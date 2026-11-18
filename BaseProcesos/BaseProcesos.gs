// BaseProcesos.gs — script vinculado a la hoja de cálculo de procesos (Extensiones > Apps Script).
// Contiene: depuración (etapas 1–5 y catálogos CAT_), esquema de la base y estandarización
// (estructura 00–07, migración de General, calidad, informe y respaldos). Menús: "Depuración de datos" y "Estandarización".

// Depuración y control de calidad de la base de procesos judiciales.
const CONFIG = {
  HOJA_ORIGEN: "General",
  HOJA_LIMPIA: "BASE_LIMPIA",
  HOJA_VACIOS: "REPORTE_VACIOS",
  HOJA_COMPARATIVA: "COMPARATIVA",
  HOJA_REVISION: "REVISION_MANUAL",
  HOJA_BITACORA: "BITACORA_CAMBIOS",

  // Máximo de ubicaciones por fila en el reporte de vacíos
  MAX_UBICACIONES_POR_FILA: 500,

  // Filas por bloque al escribir en las hojas
  BLOQUE_ESCRITURA: 500
};


// Crea el menú al abrir el libro
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Depuración de datos")
    .addItem("1. Generar base limpia", "generarBaseLimpia")
    .addItem("2. Reportar vacíos", "generarReporteVacios")
    .addItem("3. Comparar original vs limpia", "generarComparativa")
    .addItem("4. Revisar datos manualmente", "generarReporteRevisionManual")
    .addItem("5. Generar bitácora", "generarBitacoraCambios")
    .addSeparator()
    .addItem("Ejecutar todas las etapas", "ejecutarTodasLasEtapas")
    .addSeparator()
    .addItem("Generar los 6 catálogos (CAT_)", "generarLos6Catalogos")
    .addToUi();

  // Estandarización de la base (parte 3): estructura, migración, calidad y respaldos.
  SpreadsheetApp.getUi()
    .createMenu("Estandarización")
    .addItem("1. Crear estructura de la base (00–07)", "crearEstructuraBase")
    .addItem("2. Migrar General a la nueva estructura", "migrarANuevaEstructura")
    .addItem("3. Depurar catálogos y valores de 01_PROCESOS (base limpia)", "depurarProcesos")
    .addItem("   Solo depurar catálogos (04, sin repetidos)", "depurarCatalogos")
    .addItem("4. Validar calidad (06_PENDIENTES_CALIDAD)", "validarCalidadBase")
    .addItem("5. Informe de calidad (antes / después)", "generarInformeCalidad")
    .addSeparator()
    .addItem("Reparar fórmulas (04) y recalcular 05", "repararFormulas")
    .addItem("Actualizar 05_VISTA_GENERAL ahora", "actualizarVistaGeneral")
    .addItem("Reaplicar validaciones y protecciones", "aplicarValidacionesYProtecciones")
    .addItem("Eliminar columna ID_APLICACION de General", "eliminarColumnaIdAplicacion")
    .addItem("Crear respaldo ahora", "crearRespaldo")
    .addItem("Programar control diario y respaldo semanal", "programarAutomatizaciones")
    .addToUi();
}


//Funciones generales
function obtenerLibro() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// Busca una hoja por nombre; lanza error si no existe
function obtenerHoja(nombre) {
  const hoja = obtenerLibro().getSheetByName(nombre);

  if (!hoja) {
    throw new Error(
      'No se encontró la hoja "' + nombre + '".'
    );
  }

  return hoja;
}

// Devuelve la hoja o la crea si no existe
function obtenerOCrearHoja(nombre) {
  const libro = obtenerLibro();
  let hoja = libro.getSheetByName(nombre);

  if (!hoja) {
    hoja = libro.insertSheet(nombre);
  }

  return hoja;
}

// Deja la hoja lista para escribir (la crea y borra su contenido)
function prepararHoja(nombre) {
  const hoja = obtenerOCrearHoja(nombre);

  hoja.clearContents();

  return hoja;
}

// Agrega filas/columnas si la hoja no alcanza para los datos
function asegurarDimensiones(hoja, filas, columnas) {
  if (filas > hoja.getMaxRows()) {
    hoja.insertRowsAfter(
      hoja.getMaxRows(),
      filas - hoja.getMaxRows()
    );
  }

  if (columnas > hoja.getMaxColumns()) {
    hoja.insertColumnsAfter(
      hoja.getMaxColumns(),
      columnas - hoja.getMaxColumns()
    );
  }
}

// Escribe los datos en bloques para no saturar la hoja
function escribirPorBloques(hoja, datos, filaInicial, columnaInicial) {
  if (!datos || datos.length === 0) return;

  const columnas = datos[0].length;

  asegurarDimensiones(
    hoja,
    filaInicial + datos.length - 1,
    columnaInicial + columnas - 1
  );

  const tamano = CONFIG.BLOQUE_ESCRITURA;

  for (let i = 0; i < datos.length; i += tamano) {
    const bloque = datos.slice(i, i + tamano);

    esqEscribirValores_(hoja.getRange(
      filaInicial + i,
      columnaInicial,
      bloque.length,
      columnas
    ), bloque);
  }
}

// Limpia espacios raros, saltos de línea repetidos y bordes
function normalizarTexto(valor) {
  if (valor === null || valor === undefined) {
    return "";
  }

  return String(valor)
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// True si el valor es nulo o solo tiene espacios
function esVacio(valor) {
  return valor === null ||
    valor === undefined ||
    String(valor).trim() === "";
}


// Convierte número de columna a letra (1 -> A, 27 -> AA)
function nombreColumna(numero) {
  let resultado = "";

  while (numero > 0) {
    const residuo = (numero - 1) % 26;

    resultado =
      String.fromCharCode(65 + residuo) + resultado;

    numero = Math.floor((numero - 1) / 26);
  }

  return resultado;
}

// Muestra un aviso temporal en la hoja
function mostrarMensaje(mensaje) {
  SpreadsheetApp.getActiveSpreadsheet().toast(
    mensaje,
    "Depuración de datos",
    8
  );
}

// Etapa 1
// Normaliza solo los textos; números y fechas quedan igual.

function generarBaseLimpia() {
  const inicio = new Date();

  const origen = obtenerHoja(CONFIG.HOJA_ORIGEN);

  const datos = origen.getDataRange().getValues();

  if (datos.length < 2) {
    throw new Error("La hoja original no contiene registros suficientes.");
  }

  const encabezados = datos[0];

  // Recorre cada celda y normaliza solo los textos (sin tocar encabezados)
  const resultado = datos.map((fila, indiceFila) => {
    return fila.map((valor, indiceColumna) => {
      if (indiceFila === 0) return valor;

      if (typeof valor === "string") {
        return normalizarTexto(valor);
      }

      return valor;
    });
  });

  const destino = prepararHoja(CONFIG.HOJA_LIMPIA);

  // Columnas de identificadores (radicados de 23 dígitos, cédulas...) como texto plano: sin esto,
  // Sheets convierte la cadena en número y se pierden dígitos.
  for (let col = 0; col < encabezados.length; col++) {
    const valores = resultado.slice(1).map(fila => fila[col]).filter(valor => !esVacio(valor));
    const soloTexto = valores.length > 0 && valores.every(valor => typeof valor === "string");
    const identificador = valores.some(valor => typeof valor === "string" && /^\d{12,}$/.test(valor.replace(/[\s.-]/g, "")));
    if (soloTexto || identificador) {
      asegurarDimensiones(destino, resultado.length, col + 1);
      destino.getRange(1, col + 1, resultado.length, 1).setNumberFormat("@");
    }
  }

  escribirPorBloques(destino, resultado, 1, 1);

  // Formato del encabezado
  destino.setFrozenRows(1);

  destino.getRange(
    1,
    1,
    1,
    encabezados.length
  ).setFontWeight("bold");

  // Guarda datos de la ejecución para las etapas siguientes
  PropertiesService.getScriptProperties()
    .setProperty("HOJA_ORIGEN_DEPURACION", CONFIG.HOJA_ORIGEN);

  PropertiesService.getScriptProperties()
    .setProperty("FILAS_BASE_DEPURACION", String(datos.length));

  PropertiesService.getScriptProperties()
    .setProperty("COLUMNAS_BASE_DEPURACION", String(encabezados.length));

  const segundos = ((new Date() - inicio) / 1000).toFixed(2);

  mostrarMensaje(
    "BASE_LIMPIA generada. " +
    (datos.length - 1) +
    " registros. Tiempo: " + segundos + " s."
  );

  Logger.log("ETAPA 1 - BASE LIMPIA");
  Logger.log("Hoja origen: " + CONFIG.HOJA_ORIGEN);
  Logger.log("Registros: " + (datos.length - 1));
  Logger.log("Columnas: " + encabezados.length);
  Logger.log("Tiempo: " + segundos + " segundos");
}


// Etapa 2
// Lista las celdas vacías por columna; si son muchas, divide en varias filas.

function generarReporteVacios() {
  const inicio = new Date();

  const hoja = obtenerHoja(CONFIG.HOJA_LIMPIA);

  const datos = hoja.getDataRange().getValues();

  if (datos.length < 2) {
    throw new Error("BASE_LIMPIA no contiene registros.");
  }

  const encabezados = datos[0];
  const totalRegistros = datos.length - 1;

  const reporte = [[
    "Columna",
    "Campo",
    "Cantidad de vacíos",
    "Fila inicial",
    "Fila final",
    "Ubicaciones de celdas vacías"
  ]];

  // Recorre cada columna buscando celdas vacías
  for (let col = 0; col < encabezados.length; col++) {
    let cantidad = 0;
    const ubicaciones = [];

    for (let fila = 1; fila < datos.length; fila++) {
      if (esVacio(datos[fila][col])) {
        cantidad++;

        ubicaciones.push(
          nombreColumna(col + 1) + (fila + 1)
        );
      }
    }

    // Si la columna no tiene vacíos, se omite
    if (cantidad === 0) continue;

    // Divide las ubicaciones en bloques del tamaño máximo permitido
    const bloques = [];

    for (
      let i = 0;
      i < ubicaciones.length;
      i += CONFIG.MAX_UBICACIONES_POR_FILA
    ) {
      bloques.push(
        ubicaciones.slice(
          i,
          i + CONFIG.MAX_UBICACIONES_POR_FILA
        )
      );
    }

    // Una fila del reporte por cada bloque
    bloques.forEach((bloque, indice) => {
      reporte.push([
        nombreColumna(col + 1),
        encabezados[col],
        indice === 0 ? cantidad : "",
        indice === 0 ? 2 : "",
        indice === 0 ? datos.length : "",
        bloque.join(", ")
      ]);
    });
  }

  const destino = prepararHoja(CONFIG.HOJA_VACIOS);

  escribirPorBloques(destino, reporte, 1, 1);

  destino.setFrozenRows(1);
  destino.getRange(1, 1, 1, 6).setFontWeight("bold");

  destino.autoResizeColumns(1, 5);

  const segundos = ((new Date() - inicio) / 1000).toFixed(2);

  mostrarMensaje(
    "Reporte de vacíos generado. Tiempo: " + segundos + " s."
  );

  Logger.log("ETAPA 2 - REPORTE DE VACÍOS");
  Logger.log("Registros analizados: " + totalRegistros);
  Logger.log("Campos con vacíos: " + (reporte.length - 1));
  Logger.log("Tiempo: " + segundos + " segundos");
}


// Etapa 3
// Compara la hoja original con BASE_LIMPIA celda por celda.

function generarComparativa() {
  const inicio = new Date();

  const origenNombre = PropertiesService
    .getScriptProperties()
    .getProperty("HOJA_ORIGEN_DEPURACION") || CONFIG.HOJA_ORIGEN;

  const origen = obtenerHoja(origenNombre);
  const limpia = obtenerHoja(CONFIG.HOJA_LIMPIA);

  const original = origen.getDataRange().getValues();
  const depurada = limpia.getDataRange().getValues();

  const filas = Math.min(original.length, depurada.length);
  const columnas = Math.min(
    original[0].length,
    depurada[0].length
  );

  // Resumen es diferencias por columna
  const resumen = [[
    "Columna",
    "Campo",
    "Cantidad de diferencias"
  ]];

  // Detalle es cada celda que cambió
  const detalle = [[
    "Fila",
    "Celda",
    "Campo",
    "Valor original",
    "Valor limpio"
  ]];

  for (let col = 0; col < columnas; col++) {
    let cantidad = 0;

    for (let fila = 1; fila < filas; fila++) {
      const valorOriginal = original[fila][col];
      const valorLimpio = depurada[fila][col];

      // Si el valor cambió, se registra en el detalle
      if (
        String(valorOriginal ?? "") !==
        String(valorLimpio ?? "")
      ) {
        cantidad++;

        detalle.push([
          fila + 1,
          nombreColumna(col + 1) + (fila + 1),
          original[0][col],
          String(valorOriginal ?? ""),
          String(valorLimpio ?? "")
        ]);
      }
    }

    if (cantidad > 0) {
      resumen.push([
        nombreColumna(col + 1),
        original[0][col],
        cantidad
      ]);
    }
  }

  const destino = prepararHoja(CONFIG.HOJA_COMPARATIVA);

  // Primero el resumen, luego el detalle debajo
  escribirPorBloques(destino, resumen, 1, 1);

  const filaDetalle = resumen.length + 3;

  escribirPorBloques(
    destino,
    [["DETALLE DE DIFERENCIAS"]],
    filaDetalle,
    1
  );

  escribirPorBloques(
    destino,
    detalle,
    filaDetalle + 1,
    1
  );

  destino.setFrozenRows(1);

  mostrarMensaje(
    "Comparativa generada. Diferencias: " +
    (detalle.length - 1)
  );

  Logger.log("ETAPA 3 - COMPARATIVA");
  Logger.log("Diferencias detectadas: " + (detalle.length - 1));
}


// Etapa 4
// No corrige nada; solo señala casos para validar a mano:
function generarReporteRevisionManual() {
  const inicio = new Date();

  const origenNombre = PropertiesService
    .getScriptProperties()
    .getProperty("HOJA_ORIGEN_DEPURACION") || CONFIG.HOJA_ORIGEN;

  const origen = obtenerHoja(origenNombre);
  const limpia = obtenerHoja(CONFIG.HOJA_LIMPIA);

  const original = origen.getDataRange().getValues();
  const depurada = limpia.getDataRange().getValues();

  const encabezados = depurada[0].map(
    valor => normalizarTexto(valor).toUpperCase()
  );

  // Ubica las columnas a validar según su encabezado
  const indiceRadicado = encabezados.indexOf("RADICADO");

  const indiceCorto = encabezados.findIndex(
    valor => valor.includes("NO. CORTO") ||
      valor.includes("N° CORTO") ||
      valor.includes("NUMERO CORTO") ||
      valor.includes("NÚMERO CORTO")
  );

  const reporte = [[
    "Fila",
    "Celda",
    "Campo",
    "Valor encontrado",
    "Motivo de revisión",
    "Acción sugerida"
  ]];

  for (let fila = 1; fila < depurada.length; fila++) {

    // Valida el formato del radicado 23 dígitos
    if (indiceRadicado >= 0) {
      const valor = normalizarTexto(
        depurada[fila][indiceRadicado]
      );

      if (
        valor !== "" &&
        !/^\d{23}$/.test(valor)
      ) {
        reporte.push([
          fila + 1,
          nombreColumna(indiceRadicado + 1) + (fila + 1),
          encabezados[indiceRadicado],
          valor,
          "El radicado no cumple el formato de 23 dígitos.",
          "Verificar contra el expediente o fuente oficial."
        ]);
      }
    }

    // Valida el formato del número corto AAAA-NNNNN
    if (indiceCorto >= 0) {
      const valor = normalizarTexto(
        depurada[fila][indiceCorto]
      );

      if (
        valor !== "" &&
        !/^\d{4}-\d{5}$/.test(valor)
      ) {
        reporte.push([
          fila + 1,
          nombreColumna(indiceCorto + 1) + (fila + 1),
          encabezados[indiceCorto],
          valor,
          "El número corto no cumple AAAA-NNNNN.",
          "Validar y estandarizar manualmente."
        ]);
      }
    }

    // Marca los textos que cambiaron al limpiarlos
    for (let col = 0; col < depurada[fila].length; col++) {
      const valorOriginal = original[fila]?.[col];
      const valorLimpio = depurada[fila][col];

      if (
        typeof valorOriginal === "string" &&
        valorOriginal !== valorLimpio
      ) {
        reporte.push([
          fila + 1,
          nombreColumna(col + 1) + (fila + 1),
          encabezados[col],
          valorOriginal,
          "Se normalizaron espacios o saltos de línea.",
          "Confirmar que el texto conserva su significado."
        ]);
      }
    }
  }

  const destino = prepararHoja(CONFIG.HOJA_REVISION);

  escribirPorBloques(destino, reporte, 1, 1);

  destino.setFrozenRows(1);

  mostrarMensaje(
    "Revisión manual generada. Hallazgos: " +
    (reporte.length - 1)
  );

  Logger.log("ETAPA 4 - REVISIÓN MANUAL");
  Logger.log("Hallazgos: " + (reporte.length - 1));
}


// Etapa 5
// Registra cada celda que cambió entre la original y la limpia.

function generarBitacoraCambios() {
  const inicio = new Date();

  const origenNombre = PropertiesService
    .getScriptProperties()
    .getProperty("HOJA_ORIGEN_DEPURACION") || CONFIG.HOJA_ORIGEN;

  const origen = obtenerHoja(origenNombre);
  const limpia = obtenerHoja(CONFIG.HOJA_LIMPIA);

  const original = origen.getDataRange().getValues();
  const depurada = limpia.getDataRange().getValues();

  const bitacora = [[
    "Fecha de ejecución",
    "Fila",
    "Celda",
    "Campo",
    "Valor anterior",
    "Valor nuevo",
    "Tipo de cambio"
  ]];

  const fecha = new Date();

  // Registra cada celda cuyo valor cambió
  for (let fila = 1; fila < depurada.length; fila++) {
    for (let col = 0; col < depurada[fila].length; col++) {
      const antes = original[fila]?.[col];
      const despues = depurada[fila][col];

      if (
        String(antes ?? "") !==
        String(despues ?? "")
      ) {
        bitacora.push([
          fecha,
          fila + 1,
          nombreColumna(col + 1) + (fila + 1),
          depurada[0][col],
          String(antes ?? ""),
          String(despues ?? ""),
          "Normalización de texto"
        ]);
      }
    }
  }

  const destino = prepararHoja(CONFIG.HOJA_BITACORA);

  escribirPorBloques(destino, bitacora, 1, 1);

  destino.setFrozenRows(1);

  mostrarMensaje(
    "Bitácora generada. Cambios: " + (bitacora.length - 1)
  );

  Logger.log("ETAPA 5 - BITÁCORA");
  Logger.log("Cambios registrados: " + (bitacora.length - 1));
}


// Ejecuta las 5 etapas en orden (opcional; se recomienda correrlas por separado)
function ejecutarTodasLasEtapas() {
  generarBaseLimpia();
  generarReporteVacios();
  generarComparativa();
  generarReporteRevisionManual();
  generarBitacoraCambios();

  mostrarMensaje("Todas las etapas finalizaron.");
}



// genera los catálogos a partir de la hoja BASE_LIMPIA
// configuración

const CONFIG_CATALOGOS = {

  HOJA_ORIGEN: 'BASE_LIMPIA',

  // nombres posibles del encabezado para cada catálogo
  COLUMNAS: {

    ESTADO: [
      'ESTADO',
      'ESTADO DEL PROCESO',
      'ESTADO PROCESO',
      'ESTADO ACTUAL',
      'SITUACION',
      'SITUACIÓN',
      'SITUACION DEL PROCESO',
      'SITUACIÓN DEL PROCESO',
      'ESTADO DEL EXPEDIENTE'
    ],

    ETAPA: [
      'ETAPA',
      'ETAPA PROCESAL',
      'ETAPA DEL PROCESO',
      'ETAPA ACTUAL',
      'ETAPA ACTUAL DEL PROCESO',
      'FASE',
      'FASE PROCESAL',
      'FASE DEL PROCESO',
      'ESTADO PROCESAL',
      'ESTADO ACTUAL DEL PROCESO'
    ],

    TIPO_PROCESO: [
      'TIPO',
      'TIPO DE PROCESO',
      'TIPO PROCESO',
      'TIPO DEL PROCESO',
      'TIPO DE PROCESO JUDICIAL',
      'CLASE DE PROCESO',
      'CLASE PROCESO',
      'TIPO DE ASUNTO'
    ],

    AREA: [
      'AREA',
      'ÁREA',
      'AREA GENERADORA',
      'ÁREA GENERADORA',
      'AREA RESPONSABLE',
      'ÁREA RESPONSABLE',
      'AREA GENERADORA DEL PROCESO',
      'ÁREA GENERADORA DEL PROCESO',
      'DEPENDENCIA',
      'DEPENDENCIA RESPONSABLE'
    ],

    ABOGADO: [
      'ABOGADO',
      'ABOGADA',
      'ABOGADO RESPONSABLE',
      'ABOGADA RESPONSABLE',
      'ASIGNADO A',
      'ASIGNADA A',
      'RESPONSABLE',
      'RESPONSABLE DEL PROCESO',
      'ABOGADO ASIGNADO',
      'ABOGADA ASIGNADA',
      'PROFESIONAL RESPONSABLE'
    ],

    DESPACHO: [
      'DESPACHO',
      'DESPACHO JUDICIAL',
      'DESPACHO ACTUAL',
      'JUZGADO',
      'JUZGADO ACTUAL',
      'TRIBUNAL',
      'TRIBUNAL ACTUAL',
      'CORPORACION',
      'CORPORACIÓN',
      'CORPORACION JUDICIAL',
      'CORPORACIÓN JUDICIAL'
    ]

  }

};


// catálogos individuales

function generarCatalogoEstados() {
  generarCatalogoDesdeColumna_('CAT_ESTADOS', 'ESTADO', CONFIG_CATALOGOS.COLUMNAS.ESTADO);
}

function generarCatalogoEtapas() {
  generarCatalogoDesdeColumna_('CAT_ETAPAS', 'ETAPA', CONFIG_CATALOGOS.COLUMNAS.ETAPA);
}

function generarCatalogoTiposProceso() {
  generarCatalogoDesdeColumna_('CAT_TIPOS_PROCESO', 'TIPO_PROCESO', CONFIG_CATALOGOS.COLUMNAS.TIPO_PROCESO);
}

function generarCatalogoAreas() {
  generarCatalogoDesdeColumna_('CAT_AREAS', 'AREA', CONFIG_CATALOGOS.COLUMNAS.AREA);
}

function generarCatalogoAbogados() {
  generarCatalogoDesdeColumna_('CAT_ABOGADOS', 'ABOGADO', CONFIG_CATALOGOS.COLUMNAS.ABOGADO);
}

function generarCatalogoDespachos() {
  generarCatalogoDesdeColumna_('CAT_DESPACHOS', 'DESPACHO', CONFIG_CATALOGOS.COLUMNAS.DESPACHO);
}


// ejecuta los 6 catálogos

function generarLos6Catalogos() {

  const tareas = [
    ['CAT_ESTADOS', generarCatalogoEstados],
    ['CAT_ETAPAS', generarCatalogoEtapas],
    ['CAT_TIPOS_PROCESO', generarCatalogoTiposProceso],
    ['CAT_AREAS', generarCatalogoAreas],
    ['CAT_ABOGADOS', generarCatalogoAbogados],
    ['CAT_DESPACHOS', generarCatalogoDespachos]
  ];

  const errores = [];

  // si uno falla, los demás se siguen generando
  tareas.forEach(function(tarea) {
    try {
      tarea[1]();
    } catch (error) {
      errores.push(tarea[0] + ': ' + error.message);
    }
  });

  // los errores se muestran al final
  if (errores.length > 0) {
    throw new Error('Fallaron algunos catálogos:\n' + errores.join('\n'));
  }

}


// función central

function generarCatalogoDesdeColumna_(nombreHojaCatalogo, nombreColumnaCatalogo, nombresPosibles) {

  const datos = obtenerDatosBaseLimpia_();

  const resultadoColumna = encontrarColumnaInteligente_(
    datos.encabezadosOriginales,
    nombresPosibles
  );

  // si no encuentra la columna, crea el catálogo vacío
  if (resultadoColumna.indice === -1) {
    escribirCatalogo_(nombreHojaCatalogo, nombreColumnaCatalogo, []);
    return;
  }

  const valores = obtenerValoresUnicos_(datos.filas, resultadoColumna.indice);

  escribirCatalogo_(nombreHojaCatalogo, nombreColumnaCatalogo, valores);

}


// lectura de BASE_LIMPIA

function obtenerDatosBaseLimpia_() {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(CONFIG_CATALOGOS.HOJA_ORIGEN);

  if (!hoja) {
    throw new Error('No existe la hoja "' + CONFIG_CATALOGOS.HOJA_ORIGEN + '".');
  }

  const ultimaFila = hoja.getLastRow();
  const ultimaColumna = hoja.getLastColumn();

  if (ultimaFila < 2) {
    throw new Error('BASE_LIMPIA no contiene registros.');
  }

  const datos = hoja.getRange(1, 1, ultimaFila, ultimaColumna).getValues();

  const encabezadosOriginales = datos[0].map(function(encabezado) {
    return String(encabezado === null || encabezado === undefined ? '' : encabezado).trim();
  });

  return {
    encabezadosOriginales: encabezadosOriginales,
    filas: datos.slice(1)
  };

}


// búsqueda de columna
function encontrarColumnaInteligente_(encabezadosOriginales, nombresPosibles) {

  const encabezados = encabezadosOriginales.map(normalizarTexto_);
  const nombres = nombresPosibles.map(normalizarTexto_);

  // 1. coincidencia exacta
  for (let i = 0; i < encabezados.length; i++) {
    if (nombres.indexOf(encabezados[i]) !== -1) {
      return { indice: i, nombre: encabezadosOriginales[i], tipo: 'EXACTA' };
    }
  }

  // 2. el encabezado contiene alguno de los nombres buscados
  for (let n = 0; n < nombres.length; n++) {

    if (!nombres[n]) {
      continue;
    }

    for (let i = 0; i < encabezados.length; i++) {
      if (encabezados[i].indexOf(nombres[n]) !== -1) {
        return { indice: i, nombre: encabezadosOriginales[i], tipo: 'PARCIAL' };
      }
    }

  }

  // 3. el encabezado comparte al menos 2 palabras clave
  const palabrasClave = obtenerPalabrasClave_(nombresPosibles);

  for (let i = 0; i < encabezados.length; i++) {

    let coincidencias = 0;

    palabrasClave.forEach(function(palabra) {
      if (encabezados[i].indexOf(palabra) !== -1) {
        coincidencias++;
      }
    });

    if (coincidencias >= 2) {
      return { indice: i, nombre: encabezadosOriginales[i], tipo: 'PALABRAS_CLAVE' };
    }

  }

  return { indice: -1, nombre: '', tipo: 'NO_ENCONTRADA' };

}


// palabras únicas de 4 o más letras sacadas de los nombres posibles
function obtenerPalabrasClave_(nombres) {

  const palabras = {};

  nombres.forEach(function(nombre) {
    normalizarTexto_(nombre).split(' ').forEach(function(palabra) {
      if (palabra.length >= 4) {
        palabras[palabra] = true;
      }
    });
  });

  return Object.keys(palabras);

}


// valores únicos
function obtenerValoresUnicos_(filas, indiceColumna) {

  // se usa un objeto como conjunto para evitar repetidos
  const conjunto = {};

  filas.forEach(function(fila) {

    if (indiceColumna >= fila.length) {
      return;
    }

    let valor = fila[indiceColumna];

    if (valor === null || valor === undefined) {
      return;
    }

    // quita espacios repetidos y de los extremos
    valor = String(valor).replace(/\s+/g, ' ').trim();

    if (valor === '') {
      return;
    }

    conjunto[valor] = true;

  });

  // orden alfabético en español
  return Object.keys(conjunto).sort(function(a, b) {
    return a.localeCompare(b, 'es', { sensitivity: 'base' });
  });

}


// escritura del catálogo
function escribirCatalogo_(nombreHoja, nombreColumna, valores) {

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hoja = ss.getSheetByName(nombreHoja);

  // crea la hoja o la limpia si ya existe
  if (!hoja) {
    hoja = ss.insertSheet(nombreHoja);
  } else {
    hoja.clearContents();
    hoja.clearFormats();
  }

  // encabezados y una fila por valor (ID, valor, ACTIVO)
  const salida = [['ID', nombreColumna, 'ACTIVO']];

  valores.forEach(function(valor, indice) {
    salida.push([indice + 1, valor, 'SI']);
  });

  hoja.getRange(1, 1, salida.length, 3).setValues(salida);

  // formato
  hoja.getRange(1, 1, 1, 3).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.autoResizeColumns(1, 3);

  // reemplaza el filtro anterior, solo si hay datos
  if (hoja.getFilter()) {
    hoja.getFilter().remove();
  }

  if (salida.length > 1) {
    hoja.getRange(1, 1, salida.length, 3).createFilter();
  }

}

// pasa a mayúsculas, sin tildes y sin espacios extra
function normalizarTexto_(texto) {

  if (texto === null || texto === undefined) {
    return '';
  }

  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

}


// =============================================================================
// PARTE 2. ESQUEMA DE LA BASE
// =============================================================================

// =============================================================================
// ESQUEMA DE LA BASE DE SEGUIMIENTO DE PROCESOS JUDICIALES
// -----------------------------------------------------------------------------
// Esta sección es IDÉNTICA en los dos archivos .gs:
//   1. BaseProcesos.gs (script de la hoja de procesos): crea las hojas, migra General,
//      aplica validaciones y protecciones.
//   2. Code.gs (aplicación web): lee y escribe en esas hojas.
// Si se cambia una columna, hay que cambiarla en los dos archivos.
//
// Sigue la "Estructura propuesta de la base" (sección 3 de la propuesta):
//   01_PROCESOS, 02_ACTUACIONES, 03_ASIGNACIONES, 04_CATALOGOS,
//   05_VISTA_GENERAL y 06_PENDIENTES_CALIDAD.
// Se agregan 00_DICCIONARIO (entregable 2: diccionario de datos) y
// 07_AUDITORIA (trazabilidad de cambios: "no se deben sobrescribir históricos").
//
// Cada columna: [ENCABEZADO, clave en la aplicación, tipo, obligatoriedad,
//                responsable, origen, definición, regla especial (opcional)]
// Tipos: id | text | date | number | datetime | flag | list | cat:<CATEGORIA>
// =============================================================================

const ESQUEMA = {
  procesos: {
    hoja: '01_PROCESOS',
    descripcion: 'Una fila por proceso. Identificación, clasificación jurídica, estado, etapa, valores, despacho y variables principales.',
    columnas: [
      ['ID_PROCESO', 'id', 'id', 'Automático', 'Sistema', 'Calculado', 'Identificador único e inmutable del proceso. Enlaza las demás pestañas.'],
      ['NO_CORTO', 'shortNo', 'text', 'Obligatorio (registro inicial)', 'Administrador', 'General: No. CORTO', 'Identificador interno del proceso (AAAA-NNNNN).', 'Formato AAAA-NNNNN'],
      ['RADICADO', 'radicado', 'text', 'Obligatorio (registro inicial)', 'Administrador', 'General: RADICADO', 'Número de radicación original del proceso.', '23 dígitos, sin espacios ni separadores; no se repite'],
      ['RADICADO_ACTUAL', 'currentRadicado', 'text', 'Obligatorio (registro inicial)', 'Administrador', 'General: RADICADO ACTUAL', 'Número de radicación vigente del proceso.'],
      ['ID_SIPROJ', 'siproJ', 'text', 'Obligatorio en seguimiento', 'Intermediario', 'General: ID SIPROJ', 'Identificador del proceso en SIPROJ.'],
      ['EXPEDIENTE_ORFEO', 'orfeo', 'text', 'Obligatorio en seguimiento', 'Intermediario', 'General: EXPEDIENTE ORFEO', 'Número de expediente en ORFEO.'],
      ['CEDULAS', 'ids', 'text', 'Obligatorio (registro inicial)', 'Administrador', 'General: CÉDULAS', 'Identificación de las personas relacionadas con el proceso.'],
      ['DEMANDANTE', 'claimant', 'text', 'Obligatorio (registro inicial)', 'Administrador', 'General: DEMANDANTE', 'Persona natural o jurídica que presenta la demanda.'],
      ['DEMANDADOS', 'defendant', 'text', 'Obligatorio (registro inicial)', 'Administrador', 'General: DEMANDADO', 'Personas o entidades demandadas (una por línea).'],
      ['AREA_GENERADORA', 'area', 'cat:AREA', 'Obligatorio en seguimiento', 'Intermediario', 'General: ÁREA GENERADORA DEL DAÑO', 'Área de la entidad relacionada con el hecho generador.'],
      ['ABOGADO_A_CARGO', 'lawyer', 'cat:ABOGADO', 'Obligatorio (registro inicial)', 'Administrador', 'General: ABOGADO A CARGO', 'Abogado responsable actual. El historial está en 03_ASIGNACIONES.'],
      ['PARTE_PROCESAL', 'quality', 'cat:PARTE_PROCESAL', 'Obligatorio (registro inicial)', 'Administrador', 'General: CALIDAD', 'Calidad procesal de la entidad (activa o pasiva).'],
      ['TIPO_VINCULACION', 'lawyerLinkType', 'cat:TIPO_VINCULACION', 'Opcional', 'Administrador', 'General: TIPO DE VINCULACIÓN DEL ABOGADO', 'Tipo de vinculación del abogado con la entidad.'],
      ['CALIDAD_REPRESENTACION', 'represents', 'cat:REPRESENTACION', 'Obligatorio (registro inicial)', 'Administrador', 'General: REPRESENTA', 'Indica si el abogado representa o es representado.'],
      ['TIPO_PROCESO', 'type', 'cat:TIPO_PROCESO', 'Obligatorio (registro inicial)', 'Administrador', 'General: TIPO DE PROCESO', 'Clasificación jurídica del proceso.'],
      ['INSTANCIA', 'instance', 'cat:INSTANCIA', 'Obligatorio (registro inicial)', 'Administrador', 'General: INSTANCIA DEL PROCESO', 'Instancia judicial en la que se encuentra el proceso.'],
      ['DESPACHO_INICIAL', 'court', 'cat:DESPACHO', 'Obligatorio (registro inicial)', 'Administrador', 'General: DESPACHO JUDICIAL INICIAL', 'Despacho ante el cual inició el proceso.'],
      ['FECHA_NOTIFICACION', 'notificationDate', 'date', 'Obligatorio (registro inicial)', 'Administrador', 'General: FECHA DE NOTIFICACIÓN DE LA DEMANDA', 'Fecha en que se notificó la demanda.'],
      ['DESPACHO_SEGUNDA_INSTANCIA', 'secondCourt', 'cat:DESPACHO', 'Condicional: si hay segunda instancia', 'Intermediario', 'General: DESPACHO DE SEGUNDA INSTANCIA', 'Despacho que conoce la segunda instancia.'],
      ['CAUSA', 'cause', 'cat:CAUSA', 'Obligatorio en seguimiento', 'Intermediario', 'General: CAUSA', 'Causa o motivo que origina el proceso.'],
      ['ETAPA', 'stage', 'cat:ETAPA', 'Obligatorio en seguimiento', 'Intermediario', 'General: ETAPAS DEL PROCESO', 'Etapa procesal actual.'],
      ['ESTADO', 'state', 'cat:ESTADO_PROCESO', 'Obligatorio en seguimiento', 'Intermediario', 'General: ESTADO DEL PROCESO', 'Estado actual: Activo, Terminado o Desvinculado.'],
      ['FECHA_TERMINACION', 'endDate', 'date', 'Condicional: obligatorio si ESTADO = Terminado', 'Intermediario', 'General: FECHA DE TERMINACIÓN', 'Fecha en que terminó el proceso.', 'Fecha; obligatoria si el estado es Terminado'],
      ['FORMA_TERMINACION', 'terminationForm', 'cat:FORMA_TERMINACION', 'Condicional: si el proceso terminó', 'Intermediario', 'Aplicación', 'Forma en que terminó el proceso.'],
      ['INSTANCIA_TERMINACION', 'terminationInstance', 'cat:INSTANCIA', 'Condicional: si el proceso terminó', 'Intermediario', 'Aplicación', 'Instancia en la que terminó el proceso.'],
      ['OBSERVACIONES_TERMINACION', 'terminationNotes', 'text', 'Condicional: justificación si es Terminado sin fecha', 'Intermediario', 'Aplicación', 'Observaciones sobre la terminación.'],
      ['PRETENSION_ASUNTO', 'claim', 'text', 'Obligatorio en seguimiento', 'Intermediario', 'General: PRETENSIÓN - ASUNTO', 'Descripción de la pretensión o asunto. Texto libre que conserva la información original.'],
      ['VALOR_PRETENSIONES', 'amount', 'number', 'Obligatorio en seguimiento', 'Intermediario', 'General: VALOR DE LAS PRETENSIONES', 'Valor económico de las pretensiones de primera instancia, en pesos colombianos (COP).', 'Número entero en COP, sin $, puntos ni comas'],
      ['VALOR_PRETENSION_RECURSO', 'appealAmount', 'number', 'Condicional: si se presentó recurso', 'Intermediario', 'Aplicación', 'Valor de la pretensión del recurso.', 'Número sin $ ni separadores'],
      ['MEDIDA_CAUTELAR', 'cautelar', 'cat:MEDIDA_CAUTELAR', 'Obligatorio (registro inicial)', 'Administrador', 'General: PRESENTA MEDIDA CAUTELAR', 'Indica si el proceso presenta medida cautelar (Sí, No, Sin datos).'],
      ['FECHA_MAX_CONTESTACION_MEDIDA', 'maxMeasureResponseDate', 'date', 'Condicional: si hay medida cautelar', 'Intermediario', 'Aplicación', 'Fecha límite para contestar la medida cautelar.'],
      ['FECHA_CONTESTACION_MEDIDA', 'measureResponseDate', 'date', 'Condicional: si hay medida cautelar', 'Intermediario', 'General: FECHA DE CONTESTACIÓN DE MEDIDA CAUTELAR', 'Fecha de contestación de la medida cautelar.'],
      ['FECHA_MAX_CONTESTACION_DEMANDA', 'maxDemandResponseDate', 'date', 'Obligatorio en seguimiento', 'Intermediario', 'General: FECHA MÁX CONTESTACIÓN DE DEMANDA', 'Fecha límite para contestar la demanda (se registra manualmente).'],
      ['FECHA_CONTESTACION_DEMANDA', 'demandResponseDate', 'date', 'Obligatorio en seguimiento', 'Intermediario', 'General: FECHA CONTESTACIÓN DEMANDA', 'Fecha efectiva de contestación de la demanda.'],
      ['SENTENCIA_ANTICIPADA', 'anticipatedJudgment', 'cat:SI_NO', 'Obligatorio en seguimiento', 'Intermediario', 'Calculado en la migración', 'Indica si hubo sentencia anticipada.'],
      ['FECHA_AUDIENCIA_INICIAL', 'initialAudienceDate', 'date', 'Obligatorio en seguimiento', 'Intermediario', 'General: AUDIENCIA INICIAL', 'Fecha de la audiencia inicial.'],
      ['FECHA_AUDIENCIA_PRUEBAS', 'evidenceAudienceDate', 'date', 'Condicional: sin sentencia anticipada', 'Intermediario', 'General: PRUEBAS (cuando es fecha)', 'Fecha de la audiencia de pruebas.'],
      ['FECHA_MAX_ALEGATOS', 'maxClosingArgumentsDate', 'date', 'Condicional: sin sentencia anticipada', 'Intermediario', 'Aplicación', 'Fecha límite de alegatos de conclusión.'],
      ['FECHA_ALEGATOS', 'closingArgumentsDate', 'date', 'Condicional: sin sentencia anticipada', 'Intermediario', 'General: FECHA DE ALEGATOS DE CONCLUSIÓN', 'Fecha de presentación de alegatos.'],
      ['FECHA_FALLO_PRIMERA', 'firstInstanceDecisionDate', 'date', 'Obligatorio en seguimiento', 'Intermediario', 'General: FECHA DE FALLO DE PRIMERA INSTANCIA', 'Fecha del fallo de primera instancia.'],
      ['SENTIDO_FALLO_PRIMERA', 'firstInstanceDecisionSense', 'cat:SENTIDO_FALLO', 'Obligatorio en seguimiento', 'Intermediario', 'General: SENTIDO DEL FALLO PRIMERA INSTANCIA', 'Sentido del fallo: Favorable, Desfavorable, Mixto o Inhibitorio.'],
      ['ESTADO_RECURSO', 'appealStatus', 'cat:ESTADO_RECURSO', 'Obligatorio en seguimiento', 'Intermediario', 'Calculado en la migración', 'Estado del recurso de apelación.'],
      ['FECHA_MAX_RECURSO', 'maxAppealDate', 'date', 'Condicional: si aplica recurso', 'Intermediario', 'Aplicación', 'Fecha límite para presentar el recurso.'],
      ['FECHA_RECURSO', 'appealDate', 'date', 'Condicional: si se presentó recurso', 'Intermediario', 'General: FECHA DE PRESENTACIÓN DEL RECURSO', 'Fecha en que se presentó el recurso.'],
      ['FECHA_AUTO_CONCEDE_APELACION', 'appealGrantedOrderDate', 'date', 'Condicional: si hay segunda instancia', 'Intermediario', 'Aplicación', 'Fecha del auto que concede la apelación.'],
      ['FECHA_AUTO_ADMITE_APELACION', 'appealAdmittedOrderDate', 'date', 'Condicional: si hay segunda instancia', 'Intermediario', 'Aplicación', 'Fecha del auto que admite la apelación.'],
      ['FECHA_MAX_ANUNCIO_RECURSO', 'maxAppealAnnouncementDate', 'date', 'Obligatorio en seguimiento', 'Intermediario', 'Aplicación', 'Fecha máxima del anuncio del recurso.'],
      ['FECHA_FALLO_SEGUNDA', 'secondInstanceDecisionDate', 'date', 'Condicional: si hay segunda instancia', 'Intermediario', 'General: FECHA FALLO 2DA INSTANCIA', 'Fecha del fallo de segunda instancia.'],
      ['SENTIDO_FALLO_SEGUNDA', 'secondInstanceDecisionSense', 'cat:SENTIDO_FALLO', 'Condicional: si hay segunda instancia', 'Intermediario', 'General: FALLO DE SEGUNDA INSTANCIA', 'Sentido del fallo de segunda instancia.'],
      ['DETALLE_FALLO_SEGUNDA', 'secondInstanceDecision', 'text', 'Opcional', 'Intermediario', 'General: FALLO DE SEGUNDA INSTANCIA (texto)', 'Detalle del fallo de segunda instancia.'],
      ['INFORME_JEFATURA', 'report', 'text', 'Opcional', 'Intermediario', 'General: INFORME', 'Información de seguimiento destinada a la jefatura.'],
      ['OBSERVACIONES', 'notes', 'text', 'Opcional', 'Intermediario', 'General (valores sin campo propio)', 'Observaciones. Aquí van los valores excepcionales, sin contaminar la variable principal.'],
      ['INCOMPLETO', 'incomplete', 'flag', 'Automático', 'Sistema', 'Calculado', 'SI cuando faltan campos obligatorios según el rol que guardó.'],
      ['CAMPOS_FALTANTES', 'missingFields', 'list', 'Automático', 'Sistema', 'Calculado', 'Campos obligatorios sin diligenciar, separados por |.'],
      ['ESTADO_REGISTRO', 'recordStatus', 'cat:ESTADO_REGISTRO', 'Automático', 'Sistema', 'Calculado', 'ACTIVO o ELIMINADO. Los procesos no se borran: se marcan como eliminados.'],
      ['ORIGEN', 'origin', 'text', 'Automático', 'Sistema', 'Calculado', 'Procedencia del registro (fila de General o aplicación).'],
      ['CREADO_EN', 'createdAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Fecha y hora de creación (ISO).'],
      ['CREADO_POR', 'createdBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Usuario que creó el registro.'],
      ['ACTUALIZADO_EN', 'updatedAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Fecha y hora de la última actualización (ISO).'],
      ['ACTUALIZADO_POR', 'updatedBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Usuario o proceso que hizo la última actualización.'],
      ['ULTIMA_EDICION_INTERMEDIARIO', 'lastIntermediaryEditAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Última edición hecha por un intermediario.'],
      ['ULTIMA_EDICION_INTERMEDIARIO_POR', 'lastIntermediaryEditBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Intermediario que hizo la última edición.']
    ]
  },
  actuaciones: {
    hoja: '02_ACTUACIONES',
    descripcion: 'Una fila por actuación (también diligencias y comités de conciliación). Histórico procesal sin repetir columnas.',
    columnas: [
      ['ID_ACTUACION', 'id', 'id', 'Automático', 'Sistema', 'Calculado', 'Identificador único de la actuación.'],
      ['ID_PROCESO', 'processId', 'id', 'Obligatorio', 'Sistema', 'Calculado', 'Proceso al que pertenece (01_PROCESOS).'],
      ['RADICADO', 'radicado', 'text', 'Automático', 'Sistema', 'Calculado', 'Radicado del proceso al momento del registro.'],
      ['CLASE', 'clase', 'cat:CLASE_REGISTRO', 'Obligatorio', 'Sistema', 'Calculado', 'ACTUACION, DILIGENCIA o COMITE.'],
      ['FECHA', 'date', 'date', 'Obligatorio', 'Intermediario', 'General: bloques FECHA', 'Fecha en que ocurrió la actuación.'],
      ['FUENTE', 'source', 'cat:FUENTE', 'Obligatorio', 'Intermediario', 'Calculado', 'De dónde proviene la actuación.'],
      ['TIPO', 'type', 'cat:TIPO_REGISTRO', 'Obligatorio', 'Intermediario', 'General: bloques TIPO', 'Tipo de actuación, diligencia o comité. Lista cerrada: TIPO_ACTUACION + TIPO_DILIGENCIA + TIPO_COMITE (04_CATALOGOS).'],
      ['TITULO', 'title', 'text', 'Obligatorio', 'Intermediario', 'General: bloques TIPO', 'Resumen corto.'],
      ['DESCRIPCION', 'description', 'text', 'Obligatorio', 'Intermediario', 'General: bloques DESCRIPCIÓN', 'Descripción de la actuación.'],
      ['ESTADO', 'status', 'cat:ESTADO_ACTUACION', 'Opcional', 'Intermediario', 'Aplicación', 'Estado de la actuación.'],
      ['FECHA_VENCIMIENTO', 'dueDate', 'date', 'Opcional', 'Intermediario', 'Aplicación', 'Fecha de vencimiento.'],
      ['NUMERO_SESION', 'sessionNumber', 'text', 'Condicional: diligencias y comités', 'Intermediario', 'Aplicación', 'Número de sesión.'],
      ['DESPACHO', 'court', 'cat:DESPACHO', 'Condicional: diligencias', 'Intermediario', 'Aplicación', 'Despacho de la diligencia.'],
      ['FECHA_REGISTRO', 'registrationDate', 'date', 'Automático', 'Sistema', 'Calculado', 'Fecha en que se registró.'],
      ['REGISTRADO_POR', 'registeredBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Usuario o proceso que la registró.'],
      ['CREADO_EN', 'createdAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Fecha y hora de creación (ISO).'],
      ['ACTUALIZADO_EN', 'updatedAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Fecha y hora de la última edición (la versión anterior queda en 07_AUDITORIA).'],
      ['ACTUALIZADO_POR', 'updatedBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Usuario de la última edición.']
    ]
  },
  asignaciones: {
    hoja: '03_ASIGNACIONES',
    descripcion: 'Historial de responsables del proceso con fecha de inicio y fin.',
    columnas: [
      ['ID_ASIGNACION', 'id', 'id', 'Automático', 'Sistema', 'Calculado', 'Identificador de la asignación.'],
      ['ID_PROCESO', 'processId', 'id', 'Obligatorio', 'Sistema', 'Calculado', 'Proceso asignado.'],
      ['RADICADO', 'radicado', 'text', 'Automático', 'Sistema', 'Calculado', 'Radicado del proceso.'],
      ['ABOGADO', 'lawyer', 'cat:ABOGADO', 'Obligatorio', 'Administrador', 'General: ABOGADO A CARGO', 'Abogado responsable en el periodo.'],
      ['TIPO_VINCULACION', 'lawyerLinkType', 'cat:TIPO_VINCULACION', 'Opcional', 'Administrador', 'General: TIPO DE VINCULACIÓN DEL ABOGADO', 'Vinculación del abogado en el periodo.'],
      ['FECHA_INICIO', 'startDate', 'date', 'Obligatorio', 'Coordinación', 'General: FECHA ASIGNACIÓN', 'Inicio de la responsabilidad.'],
      ['FECHA_FIN', 'endDate', 'date', 'Automático', 'Sistema', 'Calculado', 'Fin de la responsabilidad (vacío = asignación vigente).'],
      ['ORIGEN', 'origin', 'text', 'Automático', 'Sistema', 'Calculado', 'Migración o aplicación.'],
      ['REGISTRADO_POR', 'registeredBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Usuario que registró el cambio.'],
      ['REGISTRADO_EN', 'registeredAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Fecha y hora del registro (ISO).'],
      ['OBSERVACION', 'note', 'text', 'Opcional', 'Coordinación', 'Aplicación', 'Observación sobre la asignación.']
    ]
  },
  catalogos: {
    hoja: '04_CATALOGOS',
    descripcion: 'Listas cerradas administrables. Alimentan los desplegables y las validaciones de datos.',
    columnas: [
      ['CATEGORIA', 'category', 'text', 'Obligatorio', 'Coordinación', 'Institucional', 'Nombre del catálogo.'],
      ['VALOR', 'value', 'text', 'Obligatorio', 'Coordinación', 'Institucional', 'Valor permitido.'],
      ['ACTIVO', 'active', 'flag', 'Obligatorio', 'Coordinación', 'Institucional', 'SI = disponible; NO = histórico (no se borra).'],
      ['ORIGEN', 'origin', 'text', 'Automático', 'Sistema', 'Calculado', 'INSTITUCIONAL, BASE GENERAL o APLICACIÓN.'],
      ['ACTUALIZADO_POR', 'updatedBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Usuario de la última actualización.'],
      ['FECHA_ACTUALIZACION', 'updatedAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Fecha y hora de la última actualización.']
    ]
  },
  pendientes: {
    hoja: '06_PENDIENTES_CALIDAD',
    descripcion: 'Un registro por proceso con todas sus incidencias en celdas multilínea. Los cierres individuales quedan en 07_AUDITORIA.',
    columnas: [
      ['ID_PENDIENTE', 'id', 'id', 'Automático', 'Sistema', 'Calculado', 'Identificador único del registro de calidad del proceso.'],
      ['ID_PROCESO', 'processId', 'id', 'Obligatorio', 'Sistema', 'Calculado', 'Proceso al que pertenece el registro.'],
      ['NO_CORTO', 'shortNo', 'text', 'Automático', 'Sistema', 'Calculado', 'No. corto del proceso, tal como está en 01_PROCESOS.'],
      ['RADICADO', 'radicado', 'text', 'Automático', 'Sistema', 'Calculado', 'Radicado del proceso, tal como está en 01_PROCESOS.'],
      ['ABOGADO_A_CARGO', 'lawyer', 'text', 'Automático', 'Sistema', 'Calculado', 'Abogado a cargo del proceso.'],
      ['PRIORIDAD', 'priority', 'text', 'Automático', 'Sistema', 'Calculado', 'Prioridad más alta entre las incidencias del proceso.'],
      ['TIPO_PROBLEMA', 'problemType', 'text', 'Automático', 'Sistema', 'Calculado', 'Tipos de incidencia, uno por línea en el mismo orden de DETALLE.'],
      ['CAMPO', 'field', 'text', 'Automático', 'Sistema', 'Calculado', 'Campos que hay que corregir, uno por línea en el mismo orden de DETALLE.'],
      ['NOMBRE_CAMPO', 'fieldLabel', 'text', 'Automático', 'Sistema', 'Calculado', 'Nombres legibles de los campos, uno por línea en el mismo orden de DETALLE.'],
      ['QUE_ESTA_MAL', 'problem', 'text', 'Automático', 'Sistema', 'Calculado', 'Incidencias detectadas, una por línea en el mismo orden de DETALLE.'],
      ['VALOR_ENCONTRADO', 'value', 'text', 'Automático', 'Sistema', 'Calculado', 'Valores que causan las incidencias, uno por línea en el mismo orden de DETALLE.'],
      ['QUE_HACER', 'howTo', 'text', 'Automático', 'Sistema', 'Calculado', 'Indicaciones para corregir, una por línea en el mismo orden de DETALLE.'],
      ['RESPONSABLE', 'responsible', 'text', 'Obligatorio', 'Coordinación', 'Calculado', 'Roles responsables de corregir las incidencias.'],
      ['CLASIFICACION', 'classification', 'cat:CLASIFICACION_CALIDAD', 'Obligatorio', 'Sistema', 'Calculado', 'REQUIERE REVISIÓN JURÍDICA (lo corregido automáticamente no entra).'],
      ['ESTADO', 'status', 'cat:ESTADO_PENDIENTE', 'Obligatorio', 'Coordinación', 'Calculado', 'PENDIENTE, RESUELTO o DESCARTADO.'],
      ['ORIGEN', 'origin', 'text', 'Automático', 'Sistema', 'Calculado', 'MIGRACIÓN, DEPURACIÓN, CONTROL AUTOMÁTICO o APLICACIÓN.'],
      ['FILA_GENERAL', 'sourceRow', 'text', 'Automático', 'Sistema', 'Calculado', 'Fila de origen (si aplica).'],
      ['FECHA_DETECCION', 'detectedAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Cuándo se detectó la primera incidencia pendiente.'],
      ['ACTUALIZADO_EN', 'updatedAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Última vez que cambió el registro.'],
      ['FECHA_RESOLUCION', 'resolvedAt', 'datetime', 'Opcional', 'Coordinación', 'Manual', 'Cuándo se cerró la última incidencia pendiente.'],
      ['RESUELTO_POR', 'resolvedBy', 'text', 'Opcional', 'Coordinación', 'Manual', 'Quién cerró la última incidencia pendiente.'],
      ['OBSERVACION_RESOLUCION', 'resolutionNote', 'text', 'Opcional', 'Coordinación', 'Manual', 'Historial de cierres y decisiones del proceso.'],
      ['DETALLE', 'detail', 'text', 'Automático', 'Sistema', 'Calculado', 'Todas las incidencias pendientes, separadas por | y conservadas completas.'],
      ['CANTIDAD_PUNTOS', 'count', 'number', 'Automático', 'Sistema', 'Calculado', 'Cantidad de incidencias pendientes del proceso.']
    ]
  },
  auditoria: {
    hoja: '07_AUDITORIA',
    descripcion: 'Trazabilidad: una fila por cada campo modificado de un proceso o de una actuación, con su valor anterior y su valor nuevo.',
    columnas: [
      ['ID_AUDITORIA', 'id', 'id', 'Automático', 'Sistema', 'Calculado', 'Identificador de la fila de auditoría.'],
      ['ID_PROCESO', 'processId', 'id', 'Automático', 'Sistema', 'Calculado', 'Proceso al que pertenece el cambio.'],
      ['NO_CORTO', 'processShortNo', 'text', 'Automático', 'Sistema', 'Calculado', 'No. corto del proceso que se modificó (como estaba en 01_PROCESOS al registrar el cambio), para ubicarlo sin buscar el ID.'],
      ['RADICADO', 'processRadicado', 'text', 'Automático', 'Sistema', 'Calculado', 'Radicado del proceso que se modificó (como estaba en 01_PROCESOS al registrar el cambio).'],
      ['FECHA_CAMBIO', 'changedAt', 'datetime', 'Automático', 'Sistema', 'Calculado', 'Fecha y hora del cambio.'],
      ['MODIFICADO_POR', 'changedBy', 'text', 'Automático', 'Sistema', 'Calculado', 'Usuario o proceso que hizo el cambio.'],
      ['ORIGEN', 'origin', 'text', 'Automático', 'Sistema', 'Calculado', 'APLICACIÓN, DEPURACIÓN o APLICACIÓN ANTERIOR.'],
      ['TIPO_REGISTRO', 'recordType', 'text', 'Automático', 'Sistema', 'Calculado', 'PROCESO, ACTUACION, DILIGENCIA o COMITE.'],
      ['ID_REGISTRO', 'recordId', 'text', 'Automático', 'Sistema', 'Calculado', 'Proceso o actuación modificada (ID de 01_PROCESOS o de 02_ACTUACIONES).'],
      ['CAMPO', 'field', 'text', 'Automático', 'Sistema', 'Calculado', 'Columna modificada (nombre en 01_PROCESOS o 02_ACTUACIONES). REGISTRO_NUEVO cuando se agregó una actuación, diligencia o comité.'],
      ['VALOR_ANTERIOR', 'previousValue', 'text', 'Automático', 'Sistema', 'Calculado', 'Valor antes del cambio.'],
      ['VALOR_NUEVO', 'newValue', 'text', 'Automático', 'Sistema', 'Calculado', 'Valor después del cambio.']
    ]
  }
};

const HOJA_VISTA_GENERAL = '05_VISTA_GENERAL';
const HOJA_DICCIONARIO = '00_DICCIONARIO';

// Valores que identifican lo cargado por la migración desde General.
const MIGRACION = { usuario: 'MIGRACION_GENERAL', usuarioAnterior: 'IMPORTACION_GENERAL', fuente: 'Base General (histórico)' };

// Catálogos institucionales. Los vacíos se llenan con los valores reales de General durante la migración.
const CATALOGO_BASE = {
  ESTADO_PROCESO: ['Activo', 'Terminado', 'Desvinculado'],
  ETAPA: [],
  TIPO_PROCESO: [],
  PARTE_PROCESAL: ['Activa', 'Pasiva'],
  REPRESENTACION: ['Representa', 'Representado'],
  AREA: [],
  ABOGADO: [],
  TIPO_VINCULACION: ['Planta', 'Contratista', 'Otro', 'No informado'],
  DESPACHO: [],
  CAUSA: [],
  INSTANCIA: ['Primera', 'Segunda', 'Única', 'Casación', 'Otra'],
  MEDIDA_CAUTELAR: ['Sí', 'No', 'Sin datos'],
  SI_NO: ['Sí', 'No'],
  SENTIDO_FALLO: ['Favorable', 'Desfavorable', 'Mixto', 'Inhibitorio'],
  ESTADO_RECURSO: ['No presentado', 'Presentado en término', 'Presentado fuera de término'],
  FORMA_TERMINACION: ['Sentencia', 'Conciliación', 'Transacción', 'Desistimiento', 'Desvinculación', 'Otra'],
  TIPO_ACTUACION: ['Contestación de demanda', 'Contestación de medida cautelar', 'Programación de diligencia', 'Traslado para alegatos', 'Fallo', 'Recurso', 'Otra'],
  TIPO_DILIGENCIA: ['Inicial', 'Pruebas', 'Alegatos y juzgamiento', 'Conciliación', 'Otra'],
  TIPO_COMITE: ['Comité de conciliación'],
  FUENTE: ['Aplicación', 'Base General (histórico)', 'Rama Judicial', 'SIPROJ', 'Orfeo', 'Otra'],
  ESTADO_ACTUACION: ['Pendiente', 'En trámite', 'Completada', 'Terminada'],
  CLASE_REGISTRO: ['ACTUACION', 'DILIGENCIA', 'COMITE'],
  CLASIFICACION_CALIDAD: ['VALIDADO', 'CORREGIBLE AUTOMÁTICAMENTE', 'REQUIERE REVISIÓN JURÍDICA'],
  ESTADO_PENDIENTE: ['PENDIENTE', 'RESUELTO', 'DESCARTADO'],
  ESTADO_REGISTRO: ['ACTIVO', 'ELIMINADO']
};

// Listas que combinan varios catálogos (para validar columnas que mezclan clases de registro, como TIPO en 02).
const CATALOGOS_COMBINADOS = { TIPO_REGISTRO: ['TIPO_ACTUACION', 'TIPO_DILIGENCIA', 'TIPO_COMITE'] };

// Catálogos que el administrador puede editar desde la aplicación (clave de la app -> categoría en 04_CATALOGOS).
const CATEGORIAS_APP = {
  lawyer: 'ABOGADO', lawyerLinkType: 'TIPO_VINCULACION', type: 'TIPO_PROCESO', cause: 'CAUSA',
  stage: 'ETAPA', state: 'ESTADO_PROCESO', area: 'AREA', court: 'DESPACHO', hearingType: 'TIPO_DILIGENCIA',
  terminationForm: 'FORMA_TERMINACION', quality: 'PARTE_PROCESAL', represents: 'REPRESENTACION',
  instance: 'INSTANCIA', cautelar: 'MEDIDA_CAUTELAR', decisionSense: 'SENTIDO_FALLO',
  appealStatus: 'ESTADO_RECURSO', actionType: 'TIPO_ACTUACION',
  source: 'FUENTE', actionStatus: 'ESTADO_ACTUACION', yesNo: 'SI_NO'
};

function esqEncabezados_(tabla) {
  return ESQUEMA[tabla].columnas.map(col => col[0]);
}

function esqClaves_(tabla) {
  return ESQUEMA[tabla].columnas.map(col => col[1]);
}

function esqTipo_(tabla, clave) {
  const col = ESQUEMA[tabla].columnas.find(item => item[1] === clave);
  return col ? col[2] : '';
}

// Índice (base 0) de una columna por su encabezado.
function esqIndice_(tabla, encabezado) {
  return esqEncabezados_(tabla).indexOf(encabezado);
}

// Formato de número por columna: texto plano, fecha o número.
function esqFormato_(tipo) {
  if (tipo === 'date') return 'yyyy-mm-dd';
  if (tipo === 'number') return '0';
  return '@';
}

function esqFormatosFila_(tabla) {
  return ESQUEMA[tabla].columnas.map(col => esqFormato_(col[2]));
}

function esqFechaIsoValida_(value) {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(text + 'T00:00:00Z');
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

// Valor de la celda -> texto (las fechas como AAAA-MM-DD en la zona horaria del script).
function esqTextoCelda_(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return value === null || value === undefined ? '' : String(value);
}

// Valor de la aplicación -> celda con el tipo correcto (fechas reales, números reales, texto plano).
function esqValorCelda_(tipo, value) {
  if (value === null || value === undefined || value === '') return '';
  if (tipo === 'date') {
    if (!esqFechaIsoValida_(value)) return '';
    const parts = String(value).split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (tipo === 'number') {
    // Pesos (COP) como número entero: "1.500.000", "$ 1,500,000" o "1500000" -> 1500000.
    const texto = String(value).trim();
    if (typeof value === 'number') return isFinite(value) ? Math.round(value) : '';
    const decimal = texto.match(/^\d+[.,]\d{1,2}$/);
    const number = decimal ? Number(texto.replace(',', '.')) : Number(texto.replace(/\D/g, ''));
    return texto !== '' && /\d/.test(texto) && isFinite(number) ? Math.round(number) : '';
  }
  if (tipo === 'flag') return value === true || String(value).toUpperCase() === 'SI' ? 'SI' : 'NO';
  if (tipo === 'list') return esqRecortarCelda_(Array.isArray(value) ? value.join('|') : String(value));
  return esqRecortarCelda_(String(value));
}

// Sheets no admite más de 50.000 caracteres por celda: un texto más largo (p. ej. muchas anotaciones sin fecha
// unidas en Observaciones) haría fallar la escritura de TODA la migración. Se recorta con aviso; el texto completo
// sigue en General, que queda como histórico.
const ESQ_MAX_CELDA = 45000;
function esqRecortarCelda_(texto) {
  if (texto.length <= ESQ_MAX_CELDA) return texto;
  const aviso = ' … [RECORTADO: tenía ' + texto.length + ' caracteres; el texto completo está en General]';
  return texto.slice(0, ESQ_MAX_CELDA - aviso.length) + aviso;
}

// Objeto de la aplicación -> fila de la hoja.
function esqObjetoAFila_(tabla, objeto) {
  return ESQUEMA[tabla].columnas.map(col => esqValorCelda_(col[2], objeto[col[1]]));
}

// Fila de la hoja -> objeto de la aplicación.
function esqFilaAObjeto_(tabla, fila) {
  const objeto = {};
  ESQUEMA[tabla].columnas.forEach((col, index) => {
    const text = esqTextoCelda_(fila[index]);
    if (col[2] === 'flag') objeto[col[1]] = text.toUpperCase() === 'SI';
    else if (col[2] === 'list') objeto[col[1]] = text ? text.split('|').filter(Boolean) : [];
    else objeto[col[1]] = text;
  });
  return objeto;
}

// Nombre de columna (encabezado) de un campo de la aplicación.
function esqEtiquetaCampo_(tabla, clave) {
  const col = ESQUEMA[tabla].columnas.find(item => item[1] === clave);
  return col ? col[0] : String(clave);
}

// Filas de 07_AUDITORIA: una por campo modificado, con el valor anterior y el nuevo como texto.
// base = { processId, changedAt, changedBy, origin, recordType, recordId }.
function esqFilasAuditoria_(base, tabla, campos, antes, despues) {
  const texto = valor => Array.isArray(valor) ? valor.join('|') : esqTextoCelda_(valor === true ? 'SI' : valor === false ? 'NO' : valor);
  return campos.map(clave => Object.assign({}, base, {
    id: 'AU_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20),
    field: esqEtiquetaCampo_(tabla, clave),
    previousValue: texto((antes || {})[clave]),
    newValue: texto((despues || {})[clave])
  }));
}

// Escribe valores sin que las reglas de validación "rechazar entrada" bloqueen la escritura del script.
// Google rechaza el bloque completo si una sola celda (aunque no haya cambiado) tiene un valor fuera de
// la lista, por ejemplo un despacho histórico o inactivo. Las reglas se quitan solo en ese rango, se
// escriben los valores y se vuelven a poner: los valores fuera de lista quedan marcados en la hoja y los
// reporta "Validar calidad" en 06_PENDIENTES_CALIDAD.
function esqEscribirValores_(rango, valores, opciones) {
  // directo: las reglas de la hoja solo advierten (no rechazan): una sola llamada, sin esperar confirmación.
  if (opciones && opciones.directo) { rango.setValues(valores); return rango; }
  // Intento directo (lo normal: los valores cumplen las listas). Solo si una regla lo rechaza se hace el
  // rodeo de quitar y volver a poner las reglas, que cuesta varias llamadas más.
  try {
    rango.setValues(valores);
    SpreadsheetApp.flush();
    return rango;
  } catch (error) { /* una regla "rechazar entrada" bloqueó la escritura */ }
  let reglas = null;
  try { reglas = rango.getDataValidations(); } catch (error) { reglas = null; }
  const conReglas = !!reglas && reglas.some(fila => fila.some(Boolean));
  if (conReglas) rango.clearDataValidations();
  rango.setValues(valores);
  if (conReglas) rango.setDataValidations(reglas);
  return rango;
}

// Clave para detectar valores repetidos de un catálogo: sin tildes, mayúsculas, signos ni espacios dobles.
// "Juzgado 1 Administrativo de Bogotá." y "JUZGADO 1 ADMINISTRATIVO DE BOGOTA" tienen la misma clave.
function esqClaveCatalogo_(value) {
  return esqNormalizar_(value).replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

// ---- 06_PENDIENTES_CALIDAD: agrupación por proceso (en memoria) ----
const PEND_SEP = ' | ';
const PEND_CONTROL = 'Control · ';

// Texto de un hallazgo dentro de DETALLE: "CAMPO: qué revisar [valor: original]".
function esqItemPendiente_(hallazgo) {
  const limpiar = texto => String(texto === undefined || texto === null ? '' : texto).replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
  const valor = limpiar(hallazgo.originalValue);
  return (hallazgo.origin === 'CONTROL AUTOMÁTICO' ? PEND_CONTROL : '') + limpiar(hallazgo.field) + ': ' + limpiar(hallazgo.problem) + (valor ? ' [valor: ' + valor + ']' : '');
}

// Clave para no repetir el mismo hallazgo (sin el prefijo de control, sin el valor ni paréntesis).
function esqClaveItemPendiente_(item) {
  return esqNormalizar_(String(item).replace(PEND_CONTROL, '').replace(/\s*\[valor:.*\]\s*$/, '').replace(/\(.*?\)/g, ''));
}

function esqItemsPendiente_(fila) {
  return String(fila.detail || '').split(PEND_SEP).map(item => item.trim()).filter(Boolean);
}

// ---- 06_PENDIENTES_CALIDAD: un registro por proceso ----
// "Control · CAMPO: problema [valor: v]" -> partes.
function esqPartesItem_(item) {
  const texto = String(item || '');
  const control = texto.indexOf(PEND_CONTROL) === 0;
  const cuerpo = control ? texto.slice(PEND_CONTROL.length) : texto;
  const m = cuerpo.match(/^([^:]+):\s*([\s\S]*?)(?:\s*\[valor:\s*([\s\S]*)\])?$/) || [cuerpo, '', cuerpo, ''];
  return { control: control, field: String(m[1] || '').trim(), problem: String(m[2] || '').trim(), value: String(m[3] || '').trim() };
}
function esqTextoPunto_(punto) {
  return esqItemPendiente_({ field: punto.field, problem: punto.problem, originalValue: punto.value,
    origin: String(punto.origin || '') === 'CONTROL AUTOMÁTICO' ? 'CONTROL AUTOMÁTICO' : '' });
}

// Nombre del campo como se conoce en General («FECHA CONTESTACIÓN DEMANDA»).
function esqEtiquetaLegible_(campo) {
  const col = ESQUEMA.procesos.columnas.find(item => item[0] === campo || item[1] === campo);
  if (!col) return String(campo || '').replace(/_/g, ' ');
  const general = String(col[5] || '').match(/^General:\s*(.+)$/);
  return general ? general[1].split(/\s*[+/]\s*/)[0].trim() : col[0].replace(/_/g, ' ');
}

function esqTipoProblema_(campo, problema) {
  const p = String(problema || '');
  if (p === PEND_FALTANTE) return ['2. Alta', 'Obligatorio sin diligenciar'];
  if (/^Orden de fechas|anterior a otras fechas|año anterior al de radicaci/.test(p)) return ['1. Crítica', 'Fechas en desorden'];
  if (/Fecha futura|anterior a 1990|más de 3 años|no es fecha|no se puede interpretar|no es una fecha|con fecha futura|sin fecha válida/.test(p)) return ['1. Crítica', 'Fecha imposible o mal escrita'];
  if (/ pero |sin forma de terminaci|no su fecha|no su sentido|sin fecha del fallo|figura como presentado|[Tt]erminado sin fecha/.test(p)) return ['2. Alta', 'Datos que se contradicen'];
  if (/radicado|No\. corto|23 dígitos/i.test(p)) return ['2. Alta', 'Radicado o número del proceso'];
  if (/abogado|asignaci/i.test(p) || campo === 'FECHA ASIGNACION') return ['2. Alta', 'Responsable del proceso'];
  if (/catálogo/.test(p)) return ['3. Media', 'Valor fuera de la lista'];
  if (/repetid/.test(p)) return ['3. Media', 'Registro repetido'];
  if (/pesos|COP|pretensi|rango/i.test(p)) return ['3. Media', 'Valores en pesos'];
  if (/anotaci|actuaci/i.test(p) || campo === 'ACTUACIONES') return ['3. Media', 'Actuaciones'];
  return ['3. Media', 'Otro'];
}

function esqQueHacer_(tipo, problema) {
  const p = String(problema || '');
  switch (tipo) {
    case 'Obligatorio sin diligenciar': return 'Busca el dato en el expediente (demanda, auto, SIPROJ u ORFEO) y diligéncialo en la app con «Corregir». Si no aplica a este proceso, el administrador lo marca «No aplica».';
    case 'Fechas en desorden': return 'Compara las dos fechas con el expediente y corrige la que esté mal. Si ambas son correctas (caso excepcional), el administrador lo marca «Resuelto» explicando por qué.';
    case 'Fecha imposible o mal escrita': return /sin fecha válida/.test(p) ? 'Abre las actuaciones del proceso y registra la anotación con su fecha real; si no es una actuación, el administrador la marca «No aplica».' : 'Revisa la fecha en el expediente y escríbela completa (día/mes/año). Si el dato no existe, deja el campo vacío.';
    case 'Datos que se contradicen': return 'Revisa en el expediente cuál de los dos datos es el correcto y corrige el otro.';
    case 'Radicado o número del proceso': return 'Verifica el radicado de 23 dígitos en la consulta de procesos de la Rama Judicial y el No. corto (AAAA-NNNNN).';
    case 'Valor fuera de la lista': return 'Elige en la app el valor equivalente de la lista. Si no existe, pide al administrador que lo agregue en Catálogos.';
    case 'Registro repetido': return 'El administrador revisa los registros repetidos y deja solo uno.';
    case 'Responsable del proceso': return 'El administrador asigna el abogado o registra desde cuándo lo tiene (acta de reparto o correo de asignación).';
    case 'Valores en pesos': return 'Escribe el valor en pesos colombianos, solo números. Si estaba en SMMLV, conviértelo con el salario del año de la demanda.';
    case 'Actuaciones': return 'Abre las actuaciones del proceso en la app y corrige la fecha o el texto de cada una.';
    default: return 'Revisa el dato en el expediente y corrígelo en la app con «Corregir».';
  }
}

// Completa los datos que se calculan de un punto (prioridad, tipo, qué hacer, nombre del campo, responsable).
function esqCompletarPunto_(punto) {
  const tipo = esqTipoProblema_(punto.field, punto.problem);
  const col = ESQUEMA.procesos.columnas.find(item => item[0] === punto.field);
  punto.priority = tipo[0];
  punto.problemType = tipo[1];
  punto.howTo = esqQueHacer_(tipo[1], punto.problem);
  punto.fieldLabel = punto.field === 'ACTUACIONES' ? 'ACTUACIONES' : punto.field === 'FECHA ASIGNACION' ? 'FECHA DE ASIGNACIÓN DEL ABOGADO' : esqEtiquetaLegible_(punto.field);
  punto.responsible = col ? String(col[4] || 'Intermediario') : punto.field === 'FECHA ASIGNACION' ? 'Administrador' : 'Intermediario';
  punto.classification = 'REQUIERE REVISIÓN JURÍDICA';
  return punto;
}

function esqDatosGrupo_(grupo, proceso) {
  const items = esqItemsPendiente_(grupo);
  const puntos = items.map(item => {
    const partes = esqPartesItem_(item);
    return esqCompletarPunto_({ field: partes.field, problem: partes.problem, value: partes.value });
  });
  const unir = key => puntos.map(punto => punto[key]).filter(Boolean).join('\n');
  const prioridades = puntos.map(punto => punto.priority);
  const priority = prioridades.indexOf('1. Crítica') >= 0 ? '1. Crítica'
    : prioridades.indexOf('2. Alta') >= 0 ? '2. Alta' : prioridades.length ? '3. Media' : '';
  return Object.assign({}, grupo, {
    id: 'PQ-' + grupo.processId,
    shortNo: proceso && proceso.shortNo !== undefined ? proceso.shortNo : grupo.shortNo || '',
    radicado: proceso && proceso.radicado !== undefined ? proceso.radicado : grupo.radicado || '',
    lawyer: proceso && proceso.lawyer !== undefined ? proceso.lawyer : grupo.lawyer || '',
    priority,
    problemType: unir('problemType'),
    field: unir('field'),
    fieldLabel: unir('fieldLabel'),
    problem: unir('problem'),
    value: unir('value'),
    howTo: unir('howTo'),
    responsible: grupo.responsible || [...new Set(puntos.map(punto => punto.responsible).filter(Boolean))].join('\n'),
    classification: 'REQUIERE REVISIÓN JURÍDICA',
    count: items.length
  });
}

// Lee tanto el formato agrupado como el formato anterior, con un hallazgo por fila.
function esqPuntosAGrupos_(puntos) {
  const filas = (puntos || []).filter(punto => punto && punto.processId);
  if (filas.some(punto => punto.detail !== undefined)) {
    const grupos = new Map();
    filas.forEach(fila => {
      const actual = grupos.get(fila.processId);
      if (!actual) { grupos.set(fila.processId, Object.assign({}, fila)); return; }
      const items = esqItemsPendiente_(actual);
      esqItemsPendiente_(fila).forEach(item => {
        if (!items.some(existing => esqClaveItemPendiente_(existing) === esqClaveItemPendiente_(item))) items.push(item);
      });
      actual.detail = items.join(PEND_SEP);
      actual.count = items.length;
      if (fila.status === 'PENDIENTE') actual.status = 'PENDIENTE';
      ['shortNo', 'radicado', 'lawyer', 'origin', 'responsible', 'sourceRow'].forEach(key => {
        if (['origin', 'responsible'].indexOf(key) >= 0) {
          actual[key] = [...new Set((String(actual[key] || '') + ' / ' + String(fila[key] || '')).split(' / ').filter(Boolean))].join(' / ');
        } else if (!actual[key] && fila[key]) actual[key] = fila[key];
      });
      actual.updatedAt = [actual.updatedAt, fila.updatedAt].filter(Boolean).sort().pop() || '';
      actual.detectedAt = [actual.detectedAt, fila.detectedAt].filter(Boolean).sort()[0] || '';
      actual.resolutionNote = [...new Set([actual.resolutionNote, fila.resolutionNote].filter(Boolean))].join('\n');
    });
    return [...grupos.values()].map(grupo => esqDatosGrupo_(grupo));
  }
  const porProceso = new Map();
  filas.forEach(punto => {
    if (!porProceso.has(punto.processId)) porProceso.set(punto.processId, []);
    porProceso.get(punto.processId).push(punto);
  });
  const grupos = [];
  porProceso.forEach((lista, id) => {
    const abiertos = lista.filter(punto => punto.status === 'PENDIENTE');
    const base = abiertos[0] || lista[lista.length - 1];
    const unir = valores => [...new Set(valores.map(valor => String(valor || '').trim()).filter(Boolean))].join(' / ');
    const fechas = valores => valores.map(String).filter(Boolean).sort();
    const historial = lista.filter(punto => punto.status !== 'PENDIENTE').map(punto =>
      [punto.status, esqTextoPunto_(punto), punto.resolutionNote].filter(Boolean).join(': ')).join('\n');
    if (abiertos.length) {
      const items = abiertos.map(esqTextoPunto_);
      grupos.push({ id: 'PQ-' + id, processId: id, shortNo: base.shortNo || '', radicado: base.radicado || '', lawyer: base.lawyer || '', sourceRow: base.sourceRow || '',
        detail: items.join(PEND_SEP), count: items.length, fields: [...new Set(abiertos.map(punto => punto.field).filter(Boolean))],
        classification: 'REQUIERE REVISIÓN JURÍDICA', responsible: unir(abiertos.map(punto => punto.responsible)), status: 'PENDIENTE',
        origin: unir(abiertos.map(punto => punto.origin)), detectedAt: fechas(abiertos.map(punto => punto.detectedAt))[0] || '',
        updatedAt: fechas(abiertos.map(punto => punto.updatedAt)).pop() || '', resolvedAt: '', resolvedBy: '', resolutionNote: historial });
    } else {
      const ultimo = lista.slice().sort((a, b) => String(a.resolvedAt || '').localeCompare(String(b.resolvedAt || ''))).pop();
      grupos.push({ id: 'PQ-' + id, processId: id, shortNo: ultimo.shortNo || '', radicado: ultimo.radicado || '', lawyer: ultimo.lawyer || '', sourceRow: ultimo.sourceRow || '',
        detail: '', count: 0, fields: [], classification: 'REQUIERE REVISIÓN JURÍDICA', responsible: '', status: ultimo.status || 'RESUELTO',
        origin: ultimo.origin || '', detectedAt: ultimo.detectedAt || '', updatedAt: ultimo.updatedAt || '',
        resolvedAt: ultimo.resolvedAt || '', resolvedBy: ultimo.resolvedBy || '', resolutionNote: [historial, ultimo.resolutionNote].filter(Boolean).join('\n') });
    }
  });
  return grupos;
}

// Convierte grupos en filas, una por proceso.
function esqGruposAFilas_(grupos, filasPrevias, ahora, procesos) {
  const salida = new Map();
  esqPuntosAGrupos_(filasPrevias || []).forEach(grupo => salida.set(grupo.processId, grupo));
  esqPuntosAGrupos_(grupos || []).forEach(grupo => salida.set(grupo.processId, grupo));
  return [...salida.values()].map(grupo => {
    const proceso = procesos && procesos.get ? procesos.get(grupo.processId) : null;
    const fila = esqDatosGrupo_(grupo, proceso);
    if (!fila.updatedAt) fila.updatedAt = ahora;
    if (!fila.count && fila.status === 'PENDIENTE') fila.status = 'RESUELTO';
    return fila;
  });
}

// Une hallazgos nuevos a los registros de 06 (uno por proceso). Solo entra lo que requiere revisión.
// opciones.procesos: Map id -> { shortNo, radicado } para dejar el No. corto y el radicado como están en 01.
// opciones.controlCompleto: los hallazgos de control traen TODO lo vigente; los de control que ya no aparecen se quitan.
// opciones.corregidos: Map id -> Set de campos (nombre de columna) corregidos después de detectarse; esos puntos se quitan.
// opciones.cerrados: Map id -> Set de claves cerradas desde la aplicación (07_AUDITORIA, TIPO_REGISTRO = CALIDAD); no se vuelven a abrir.
function esqFusionarPendientes_(filas, hallazgos, ahora, opciones) {
  const options = opciones || {};
  const porProceso = new Map();
  (filas || []).forEach(fila => {
    if (!fila.processId) return;
    const previa = porProceso.get(fila.processId);
    if (previa) { // registros antiguos repetidos del mismo proceso: se unen en uno
      esqItemsPendiente_(fila).forEach(item => { if (esqItemsPendiente_(previa).indexOf(item) < 0) previa.detail = (previa.detail ? previa.detail + PEND_SEP : '') + item; });
      return;
    }
    porProceso.set(fila.processId, Object.assign({}, fila));
  });
  const nuevosPorProceso = new Map();
  (hallazgos || []).forEach(hallazgo => {
    if (!hallazgo || !hallazgo.processId || hallazgo.classification === 'CORREGIBLE AUTOMÁTICAMENTE' || hallazgo.classification === 'VALIDADO') return;
    const cerrados = options.cerrados && options.cerrados.get(hallazgo.processId);
    if (cerrados && cerrados.has(esqClaveItemPendiente_(esqItemPendiente_(hallazgo)))) return; // ya se cerró desde la aplicación
    if (!nuevosPorProceso.has(hallazgo.processId)) nuevosPorProceso.set(hallazgo.processId, []);
    nuevosPorProceso.get(hallazgo.processId).push(hallazgo);
  });
  const tocados = new Set();
  if (options.controlCompleto) {
    porProceso.forEach((fila, id) => {
      const vigentes = new Set((nuevosPorProceso.get(id) || []).filter(h => h.origin === 'CONTROL AUTOMÁTICO').map(h => esqClaveItemPendiente_(esqItemPendiente_(h))));
      const items = esqItemsPendiente_(fila);
      const corregidos = (options.corregidos && options.corregidos.get(id)) || new Set();
      const quedan = items.filter(item => item.indexOf(PEND_CONTROL) === 0
        ? vigentes.has(esqClaveItemPendiente_(item))
        : !corregidos.has(item.split(':')[0].trim()));
      if (quedan.length !== items.length) {
        const cerrados = items.filter(item => quedan.indexOf(item) < 0);
        fila.detail = quedan.join(PEND_SEP);
        fila.resolutionNote = [fila.resolutionNote, 'Cierre automático: ' + cerrados.join(PEND_SEP)].filter(Boolean).join('\n');
        fila.updatedAt = ahora;
        tocados.add(id);
      }
    });
  }
  nuevosPorProceso.forEach((lista, id) => {
    let fila = porProceso.get(id);
    if (!fila) {
      fila = { id: 'PQ-' + id, processId: id, detail: '', classification: 'REQUIERE REVISIÓN JURÍDICA', status: 'PENDIENTE', detectedAt: ahora, origin: '', responsible: '' };
      porProceso.set(id, fila);
    }
    const items = esqItemsPendiente_(fila);
    const claves = new Set(items.map(esqClaveItemPendiente_));
    const origenes = new Set(String(fila.origin || '').split(' / ').filter(Boolean));
    const responsables = new Set(String(fila.responsible || '').split(' / ').filter(Boolean));
    let agregados = 0;
    lista.forEach(hallazgo => {
      const item = esqItemPendiente_(hallazgo);
      const clave = esqClaveItemPendiente_(item);
      if (claves.has(clave)) return;
      claves.add(clave);
      items.push(item);
      if (hallazgo.origin) (fila.origenes || (fila.origenes = {}))[clave] = hallazgo.origin;
      agregados++;
      if (hallazgo.origin) origenes.add(hallazgo.origin);
      if (hallazgo.responsible) responsables.add(hallazgo.responsible);
      if (!fila.sourceRow && hallazgo.sourceRow) fila.sourceRow = String(hallazgo.sourceRow);
    });
    if (!agregados) return;
    fila.detail = items.join(PEND_SEP);
    fila.origin = [...origenes].join(' / ');
    fila.responsible = [...responsables].join(' / ');
    fila.updatedAt = ahora;
    if (fila.status !== 'PENDIENTE') {
      fila.status = 'PENDIENTE';
      fila.resolutionNote = (fila.resolutionNote ? fila.resolutionNote + ' ' : '') + '[Reabierto ' + String(ahora).slice(0, 10) + ': hay hallazgos nuevos]';
    }
    tocados.add(id);
  });
  porProceso.forEach((fila, id) => {
    const items = esqItemsPendiente_(fila);
    fila.count = items.length;
    fila.fields = [...new Set(items.map(item => item.replace(PEND_CONTROL, '').split(':')[0].trim()).filter(Boolean))];
    fila.classification = 'REQUIERE REVISIÓN JURÍDICA';
    const proceso = options.procesos && options.procesos.get(id);
    if (proceso) { fila.shortNo = proceso.shortNo || ''; fila.radicado = proceso.radicado || ''; }
    if (!items.length && fila.status === 'PENDIENTE' && tocados.has(id)) {
      fila.status = 'RESUELTO'; fila.resolvedAt = ahora; fila.resolvedBy = 'CONTROL AUTOMÁTICO';
      fila.resolutionNote = 'Las condiciones detectadas ya no se cumplen en 01_PROCESOS.';
    }
  });
  return [...porProceso.values()].filter(fila => fila.count || fila.status !== 'PENDIENTE');
}

// Puntos de 06 cerrados desde la aplicación: quedan en 07_AUDITORIA con TIPO_REGISTRO = CALIDAD,
// VALOR_ANTERIOR = el punto y VALOR_NUEVO = "RESUELTO: ..." o "DESCARTADO: ...". Devuelve Map id -> Set de claves.
function esqCerradosCalidad_(filasAuditoria) {
  const cerrados = new Map();
  (filasAuditoria || []).forEach(cambio => {
    if (!cambio || cambio.recordType !== 'CALIDAD' || !cambio.processId || !cambio.previousValue) return;
    if (!/^(RESUELTO|DESCARTADO)/.test(String(cambio.newValue || ''))) return;
    if (!cerrados.has(cambio.processId)) cerrados.set(cambio.processId, new Set());
    cerrados.get(cambio.processId).add(esqClaveItemPendiente_(cambio.previousValue));
  });
  return cerrados;
}

// Campos obligatorios marcados «No aplica» desde la aplicación (07_AUDITORIA, CALIDAD, "CAMPO: Campo obligatorio
// sin diligenciar."): dejan de contarse como faltantes. Devuelve Map id -> Set de claves de 01_PROCESOS.
const PEND_FALTANTE = 'Campo obligatorio sin diligenciar.';
function esqExentosObligatorios_(filasAuditoria) {
  const claves = {};
  ESQUEMA.procesos.columnas.forEach(col => { claves[col[0]] = col[1]; });
  const exentos = new Map();
  (filasAuditoria || []).forEach(cambio => {
    if (!cambio || cambio.recordType !== 'CALIDAD' || !cambio.processId || !/^DESCARTADO/.test(String(cambio.newValue || ''))) return;
    const texto = String(cambio.previousValue || '');
    if (texto.indexOf(PEND_FALTANTE) < 0) return;
    const clave = claves[texto.split(':')[0].trim()];
    if (!clave) return;
    if (!exentos.has(cambio.processId)) exentos.set(cambio.processId, new Set());
    exentos.get(cambio.processId).add(clave);
  });
  return exentos;
}

// Normaliza para comparar: sin tildes, mayúsculas y espacios simples.
function esqNormalizar_(value) {
  return String(value === null || value === undefined ? '' : value)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
}

// No. corto y radicado de cada proceso de 01_PROCESOS (Map ID -> { shortNo, radicado }).
function esqProcesosPorId_(libro) {
  const mapa = new Map();
  const hoja = libro.getSheetByName(ESQUEMA.procesos.hoja);
  if (!hoja || hoja.getLastRow() < 2) return mapa;
  const corto = esqIndice_('procesos', 'NO_CORTO'), radicado = esqIndice_('procesos', 'RADICADO');
  const ancho = Math.max(corto, radicado) + 1;
  hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues().forEach(fila => {
    const id = esqTextoCelda_(fila[0]);
    if (id) mapa.set(id, { shortNo: esqTextoCelda_(fila[corto]), radicado: esqTextoCelda_(fila[radicado]) });
  });
  return mapa;
}

// ¿07_AUDITORIA está en la versión anterior (sin NO_CORTO y RADICADO después de ID_PROCESO)?
function esqAuditoriaSinProceso_(hoja) {
  if (!hoja || hoja.getLastColumn() < 3) return false;
  const actuales = hoja.getRange(1, 1, 1, 3).getDisplayValues()[0].map(valor => String(valor).trim());
  return actuales[0] === 'ID_AUDITORIA' && actuales[1] === 'ID_PROCESO' && actuales[2] === 'FECHA_CAMBIO';
}

// 07_AUDITORIA de la versión anterior: se insertan NO_CORTO y RADICADO después de ID_PROCESO y se llenan con lo
// que hay en 01_PROCESOS. Las filas no cambian de lugar ni se pierde ningún cambio. Devuelve true si convirtió.
function esqAuditoriaConProceso_(hoja) {
  if (!esqAuditoriaSinProceso_(hoja)) return false;
  const filas = Math.max(hoja.getLastRow() - 1, 0);
  hoja.insertColumnsAfter(2, 2);
  hoja.getRange(1, 3, 1, 2).setValues([['NO_CORTO', 'RADICADO']]);
  hoja.getRange(2, 3, Math.max(hoja.getMaxRows() - 1, 1), 2).setNumberFormat('@'); // texto: los radicados no se alteran
  if (filas) {
    const procesos = esqProcesosPorId_(hoja.getParent());
    const valores = hoja.getRange(2, 2, filas, 1).getValues().map(fila => {
      const proceso = procesos.get(esqTextoCelda_(fila[0]));
      return proceso ? [proceso.shortNo, proceso.radicado] : ['', ''];
    });
    hoja.getRange(2, 3, filas, 2).setValues(valores);
  }
  return true;
}


// =============================================================================
// PARTE 3. ESTANDARIZACIÓN: ESTRUCTURA, MIGRACIÓN Y CALIDAD
// =============================================================================

// =============================================================================
// ESTRUCTURA, MIGRACIÓN Y CONTROL DE CALIDAD DE LA BASE (script de la hoja de cálculo)
// -----------------------------------------------------------------------------
// Usa las utilidades de la parte 1 (CONFIG, prepararHoja, escribirPorBloques, asegurarDimensiones,
// mostrarMensaje, nombreColumna). Implementa la propuesta de estandarización:
//
//   Mes 1  crearEstructuraBase()        pestañas 00–07, diccionario, catálogos,
//          aplicarValidacionesYProtecciones()   listas cerradas, fórmulas y protecciones
//   Mes 2  migrarANuevaEstructura()     General -> 01/02/03/06, clasificación
//                                       VALIDADO / CORREGIBLE / REQUIERE REVISIÓN
//          depurarProcesos()            deja cada valor de 01_PROCESOS (la base limpia) con su formato
//   Mes 3  validarCalidadBase()         alertas de calidad en 06_PENDIENTES_CALIDAD
//          generarInformeCalidad()      indicadores de éxito antes / después
//          crearRespaldo(), programarAutomatizaciones()
//
// La pestaña General NO se modifica (salvo eliminar la columna ID_APLICACION que
// agregaba la versión anterior de la aplicación).
// =============================================================================

const EST = {
  hojaReporteMigracion: 'REPORTE_MIGRACION',
  hojaInforme: 'INFORME_CALIDAD',
  columnaIdAnterior: 'ID_APLICACION',
  prefijoEliminado: 'ELIMINADO:',
  carpetaRespaldos: 'Respaldos - Base de procesos judiciales',
  diasSinActuacion: 180,        // "larga permanencia sin actuación" (ajustable con la Dirección)
  columnaListas: 8,             // en 04_CATALOGOS las listas para validación empiezan en la columna H
  responsable: { juridico: 'Abogado a cargo', coordinacion: 'Coordinación de Representación Judicial', analista: 'Analista de datos' },
  clasificacion: { validado: 'VALIDADO', corregible: 'CORREGIBLE AUTOMÁTICAMENTE', revision: 'REQUIERE REVISIÓN JURÍDICA' },
  obligatoriosRegistro: ['shortNo', 'radicado', 'currentRadicado', 'ids', 'claimant', 'defendant', 'lawyer', 'quality',
    'represents', 'type', 'instance', 'court', 'cautelar', 'notificationDate']
};

// Encabezado de General (normalizado) -> campo.
const EST_COLUMNAS_GENERAL = {
  'NO. CORTO': 'shortNo', 'RADICADO': 'radicado', 'RADICADO ACTUAL': 'currentRadicado',
  'INSTANCIA DEL PROCESO': 'instance', 'CEDULAS': 'ids', 'ID SIPROJ': 'siproJ', 'EXPEDIENTE ORFEO': 'orfeo',
  'TIPO DE PROCESO': 'type', 'DEMANDANTE': 'claimant', 'DEMANDADO': 'defendant',
  'DESPACHO JUDICIAL INICIAL': 'court', 'CAUSA': 'cause', 'PRETENSION - ASUNTO': 'claim',
  'VALOR DE LAS PRETENSIONES': 'amount', 'AREA GENERADORA DEL DANO': 'area', 'ETAPAS DEL PROCESO': 'stage',
  'ESTADO DEL PROCESO': 'state', 'FECHA DE TERMINACION': 'endDate', 'CALIDAD': 'quality',
  'FECHA DE NOTIFICACION DE LA DEMANDA': 'notificationDate', 'PRESENTA MEDIDA CAUTELAR': 'cautelar',
  'FECHA DE CONTESTACION DE MEDIDA CAUTELAR': 'measureResponseDate',
  'FECHA MAX CONTESTACION DE DEMANDA': 'maxDemandResponseDate', 'FECHA CONTESTACION DEMANDA': 'demandResponseDate',
  'AUDIENCIA INICIAL': 'initialAudienceDate', 'PRUEBAS': 'evidence',
  'FECHA DE ALEGATOS DE CONCLUSION': 'closingArgumentsDate', 'FECHA DE FALLO DE PRIMERA INSTANCIA': 'firstInstanceDecisionDate',
  'SENTIDO DEL FALLO PRIMERA INSTANCIA': 'firstInstanceDecisionSense', 'FECHA DE PRESENTACION DEL RECURSO': 'appealDate',
  'FECHA FALLO 2DA INSTANCIA': 'secondInstanceDecisionDate', 'DESPACHO DE SEGUNDA INSTANCIA': 'secondCourt',
  'FALLO DE SEGUNDA INSTANCIA': 'secondInstanceDecisionSense', 'ABOGADO A CARGO': 'lawyer',
  'TIPO DE VINCULACION DEL ABOGADO': 'lawyerLinkType', 'REPRESENTA': 'represents'
};
const EST_VACIOS = ['', '-', '--', '.', '/', 'N/A', 'NA', 'N.A', 'N.A.', '#N/D', '#N/A', '#REF!', '#VALUE!', '#¡REF!', '#¡VALOR!', 'NO APLICA'];
// Catálogos que se completan con los valores reales (homologando variantes de escritura).
const EST_CATALOGOS_ABIERTOS = ['ABOGADO', 'AREA', 'TIPO_PROCESO', 'ETAPA', 'CAUSA', 'DESPACHO', 'TIPO_VINCULACION', 'FORMA_TERMINACION'];

// =============================================================================
// MES 1. CREAR LA ESTRUCTURA
// =============================================================================

function crearEstructuraBase() {
  const inicio = new Date();
  const libro = obtenerLibro();
  estMarcarCambioDatos_(libro);
  estQuitarColumnasRetiradas_(libro);
  estConvertirAuditoria_(libro);
  estAuditoriaRevisada_ = false;
  estAuditoriaAlDia_(libro);
  estConvertirPendientes_(libro, false);
  ['procesos', 'actuaciones', 'asignaciones', 'catalogos', 'pendientes', 'auditoria'].forEach(tabla => estAsegurarTabla_(libro, tabla));
  const agregados = estSembrarCatalogos_(libro, {});
  estEnIngles_(libro, () => {
    estCrearListasCatalogo_(libro);
    estCrearVistaGeneral_(libro);
  });
  estCrearDiccionario_(libro);
  aplicarValidacionesYProtecciones();
  estOrdenarPestanas_(libro);
  const segundos = ((new Date() - inicio) / 1000).toFixed(1);
  mostrarMensaje('Estructura lista (00–07). Catálogos agregados: ' + agregados + '. Tiempo: ' + segundos + ' s.');
  Logger.log('ESTRUCTURA - hojas creadas o verificadas en ' + segundos + ' s');
}

// Crea la pestaña si no existe; si existe, verifica los encabezados y agrega los que falten al final.
function estAsegurarTabla_(libro, tabla) {
  const config = ESQUEMA[tabla];
  const encabezados = esqEncabezados_(tabla);
  let hoja = libro.getSheetByName(config.hoja);
  if (!hoja) hoja = libro.insertSheet(config.hoja);
  asegurarDimensiones(hoja, Math.max(hoja.getMaxRows(), 1000), encabezados.length);
  const actuales = hoja.getRange(1, 1, 1, encabezados.length).getDisplayValues()[0];
  const vacio = actuales.every(valor => !valor);
  const compatible = actuales.every((valor, index) => !valor || valor === encabezados[index]);
  if (!vacio && !compatible) {
    throw new Error('Los encabezados de "' + config.hoja + '" no coinciden con el esquema. Renombra la pestaña actual y vuelve a ejecutar.');
  }
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold').setBackground('#344554').setFontColor('#ffffff');
  hoja.setFrozenRows(1);
  estFormatearColumnas_(hoja, tabla, 2, hoja.getMaxRows() - 1);
  hoja.getRange(1, 1).setNote(config.descripcion);
  return hoja;
}

// Formato por columna: texto plano (conserva radicados de 23 dígitos), fecha o número.
function estFormatearColumnas_(hoja, tabla, filaInicial, filas) {
  if (filas < 1) return;
  ESQUEMA[tabla].columnas.forEach((columna, index) => {
    hoja.getRange(filaInicial, index + 1, filas, 1).setNumberFormat(esqFormato_(columna[2]));
  });
}

// Columnas que ya no hacen parte del modelo: se borran de las pestañas creadas con una versión anterior,
// para que los encabezados vuelvan a coincidir con el esquema. Los demás datos no se tocan.
const EST_COLUMNAS_RETIRADAS = { procesos: ['CORREO_INTERMEDIARIO', 'UNIDAD_PRETENSIONES', 'PRUEBAS'], asignaciones: ['CORREO_INTERMEDIARIO'] };
function estQuitarColumnasRetiradas_(libro) {
  let borradas = 0;
  Object.keys(EST_COLUMNAS_RETIRADAS).forEach(tabla => {
    const hoja = libro.getSheetByName(ESQUEMA[tabla].hoja);
    if (!hoja || hoja.getLastColumn() < 1) return;
    EST_COLUMNAS_RETIRADAS[tabla].forEach(nombre => {
      const encabezados = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(valor => String(valor).trim());
      const columna = encabezados.indexOf(nombre);
      if (columna >= 0 && nombre === 'UNIDAD_PRETENSIONES') estRetirarUnidadPretension_(libro, hoja, encabezados, columna);
      if (columna >= 0 && nombre === 'PRUEBAS') estRetirarPruebas_(hoja, encabezados, columna);
      if (columna >= 0) { hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(item => item.remove()); hoja.deleteColumn(columna + 1); borradas++; }
    });
  });
  if (borradas) Logger.log('Columnas retiradas del modelo eliminadas: ' + borradas);
  return borradas;
}

// 07_AUDITORIA creada con la versión anterior (VALORES_ANTERIORES / VALORES_NUEVOS en JSON): se pasa al
// formato actual, una fila por campo con su valor anterior y nuevo. No se pierde ningún cambio.
function estConvertirAuditoria_(libro) {
  const hoja = libro.getSheetByName(ESQUEMA.auditoria.hoja);
  if (!hoja || hoja.getLastColumn() < 1 || hoja.getLastRow() < 1) return 0;
  const datos = hoja.getRange(1, 1, hoja.getLastRow(), hoja.getLastColumn()).getValues();
  const encabezados = datos[0].map(valor => String(valor).trim());
  if (encabezados.indexOf('VALORES_ANTERIORES') < 0) return 0;
  const col = nombre => encabezados.indexOf(nombre);
  const json = texto => { try { return JSON.parse(String(texto || '') || '{}') || {}; } catch (error) { return {}; } };
  const filas = [];
  datos.slice(1).forEach(fila => {
    const id = String(fila[col('ID_AUDITORIA')] || '').trim();
    if (!id) return;
    const base = { processId: String(fila[col('ID_PROCESO')] || ''), changedAt: esqTextoCelda_(fila[col('FECHA_CAMBIO')]),
      changedBy: String(fila[col('MODIFICADO_POR')] || '') };
    const antes = json(fila[col('VALORES_ANTERIORES')]);
    const despues = json(fila[col('VALORES_NUEVOS')]);
    const origen = base.changedBy === DEP.usuario ? 'DEPURACIÓN' : 'APLICACIÓN';
    let n = 0;
    const agregar = objeto => filas.push(Object.assign({}, base, { origin: origen }, objeto, { id: id + '_' + (++n) }));
    String(fila[col('CAMPOS_CAMBIADOS')] || '').split('|').filter(Boolean).forEach(campo => {
      if (campo.indexOf('actuacion:') === 0) {
        const claves = Object.keys(Object.assign({}, antes, despues)).filter(clave => String(antes[clave] || '') !== String(despues[clave] || ''));
        claves.forEach(clave => agregar({ recordType: 'ACTUACION', recordId: campo.slice(10), field: esqEtiquetaCampo_('actuaciones', clave),
          previousValue: String(antes[clave] === undefined ? '' : antes[clave]), newValue: String(despues[clave] === undefined ? '' : despues[clave]) }));
      } else if (['hearings', 'committees', 'actions'].indexOf(campo) >= 0) {
        agregar({ recordType: { hearings: 'DILIGENCIA', committees: 'COMITE', actions: 'ACTUACION' }[campo], recordId: '', field: 'REGISTRO_NUEVO', previousValue: '', newValue: '' });
      } else {
        agregar({ recordType: 'PROCESO', recordId: base.processId, field: esqEtiquetaCampo_('procesos', campo),
          previousValue: String(antes[campo] === undefined ? '' : antes[campo]), newValue: String(despues[campo] === undefined ? '' : despues[campo]) });
      }
    });
  });
  hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(item => item.remove());
  hoja.clear();
  const encabezadosNuevos = esqEncabezados_('auditoria');
  asegurarDimensiones(hoja, Math.max(filas.length + 1, 2), encabezadosNuevos.length);
  hoja.getRange(1, 1, 1, encabezadosNuevos.length).setValues([encabezadosNuevos]);
  if (filas.length) {
    estCompletarAuditoria_(libro, filas);
    estFormatearColumnas_(hoja, 'auditoria', 2, filas.length);
    escribirPorBloques(hoja, filas.map(objeto => esqObjetoAFila_('auditoria', objeto)), 2, 1);
  }
  Logger.log('07_AUDITORIA convertida al formato por campo: ' + filas.length + ' filas.');
  return filas.length;
}

// Antes de borrar UNIDAD_PRETENSIONES: un valor que no estaba en COP (SMMLV, UVT, Indeterminado) no se puede
// dejar como pesos. Se vacía VALOR_PRETENSIONES, el valor y la unidad pasan a OBSERVACIONES y el caso a 06.
function estRetirarUnidadPretension_(libro, hoja, encabezados, columnaUnidad) {
  const columnaValor = encabezados.indexOf('VALOR_PRETENSIONES');
  const columnaNotas = encabezados.indexOf('OBSERVACIONES');
  const columnaId = encabezados.indexOf('ID_PROCESO');
  if (columnaValor < 0 || columnaNotas < 0 || hoja.getLastRow() < 2) return 0;
  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, encabezados.length).getValues();
  const ahora = new Date().toISOString();
  const pendientes = [];
  let cambios = 0;
  datos.forEach(fila => {
    const unidad = String(fila[columnaUnidad] || '').trim();
    if (!unidad || unidad === 'COP' || fila[columnaValor] === '' || fila[columnaValor] === null) return;
    const original = esqTextoCelda_(fila[columnaValor]) + ' ' + unidad;
    fila[columnaNotas] = (String(fila[columnaNotas] || '').trim() ? String(fila[columnaNotas]).trim() + '\n' : '') + 'Valor de las pretensiones (no estaba en pesos): ' + original;
    fila[columnaValor] = '';
    cambios++;
    pendientes.push(Object.assign(estHallazgo_('amount', original, '', 'El valor de las pretensiones no está en pesos; se requiere el valor en COP.', EST.clasificacion.revision, EST.responsable.juridico),
      { processId: String(fila[columnaId] || ''), origin: 'DEPURACIÓN' }));
  });
  if (!cambios) return 0;
  hoja.getRange(2, columnaValor + 1, datos.length, 1).setNumberFormat('0');
  esqEscribirValores_(hoja.getRange(2, columnaValor + 1, datos.length, 1), datos.map(fila => [fila[columnaValor]]));
  esqEscribirValores_(hoja.getRange(2, columnaNotas + 1, datos.length, 1), datos.map(fila => [fila[columnaNotas]]));
  estFusionarEnHoja_(libro, pendientes);
  Logger.log('Valores de pretensiones que no estaban en COP: ' + cambios + ' (pasaron a Observaciones y a 06).');
  return cambios;
}

// PRUEBAS deja de existir: «Fecha de audiencia de pruebas» es el único campo. Antes de borrar la columna, una fecha
// pasa a FECHA_AUDIENCIA_PRUEBAS (si estaba vacía) y un texto pasa a OBSERVACIONES. No se pierde nada.
function estRetirarPruebas_(hoja, encabezados, columnaPruebas) {
  const columnaFecha = encabezados.indexOf('FECHA_AUDIENCIA_PRUEBAS');
  const columnaNotas = encabezados.indexOf('OBSERVACIONES');
  if (columnaFecha < 0 || columnaNotas < 0 || hoja.getLastRow() < 2) return 0;
  const zona = Session.getScriptTimeZone();
  const datos = hoja.getRange(2, 1, hoja.getLastRow() - 1, encabezados.length).getValues();
  let cambios = 0;
  datos.forEach(fila => {
    const crudo = fila[columnaPruebas];
    if (estVacio_(crudo)) return;
    const iso = estFecha_(crudo, zona);
    if (iso && estVacio_(fila[columnaFecha])) fila[columnaFecha] = iso;
    else if (!iso || esqTextoCelda_(fila[columnaFecha]).slice(0, 10) !== iso) {
      fila[columnaNotas] = (String(fila[columnaNotas] || '').trim() ? String(fila[columnaNotas]).trim() + '\n' : '') + 'Pruebas: ' + estTexto_(crudo, zona);
    }
    cambios++;
  });
  if (!cambios) return 0;
  esqEscribirValores_(hoja.getRange(2, columnaFecha + 1, datos.length, 1), datos.map(fila => [fila[columnaFecha]]));
  esqEscribirValores_(hoja.getRange(2, columnaNotas + 1, datos.length, 1), datos.map(fila => [fila[columnaNotas]]));
  Logger.log('Columna PRUEBAS retirada: ' + cambios + ' valores pasaron a la fecha de audiencia de pruebas o a Observaciones.');
  return cambios;
}

// Une hallazgos a 06_PENDIENTES_CALIDAD (un registro por proceso) y reescribe la pestaña.
function estFusionarEnHoja_(libro, hallazgos, opciones) {
  if (!libro.getSheetByName(ESQUEMA.pendientes.hoja)) return 0;
  estConvertirPendientes_(libro, true);
  const options = Object.assign({}, opciones || {});
  if (!options.procesos) options.procesos = estMapaProcesos_(libro);
  if (!options.cerrados && libro.getSheetByName(ESQUEMA.auditoria.hoja)) options.cerrados = esqCerradosCalidad_(estLeerTabla_(libro, 'auditoria'));
  const filas = esqFusionarPendientes_(estLeerTabla_(libro, 'pendientes'), hallazgos, new Date().toISOString(), options);
  estEscribirTabla_(libro, 'pendientes', filas);
  return filas.filter(fila => fila.status === 'PENDIENTE').length;
}

// ID del proceso -> No. corto y radicado tal como están en 01_PROCESOS.
function estMapaProcesos_(libro) {
  const mapa = new Map();
  estLeerTabla_(libro, 'procesos').forEach(item => mapa.set(item.id, { shortNo: item.shortNo, radicado: item.radicado }));
  return mapa;
}

// Convierte los formatos anteriores de 06_PENDIENTES_CALIDAD:
//  · el más antiguo (una fila por hallazgo, con VALOR_ORIGINAL y lo corregido automáticamente);
//  · uno por hallazgo;
//  · uno por proceso, con DETALLE.
function estConvertirPendientes_(libro, reaplicar) {
  const vieja = libro.getSheetByName('06_POR_CORREGIR'); // hoja de consulta de una versión intermedia: ya va dentro de 06
  if (vieja) { try { libro.deleteSheet(vieja); } catch (error) { Logger.log('No se pudo quitar 06_POR_CORREGIR: ' + error.message); } }
  const hoja = libro.getSheetByName(ESQUEMA.pendientes.hoja);
  if (!hoja || hoja.getLastColumn() < 1) return 0;
  const datos = hoja.getRange(1, 1, Math.max(hoja.getLastRow(), 1), hoja.getLastColumn()).getValues();
  const encabezados = datos[0].map(valor => String(valor).trim());
  const actuales = esqEncabezados_('pendientes');
  const esquemaActual = actuales.every((encabezado, index) => encabezados[index] === encabezado);
  const columnaProceso = encabezados.indexOf('ID_PROCESO');
  const idsProceso = columnaProceso < 0 ? [] : datos.slice(1).map(fila => String(fila[columnaProceso] || '').trim()).filter(Boolean);
  const repetidos = new Set(idsProceso).size !== idsProceso.length;
  if (esquemaActual && !repetidos) return 0;
  const antiguo = encabezados.indexOf('VALOR_ORIGINAL') >= 0;
  const porProceso = (encabezados.indexOf('DETALLE') >= 0 && !antiguo && !esquemaActual) || (esquemaActual && repetidos);
  const porPunto = !antiguo && !porProceso && !esquemaActual && encabezados.indexOf('CAMPO') >= 0 && encabezados.indexOf('QUE_ESTA_MAL') >= 0;
  if (!antiguo && !porProceso && !porPunto) return 0;
  const col = nombre => encabezados.indexOf(nombre);
  const celda = (fila, nombre) => col(nombre) >= 0 ? esqTextoCelda_(fila[col(nombre)]) : '';
  const ahora = new Date().toISOString();
  const procesos = new Map();
  estLeerTabla_(libro, 'procesos').forEach(item => procesos.set(item.id, { shortNo: item.shortNo || '', radicado: item.radicado || '', lawyer: item.lawyer || '' }));
  let grupos;
  if (antiguo) {
    const hallazgos = [];
    datos.slice(1).forEach(fila => {
      const processId = String(fila[col('ID_PROCESO')] || '').trim();
      if (!processId) return;
      if (String(fila[col('CLASIFICACION')]) !== EST.clasificacion.revision || String(fila[col('ESTADO')]) !== 'PENDIENTE') return;
      hallazgos.push({ processId: processId, field: String(fila[col('CAMPO')] || ''), problem: String(fila[col('PROBLEMA')] || ''),
        originalValue: esqTextoCelda_(fila[col('VALOR_ORIGINAL')]), classification: EST.clasificacion.revision,
        responsible: String(fila[col('RESPONSABLE')] || ''), origin: String(fila[col('ORIGEN')] || ''), sourceRow: String(fila[col('FILA_GENERAL')] || '') });
    });
    grupos = esqFusionarPendientes_([], hallazgos, ahora, { procesos: procesos });
  } else if (porPunto) {
    const puntos = datos.slice(1).filter(fila => celda(fila, 'ID_PROCESO')).map(fila => ({
      id: celda(fila, 'ID_PENDIENTE'), processId: celda(fila, 'ID_PROCESO'), shortNo: celda(fila, 'NO_CORTO'),
      radicado: celda(fila, 'RADICADO'), lawyer: celda(fila, 'ABOGADO_A_CARGO'), priority: celda(fila, 'PRIORIDAD'),
      field: celda(fila, 'CAMPO'), fieldLabel: celda(fila, 'NOMBRE_CAMPO'), problem: celda(fila, 'QUE_ESTA_MAL'),
      value: celda(fila, 'VALOR_ENCONTRADO'), howTo: celda(fila, 'QUE_HACER'), responsible: celda(fila, 'RESPONSABLE'),
      classification: celda(fila, 'CLASIFICACION'), status: celda(fila, 'ESTADO'), origin: celda(fila, 'ORIGEN'),
      sourceRow: celda(fila, 'FILA_GENERAL'), detectedAt: celda(fila, 'FECHA_DETECCION'), updatedAt: celda(fila, 'ACTUALIZADO_EN'),
      resolvedAt: celda(fila, 'FECHA_RESOLUCION'), resolvedBy: celda(fila, 'RESUELTO_POR'), resolutionNote: celda(fila, 'OBSERVACION_RESOLUCION')
    }));
    grupos = esqPuntosAGrupos_(puntos);
  } else {
    grupos = datos.slice(1).filter(fila => celda(fila, 'ID_PROCESO')).map(fila => ({
      id: celda(fila, 'ID_PENDIENTE'), processId: celda(fila, 'ID_PROCESO'), shortNo: celda(fila, 'NO_CORTO'), radicado: celda(fila, 'RADICADO'),
      sourceRow: celda(fila, 'FILA_GENERAL'), detail: celda(fila, 'DETALLE'), classification: celda(fila, 'CLASIFICACION'), responsible: celda(fila, 'RESPONSABLE'),
      status: celda(fila, 'ESTADO') || 'PENDIENTE', origin: celda(fila, 'ORIGEN'), detectedAt: celda(fila, 'FECHA_DETECCION'), updatedAt: celda(fila, 'ACTUALIZADO_EN'),
      resolvedAt: celda(fila, 'FECHA_RESOLUCION'), resolvedBy: celda(fila, 'RESUELTO_POR'), resolutionNote: celda(fila, 'OBSERVACION_RESOLUCION') }));
  }
  const deteccion = new Map(grupos.map(grupo => [grupo.processId, grupo.detectedAt || ahora]));
  const filas = esqGruposAFilas_(grupos, [], ahora, procesos)
    .map(grupo => Object.assign(grupo, { detectedAt: deteccion.get(grupo.processId) || ahora }));
  hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(item => item.remove());
  const filtro = hoja.getFilter(); if (filtro) filtro.remove();
  hoja.clear();
  hoja.getRange(1, 1, hoja.getMaxRows(), hoja.getMaxColumns()).clearDataValidations();
  const nuevos = esqEncabezados_('pendientes');
  asegurarDimensiones(hoja, Math.max(filas.length + 1, 2), nuevos.length);
  hoja.getRange(1, 1, 1, nuevos.length).setValues([nuevos]).setFontWeight('bold').setBackground('#344554').setFontColor('#ffffff');
  estFormatearColumnas_(hoja, 'pendientes', 2, Math.max(hoja.getMaxRows() - 1, 1));
  if (filas.length) escribirPorBloques(hoja, filas.map(objeto => esqObjetoAFila_('pendientes', objeto)), 2, 1);
  estFormatoPendientes_(hoja);
  estMarcarCambioDatos_(libro);
  Logger.log('06_PENDIENTES_CALIDAD: ' + (datos.length - 1) + ' filas antiguas -> ' + filas.length + ' procesos.');
  if (reaplicar) {
    estEnIngles_(libro, () => estCrearVistaGeneral_(libro));
    aplicarValidacionesYProtecciones();
  }
  return filas.length;
}

// Agrega a 04_CATALOGOS los valores institucionales y los recibidos que falten. Nunca borra.
function estSembrarCatalogos_(libro, adicionales) {
  const hoja = libro.getSheetByName(ESQUEMA.catalogos.hoja);
  const existentes = estLeerTabla_(libro, 'catalogos');
  const claves = new Set(existentes.map(item => item.category + '|' + esqClaveCatalogo_(item.value)));
  const ahora = new Date().toISOString();
  const usuario = estUsuario_();
  const nuevos = [];
  const agregar = (categoria, valor, origen) => {
    const texto = String(valor || '').trim();
    if (!texto || texto.length > 150) return;
    const clave = categoria + '|' + esqClaveCatalogo_(texto);
    if (claves.has(clave)) return;
    claves.add(clave);
    nuevos.push(esqObjetoAFila_('catalogos', { category: categoria, value: texto, active: true, origin: origen, updatedBy: usuario, updatedAt: ahora }));
  };
  Object.keys(CATALOGO_BASE).forEach(categoria => CATALOGO_BASE[categoria].forEach(valor => agregar(categoria, valor, 'INSTITUCIONAL')));
  Object.keys(adicionales || {}).forEach(categoria => (adicionales[categoria] || []).forEach(valor => agregar(categoria, valor, 'BASE GENERAL')));
  if (nuevos.length) {
    const fila = Math.max(hoja.getLastRow(), 1) + 1;
    asegurarDimensiones(hoja, fila + nuevos.length, nuevos[0].length);
    escribirPorBloques(hoja, nuevos, fila, 1);
  }
  return nuevos.length;
}

// Listas para validación de datos: una columna por catálogo con los valores activos (fórmula).
function estCategoriasLista_() {
  return Object.keys(CATALOGO_BASE).concat(Object.keys(CATALOGOS_COMBINADOS));
}

function estCrearListasCatalogo_(libro) {
  const hoja = libro.getSheetByName(ESQUEMA.catalogos.hoja);
  const categorias = estCategoriasLista_();
  const inicio = EST.columnaListas;
  asegurarDimensiones(hoja, hoja.getMaxRows(), inicio + categorias.length);
  hoja.getRange(1, inicio - 1).setValue('LISTAS ACTIVAS →').setFontStyle('italic');
  categorias.forEach((categoria, index) => {
    const columna = inicio + index;
    hoja.getRange(1, columna).setValue(categoria).setFontWeight('bold').setBackground('#dbe8f5');
    const partes = CATALOGOS_COMBINADOS[categoria] || [categoria];
    const condicion = partes.length === 1 ? '$A$2:$A="' + partes[0] + '"' : '(' + partes.map(parte => '($A$2:$A="' + parte + '")').join('+') + ')>0';
    estPonerFormula_(hoja.getRange(2, columna), '=IFERROR(SORT(UNIQUE(FILTER($B$2:$B,' + condicion + ',$C$2:$C="SI"))),"")');
  });
}

function estRangoLista_(libro, categoria) {
  const index = estCategoriasLista_().indexOf(categoria);
  if (index < 0) return null;
  const letra = nombreColumna(EST.columnaListas + index);
  return libro.getSheetByName(ESQUEMA.catalogos.hoja).getRange(letra + '2:' + letra);
}

// 05_VISTA_GENERAL: vista automática (no se diligencia). Última actuación, días sin actuación, totales,
// pendientes de calidad, rango de pretensión y alertas. Fuente para Looker Studio.
// La calcula el script (no fórmulas): con fórmulas, CADA guardado de la aplicación obligaba a Sheets a recalcular
// toda la vista (COUNTIF de miles de procesos contra miles de actuaciones), y eso hacía lentos los guardados.
// Se actualiza cada hora (programarAutomatizaciones), al validar la calidad y al migrar o depurar.
const EST_VISTA_ = {
  visibles: ['ID_PROCESO', 'NO_CORTO', 'RADICADO', 'DEMANDANTE', 'TIPO_PROCESO', 'ETAPA', 'ESTADO', 'ABOGADO_A_CARGO',
    'INSTANCIA', 'DESPACHO_INICIAL', 'AREA_GENERADORA', 'PARTE_PROCESAL', 'CAUSA', 'FECHA_NOTIFICACION',
    'VALOR_PRETENSIONES', 'MEDIDA_CAUTELAR', 'SENTIDO_FALLO_PRIMERA', 'FECHA_MAX_CONTESTACION_DEMANDA',
    'FECHA_CONTESTACION_DEMANDA', 'FECHA_TERMINACION', 'INCOMPLETO', 'ACTUALIZADO_EN'],
  calculadas: ['ULTIMA_ACTUACION', 'DIAS_SIN_ACTUACION', 'TOTAL_ACTUACIONES', 'TOTAL_ASIGNACIONES', 'PENDIENTES_CALIDAD', 'RANGO_PRETENSION', 'ALERTAS']
};

function estCrearVistaGeneral_(libro) {
  let hoja = libro.getSheetByName(HOJA_VISTA_GENERAL);
  if (!hoja) hoja = libro.insertSheet(HOJA_VISTA_GENERAL);
  hoja.clear();
  const encabezados = EST_VISTA_.visibles.concat(EST_VISTA_.calculadas);
  asegurarDimensiones(hoja, Math.max(hoja.getMaxRows(), 1000), encabezados.length);
  hoja.getRange(1, 1, 1, encabezados.length).setValues([encabezados]).setFontWeight('bold').setBackground('#315d82').setFontColor('#ffffff');
  hoja.setFrozenRows(1);
  hoja.getRange(1, 1).setNote('Vista automática calculada por el script a partir de 01, 02, 03 y 06 (cada hora, al validar la calidad y al migrar o depurar). No se diligencia manualmente. Es la fuente sugerida para Looker Studio.');
  estActualizarVistaGeneral_(libro);
}

// Menú y activador: recalcula 05_VISTA_GENERAL.
function actualizarVistaGeneral() {
  const total = estActualizarVistaGeneral_(obtenerLibro());
  Logger.log('05_VISTA_GENERAL actualizada: ' + total + ' procesos.');
  return total;
}

function estActualizarVistaGeneral_(libro) {
  const hoja = libro.getSheetByName(HOJA_VISTA_GENERAL);
  const fuente = libro.getSheetByName(ESQUEMA.procesos.hoja);
  if (!hoja || !fuente) return 0;
  const zona = Session.getScriptTimeZone();
  const columnas = (tabla, nombres) => {
    const sheet = libro.getSheetByName(ESQUEMA[tabla].hoja);
    if (!sheet || sheet.getLastRow() < 2) return [];
    const indices = nombres.map(nombre => esqIndice_(tabla, nombre));
    const desde = Math.min.apply(null, indices), hasta = Math.max.apply(null, indices);
    return sheet.getRange(2, desde + 1, sheet.getLastRow() - 1, hasta - desde + 1).getValues().map(fila => indices.map(index => fila[index - desde]));
  };
  const clave = valor => esqTextoCelda_(valor);
  const comoFecha = valor => {
    if (valor instanceof Date) return new Date(valor.getFullYear(), valor.getMonth(), valor.getDate());
    const iso = estFecha_(valor, zona);
    return iso ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) : null;
  };
  // 02, 03 y 06 resumidos por proceso (una sola pasada por hoja).
  const ultima = new Map(), totalActuaciones = new Map(), totalAsignaciones = new Map(), pendientes = new Map();
  columnas('actuaciones', ['ID_PROCESO', 'FECHA']).forEach(([id, fecha]) => {
    const key = clave(id); if (!key) return;
    totalActuaciones.set(key, (totalActuaciones.get(key) || 0) + 1);
    const dia = comoFecha(fecha);
    if (dia && (!ultima.has(key) || dia > ultima.get(key))) ultima.set(key, dia);
  });
  columnas('asignaciones', ['ID_PROCESO']).forEach(([id]) => { const key = clave(id); if (key) totalAsignaciones.set(key, (totalAsignaciones.get(key) || 0) + 1); });
  columnas('pendientes', ['ID_PROCESO', 'ESTADO', 'CANTIDAD_PUNTOS']).forEach(([id, estado, cantidad]) => {
    const key = clave(id);
    if (key && String(estado) === 'PENDIENTE') pendientes.set(key, (pendientes.get(key) || 0) + (Number(cantidad) || 1));
  });
  // 01: procesos no eliminados.
  const nombres = EST_VISTA_.visibles.concat(['ESTADO_REGISTRO']);
  const filas01 = columnas('procesos', nombres).filter(fila => clave(fila[0]) && String(fila[nombres.length - 1]) !== 'ELIMINADO');
  const pos = nombre => EST_VISTA_.visibles.indexOf(nombre);
  const radicados = new Map();
  filas01.forEach(fila => { const r = clave(fila[pos('RADICADO')]); if (r) radicados.set(r, (radicados.get(r) || 0) + 1); });
  const hoy = new Date(); const hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const filas = filas01.map(fila => {
    const id = clave(fila[0]);
    const estado = String(fila[pos('ESTADO')] || '');
    const ult = ultima.get(id) || '';
    const dias = ult ? Math.round((hoyDia - ult) / 86400000) : '';
    const valor = fila[pos('VALOR_PRETENSIONES')];
    const numero = valor === '' || valor === null ? null : Number(valor);
    const rango = numero === null || isNaN(numero) ? 'Sin valor' : numero < 10000000 ? '1. Menos de 10 M' : numero < 100000000 ? '2. 10 M a 100 M' : numero < 1000000000 ? '3. 100 M a 1.000 M' : '4. Más de 1.000 M';
    const pend = pendientes.get(id) || 0;
    const maxContestacion = comoFecha(fila[pos('FECHA_MAX_CONTESTACION_DEMANDA')]);
    const alertas = [];
    if (estado === 'Terminado' && estVacio_(fila[pos('FECHA_TERMINACION')])) alertas.push('Terminado sin fecha de terminación.');
    if (estado === 'Activo' && dias !== '' && dias > EST.diasSinActuacion) alertas.push('Sin actuación hace más de ' + EST.diasSinActuacion + ' días.');
    if (estado === 'Activo' && !ult) alertas.push('Sin actuaciones registradas.');
    if (estado === 'Activo' && maxContestacion && estVacio_(fila[pos('FECHA_CONTESTACION_DEMANDA')]) && maxContestacion < hoyDia) alertas.push('Contestación de demanda vencida sin registrar.');
    if (pend > 0) alertas.push('Incidencias de calidad pendientes.');
    const radicado = clave(fila[pos('RADICADO')]);
    if (radicado && radicados.get(radicado) > 1) alertas.push('Radicado repetido.');
    return fila.slice(0, EST_VISTA_.visibles.length).concat([ult, dias, totalActuaciones.get(id) || 0, totalAsignaciones.get(id) || 0, pend, rango, alertas.join(' ')]);
  });
  const ancho = EST_VISTA_.visibles.length + EST_VISTA_.calculadas.length;
  if (hoja.getLastRow() > 1) hoja.getRange(2, 1, hoja.getLastRow() - 1, Math.max(hoja.getLastColumn(), ancho)).clearContent();
  if (filas.length) {
    asegurarDimensiones(hoja, filas.length + 1, ancho);
    const col = nombre => EST_VISTA_.visibles.concat(EST_VISTA_.calculadas).indexOf(nombre) + 1;
    ['FECHA_NOTIFICACION', 'FECHA_MAX_CONTESTACION_DEMANDA', 'FECHA_CONTESTACION_DEMANDA', 'FECHA_TERMINACION', 'ULTIMA_ACTUACION']
      .forEach(nombre => hoja.getRange(2, col(nombre), filas.length, 1).setNumberFormat('yyyy-mm-dd'));
    hoja.getRange(2, col('VALOR_PRETENSIONES'), filas.length, 1).setNumberFormat('0');
    hoja.getRange(2, 1, filas.length, ancho).setValues(filas);
  }
  return filas.length;
}

// 00_DICCIONARIO: nombre, definición, tipo, obligatoriedad, formato, regla, catálogo, origen y responsable.
function estCrearDiccionario_(libro) {
  const tipos = { id: 'Identificador (texto)', text: 'Texto', date: 'Fecha', number: 'Numérico', datetime: 'Fecha y hora (ISO)', flag: 'SI / NO', list: 'Lista separada por |' };
  const filas = [['HOJA', 'CAMPO', 'NOMBRE_TECNICO', 'DEFINICION', 'TIPO', 'OBLIGATORIEDAD', 'FORMATO', 'REGLA_VALIDACION', 'CATALOGO', 'ORIGEN', 'RESPONSABLE']];
  Object.keys(ESQUEMA).forEach(tabla => {
    ESQUEMA[tabla].columnas.forEach(col => {
      const tipo = col[2];
      const categoria = tipo.indexOf('cat:') === 0 ? tipo.slice(4) : '';
      const formato = tipo === 'date' ? 'AAAA-MM-DD' : tipo === 'number' ? 'Entero, sin $ ni separadores' : categoria ? 'Valor exacto del catálogo' : tipo === 'datetime' ? 'AAAA-MM-DDThh:mm:ssZ' : 'Texto plano';
      const regla = col[7] || (tipo === 'date' ? 'Solo fechas válidas o vacío (no "N/A", "sin recurso", "en tiempo")'
        : categoria ? 'Lista cerrada protegida (04_CATALOGOS)' : tipo === 'number' ? 'Número mayor o igual a 0'
          : tipo === 'id' ? 'Único; no se modifica' : 'Un solo dato por celda');
      filas.push([ESQUEMA[tabla].hoja, col[0], col[1], col[6], categoria ? 'Categórico' : tipos[tipo] || tipo, col[3], formato, regla, categoria, col[5], col[4]]);
    });
  });
  [['ULTIMA_ACTUACION', 'Fecha de la actuación más reciente.'], ['DIAS_SIN_ACTUACION', 'Días desde la última actuación.'],
    ['TOTAL_ACTUACIONES', 'Número de registros en 02_ACTUACIONES.'], ['TOTAL_ASIGNACIONES', 'Número de responsables que ha tenido.'],
    ['PENDIENTES_CALIDAD', 'Incidencias de calidad sin resolver.'], ['RANGO_PRETENSION', 'Rango del valor de las pretensiones.'],
    ['ALERTAS', 'Alertas de calidad y seguimiento calculadas.']].forEach(([campo, definicion]) => {
    filas.push([HOJA_VISTA_GENERAL, campo, '', definicion, 'Calculado', 'Automático', '', 'Fórmula; no se diligencia', '', 'Fórmula', 'Sistema']);
  });
  const hoja = prepararHoja(HOJA_DICCIONARIO);
  escribirPorBloques(hoja, filas, 1, 1);
  hoja.getRange(1, 1, 1, filas[0].length).setFontWeight('bold').setBackground('#344554').setFontColor('#ffffff');
  hoja.setFrozenRows(1);
}

function estOrdenarPestanas_(libro) {
  [HOJA_DICCIONARIO, ESQUEMA.procesos.hoja, ESQUEMA.actuaciones.hoja, ESQUEMA.asignaciones.hoja, ESQUEMA.catalogos.hoja,
    HOJA_VISTA_GENERAL, ESQUEMA.pendientes.hoja, ESQUEMA.auditoria.hoja].forEach((nombre, index) => {
    const hoja = libro.getSheetByName(nombre);
    if (!hoja) return;
    libro.setActiveSheet(hoja);
    libro.moveActiveSheet(index + 1);
  });
}

// Listas cerradas, tipos de dato, reglas condicionales (formato) y protección de catálogos e historiales.
function aplicarValidacionesYProtecciones() {
  const libro = obtenerLibro();
  estMarcarCambioDatos_(libro); // la app vuelve a revisar las reglas (ahora solo advierten) y escribe directo
  ['procesos', 'actuaciones', 'asignaciones', 'pendientes'].forEach(tabla => {
    const hoja = libro.getSheetByName(ESQUEMA[tabla].hoja);
    if (!hoja) return;
    const filas = hoja.getMaxRows() - 1;
    ESQUEMA[tabla].columnas.forEach((col, index) => {
      const rango = hoja.getRange(2, index + 1, filas, 1);
      const tipo = col[2];
      let regla = null;
      if (tipo.indexOf('cat:') === 0) {
        const lista = estRangoLista_(libro, tipo.slice(4));
        if (lista) regla = SpreadsheetApp.newDataValidation().requireValueInRange(lista, true).setAllowInvalid(true)
          .setHelpText('Seleccione un valor del catálogo ' + tipo.slice(4) + ' (04_CATALOGOS).').build();
      } else if (tipo === 'date') {
        regla = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).setHelpText('Solo fechas (AAAA-MM-DD) o vacío.').build();
      } else if (tipo === 'number') {
        regla = SpreadsheetApp.newDataValidation().requireNumberGreaterThanOrEqualTo(0).setAllowInvalid(true).setHelpText('Número sin $ ni separadores.').build();
      } else if (tabla === 'procesos' && col[0] === 'RADICADO') {
        const letra = nombreColumna(index + 1);
        const formula = '=OR(LEN(' + letra + '2)=0,REGEXMATCH(TO_TEXT(' + letra + '2),"^[0-9]{23}$"))';
        estConSeparadorLocal_(formula, version => rango.setDataValidation(SpreadsheetApp.newDataValidation()
          .requireFormulaSatisfied(version).setAllowInvalid(true).setHelpText('El radicado debe tener exactamente 23 dígitos.').build()));
      }
      if (regla) rango.setDataValidation(regla);
    });
  });

  // Reglas condicionales visibles en 01_PROCESOS.
  const procesos = libro.getSheetByName(ESQUEMA.procesos.hoja);
  if (procesos) {
    const columnas = esqEncabezados_('procesos').length;
    const letra = encabezado => nombreColumna(esqIndice_('procesos', encabezado) + 1);
    const todo = procesos.getRange(2, 1, procesos.getMaxRows() - 1, columnas);
    const terminadoSinFecha = '=AND($' + letra('ESTADO') + '2="Terminado",$' + letra('FECHA_TERMINACION') + '2="")';
    // Sin regla de «radicado repetido» con COUNTIF: comparaba cada fila con todas las demás (con 20.000 procesos,
    // 400 millones de comparaciones que Sheets recalculaba en cada escritura y frenaban los guardados). Los
    // radicados repetidos los rechaza la aplicación al guardar y los reporta el control de calidad en 06 y la vista 05.
    const eliminado = '=$' + letra('ESTADO_REGISTRO') + '2="ELIMINADO"';
    estConSeparadorLocal_('', (version, separador) => procesos.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(estFormulaLocal_(terminadoSinFecha, separador))
        .setBackground('#fde8d7').setRanges([todo]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(eliminado)
        .setFontColor('#9aa5ae').setStrikethrough(true).setRanges([todo]).build()
    ]));
  }

  // Protección: TODAS las hojas 00–07 quedan bloqueadas (solo consulta). Todo se gestiona desde la aplicación,
  // que se ejecuta como el propietario; solo el propietario (y quien corre este script) puede editar en la hoja.
  const propietario = Session.getEffectiveUser();
  [HOJA_DICCIONARIO, ESQUEMA.procesos.hoja, ESQUEMA.actuaciones.hoja, ESQUEMA.asignaciones.hoja, ESQUEMA.catalogos.hoja,
    HOJA_VISTA_GENERAL, ESQUEMA.pendientes.hoja, ESQUEMA.auditoria.hoja].forEach(nombre => {
    const hoja = libro.getSheetByName(nombre);
    if (!hoja) return;
    hoja.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(item => item.remove());
    const proteccion = hoja.protect().setDescription('Solo consulta: se gestiona desde la aplicación (los cambios quedan en 07_AUDITORIA).');
    try {
      proteccion.removeEditors(proteccion.getEditors());
      if (propietario && propietario.getEmail()) proteccion.addEditor(propietario);
      if (proteccion.canDomainEdit()) proteccion.setDomainEdit(false);
    } catch (error) {
      Logger.log('No se pudieron ajustar los editores de ' + nombre + ': ' + error.message);
    }
  });
  mostrarMensaje('Validaciones, formatos condicionales y protecciones aplicados.');
}

// =============================================================================
// MES 2. MIGRACIÓN DESDE General (o BASE_LIMPIA) A LA NUEVA ESTRUCTURA
// =============================================================================

// Opciones: { sobrescribirEditados: true } reemplaza también procesos ya editados en la aplicación.
function migrarANuevaEstructura(opciones) {
  const inicio = new Date();
  const options = opciones && !opciones.triggerUid ? opciones : {};
  const libro = obtenerLibro();
  ['procesos', 'actuaciones', 'asignaciones', 'catalogos', 'pendientes', 'auditoria'].forEach(tabla => {
    if (!libro.getSheetByName(ESQUEMA[tabla].hoja)) throw new Error('Falta la pestaña ' + ESQUEMA[tabla].hoja + '. Ejecuta primero "Crear estructura de la base".');
  });
  const ahora = new Date().toISOString();
  const zona = Session.getScriptTimeZone();

  // 1. Fuente: General (original, solo lectura). La limpieza de espacios de la etapa 1 se aplica aquí mismo,
  //    porque BASE_LIMPIA puede haber convertido radicados de 23 dígitos en números (pérdida de precisión).
  const fuente = obtenerHoja(CONFIG.HOJA_ORIGEN);
  const valores = fuente.getDataRange().getValues();
  const disposicion = estDetectarGeneral_(valores);
  const idsAnteriores = estIdsAnteriores_(libro, disposicion, valores);

  // 2. Lo que ya existe en la nueva estructura (re-ejecuciones y uso de la aplicación).
  const existentes = new Map(estLeerTabla_(libro, 'procesos').map(item => [item.id, item]));
  // Enlace fila de General -> proceso: ORIGEN de 01_PROCESOS ("GENERAL fila N"). General queda congelada como histórico.
  const porOrigen = new Map();
  existentes.forEach(item => { if (item.origin) porOrigen.set(item.origin, item.id) });
  const actuaciones = new Map(estLeerTabla_(libro, 'actuaciones').map(item => [item.id, item]));
  const asignaciones = estLeerTabla_(libro, 'asignaciones');
  estConvertirPendientes_(libro, true);
  const pendientes = estLeerTabla_(libro, 'pendientes');
  const auditoria = estLeerTabla_(libro, 'auditoria');
  const exentosMigracion = esqExentosObligatorios_(auditoria);
  const hallazgosRevision = [];
  const procesosConAsignacion = new Set(asignaciones.map(item => item.processId));

  // 3. Filas de General -> procesos.
  const conteoRadicados = new Map();
  disposicion.filas.forEach(index => {
    const radicado = estLimpiarRadicado_(valores[index][disposicion.columnas.radicado]);
    if (radicado) conteoRadicados.set(radicado, (conteoRadicados.get(radicado) || 0) + 1);
  });
  const usados = new Map();
  const migrados = new Map();
  const reporte = [];
  const resumen = { filas: disposicion.filas.length, creados: 0, actualizados: 0, omitidos: 0, actuaciones: 0, validados: 0, corregibles: 0, revision: 0 };
  disposicion.filas.forEach(index => {
    const fila = index + 1;
    const idAnterior = idsAnteriores[index] || '';
    if (idAnterior.indexOf(EST.prefijoEliminado) === 0) {
      // Se conserva como ELIMINADO (borrado lógico) para que las siguientes migraciones no lo recreen.
      const idEliminado = idAnterior.slice(EST.prefijoEliminado.length);
      if (!existentes.has(idEliminado)) {
        existentes.set(idEliminado, { id: idEliminado, recordStatus: 'ELIMINADO', origin: 'GENERAL fila ' + fila,
          shortNo: estTexto_(valores[index][disposicion.columnas.shortNo], zona), createdAt: ahora, createdBy: MIGRACION.usuario,
          updatedAt: ahora, updatedBy: MIGRACION.usuario, notes: 'Eliminado en la aplicación anterior.' });
      }
      resumen.omitidos++;
      reporte.push([fila, '', '', idEliminado, 'OMITIDO', '', 'El proceso fue eliminado en la aplicación anterior (queda como ELIMINADO).']);
      return;
    }
    const mapeo = estMapearFilaGeneral_(valores[index], disposicion, zona, fila);
    const proceso = mapeo.proceso;
    const origen = 'GENERAL fila ' + fila;
    const id = (estIdSeguro_(idAnterior) && idAnterior) || porOrigen.get(origen) || estIdImportacion_(proceso, usados);
    proceso.id = id;
    proceso.origin = origen;
    mapeo.actuaciones.forEach(actuacion => { actuacion.id = id + '_G' + actuacion.bloque });
    if (proceso.radicado && conteoRadicados.get(proceso.radicado) > 1) {
      mapeo.hallazgos.push(estHallazgo_('radicado', proceso.radicado, '', 'Radicado repetido en General (' + conteoRadicados.get(proceso.radicado) + ' filas); no se puede asumir cuál es el correcto.', EST.clasificacion.revision, EST.responsable.coordinacion));
    }
    migrados.set(id, mapeo);
  });

  // 4. Procesos de la aplicación anterior (hoja PROCESOS con DATA_JSON): los editados en la app prevalecen.
  const anterior = estLeerAplicacionAnterior_(libro);
  anterior.procesos.forEach(proceso => {
    const editado = proceso.updatedBy && proceso.updatedBy !== MIGRACION.usuarioAnterior;
    if (!editado && migrados.has(proceso.id)) return;
    const base = migrados.get(proceso.id);
    const mapeo = { proceso: Object.assign({}, proceso, { origin: (base && base.proceso.origin) || 'APLICACIÓN ANTERIOR' }), actuaciones: base ? base.actuaciones : [], hallazgos: [], asignacionFecha: base ? base.asignacionFecha : '', deApp: true };
    estNormalizarCategoricos_(mapeo.proceso, mapeo.hallazgos);
    migrados.set(proceso.id, mapeo);
  });

  // 5. Homologar variantes de escritura en catálogos abiertos (ej. "juzgado 1 adtivo" vs "JUZGADO 1 ADTIVO").
  const catalogoActual = estLeerTabla_(libro, 'catalogos');
  const catalogoAbierto = estHomologarCatalogos_([...migrados.values()], catalogoActual);

  // 6. Consolidar en las tablas.
  const ahoraFecha = ahora.slice(0, 10);
  migrados.forEach((mapeo, id) => {
    const proceso = mapeo.proceso;
    const previo = existentes.get(id);
    const fila = String(proceso.origin || '').replace('GENERAL fila ', '');
    if (previo && previo.recordStatus === 'ELIMINADO') { resumen.omitidos++; reporte.push([fila, proceso.shortNo, proceso.radicado, id, 'OMITIDO', '', 'Marcado como ELIMINADO en 01_PROCESOS.']); return; }
    const editadoEnApp = previo && previo.updatedBy && [MIGRACION.usuario, MIGRACION.usuarioAnterior].indexOf(previo.updatedBy) < 0;
    if (editadoEnApp && !options.sobrescribirEditados) {
      resumen.omitidos++;
      reporte.push([fila, proceso.shortNo, proceso.radicado, id, 'OMITIDO', '', 'Ya fue editado en la aplicación por ' + previo.updatedBy + '; no se sobrescribe.']);
      return;
    }
    const exentos = exentosMigracion.get(id) || new Set();
    const faltantes = EST.obligatoriosRegistro.filter(campo => !String(proceso[campo] || '').trim() && !exentos.has(campo));
    const registro = Object.assign({}, proceso, {
      recordStatus: 'ACTIVO',
      incomplete: faltantes.length > 0, missingFields: faltantes,
      createdAt: (previo && previo.createdAt) || proceso.createdAt || ahora,
      createdBy: (previo && previo.createdBy) || proceso.createdBy || MIGRACION.usuario,
      updatedAt: mapeo.deApp ? (proceso.updatedAt || ahora) : ahora,
      updatedBy: mapeo.deApp ? proceso.updatedBy : MIGRACION.usuario
    });
    existentes.set(id, registro);
    if (previo) resumen.actualizados++; else resumen.creados++;

    // Actuaciones históricas: una fila por actuación (formato vertical).
    mapeo.actuaciones.forEach(actuacion => {
      const actual = actuaciones.get(actuacion.id);
      if (actual && actual.registeredBy !== MIGRACION.usuario && actual.registeredBy !== MIGRACION.usuarioAnterior) return;
      actuaciones.set(actuacion.id, Object.assign({ processId: id, radicado: registro.radicado, clase: 'ACTUACION', source: MIGRACION.fuente,
        registeredBy: MIGRACION.usuario, createdAt: ahora, registrationDate: ahoraFecha }, actuacion));
      resumen.actuaciones++;
    });

    // Asignación inicial (historial de responsables) y faltantes.
    if (!procesosConAsignacion.has(id)) {
      if (registro.lawyer) {
        asignaciones.push({ id: id + '_A1', processId: id, radicado: registro.radicado, lawyer: registro.lawyer,
          lawyerLinkType: registro.lawyerLinkType || '', startDate: mapeo.asignacionFecha || '', endDate: '',
          origin: mapeo.deApp ? 'APLICACIÓN ANTERIOR' : 'MIGRACIÓN GENERAL', registeredBy: MIGRACION.usuario, registeredAt: ahora,
          note: mapeo.asignacionFecha ? '' : 'Sin fecha de asignación en General.' });
        if (!mapeo.asignacionFecha) mapeo.hallazgos.push(estHallazgo_('FECHA ASIGNACION', '', '', 'Falta la fecha de asignación del abogado (historial de responsables incompleto).', EST.clasificacion.revision, EST.responsable.coordinacion));
      } else {
        mapeo.hallazgos.push(estHallazgo_('lawyer', '', '', 'El proceso no tiene abogado a cargo.', EST.clasificacion.revision, EST.responsable.coordinacion));
      }
      procesosConAsignacion.add(id);
    }

    // Lo que requiere revisión va a 06 (un registro por proceso). Lo corregido automáticamente queda en REPORTE_MIGRACION.
    let peor = EST.clasificacion.validado;
    mapeo.hallazgos.forEach(hallazgo => {
      if (hallazgo.classification === EST.clasificacion.revision) peor = EST.clasificacion.revision;
      else if (peor === EST.clasificacion.validado) peor = EST.clasificacion.corregible;
      if (hallazgo.classification === EST.clasificacion.revision) hallazgosRevision.push(Object.assign({ processId: id, sourceRow: fila, origin: 'MIGRACIÓN' }, hallazgo));
    });
    if (peor === EST.clasificacion.validado) resumen.validados++;
    else if (peor === EST.clasificacion.corregible) resumen.corregibles++;
    else resumen.revision++;
    reporte.push([fila, registro.shortNo, registro.radicado, id, previo ? 'ACTUALIZADO' : 'CREADO', peor, mapeo.hallazgos.map(h => h.problem).join(' | ')]);
  });

  // Historiales de la aplicación anterior: diligencias, comités, actuaciones propias y auditoría.
  anterior.actuaciones.forEach(item => { if (existentes.has(item.processId) && !actuaciones.has(item.id)) actuaciones.set(item.id, Object.assign({ radicado: (existentes.get(item.processId) || {}).radicado || '' }, item)) });
  const idsAuditoria = new Set(auditoria.map(item => item.id));
  anterior.auditoria.forEach(item => { if (!idsAuditoria.has(item.id)) auditoria.push(item) });

  // TIPO de 02_ACTUACIONES dentro de su lista cerrada (según la clase del registro).
  estAjustarTiposActuacion_([...actuaciones.values()], catalogoActual);

  // 7. Escribir todo en bloque.
  estEscribirTabla_(libro, 'procesos', [...existentes.values()]);
  estEscribirTabla_(libro, 'actuaciones', [...actuaciones.values()]);
  estEscribirTabla_(libro, 'asignaciones', asignaciones);
  const mapaProcesos = new Map([...existentes.values()].map(item => [item.id, { shortNo: item.shortNo, radicado: item.radicado }]));
  estEscribirTabla_(libro, 'pendientes', esqFusionarPendientes_(pendientes, hallazgosRevision, ahora, { procesos: mapaProcesos, cerrados: esqCerradosCalidad_(auditoria) }));
  estEscribirTabla_(libro, 'auditoria', auditoria);
  Object.keys(anterior.catalogos).forEach(categoria => { catalogoAbierto[categoria] = (catalogoAbierto[categoria] || []).concat(anterior.catalogos[categoria]) });
  const nuevosCatalogo = estSembrarCatalogos_(libro, catalogoAbierto);
  estEscribirReporteMigracion_(reporte, resumen);
  eliminarColumnaIdAplicacion();
  PropertiesService.getScriptProperties().setProperty('ULTIMA_MIGRACION', ahora);
  estActualizarVistaGeneral_(libro);

  const segundos = ((new Date() - inicio) / 1000).toFixed(1);
  const mensaje = 'Migración: ' + resumen.filas + ' filas · ' + resumen.creados + ' creados · ' + resumen.actualizados + ' actualizados · ' +
    resumen.omitidos + ' omitidos · ' + resumen.actuaciones + ' actuaciones · VALIDADO ' + resumen.validados + ' · CORREGIBLE ' +
    resumen.corregibles + ' · REVISIÓN ' + resumen.revision + ' · ' + nuevosCatalogo + ' valores de catálogo · ' + segundos + ' s.';
  mostrarMensaje(mensaje);
  Logger.log(mensaje);
  return mensaje;
}

// Ubica cada columna por su encabezado y el bloque de anotaciones (FECHA / TIPO / DESCRIPCIÓN).
function estDetectarGeneral_(valores) {
  let filaEncabezado = -1;
  for (let index = 0; index < Math.min(valores.length, 10); index++) {
    if (valores[index].some(celda => esqNormalizar_(celda) === 'NO. CORTO')) { filaEncabezado = index; break; }
  }
  if (filaEncabezado < 0) throw new Error('No se encontró la fila de encabezados (columna "No. CORTO") en ' + CONFIG.HOJA_ORIGEN + '.');
  const encabezados = valores[filaEncabezado].map(esqNormalizar_);
  const columnas = {};
  Object.keys(EST_COLUMNAS_GENERAL).forEach(nombre => {
    const index = encabezados.indexOf(nombre);
    if (index >= 0) columnas[EST_COLUMNAS_GENERAL[nombre]] = index;
  });
  if (columnas.shortNo === undefined || columnas.radicado === undefined) throw new Error('General debe tener las columnas "No. CORTO" y "RADICADO".');
  const notas = {
    informe: encabezados.findIndex(item => item.indexOf('INFORME') === 0),
    fecha: encabezados.indexOf('FECHA'),
    anotacion: encabezados.indexOf('ANOTACION'),
    asignacion: encabezados.indexOf('FECHA ASIGNACION')
  };
  const ultimaBase = Math.max.apply(null, Object.keys(columnas).map(clave => columnas[clave]).concat([notas.informe, notas.fecha, notas.anotacion]));
  const idAnterior = encabezados.indexOf(EST.columnaIdAnterior);
  const limites = [notas.asignacion, idAnterior].filter(index => index > ultimaBase);
  const finActuaciones = limites.length ? Math.min.apply(null, limites) : encabezados.length;
  const base = Object.keys(columnas).map(clave => columnas[clave]);
  const filas = [];
  for (let index = filaEncabezado + 1; index < valores.length; index++) {
    if (base.some(columna => !estVacio_(valores[index][columna]))) filas.push(index);
  }
  return { filaEncabezado, encabezados, columnas, notas, idAnterior, inicioActuaciones: ultimaBase + 1, finActuaciones, filas };
}

// IDs que dejó la aplicación anterior en la columna ID_APLICACION (se usan antes de borrar la columna).
function estIdsAnteriores_(libro, disposicion, valores) {
  const ids = {};
  let columna = disposicion.idAnterior;
  let fuente = valores;
  if (columna < 0) {
    const general = libro.getSheetByName(CONFIG.HOJA_ORIGEN);
    if (!general) return ids;
    const datos = general.getDataRange().getValues();
    columna = (datos[disposicion.filaEncabezado] || []).map(esqNormalizar_).indexOf(EST.columnaIdAnterior);
    if (columna < 0) return ids;
    fuente = datos;
  }
  disposicion.filas.forEach(index => { ids[index] = String((fuente[index] || [])[columna] || '').trim() });
  return ids;
}

function estMapearFilaGeneral_(fila, disposicion, zona, numeroFila) {
  const c = disposicion.columnas;
  const obtener = campo => (c[campo] === undefined ? '' : fila[c[campo]]);
  const hallazgos = [];
  const extras = [];
  const proceso = {};
  const texto = campo => estTexto_(obtener(campo), zona);
  let anticipada = false;

  const fecha = (campo, etiqueta) => {
    const crudo = obtener(campo);
    if (estSentenciaAnticipada_(crudo)) {
      anticipada = true;
      hallazgos.push(estHallazgo_(campo, estTexto_(crudo, zona), 'Sentencia anticipada = Sí', etiqueta + ' contenía el texto "SENTENCIA ANTICIPADA" en un campo de fecha; se registró como sentencia anticipada.', EST.clasificacion.corregible, EST.responsable.analista));
      return '';
    }
    const iso = estFecha_(crudo, zona);
    if (iso && typeof crudo === 'string' && (crudo.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{1,2}-\d{1,2}/g) || []).length > 1) {
      extras.push(etiqueta + ': ' + estTexto_(crudo, zona));
      hallazgos.push(estHallazgo_(campo, estTexto_(crudo, zona), iso, etiqueta + ' tenía varias fechas en una celda; se tomó la primera y el texto completo quedó en Observaciones.', EST.clasificacion.corregible, EST.responsable.analista));
    } else if (iso && typeof crudo === 'string') {
      hallazgos.push(estHallazgo_(campo, crudo, iso, etiqueta + ' estaba escrita como texto; se convirtió a fecha.', EST.clasificacion.corregible, EST.responsable.analista));
    }
    if (!iso && !estVacio_(crudo)) {
      extras.push(etiqueta + ': ' + estTexto_(crudo, zona));
      hallazgos.push(estHallazgo_(campo, estTexto_(crudo, zona), '', etiqueta + ' no es una fecha válida; el campo quedó vacío y el texto en Observaciones.', EST.clasificacion.revision, EST.responsable.juridico));
    }
    return iso;
  };

  const noCorto = estSepararNoCorto_(texto('shortNo'));
  proceso.shortNo = noCorto.codigo;
  if (noCorto.resto) {
    extras.push('No. corto (texto adicional): ' + noCorto.resto);
    hallazgos.push(estHallazgo_('shortNo', texto('shortNo'), noCorto.codigo, 'El No. corto traía texto adicional; se dejó solo AAAA-NNNNN y el texto quedó en Observaciones.', EST.clasificacion.corregible, EST.responsable.analista));
  } else if (noCorto.codigo !== texto('shortNo')) {
    hallazgos.push(estHallazgo_('shortNo', texto('shortNo'), noCorto.codigo, 'No. corto ajustado al formato AAAA-NNNNN.', EST.clasificacion.corregible, EST.responsable.analista));
  }
  const radicadoCrudo = texto('radicado');
  proceso.radicado = estLimpiarRadicado_(obtener('radicado'));
  if (radicadoCrudo && !proceso.radicado) {
    hallazgos.push(estHallazgo_('radicado', radicadoCrudo, '', 'El radicado no tiene 23 dígitos; requiere verificación contra el expediente.', EST.clasificacion.revision, EST.responsable.juridico));
  } else if (radicadoCrudo && radicadoCrudo !== proceso.radicado) {
    hallazgos.push(estHallazgo_('radicado', radicadoCrudo, proceso.radicado, 'Se quitaron espacios o separadores del radicado.', EST.clasificacion.corregible, EST.responsable.analista));
  }
  proceso.currentRadicado = estLimpiarRadicado_(obtener('currentRadicado')) || texto('currentRadicado');
  proceso.siproJ = estEntero_(obtener('siproJ')) || texto('siproJ');
  proceso.orfeo = texto('orfeo');
  proceso.ids = estEntero_(obtener('ids')) || texto('ids');
  proceso.claimant = texto('claimant');
  proceso.defendant = texto('defendant');
  proceso.instance = texto('instance');
  proceso.type = texto('type');
  proceso.court = texto('court');
  proceso.cause = texto('cause');
  proceso.claim = texto('claim');
  const valor = estValor_(obtener('amount'), zona);
  proceso.amount = valor.numero;
  if (valor.hallazgo) hallazgos.push(estHallazgo_('amount', texto('amount'), valor.numero, valor.hallazgo, valor.numero ? EST.clasificacion.corregible : EST.clasificacion.revision, valor.numero ? EST.responsable.analista : EST.responsable.juridico));
  if (!valor.numero && !estVacio_(obtener('amount'))) extras.push('Valor de las pretensiones: ' + texto('amount'));
  proceso.area = texto('area');
  proceso.stage = texto('stage');
  proceso.state = texto('state');
  proceso.endDate = fecha('endDate', 'Fecha de terminación');
  proceso.quality = texto('quality');
  proceso.notificationDate = fecha('notificationDate', 'Fecha de notificación');
  proceso.cautelar = texto('cautelar');
  proceso.measureResponseDate = fecha('measureResponseDate', 'Fecha de contestación de medida cautelar');
  proceso.maxDemandResponseDate = fecha('maxDemandResponseDate', 'Fecha máxima de contestación de demanda');
  proceso.demandResponseDate = fecha('demandResponseDate', 'Fecha de contestación de demanda');
  proceso.initialAudienceDate = fecha('initialAudienceDate', 'Audiencia inicial');

  // PRUEBAS de General: la fecha es la FECHA_AUDIENCIA_PRUEBAS (único campo de pruebas); un texto pasa a Observaciones.
  const pruebas = obtener('evidence');
  const fechaPruebas = estFecha_(pruebas, zona);
  if (estSentenciaAnticipada_(pruebas)) anticipada = true;
  proceso.evidenceAudienceDate = fechaPruebas;
  const textoPruebas = fechaPruebas || estSentenciaAnticipada_(pruebas) ? '' : estTexto_(pruebas, zona);
  if (textoPruebas) extras.push('Pruebas: ' + textoPruebas);
  if (fechaPruebas) hallazgos.push(estHallazgo_('evidenceAudienceDate', estTexto_(pruebas, zona), fechaPruebas, 'PRUEBAS contenía una fecha; se registró como fecha de audiencia de pruebas.', EST.clasificacion.corregible, EST.responsable.analista));

  proceso.closingArgumentsDate = fecha('closingArgumentsDate', 'Fecha de alegatos');
  proceso.firstInstanceDecisionDate = fecha('firstInstanceDecisionDate', 'Fecha de fallo de primera instancia');
  proceso.firstInstanceDecisionSense = texto('firstInstanceDecisionSense');

  // FECHA DE PRESENTACIÓN DEL RECURSO mezcla fechas con textos (SIN RECURSO...): se separa en fecha + estado.
  const recurso = obtener('appealDate');
  const recursoIso = estFecha_(recurso, zona);
  const recursoClave = esqNormalizar_(estTexto_(recurso, zona));
  proceso.appealDate = recursoIso;
  proceso.appealStatus = '';
  if (!recursoIso && recursoClave) {
    if (['SIN RECURSO', 'NO SE PRESENTO', 'NO'].indexOf(recursoClave) >= 0) {
      proceso.appealStatus = 'No presentado';
      hallazgos.push(estHallazgo_('appealDate', estTexto_(recurso, zona), 'Estado del recurso = No presentado', 'Texto en un campo de fecha; se registró como estado del recurso.', EST.clasificacion.corregible, EST.responsable.analista));
    } else {
      extras.push('Recurso de apelación: ' + estTexto_(recurso, zona));
      hallazgos.push(estHallazgo_('appealDate', estTexto_(recurso, zona), '', 'El campo de fecha del recurso contiene un texto que no se puede interpretar sin validación.', EST.clasificacion.revision, EST.responsable.juridico));
    }
  }
  proceso.anticipatedJudgment = anticipada ? 'Sí' : '';
  proceso.secondInstanceDecisionDate = fecha('secondInstanceDecisionDate', 'Fecha de fallo de segunda instancia');
  proceso.secondCourt = texto('secondCourt');
  const falloSegunda = texto('secondInstanceDecisionSense');
  proceso.secondInstanceDecisionSense = falloSegunda;
  proceso.secondInstanceDecision = falloSegunda;
  proceso.lawyer = texto('lawyer');
  proceso.lawyerLinkType = texto('lawyerLinkType');
  proceso.represents = texto('represents');

  // INFORME tiene su propio campo; FECHA / ANOTACIÓN (última anotación) es derivable: se carga como actuación.
  const n = disposicion.notas;
  proceso.report = n.informe >= 0 ? estTexto_(fila[n.informe], zona) : '';
  const actuaciones = [];
  const sueltas = [];
  for (let columna = disposicion.inicioActuaciones; columna < disposicion.finActuaciones && columna < fila.length; columna += 3) {
    const crudo = fila[columna];
    const tipo = estTexto_(fila[columna + 1], zona);
    const descripcion = estTexto_(fila[columna + 2], zona);
    if (estVacio_(crudo) && !tipo && !descripcion) continue;
    let iso = estFecha_(crudo, zona);
    let tipoFinal = tipo;
    let descripcionFinal = descripcion;
    if (!iso) {
      // La fecha puede venir escrita al inicio del texto: "27/03/2023 - ESTADO - ...".
      const embebida = estFechaAlInicio_([estTexto_(crudo, zona), tipo, descripcion].filter(Boolean).join(' - '), zona);
      if (!embebida.iso) { sueltas.push([estTexto_(crudo, zona), tipo, descripcion].filter(Boolean).join(' - ')); continue; }
      iso = embebida.iso;
      descripcionFinal = embebida.resto;
      tipoFinal = '';
      hallazgos.push(estHallazgo_('ACTUACIONES', [estTexto_(crudo, zona), tipo, descripcion].filter(Boolean).join(' - ').slice(0, 500), iso, 'La fecha de la anotación estaba escrita dentro del texto; se tomó esa fecha.', EST.clasificacion.corregible, EST.responsable.analista));
    }
    actuaciones.push({ id: '', bloque: (columna - disposicion.inicioActuaciones) / 3 + 1, date: iso, type: estTipoActuacion_(tipoFinal + ' ' + descripcionFinal),
      title: tipoFinal || 'Actuación', description: descripcionFinal || tipoFinal || 'Actuación registrada en la base General' });
  }
  if (n.anotacion >= 0 && !estVacio_(fila[n.anotacion])) {
    let iso = n.fecha >= 0 ? estFecha_(fila[n.fecha], zona) : '';
    let descripcion = estTexto_(fila[n.anotacion], zona);
    if (!iso) {
      const embebida = estFechaAlInicio_(descripcion, zona);
      if (embebida.iso) {
        hallazgos.push(estHallazgo_('ACTUACIONES', descripcion.slice(0, 500), embebida.iso, 'La fecha de la última anotación estaba escrita dentro del texto; se tomó esa fecha.', EST.clasificacion.corregible, EST.responsable.analista));
        iso = embebida.iso;
        descripcion = embebida.resto;
      }
    }
    const repetida = actuaciones.some(item => item.date === iso && esqNormalizar_(item.description) === esqNormalizar_(descripcion));
    if (iso && !repetida) actuaciones.push({ id: null, bloque: 'U', date: iso, type: estTipoActuacion_(descripcion), title: 'Última anotación', description: descripcion });
    else if (!iso) sueltas.push(descripcion);
  }
  if (sueltas.length) {
    extras.push('Anotaciones sin fecha válida:\n' + sueltas.join('\n'));
    hallazgos.push(estHallazgo_('ACTUACIONES', sueltas.join(' / ').slice(0, 500), '', sueltas.length + ' anotación(es) sin fecha válida; quedaron en Observaciones.', EST.clasificacion.revision, EST.responsable.juridico));
  }
  const asignacionFecha = n.asignacion >= 0 ? estFecha_(fila[n.asignacion], zona) : '';
  estNormalizarCategoricos_(proceso, hallazgos, extras);
  proceso.notes = extras.length ? 'Datos de la base General sin campo equivalente:\n' + extras.join('\n') : '';

  // Regla condicional: Terminado exige fecha de terminación.
  if (proceso.state === 'Terminado' && !proceso.endDate) {
    hallazgos.push(estHallazgo_('endDate', '', '', 'Proceso terminado sin fecha de terminación.', EST.clasificacion.revision, EST.responsable.juridico));
  }
  const conflicto = estConflictoTerminacion_(proceso, actuaciones);
  if (conflicto) hallazgos.push(estHallazgo_('endDate', proceso.endDate, '', 'La fecha de terminación es anterior a ' + conflicto + '.', EST.clasificacion.revision, EST.responsable.juridico));

  return { proceso, actuaciones, hallazgos, asignacionFecha, numeroFila };
}

// Convierte los campos categóricos cerrados al valor exacto del catálogo; lo que no se puede
// interpretar queda vacío, en Observaciones y en 06_PENDIENTES_CALIDAD (REQUIERE REVISIÓN JURÍDICA).
function estNormalizarCategoricos_(proceso, hallazgos, extras) {
  const notas = extras || [];
  const mapear = (campo, etiqueta, funcion) => {
    const original = String(proceso[campo] || '').trim();
    if (!original) return;
    const valor = funcion(esqNormalizar_(original));
    if (valor === original) return;
    if (valor) {
      proceso[campo] = valor;
      if (esqNormalizar_(valor) !== esqNormalizar_(original)) {
        hallazgos.push(estHallazgo_(campo, original, valor, etiqueta + ' homologado al catálogo.', EST.clasificacion.corregible, EST.responsable.analista));
      }
      return;
    }
    proceso[campo] = '';
    notas.push(etiqueta + ': ' + original);
    hallazgos.push(estHallazgo_(campo, original, '', etiqueta + ' "' + original + '" no corresponde a un valor del catálogo.', EST.clasificacion.revision, EST.responsable.juridico));
  };
  mapear('instance', 'Instancia', estInstancia_);
  mapear('terminationInstance', 'Instancia de terminación', estInstancia_);
  mapear('quality', 'Parte procesal', k => /^ACTIV/.test(k) ? 'Activa' : /^PASIV/.test(k) ? 'Pasiva' : '');
  mapear('represents', 'Calidad de representación', k => k === 'REPRESENTA' ? 'Representa' : k === 'REPRESENTADO' ? 'Representado' : '');
  mapear('state', 'Estado del proceso', k => k === 'ACTIVO' ? 'Activo' : k === 'TERMINADO' ? 'Terminado' : k.indexOf('DESVINCUL') >= 0 ? 'Desvinculado' : '');
  mapear('cautelar', 'Medida cautelar', k => k === 'SI' ? 'Sí' : k === 'NO' ? 'No' : /^SIN (DATO|INFORMACION)/.test(k) ? 'Sin datos' : '');
  mapear('anticipatedJudgment', 'Sentencia anticipada', k => k === 'SI' ? 'Sí' : k === 'NO' ? 'No' : '');
  mapear('firstInstanceDecisionSense', 'Sentido del fallo de primera instancia', estSentidoFallo_);
  mapear('secondInstanceDecisionSense', 'Sentido del fallo de segunda instancia', estSentidoFallo_);
  mapear('appealStatus', 'Estado del recurso', k => k === 'NO PRESENTADO' ? 'No presentado' : k === 'PRESENTADO EN TERMINO' ? 'Presentado en término' : k === 'PRESENTADO FUERA DE TERMINO' ? 'Presentado fuera de término' : '');
  const vinculo = esqNormalizar_(proceso.lawyerLinkType);
  if (vinculo === 'CONTRATISTA') proceso.lawyerLinkType = 'Contratista';
  else if (vinculo === 'PLANTA') proceso.lawyerLinkType = 'Planta';
}

function estInstancia_(k) {
  if (/^PRIMERA/.test(k)) return 'Primera';
  if (/^SEGUNDA/.test(k)) return 'Segunda';
  if (/^UNICA/.test(k)) return 'Única';
  if (/^CASACION/.test(k)) return 'Casación';
  if (k === 'OTRA') return 'Otra';
  return '';
}

function estSentidoFallo_(k) {
  if (!k) return '';
  if (/INHIBITORI/.test(k)) return 'Inhibitorio';
  if (/MIXT|PARCIAL/.test(k)) return 'Mixto';
  if (/DESFAVORABLE|CONDENA/.test(k)) return 'Desfavorable';
  if (/FAVORABLE|ABSUELVE|NIEGA PRETENSIONES/.test(k)) return 'Favorable';
  return '';
}

// Homologa variantes de escritura de los catálogos abiertos y devuelve los valores para 04_CATALOGOS.
function estHomologarCatalogos_(mapeos, catalogoActual) {
  const campos = [];
  ESQUEMA.procesos.columnas.forEach(col => {
    if (col[2].indexOf('cat:') === 0 && EST_CATALOGOS_ABIERTOS.indexOf(col[2].slice(4)) >= 0) campos.push([col[1], col[2].slice(4)]);
  });
  const resultado = {};
  const porCategoria = {};
  campos.forEach(([campo, categoria]) => {
    porCategoria[categoria] = porCategoria[categoria] || new Map();
    mapeos.forEach(mapeo => {
      const valor = String(mapeo.proceso[campo] || '').replace(/\s+/g, ' ').trim();
      if (!valor) return;
      const clave = esqClaveCatalogo_(valor);
      const grupo = porCategoria[categoria].get(clave) || new Map();
      grupo.set(valor, (grupo.get(valor) || 0) + 1);
      porCategoria[categoria].set(clave, grupo);
    });
  });
  Object.keys(porCategoria).forEach(categoria => {
    const oficiales = new Map(catalogoActual.filter(item => item.category === categoria).map(item => [esqClaveCatalogo_(item.value), item.value]));
    const canonico = new Map();
    porCategoria[categoria].forEach((grupo, clave) => {
      const elegido = oficiales.get(clave) || [...grupo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0][0];
      canonico.set(clave, elegido);
    });
    resultado[categoria] = [...new Set(canonico.values())];
    porCategoria[categoria] = canonico;
  });
  campos.forEach(([campo, categoria]) => {
    mapeos.forEach(mapeo => {
      const original = String(mapeo.proceso[campo] || '').trim();
      if (!original) return;
      const elegido = porCategoria[categoria].get(esqClaveCatalogo_(original));
      if (elegido && elegido !== original) {
        mapeo.proceso[campo] = elegido;
        mapeo.hallazgos.push(estHallazgo_(campo, original, elegido, 'Variante de escritura homologada al valor del catálogo ' + categoria + '.', EST.clasificacion.corregible, EST.responsable.analista));
      }
    });
  });
  return resultado;
}

// Lee la versión anterior de la aplicación (PROCESOS con DATA_JSON, AUDIENCIAS, COMITES_CONCILIACION,
// ACTUACIONES, AUDITORIA_PROCESOS, CATALOGOS) para no perder lo registrado en ella.
function estLeerAplicacionAnterior_(libro) {
  const resultado = { procesos: [], actuaciones: [], auditoria: [], catalogos: {} };
  const leer = nombre => {
    const hoja = libro.getSheetByName(nombre);
    if (!hoja || hoja.getLastRow() < 2) return [];
    const datos = hoja.getDataRange().getValues();
    const encabezados = datos[0].map(valor => String(valor).trim().toUpperCase());
    return datos.slice(1).map(fila => {
      const objeto = {};
      encabezados.forEach((encabezado, index) => { objeto[encabezado] = esqTextoCelda_(fila[index]) });
      return objeto;
    });
  };
  leer('PROCESOS').forEach(fila => {
    if (!fila.DATA_JSON) return;
    try {
      const proceso = JSON.parse(fila.DATA_JSON);
      proceso.id = proceso.id || fila.ID_PROCESO;
      resultado.procesos.push(proceso);
    } catch (error) {
      Logger.log('PROCESOS: JSON inválido en ' + fila.ID_PROCESO);
    }
  });
  leer('ACTUACIONES').forEach(fila => {
    if (!fila.ID_ACTUACION || /_G\d+$/.test(fila.ID_ACTUACION)) return; // las _G vienen de General: se migran desde allí
    resultado.actuaciones.push({ id: fila.ID_ACTUACION, processId: fila.ID_PROCESO, clase: 'ACTUACION', date: fila.FECHA_ACTUACION,
      source: 'Aplicación', type: fila.TIPO_ACTUACION, title: fila.TITULO, description: fila.DESCRIPCION, status: fila.ESTADO,
      dueDate: fila.FECHA_VENCIMIENTO, registrationDate: fila.FECHA_REGISTRO_ACTUACION || String(fila.FECHA_REGISTRO || '').slice(0, 10),
      registeredBy: fila.REGISTRADO_POR, createdAt: fila.FECHA_REGISTRO, updatedAt: fila.ACTUALIZADO_EN, updatedBy: fila.ACTUALIZADO_POR });
  });
  leer('AUDIENCIAS').forEach(fila => {
    if (!fila.ID_AUDIENCIA) return;
    const orfeo = /ORFEO/i.test(fila.ORIGEN || '');
    resultado.actuaciones.push({ id: fila.ID_AUDIENCIA, processId: fila.ID_PROCESO, clase: 'DILIGENCIA', date: fila.FECHA,
      source: orfeo ? 'Orfeo' : 'Aplicación', type: fila.TIPO_AUDIENCIA, title: fila.ORIGEN || '', description: fila.OBSERVACION,
      sessionNumber: fila.NUMERO_SESION, court: fila.DESPACHO, registrationDate: fila.FECHA_REGISTRO, registeredBy: fila.REGISTRADO_POR });
  });
  leer('COMITES_CONCILIACION').forEach(fila => {
    if (!fila.ID_COMITE) return;
    resultado.actuaciones.push({ id: fila.ID_COMITE, processId: fila.ID_PROCESO, clase: 'COMITE', date: fila.FECHA_PRONUNCIAMIENTO,
      source: 'Aplicación', type: 'Comité de conciliación', title: 'Comité de conciliación', description: fila.COMENTARIO,
      sessionNumber: fila.NUMERO_SESION, registrationDate: fila.FECHA_REGISTRO, registeredBy: fila.REGISTRADO_POR });
  });
  leer('AUDITORIA_PROCESOS').forEach(fila => {
    if (!fila.ID_AUDITORIA) return;
    String(fila.CAMPOS_CAMBIADOS || '').split('|').filter(Boolean).forEach((campo, index) => {
      resultado.auditoria.push({ id: fila.ID_AUDITORIA + '_' + (index + 1), processId: fila.ID_PROCESO, changedAt: fila.FECHA_CAMBIO,
        changedBy: fila.MODIFICADO_POR, origin: 'APLICACIÓN ANTERIOR', recordType: 'PROCESO', recordId: fila.ID_PROCESO,
        field: esqEtiquetaCampo_('procesos', campo), previousValue: '', newValue: '' });
    });
  });
  leer('CATALOGOS').forEach(fila => {
    const categoria = CATEGORIAS_APP[fila.CATEGORIA];
    if (!categoria || String(fila.ACTIVO).toUpperCase() !== 'SI') return;
    resultado.catalogos[categoria] = resultado.catalogos[categoria] || [];
    resultado.catalogos[categoria].push(fila.VALOR);
  });
  return resultado;
}

// Deja el TIPO de cada actuación, diligencia o comité con el valor exacto de su catálogo.
// ACTUACION -> TIPO_ACTUACION (se infiere del texto si no coincide), DILIGENCIA -> TIPO_DILIGENCIA ("Otra"
// si no coincide), COMITE -> TIPO_COMITE. Si el tipo cambia, el texto original queda en el título.
function estAjustarTiposActuacion_(actuaciones, catalogoActual) {
  const valores = categoria => {
    const mapa = new Map();
    (CATALOGO_BASE[categoria] || []).concat((catalogoActual || []).filter(item => item.category === categoria && item.active).map(item => item.value))
      .forEach(valor => mapa.set(esqNormalizar_(valor), valor));
    return mapa;
  };
  const listas = { ACTUACION: valores('TIPO_ACTUACION'), DILIGENCIA: valores('TIPO_DILIGENCIA'), COMITE: valores('TIPO_COMITE') };
  let ajustados = 0;
  actuaciones.forEach(item => {
    const lista = listas[item.clase || 'ACTUACION'] || listas.ACTUACION;
    const original = String(item.type || '').trim();
    const exacto = lista.get(esqNormalizar_(original));
    let tipo = exacto;
    if (!tipo) {
      if (item.clase === 'COMITE') tipo = CATALOGO_BASE.TIPO_COMITE[0];
      else if (item.clase === 'DILIGENCIA') tipo = lista.get('OTRA') || 'Otra';
      else tipo = estTipoActuacion_(original + ' ' + (item.title || '') + ' ' + (item.description || ''));
    }
    if (tipo !== original) {
      if (original && !exacto && !item.title) item.title = original;
      item.type = tipo;
      ajustados++;
    }
  });
  return ajustados;
}

// Borra la columna ID_APLICACION que la aplicación anterior agregaba a General (y a BASE_LIMPIA).
function eliminarColumnaIdAplicacion() {
  const libro = obtenerLibro();
  let eliminadas = 0;
  [CONFIG.HOJA_ORIGEN, CONFIG.HOJA_LIMPIA].forEach(nombre => {
    const hoja = libro.getSheetByName(nombre);
    if (!hoja || hoja.getLastColumn() < 1) return;
    const superior = hoja.getRange(1, 1, Math.min(10, Math.max(hoja.getLastRow(), 1)), hoja.getLastColumn()).getValues();
    for (let fila = 0; fila < superior.length; fila++) {
      const columna = superior[fila].map(esqNormalizar_).indexOf(EST.columnaIdAnterior);
      if (columna >= 0) { hoja.deleteColumn(columna + 1); eliminadas++; break; }
    }
  });
  if (eliminadas) mostrarMensaje('Columna ' + EST.columnaIdAnterior + ' eliminada (' + eliminadas + ' hoja(s)).');
  return eliminadas;
}

// =============================================================================
// MES 2. DEPURACIÓN DE 01_PROCESOS (la base limpia)
// -----------------------------------------------------------------------------
// 01_PROCESOS es la base limpia y depurada (reemplaza a BASE_LIMPIA para la operación).
// depurarProcesos() revisa CADA valor de 01_PROCESOS y lo deja con el formato que exige el
// diccionario: fechas reales, radicados de 23 dígitos como texto, números sin $ ni puntos,
// valor y unidad separados, categóricas con el valor exacto del catálogo, texto sin espacios
// sobrantes. Las celdas vacías se dejan vacías: no se rellenan ni se reportan como error.
//
// Reglas de la propuesta que se respetan:
//   - Lo que se corrige de forma determinística queda CORREGIBLE AUTOMÁTICAMENTE (RESUELTO) en
//     06_PENDIENTES_CALIDAD con el valor original.
//   - Lo que no se puede interpretar sin criterio jurídico se saca del campo, se guarda en
//     OBSERVACIONES y queda REQUIERE REVISIÓN JURÍDICA (PENDIENTE). No se inventa ningún dato.
//   - Cada proceso modificado deja sus valores anteriores y nuevos en 07_AUDITORIA.
//
// Es pesada: trabaja por bloques y, si se acerca al límite de 6 minutos de Apps Script, guarda
// el avance y se programa sola para continuar un minuto después. Se puede ejecutar las veces
// que se quiera: lo que ya está limpio no cambia.
// =============================================================================

const DEP = {
  usuario: 'DEPURACION_AUTOMATICA',
  propiedad: 'DEPURACION_PROCESOS_ESTADO',
  continuar: 'depurarProcesosContinuar',
  filasPorBloque: 500,
  limiteMs: 4.5 * 60 * 1000,
  // Columnas que la depuración no toca (las maneja el sistema).
  sistema: ['id', 'origin', 'recordStatus', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'lastIntermediaryEditAt', 'lastIntermediaryEditBy']
};

// Punto de entrada (menú). Empieza desde la primera fila, o continúa si quedó una depuración a medias.
function depurarProcesos(opciones) {
  const options = opciones && !opciones.triggerUid ? opciones : {};
  const props = PropertiesService.getScriptProperties();
  const previo = JSON.parse(props.getProperty(DEP.propiedad) || 'null');
  const estado = previo && !options.reiniciar ? previo : { siguiente: 0, inicio: new Date().toISOString(), totales: depNuevosTotales_() };
  if (!estado.catalogos) {
    // Primero se dejan los catálogos sin repetidos, para que los procesos tomen la escritura correcta.
    estado.catalogos = depDepurarCatalogos_(obtenerLibro());
    Logger.log(estado.catalogos);
  }
  return depEjecutar_(estado, options);
}

// La llama el activador programado cuando una ejecución no alcanzó a terminar.
function depurarProcesosContinuar(evento) {
  depBorrarActivadores_();
  const estado = JSON.parse(PropertiesService.getScriptProperties().getProperty(DEP.propiedad) || 'null');
  if (!estado) return 'No hay una depuración pendiente.';
  return depEjecutar_(estado, {});
}

function depNuevosTotales_() {
  return { revisados: 0, modificados: 0, celdas: 0, espacios: 0, corregibles: 0, revision: 0, catalogo: 0 };
}

function depEjecutar_(estado, options) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error('Hay otra depuración o migración en curso. Intenta en unos minutos.');
  try {
    const inicio = Date.now();
    const limite = options.limiteMs === undefined ? DEP.limiteMs : options.limiteMs;
    const porBloque = options.filasPorBloque || DEP.filasPorBloque;
    const libro = obtenerLibro();
    const hoja = libro.getSheetByName(ESQUEMA.procesos.hoja);
    if (!hoja) throw new Error('Falta la pestaña ' + ESQUEMA.procesos.hoja + '. Ejecuta primero "Crear estructura" y "Migrar General".');
    const columnas = ESQUEMA.procesos.columnas;
    const ancho = columnas.length;
    const total = Math.max(hoja.getLastRow() - 1, 0);
    const valores = total ? hoja.getRange(2, 1, total, ancho).getValues() : [];
    const zona = Session.getScriptTimeZone();
    const ahora = new Date().toISOString();

    // Catálogos y homologación (se calculan sobre toda la columna para elegir la escritura dominante).
    const contexto = depContexto_(libro, valores);
    estConvertirPendientes_(libro, true);
    const t = estado.totales;
    // Los valores nuevos de los catálogos abiertos se agregan ANTES de escribir, para que las listas ya los tengan.
    t.catalogo += estSembrarCatalogos_(libro, contexto.nuevosCatalogo);
    SpreadsheetApp.flush();

    let fila = estado.siguiente;
    while (fila < valores.length) {
      const fin = Math.min(fila + porBloque, valores.length);
      const nuevosPendientes = [];
      const auditoria = [];
      for (let index = fila; index < fin; index++) {
        const original = valores[index];
        if (!String(original[0] || '').trim() || String(original[esqIndice_('procesos', 'ESTADO_REGISTRO')]).trim() === 'ELIMINADO') continue;
        t.revisados++;
        const resultado = depLimpiarFila_(original, contexto, zona);
        if (!resultado.cambios.length) continue;
        valores[index] = resultado.fila;
        const reales = resultado.cambios.filter(cambio => !cambio.derivado);
        if (!reales.length) continue; // solo se recalcularon INCOMPLETO / CAMPOS_FALTANTES
        t.modificados++;
        const proceso = esqFilaAObjeto_('procesos', resultado.fila);
        const anteriores = {};
        const nuevos = {};
        reales.forEach(cambio => {
          t.celdas++;
          anteriores[cambio.clave] = cambio.antes;
          nuevos[cambio.clave] = cambio.despues;
          if (!cambio.problema) { t.espacios++; return; }
          if (cambio.clasificacion !== EST.clasificacion.revision) { t.corregibles++; return; } // queda en 07_AUDITORIA
          t.revision++;
          nuevosPendientes.push(Object.assign(estHallazgo_(cambio.clave, cambio.antes, cambio.despues, cambio.problema, cambio.clasificacion, cambio.responsable), {
            processId: proceso.id, sourceRow: String(proceso.origin || '').replace('GENERAL fila ', ''), origin: 'DEPURACIÓN' }));
        });
        esqFilasAuditoria_({ processId: proceso.id, changedAt: ahora, changedBy: DEP.usuario, origin: 'DEPURACIÓN', recordType: 'PROCESO', recordId: proceso.id },
          'procesos', reales.map(cambio => cambio.clave), anteriores, nuevos).forEach(fila => auditoria.push(fila));
      }
      // Escribir el bloque (formatos primero: el radicado no se convierte en número).
      if (fin > fila) {
        estFormatearColumnas_(hoja, 'procesos', fila + 2, fin - fila);
        esqEscribirValores_(hoja.getRange(fila + 2, 1, fin - fila, ancho), valores.slice(fila, fin));
        estMarcarCambioDatos_(libro);
      }
      if (nuevosPendientes.length) {
        const mapa = new Map(valores.filter(fila => String(fila[0] || '').trim()).map(fila => [String(fila[0]), { shortNo: esqTextoCelda_(fila[esqIndice_('procesos', 'NO_CORTO')]), radicado: esqTextoCelda_(fila[esqIndice_('procesos', 'RADICADO')]) }]));
        estFusionarEnHoja_(libro, nuevosPendientes, { procesos: mapa });
      }
      depAgregarFilas_(libro, 'auditoria', auditoria);
      fila = fin;
      estado.siguiente = fila;
      if (fila < valores.length && Date.now() - inicio > limite) {
        PropertiesService.getScriptProperties().setProperty(DEP.propiedad, JSON.stringify(estado));
        depBorrarActivadores_();
        ScriptApp.newTrigger(DEP.continuar).timeBased().after(60 * 1000).create();
        const parcial = 'Depuración en curso: ' + fila + ' de ' + valores.length + ' filas. Continúa sola en 1 minuto (no cierres nada).';
        mostrarMensaje(parcial);
        Logger.log(parcial);
        return parcial;
      }
    }

    // Valores nuevos de los catálogos abiertos (homologados) y cierre.
    PropertiesService.getScriptProperties().deleteProperty(DEP.propiedad);
    PropertiesService.getScriptProperties().setProperty('ULTIMA_DEPURACION', ahora);
    depBorrarActivadores_();
    estActualizarVistaGeneral_(obtenerLibro());
    const mensaje = (estado.catalogos ? estado.catalogos + '\n' : '') + 'Depuración de 01_PROCESOS: ' + t.revisados + ' procesos revisados · ' + t.modificados + ' modificados · ' +
      t.celdas + ' celdas corregidas (' + t.espacios + ' solo espacios) · CORREGIBLE ' + t.corregibles + ' · REVISIÓN ' + t.revision +
      ' · ' + t.catalogo + ' valores nuevos de catálogo. Siguiente paso: Validar calidad.';
    mostrarMensaje(mensaje);
    Logger.log(mensaje);
    return mensaje;
  } finally {
    lock.releaseLock();
  }
}

function depBorrarActivadores_() {
  ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === DEP.continuar).forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

// 07_AUDITORIA al día (con NO_CORTO y RADICADO) antes de leerla o escribirla: si viene de la versión anterior
// se convierte sola, una vez por ejecución se revisa.
let estAuditoriaRevisada_ = false;
function estAuditoriaAlDia_(libro) {
  if (estAuditoriaRevisada_) return;
  estAuditoriaRevisada_ = true;
  const hoja = libro.getSheetByName(ESQUEMA.auditoria.hoja);
  if (hoja && esqAuditoriaConProceso_(hoja)) Logger.log('07_AUDITORIA: se agregaron NO_CORTO y RADICADO (llenados con los datos de 01_PROCESOS).');
}

// Cada fila de auditoría dice a qué proceso corresponde (No. corto y radicado de 01_PROCESOS).
function estCompletarAuditoria_(libro, objetos) {
  if (!objetos.some(item => item && item.processId && !item.processShortNo && !item.processRadicado)) return objetos;
  const procesos = esqProcesosPorId_(libro);
  objetos.forEach(item => {
    if (!item || item.processShortNo || item.processRadicado) return;
    const proceso = procesos.get(String(item.processId || ''));
    if (proceso) { item.processShortNo = proceso.shortNo; item.processRadicado = proceso.radicado; }
  });
  return objetos;
}

function depAgregarFilas_(libro, tabla, objetos) {
  if (!objetos.length) return;
  if (tabla === 'auditoria') { estAuditoriaAlDia_(libro); estCompletarAuditoria_(libro, objetos); }
  const hoja = libro.getSheetByName(ESQUEMA[tabla].hoja);
  const filas = objetos.map(objeto => esqObjetoAFila_(tabla, objeto));
  const inicio = Math.max(hoja.getLastRow(), 1) + 1;
  asegurarDimensiones(hoja, inicio + filas.length, filas[0].length);
  estFormatearColumnas_(hoja, tabla, inicio, filas.length);
  escribirPorBloques(hoja, filas, inicio, 1);
}

// Catálogo por categoría (clave normalizada -> valor oficial) y escritura dominante de los catálogos abiertos.
function depContexto_(libro, valores) {
  const oficial = {};
  estLeerTabla_(libro, 'catalogos').sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0)).forEach(item => {
    oficial[item.category] = oficial[item.category] || new Map();
    const clave = esqClaveCatalogo_(item.value);
    if (!oficial[item.category].has(clave)) oficial[item.category].set(clave, item.value);
  });
  const dominante = {};
  const nuevosCatalogo = {};
  ESQUEMA.procesos.columnas.forEach((col, index) => {
    if (col[2].indexOf('cat:') !== 0) return;
    const categoria = col[2].slice(4);
    if (EST_CATALOGOS_ABIERTOS.indexOf(categoria) < 0) return;
    dominante[categoria] = dominante[categoria] || new Map();
    valores.forEach(fila => {
      const valor = depTextoSimple_(fila[index]);
      if (!valor) return;
      const clave = esqClaveCatalogo_(valor);
      const grupo = dominante[categoria].get(clave) || new Map();
      grupo.set(valor, (grupo.get(valor) || 0) + 1);
      dominante[categoria].set(clave, grupo);
    });
  });
  Object.keys(dominante).forEach(categoria => {
    const elegido = new Map();
    dominante[categoria].forEach((grupo, clave) => {
      const valor = (oficial[categoria] && oficial[categoria].get(clave)) ||
        [...grupo.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))[0][0];
      elegido.set(clave, valor);
      if (!oficial[categoria] || !oficial[categoria].has(clave)) (nuevosCatalogo[categoria] = nuevosCatalogo[categoria] || []).push(valor);
    });
    dominante[categoria] = elegido;
  });
  const exentos = libro.getSheetByName(ESQUEMA.auditoria.hoja) ? esqExentosObligatorios_(estLeerTabla_(libro, 'auditoria')) : new Map();
  return { oficial, dominante, nuevosCatalogo, exentos };
}

// Mapeos de las listas cerradas (lo que no coincide literal con el catálogo).
const DEP_MAPEOS = {
  INSTANCIA: estInstancia_,
  PARTE_PROCESAL: k => /^ACTIV/.test(k) ? 'Activa' : /^PASIV/.test(k) ? 'Pasiva' : '',
  REPRESENTACION: k => /^REPRESENTAD/.test(k) ? 'Representado' : /^REPRESENTA/.test(k) ? 'Representa' : '',
  ESTADO_PROCESO: k => /^ACTIV/.test(k) ? 'Activo' : /^TERMINAD/.test(k) ? 'Terminado' : k.indexOf('DESVINCUL') >= 0 ? 'Desvinculado' : '',
  MEDIDA_CAUTELAR: k => k === 'SI' || k === 'S' ? 'Sí' : k === 'NO' || k === 'N' ? 'No' : /^SIN (DATO|INFORMACION)|^NO REGISTRA/.test(k) ? 'Sin datos' : '',
  SI_NO: k => k === 'SI' || k === 'S' ? 'Sí' : k === 'NO' || k === 'N' ? 'No' : '',
  SENTIDO_FALLO: estSentidoFallo_,
  ESTADO_RECURSO: k => /^NO PRESENTAD|^SIN RECURSO/.test(k) ? 'No presentado' : /FUERA DE TERMINO/.test(k) ? 'Presentado fuera de término' : /^PRESENTADO/.test(k) ? 'Presentado en término' : '',
  TIPO_VINCULACION: k => /^CONTRAT/.test(k) ? 'Contratista' : /^PLANTA|^FUNCIONARIO/.test(k) ? 'Planta' : ''
};

// Espacios: sin espacios al inicio/fin, sin dobles espacios ni espacios duros, saltos de línea uniformes.
function depTextoSimple_(valor) {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return '';
  return String(valor).replace(/[\u00A0\u2007\u202F\u200B\uFEFF]/g, ' ').replace(/\r\n?/g, '\n')
    .split('\n').map(linea => linea.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n').trim();
}

// Limpia una fila de 01_PROCESOS. Devuelve la fila nueva y la lista de cambios.
function depLimpiarFila_(original, contexto, zona) {
  const columnas = ESQUEMA.procesos.columnas;
  const fila = original.slice();
  const cambios = [];
  const observaciones = [];
  const indice = clave => columnas.findIndex(col => col[1] === clave);
  const etiqueta = clave => columnas[indice(clave)][0];
  const esFecha = valor => valor instanceof Date;
  const texto = valor => esFecha(valor) ? estFecha_(valor, zona) : esqTextoCelda_(valor);
  // Cambia la celda solo si el valor o su tipo (texto / número / fecha) son distintos.
  const poner = (clave, valor, problema, clasificacion, responsable, derivado) => {
    const index = indice(clave);
    const antes = fila[index];
    const mismoTipo = esFecha(antes) === esFecha(valor) && (typeof antes === 'number') === (typeof valor === 'number');
    if (mismoTipo && texto(antes) === texto(valor)) return;
    fila[index] = valor;
    cambios.push({ clave, antes: texto(antes), despues: texto(valor), problema: problema || '', clasificacion: clasificacion || '', responsable: responsable || '', derivado: !!derivado });
  };
  const corregible = (clave, valor, problema) => poner(clave, valor, problema, EST.clasificacion.corregible, EST.responsable.analista);
  // Valor que no se puede interpretar: sale del campo, va a OBSERVACIONES y a revisión jurídica.
  const aRevision = (clave, crudo, problema) => {
    observaciones.push(etiqueta(clave) + ': ' + texto(crudo));
    poner(clave, '', problema + ' El valor original quedó en Observaciones.', EST.clasificacion.revision, EST.responsable.juridico);
  };
  const fechaReal = iso => esqValorCelda_('date', iso);
  const vacioEn = clave => !depTextoSimple_(texto(fila[indice(clave)]));
  let anticipada = false;

  columnas.forEach((col, index) => {
    const [encabezado, clave, tipo] = col;
    if (DEP.sistema.indexOf(clave) >= 0 || tipo === 'flag' || tipo === 'list' || tipo === 'datetime' || tipo === 'id') return;
    const crudo = fila[index];
    if (crudo === '' || crudo === null || crudo === undefined) return; // los vacíos se dejan vacíos
    const limpio = esFecha(crudo) ? '' : depTextoSimple_(crudo);
    const marcador = !esFecha(crudo) && typeof crudo !== 'number' && (!limpio || estVacio_(limpio));
    const vaciar = () => corregible(clave, '', limpio ? 'Marcador de vacío ("' + limpio + '"); se dejó la celda vacía.' : '');

    if (tipo === 'date') {
      if (esFecha(crudo)) {
        if (!estFecha_(crudo, zona)) aRevision(clave, isNaN(crudo.getTime()) ? 'fecha inválida' : crudo.getFullYear(), encabezado + ' tiene una fecha inválida o un año fuera de rango (1950–2100).');
        return;
      }
      if (marcador) return vaciar();
      if (estSentenciaAnticipada_(limpio)) {
        anticipada = true;
        corregible(clave, '', 'Texto "SENTENCIA ANTICIPADA" en un campo de fecha; se registró como sentencia anticipada.');
        return;
      }
      // Número de serie de fecha (celda sin formato de fecha) o texto con fecha.
      const serie = typeof crudo === 'number' && crudo > 18000 && crudo < 73000 ? new Date(Date.UTC(1899, 11, 30) + Math.round(crudo) * 86400000).toISOString().slice(0, 10) : '';
      const iso = serie || estFecha_(limpio, zona);
      if (iso) {
        const varias = (limpio.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{1,2}-\d{1,2}/g) || []).length > 1;
        if (varias) observaciones.push(encabezado + ': ' + limpio);
        corregible(clave, fechaReal(iso), varias ? encabezado + ' tenía varias fechas; se tomó la primera y el texto completo quedó en Observaciones.'
          : encabezado + ' estaba como texto o número ("' + limpio + '"); se convirtió a fecha.');
      } else {
        aRevision(clave, limpio, encabezado + ' no es una fecha válida.');
      }
      return;
    }

    if (tipo === 'number') {
      if (typeof crudo === 'number') {
        if (Math.round(crudo) !== crudo) corregible(clave, Math.round(crudo), encabezado + ' tenía decimales; se redondeó.');
        return;
      }
      if (esFecha(crudo)) return aRevision(clave, crudo, encabezado + ' contiene una fecha en lugar de un valor.');
      if (marcador) return vaciar();
      const valor = estValor_(limpio, zona);
      if (valor.numero) corregible(clave, Number(valor.numero), encabezado + ' estaba como texto ("' + limpio + '"); se dejó solo el número en pesos.');
      else aRevision(clave, limpio, valor.hallazgo || (encabezado + ' no es un valor en pesos.'));
      return;
    }

    if (tipo.indexOf('cat:') === 0) {
      const categoria = tipo.slice(4);
      if (esFecha(crudo)) return aRevision(clave, crudo, encabezado + ' contiene una fecha en lugar de un valor del catálogo.');
      if (marcador) return vaciar();
      const llave = esqClaveCatalogo_(limpio);
      const valor = (contexto.oficial[categoria] && contexto.oficial[categoria].get(llave)) ||
        (DEP_MAPEOS[categoria] ? DEP_MAPEOS[categoria](esqNormalizar_(limpio)) : '') ||
        (contexto.dominante[categoria] && contexto.dominante[categoria].get(llave)) || '';
      if (!valor) return aRevision(clave, limpio, encabezado + ' "' + limpio + '" no corresponde a un valor del catálogo ' + categoria + '.');
      if (valor === limpio) poner(clave, valor); // solo espacios
      else corregible(clave, valor, 'Homologado al catálogo ' + categoria + ' ("' + limpio + '" → "' + valor + '").');
      return;
    }

    // Texto. Una fecha escrita en un campo de texto se conserva como texto AAAA-MM-DD.
    if (esFecha(crudo)) {
      const iso = estFecha_(crudo, zona);
      poner(clave, iso, 'Fecha en un campo de texto; se guardó como texto AAAA-MM-DD.', EST.clasificacion.corregible, EST.responsable.analista);
      return;
    }
    if (marcador) return vaciar();
    if (clave === 'radicado' || clave === 'currentRadicado') {
      if (typeof crudo === 'number') return aRevision(clave, crudo, encabezado + ' estaba guardado como número y pudo perder dígitos; verificar contra el expediente.');
      const digitos = limpio.replace(/\D/g, '');
      if (digitos.length === 23) {
        if (digitos === limpio) poner(clave, digitos);
        else corregible(clave, digitos, 'Se quitaron espacios o separadores del radicado.');
      } else if (clave === 'radicado') {
        aRevision(clave, limpio, 'El radicado no tiene 23 dígitos (' + digitos.length + '); verificar contra el expediente.');
      } else {
        poner(clave, limpio);
      }
      return;
    }
    if (clave === 'shortNo') {
      const partes = estSepararNoCorto_(limpio);
      if (partes.resto) {
        observaciones.push('No. corto (texto adicional): ' + partes.resto);
        corregible(clave, partes.codigo, 'Se separó el texto que acompañaba al No. corto ("' + partes.resto.slice(0, 80) + '"); quedó en Observaciones.');
      } else if (partes.codigo !== limpio) {
        corregible(clave, partes.codigo, 'No. corto ajustado al formato AAAA-NNNNN.');
      } else {
        poner(clave, partes.codigo);
      }
      return;
    }
    if (typeof crudo === 'number') {
      const valor = ['ids', 'siproJ', 'orfeo'].indexOf(clave) >= 0 ? String(Math.round(crudo)) : String(crudo);
      poner(clave, valor, 'Número guardado como texto.', EST.clasificacion.corregible, EST.responsable.analista);
      return;
    }
    if (clave === 'ids') {
      const partes = limpio.split(/\s*(?:[,;|\/\n]|\s[Yy]\s)\s*/)
        .map(parte => /^[\d.\s]+$/.test(parte) ? parte.replace(/[.\s]/g, '') : parte.trim()).filter(Boolean);
      const valor = partes.join(', ');
      if (valor.replace(/\s/g, '') !== limpio.replace(/\s/g, '')) corregible(clave, valor, 'Se quitaron puntos y se unificó el separador de las cédulas.');
      else poner(clave, valor);
      return;
    }
    poner(clave, limpio);
  });

  // Reglas entre campos.
  if (anticipada && vacioEn('anticipatedJudgment')) corregible('anticipatedJudgment', 'Sí', 'Sentencia anticipada registrada a partir de un campo de fecha.');
  if (observaciones.length) {
    const actuales = depTextoSimple_(texto(fila[indice('notes')]));
    const nuevas = observaciones.filter(linea => actuales.indexOf(linea) < 0);
    if (nuevas.length) poner('notes', (actuales ? actuales + '\n' : '') + 'Depuración:\n' + nuevas.join('\n'));
  }
  // INCOMPLETO y CAMPOS_FALTANTES se recalculan con los valores ya limpios.
  const exentos = (contexto.exentos && contexto.exentos.get(texto(fila[indice('id')]))) || new Set();
  const faltantes = EST.obligatoriosRegistro.filter(clave => vacioEn(clave) && !exentos.has(clave));
  poner('incomplete', faltantes.length ? 'SI' : 'NO', '', '', '', true);
  poner('missingFields', faltantes.join('|'), '', '', '', true);
  return { fila, cambios };
}


// =============================================================================
// DEPURACIÓN DE 04_CATALOGOS (sin repetidos)
// -----------------------------------------------------------------------------
// depurarCatalogos(): deja una sola fila por valor en cada catálogo. Dos valores son el mismo cuando solo
// cambian tildes, mayúsculas, signos o espacios ("Juzgado 1 Administrativo de Bogotá." = "JUZGADO 1
// ADMINISTRATIVO DE BOGOTA"). Se conserva la escritura institucional; si no hay, la activa más usada en la
// base. Los valores de 02_ACTUACIONES y 03_ASIGNACIONES se cambian a esa escritura (cada cambio queda en
// 07_AUDITORIA); 01_PROCESOS la toma con depurarProcesos(), que se ejecuta después.
// También quita las filas vacías y las categorías que ya no existen en el modelo (por ejemplo UNIDAD_PRETENSION).
// =============================================================================
function depurarCatalogos() {
  const mensaje = depDepurarCatalogos_(obtenerLibro());
  mostrarMensaje(mensaje);
  Logger.log(mensaje);
  return mensaje;
}

function depDepurarCatalogos_(libro) {
  const filas = estLeerTabla_(libro, 'catalogos');
  if (!filas.length) return 'Catálogos: no hay valores para depurar.';
  const categorias = new Set(Object.keys(CATALOGO_BASE));
  const ahora = new Date().toISOString();

  // Uso de cada valor en la base (para elegir la escritura que se conserva).
  const uso = new Map();
  const contar = (categoria, valor) => {
    const clave = categoria + '|' + String(valor);
    uso.set(clave, (uso.get(clave) || 0) + 1);
  };
  const tablas = ['procesos', 'actuaciones', 'asignaciones'];
  const datos = {};
  tablas.forEach(tabla => {
    const hoja = libro.getSheetByName(ESQUEMA[tabla].hoja);
    const ancho = esqEncabezados_(tabla).length;
    datos[tabla] = hoja && hoja.getLastRow() > 1 ? hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues() : [];
    ESQUEMA[tabla].columnas.forEach((col, index) => {
      if (col[2].indexOf('cat:') !== 0) return;
      const partes = CATALOGOS_COMBINADOS[col[2].slice(4)] || [col[2].slice(4)];
      datos[tabla].forEach(fila => {
        const valor = String(fila[index] || '').trim();
        if (valor) partes.forEach(categoria => contar(categoria, valor));
      });
    });
  });

  // Agrupar por categoría + clave y elegir la fila que se conserva.
  const escritura = valor => (/[a-záéíóúñ]/.test(valor) ? 2 : 0) + (/[áéíóúÁÉÍÓÚñÑ]/.test(valor) ? 1 : 0);
  const grupos = new Map();
  let vacias = 0, retiradas = 0;
  filas.forEach(item => {
    const valor = String(item.value || '').replace(/\s+/g, ' ').trim();
    if (!valor) { vacias++; return; }
    if (!categorias.has(item.category)) { retiradas++; return; }
    const clave = item.category + '|' + esqClaveCatalogo_(valor);
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(Object.assign({}, item, { value: valor, original: item.value }));
  });
  const limpias = [];
  const reemplazos = {}; // categoría -> Map(valor anterior -> valor que queda)
  let repetidas = 0;
  grupos.forEach(grupo => {
    const categoria = grupo[0].category;
    const puntaje = item => [item.origin === 'INSTITUCIONAL' ? 1 : 0, item.active ? 1 : 0, uso.get(categoria + '|' + item.original) || 0, escritura(item.value)];
    grupo.sort((a, b) => {
      const pa = puntaje(a), pb = puntaje(b);
      for (let i = 0; i < pa.length; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
      return a.value.localeCompare(b.value, 'es');
    });
    const elegido = grupo[0];
    const activo = grupo.some(item => item.active);
    const cambio = grupo.length > 1 || elegido.value !== elegido.original || activo !== elegido.active;
    limpias.push({ category: categoria, value: elegido.value, active: activo, origin: elegido.origin,
      updatedBy: cambio ? 'DEPURACION_CATALOGOS' : elegido.updatedBy, updatedAt: cambio ? ahora : elegido.updatedAt });
    repetidas += grupo.length - 1;
    grupo.forEach(item => {
      if (item.original === elegido.value) return;
      reemplazos[categoria] = reemplazos[categoria] || new Map();
      reemplazos[categoria].set(item.original, elegido.value);
    });
  });
  limpias.sort((a, b) => Object.keys(CATALOGO_BASE).indexOf(a.category) - Object.keys(CATALOGO_BASE).indexOf(b.category) || a.value.localeCompare(b.value, 'es'));
  if (repetidas || vacias || retiradas || Object.keys(reemplazos).length) estEscribirTabla_(libro, 'catalogos', limpias);

  // Llevar la escritura elegida a 02 y 03 (y a 01 en las columnas que no revisa depurarProcesos: ninguna; 01 se deja a esa función).
  let celdas = 0;
  ['actuaciones', 'asignaciones'].forEach(tabla => {
    const hoja = libro.getSheetByName(ESQUEMA[tabla].hoja);
    if (!hoja || !datos[tabla].length) return;
    const auditoria = [];
    ESQUEMA[tabla].columnas.forEach((col, index) => {
      if (col[2].indexOf('cat:') !== 0) return;
      const partes = CATALOGOS_COMBINADOS[col[2].slice(4)] || [col[2].slice(4)];
      let cambiada = false;
      datos[tabla].forEach(fila => {
        const actual = String(fila[index] || '');
        const nuevo = partes.map(categoria => reemplazos[categoria] && reemplazos[categoria].get(actual)).find(Boolean);
        if (!nuevo || nuevo === actual) return;
        fila[index] = nuevo;
        cambiada = true;
        celdas++;
        const idProceso = String(fila[esqIndice_(tabla, 'ID_PROCESO')] || '');
        auditoria.push.apply(auditoria, esqFilasAuditoria_({ processId: idProceso, changedAt: ahora, changedBy: 'DEPURACION_CATALOGOS', origin: 'DEPURACIÓN',
          recordType: tabla === 'actuaciones' ? String(fila[esqIndice_(tabla, 'CLASE')] || 'ACTUACION') : 'ASIGNACION', recordId: String(fila[0] || '') },
          tabla, [col[1]], { [col[1]]: actual }, { [col[1]]: nuevo }));
      });
      if (cambiada) {
        const rango = hoja.getRange(2, index + 1, datos[tabla].length, 1);
        rango.setNumberFormat('@');
        esqEscribirValores_(rango, datos[tabla].map(fila => [fila[index]]));
      }
    });
    depAgregarFilas_(libro, 'auditoria', auditoria);
  });
  estMarcarCambioDatos_(libro);
  const variantes = Object.keys(reemplazos).reduce((total, categoria) => total + reemplazos[categoria].size, 0);
  return 'Catálogos depurados: ' + limpias.length + ' valores · ' + repetidas + ' repetidos unificados · ' + vacias + ' vacíos y ' +
    retiradas + ' de categorías retiradas eliminados · ' + variantes + ' escrituras reemplazadas · ' + celdas + ' celdas actualizadas en 02 y 03.';
}

// =============================================================================
// MES 3. CONTROL DE CALIDAD, INFORME Y RESPALDOS
// =============================================================================

// Revisa 01_PROCESOS y registra en 06_PENDIENTES_CALIDAD lo que incumple las reglas. Cierra
// automáticamente los hallazgos de control que ya se corrigieron. No modifica los procesos.
// Puntos de 06 que ya se corrigieron y se pueden cerrar solos al validar:
//  - un campo de 01_PROCESOS que se cambió desde la aplicación (queda en 07_AUDITORIA) después de detectarse
//    el punto y que hoy tiene valor;
//  - FECHA ASIGNACION, cuando la asignación vigente en 03_ASIGNACIONES ya tiene FECHA_INICIO.
// Las hojas quedan bloqueadas: los puntos se cierran desde la aplicación (Corregir, Resuelto o No aplica).
function estCamposCorregidos_(libro, procesos, pendientes, auditoria) {
  const tiempo = valor => valor instanceof Date ? valor.getTime() : (Date.parse(String(valor || '')) || 0);
  const columnaAClave = {};
  ESQUEMA.procesos.columnas.forEach(col => { columnaAClave[col[0]] = col[1]; });
  const porId = new Map(procesos.map(item => [item.id, item]));
  const detectado = new Map(pendientes.map(item => [item.processId, tiempo(item.detectedAt)]));
  const corregidos = new Map();
  const agregar = (id, campo) => { if (!corregidos.has(id)) corregidos.set(id, new Set()); corregidos.get(id).add(campo); };
  (auditoria || estLeerTabla_(libro, 'auditoria')).forEach(cambio => {
    if (cambio.recordType !== 'PROCESO' || cambio.origin !== 'APLICACIÓN' || estVacio_(cambio.newValue)) return;
    const proceso = porId.get(cambio.processId);
    const clave = columnaAClave[cambio.field];
    if (!proceso || !clave || estVacio_(proceso[clave]) || (Array.isArray(proceso[clave]) && !proceso[clave].length)) return;
    if (tiempo(cambio.changedAt) < (detectado.get(cambio.processId) || 0)) return;
    agregar(cambio.processId, cambio.field);
  });
  estLeerTabla_(libro, 'asignaciones').forEach(asignacion => {
    if (!asignacion.endDate && !estVacio_(asignacion.startDate) && porId.has(asignacion.processId)) agregar(asignacion.processId, 'FECHA ASIGNACION');
  });
  return corregidos;
}

function validarCalidadBase() {
  const libro = obtenerLibro();
  estConvertirPendientes_(libro, true);
  const procesos = estLeerTabla_(libro, 'procesos').filter(item => item.recordStatus !== 'ELIMINADO');
  const actuaciones = estLeerTabla_(libro, 'actuaciones');
  const pendientes = estLeerTabla_(libro, 'pendientes');
  const catalogo = new Map();
  estLeerTabla_(libro, 'catalogos').filter(item => item.active).forEach(item => {
    if (!catalogo.has(item.category)) catalogo.set(item.category, new Set());
    catalogo.get(item.category).add(item.value);
  });
  const hojaProcesos = libro.getSheetByName(ESQUEMA.procesos.hoja);
  const crudos = hojaProcesos.getLastRow() > 1 ? hojaProcesos.getRange(2, 1, hojaProcesos.getLastRow() - 1, esqEncabezados_('procesos').length).getValues() : [];
  const crudoPorId = new Map(crudos.map(fila => [String(fila[0]), fila]));
  const conteo = new Map();
  procesos.forEach(item => { if (item.radicado) conteo.set(item.radicado, (conteo.get(item.radicado) || 0) + 1) });
  const fechasActuacion = new Map();
  actuaciones.forEach(item => {
    if (!item.date) return;
    const lista = fechasActuacion.get(item.processId) || [];
    lista.push(item.date);
    fechasActuacion.set(item.processId, lista);
  });

  const ahora = new Date().toISOString();
  const detectados = new Map();
  const agregar = (proceso, campo, valor, problema, clasificacion, responsable) => {
    const hallazgo = Object.assign(estHallazgo_(campo, valor, '', problema, clasificacion, responsable), { processId: proceso.id, origin: 'CONTROL AUTOMÁTICO' });
    detectados.set(proceso.id + '|' + esqClaveItemPendiente_(esqItemPendiente_(hallazgo)), hallazgo);
  };
  procesos.forEach(proceso => {
    if (!proceso.radicado) agregar(proceso, 'radicado', '', 'Proceso sin radicado.', EST.clasificacion.revision, EST.responsable.juridico);
    else if (!/^\d{23}$/.test(proceso.radicado)) agregar(proceso, 'radicado', proceso.radicado, 'El radicado no tiene 23 dígitos.', EST.clasificacion.revision, EST.responsable.juridico);
    else if (conteo.get(proceso.radicado) > 1) agregar(proceso, 'radicado', proceso.radicado, 'Radicado repetido sin justificación.', EST.clasificacion.revision, EST.responsable.coordinacion);
    if (proceso.state === 'Terminado' && !proceso.endDate) {
      agregar(proceso, 'endDate', proceso.terminationNotes || '', proceso.terminationNotes ? 'Terminado sin fecha de terminación (con justificación: validar).' : 'Proceso terminado sin fecha de terminación.', EST.clasificacion.revision, EST.responsable.juridico);
    }
    if (!proceso.lawyer) agregar(proceso, 'lawyer', '', 'El proceso no tiene abogado a cargo.', EST.clasificacion.revision, EST.responsable.coordinacion);
    const crudo = crudoPorId.get(proceso.id) || [];
    ESQUEMA.procesos.columnas.forEach((col, index) => {
      const valor = proceso[col[1]];
      if (col[2] === 'date' && crudo[index] !== '' && crudo[index] !== undefined && !(crudo[index] instanceof Date)) {
        agregar(proceso, col[1], String(crudo[index]), 'El campo de fecha contiene un valor que no es fecha.', EST.clasificacion.revision, EST.responsable.juridico);
      }
      if (col[2].indexOf('cat:') === 0 && valor && catalogo.has(col[2].slice(4)) && !catalogo.get(col[2].slice(4)).has(valor)) {
        agregar(proceso, col[1], valor, 'Valor fuera del catálogo ' + col[2].slice(4) + '.', EST.clasificacion.revision, EST.responsable.coordinacion);
      }
    });
    if (proceso.endDate) {
      const posteriores = [proceso.notificationDate, proceso.demandResponseDate, proceso.firstInstanceDecisionDate].concat(fechasActuacion.get(proceso.id) || [])
        .filter(fecha => fecha && fecha > proceso.endDate);
      if (posteriores.length) agregar(proceso, 'endDate', proceso.endDate, 'La fecha de terminación es anterior a otras fechas del proceso.', EST.clasificacion.revision, EST.responsable.juridico);
    }
  });

  // Coherencia de los datos (fechas imposibles, orden de las etapas, campos que se contradicen y actuaciones).
  // Cada hallazgo queda en el campo que hay que corregir; el valor que causa el problema va en [valor: …], así el
  // punto se reconoce aunque cambie el valor y se cierra solo cuando el dato quede bien.
  estControlesCoherencia_(procesos, actuaciones).forEach(([proceso, campo, valor, problema, responsable]) =>
    agregar(proceso, campo, valor, problema, EST.clasificacion.revision, responsable || EST.responsable.juridico));
  // Obligatorios sin diligenciar (CAMPOS_FALTANTES de 01; sin los marcados «No aplica»): también quedan en 06, así
  // todo lo que hay que corregir está en una sola hoja. Si el campo ya tiene otro punto (p. ej. «Proceso sin
  // radicado»), no se repite.
  const conPunto = new Set([...detectados.values()].map(h => h.processId + '|' + h.field));
  procesos.forEach(proceso => {
    (Array.isArray(proceso.missingFields) ? proceso.missingFields : String(proceso.missingFields || '').split('|')).filter(Boolean).forEach(campo => {
      const col = ESQUEMA.procesos.columnas.find(item => item[1] === campo);
      if (!col || conPunto.has(proceso.id + '|' + col[0])) return;
      agregar(proceso, campo, '', PEND_FALTANTE, EST.clasificacion.revision, col[4] || EST.responsable.juridico);
    });
  });

  const abiertosAntes = pendientes.filter(item => item.status === 'PENDIENTE');
  const hallazgosAntes = abiertosAntes.reduce((total, item) => total + (Number(item.count) || 0), 0);
  const mapa = new Map(procesos.map(item => [item.id, { shortNo: item.shortNo, radicado: item.radicado }]));
  const auditoriaCalidad = estLeerTabla_(libro, 'auditoria');
  const corregidos = estCamposCorregidos_(libro, procesos, pendientes, auditoriaCalidad);
  const filas = esqFusionarPendientes_(pendientes, [...detectados.values()], ahora,
    { procesos: mapa, controlCompleto: true, corregidos: corregidos, cerrados: esqCerradosCalidad_(auditoriaCalidad) });
  estEscribirTabla_(libro, 'pendientes', filas);
  estActualizarVistaGeneral_(libro);
  const abiertos = filas.filter(item => item.status === 'PENDIENTE');
  const hallazgos = abiertos.reduce((total, item) => total + (Number(item.count) || 0), 0);
  const cerrados = abiertosAntes.filter(item => !abiertos.some(fila => fila.processId === item.processId)).length;
  const mensaje = 'Control de calidad: ' + procesos.length + ' procesos revisados · ' + abiertos.length + ' proceso(s) por revisar en 06 con ' + hallazgos +
    ' hallazgo(s) (antes ' + hallazgosAntes + ') · ' + cerrados + ' proceso(s) cerrado(s) automáticamente.';
  mostrarMensaje(mensaje);
  Logger.log(mensaje);
  return mensaje;
}

// Indicadores de éxito (sección 10 de la propuesta): línea base en General vs. resultado en la nueva estructura.
function generarInformeCalidad() {
  const libro = obtenerLibro();
  const zona = Session.getScriptTimeZone();
  const procesos = estLeerTabla_(libro, 'procesos').filter(item => item.recordStatus !== 'ELIMINADO');
  const actuaciones = estLeerTabla_(libro, 'actuaciones');
  const catalogo = new Map();
  estLeerTabla_(libro, 'catalogos').filter(item => item.active).forEach(item => {
    if (!catalogo.has(item.category)) catalogo.set(item.category, new Set());
    catalogo.get(item.category).add(item.value);
  });
  const categoricos = ESQUEMA.procesos.columnas.filter(col => col[2].indexOf('cat:') === 0 && col[1] !== 'recordStatus');
  const fechas = ESQUEMA.procesos.columnas.filter(col => col[2] === 'date');
  // Porcentaje con 1 decimal; si hay casos pero redondea a 0, se muestra con 2 decimales (o "< 0,01") para no ocultarlos.
  const pct = (parte, total) => {
    if (!total) return 0;
    const valor = Math.round(parte / total * 1000) / 10;
    if (valor > 0 || !parte) return valor;
    const fino = Math.round(parte / total * 10000) / 100;
    return fino > 0 ? fino : '< 0.01';
  };

  // Línea base (General, sin modificar).
  const general = obtenerHoja(CONFIG.HOJA_ORIGEN).getDataRange().getValues();
  const disposicion = estDetectarGeneral_(general);
  let baseCat = 0, baseCatFuera = 0, baseFechas = 0, baseFechasMal = 0, baseActivos = 0, baseCriticos = 0, baseTerminadosSinFecha = 0, baseBloques = 0;
  const baseRadicados = new Map();
  disposicion.filas.forEach(index => {
    const fila = general[index];
    categoricos.forEach(col => {
      const c = disposicion.columnas[col[1]];
      if (c === undefined || estVacio_(fila[c])) return;
      baseCat++;
      const valores = catalogo.get(col[2].slice(4));
      if (!valores || !valores.has(String(fila[c]).trim())) baseCatFuera++;
    });
    fechas.forEach(col => {
      const c = disposicion.columnas[col[1]];
      if (c === undefined || estVacio_(fila[c])) return;
      baseFechas++;
      if (!(fila[c] instanceof Date)) baseFechasMal++;
    });
    const radicado = estTexto_(fila[disposicion.columnas.radicado], zona);
    if (radicado) baseRadicados.set(radicado, (baseRadicados.get(radicado) || 0) + 1);
    const estado = esqNormalizar_(fila[disposicion.columnas.state]);
    if (estado === 'ACTIVO') {
      baseActivos++;
      if (!/^\d{23}$/.test(radicado) || estVacio_(fila[disposicion.columnas.lawyer])) baseCriticos++;
    }
    if (estado === 'TERMINADO' && estVacio_(fila[disposicion.columnas.endDate])) baseTerminadosSinFecha++;
    for (let c = disposicion.inicioActuaciones; c < disposicion.finActuaciones; c += 3) if (estFecha_(fila[c], zona)) baseBloques++;
  });

  // Resultado actual (nueva estructura).
  const hoja = libro.getSheetByName(ESQUEMA.procesos.hoja);
  const crudos = hoja.getLastRow() > 1 ? hoja.getRange(2, 1, hoja.getLastRow() - 1, esqEncabezados_('procesos').length).getValues() : [];
  let cat = 0, catFuera = 0, fechasTotal = 0, fechasMal = 0, activos = 0, criticos = 0, terminadosSinFecha = 0, terminadosSinJustificar = 0;
  const radicados = new Map();
  procesos.forEach(proceso => {
    categoricos.forEach(col => {
      const valor = proceso[col[1]];
      if (!valor) return;
      cat++;
      const valores = catalogo.get(col[2].slice(4));
      if (!valores || !valores.has(valor)) catFuera++;
    });
    if (proceso.radicado) radicados.set(proceso.radicado, (radicados.get(proceso.radicado) || 0) + 1);
    if (proceso.state === 'Activo') {
      activos++;
      if (!/^\d{23}$/.test(proceso.radicado) || !proceso.lawyer) criticos++;
    }
    if (proceso.state === 'Terminado' && !proceso.endDate) { terminadosSinFecha++; if (!proceso.terminationNotes) terminadosSinJustificar++; }
  });
  const tiposValidos = new Set(CATALOGOS_COMBINADOS.TIPO_REGISTRO.reduce((lista, categoria) => lista.concat([...(catalogo.get(categoria) || [])]), []));
  actuaciones.forEach(item => {
    if (!item.type) return;
    cat++;
    if (!tiposValidos.has(item.type)) catFuera++;
  });
  crudos.forEach(fila => fechas.forEach(col => {
    const valor = fila[esqIndice_('procesos', col[0])];
    if (valor === '' || valor === null) return;
    fechasTotal++;
    if (!(valor instanceof Date)) fechasMal++;
  }));
  const duplicados = mapa => [...mapa.values()].filter(n => n > 1).length;
  const migradas = actuaciones.filter(item => item.source === MIGRACION.fuente).length;
  const vista = libro.getSheetByName(HOJA_VISTA_GENERAL);
  const vistaConectada = vista && vista.getLastRow() > 1 && String(vista.getRange(2, 1).getValue() || '') ? 1 : 0;

  const filas = [
    ['INDICADOR', 'META DE CIERRE', 'LÍNEA BASE (General)', 'RESULTADO ACTUAL', '¿CUMPLE?', 'CÓMO SE MIDE'],
    ['Campos categóricos fuera de catálogo', '0 %', pct(baseCatFuera, baseCat) + ' % (' + baseCatFuera + ' de ' + baseCat + ')', pct(catFuera, cat) + ' % (' + catFuera + ' de ' + cat + ')', catFuera === 0 ? 'SÍ' : 'NO', 'Celdas categóricas con valor que no coincide exactamente con 04_CATALOGOS.'],
    ['Campos de fecha con texto no válido', '0 %', pct(baseFechasMal, baseFechas) + ' % (' + baseFechasMal + ' de ' + baseFechas + ')', pct(fechasMal, fechasTotal) + ' % (' + fechasMal + ' de ' + fechasTotal + ')', fechasMal === 0 ? 'SÍ' : 'NO', 'Celdas de fecha que no son fecha real.'],
    ['Duplicados no justificados', '0', duplicados(baseRadicados), duplicados(radicados), duplicados(radicados) === 0 ? 'SÍ' : 'NO', 'Radicados que aparecen en más de un proceso.'],
    ['Registros activos con errores críticos', '< 2 %', pct(baseCriticos, baseActivos) + ' %', pct(criticos, activos) + ' % (' + criticos + ' de ' + activos + ')', criticos / Math.max(activos, 1) * 100 < 2 ? 'SÍ' : 'NO', 'Activos sin radicado válido de 23 dígitos o sin abogado.'],
    ['Procesos terminados sin fecha de terminación', 'Solo casos jurídicamente justificados', baseTerminadosSinFecha, terminadosSinFecha + ' (' + terminadosSinJustificar + ' sin justificación)', terminadosSinJustificar === 0 ? 'SÍ' : 'NO', 'Estado Terminado con FECHA_TERMINACION vacía; justificación en OBSERVACIONES_TERMINACION.'],
    ['Actuaciones almacenadas en formato vertical', '100 % de las migradas', baseBloques + ' anotaciones con fecha en bloques horizontales', migradas + ' filas en 02_ACTUACIONES', migradas >= baseBloques ? 'SÍ' : 'NO', 'Bloques FECHA/TIPO/DESCRIPCIÓN de General vs. filas migradas.'],
    ['Variables derivables capturadas manualmente', '0', '2 (FECHA y ANOTACIÓN de última anotación)', 0, 'SÍ', 'Última actuación y alertas se calculan automáticamente en 05_VISTA_GENERAL (script); no hay columnas derivables en 01.'],
    ['Usuarios piloto capacitados', '100 %', '—', 'Registrar manualmente', 'PENDIENTE', 'Se diligencia al cierre con la lista de asistencia.'],
    ['Tablero conectado a fuente estandarizada', '1 tablero operativo', 0, vistaConectada + ' (05_VISTA_GENERAL)', vistaConectada ? 'SÍ' : 'NO', 'La aplicación y Looker Studio leen 01, 02 y 05.']
  ];
  const destino = prepararHoja(EST.hojaInforme);
  escribirPorBloques(destino, filas, 1, 1);
  destino.getRange(1, 1, 1, filas[0].length).setFontWeight('bold').setBackground('#344554').setFontColor('#ffffff');
  destino.getRange(filas.length + 2, 1).setValue('Generado el ' + Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd HH:mm'));
  destino.setFrozenRows(1);
  destino.autoResizeColumns(1, filas[0].length);
  mostrarMensaje('Informe de calidad generado en ' + EST.hojaInforme + '.');
}

// Copia de seguridad del archivo en una carpeta de Drive (propuesta: automatizaciones con respaldos).
function crearRespaldo() {
  const libro = obtenerLibro();
  const archivo = DriveApp.getFileById(libro.getId());
  const padres = archivo.getParents();
  const padre = padres.hasNext() ? padres.next() : DriveApp.getRootFolder();
  const carpetas = padre.getFoldersByName(EST.carpetaRespaldos);
  const carpeta = carpetas.hasNext() ? carpetas.next() : padre.createFolder(EST.carpetaRespaldos);
  const nombre = libro.getName() + ' - respaldo ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HHmm');
  archivo.makeCopy(nombre, carpeta);
  mostrarMensaje('Respaldo creado: ' + nombre);
  return nombre;
}

// Validación diaria de calidad y respaldo semanal.
function programarAutomatizaciones() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => ['validarCalidadBase', 'crearRespaldo', 'actualizarVistaGeneral'].indexOf(trigger.getHandlerFunction()) >= 0)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('validarCalidadBase').timeBased().everyDays(1).atHour(6).create();
  ScriptApp.newTrigger('crearRespaldo').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(5).create();
  ScriptApp.newTrigger('actualizarVistaGeneral').timeBased().everyHours(1).create();
  mostrarMensaje('Programado: control de calidad diario (6 a. m.), respaldo semanal (lunes 5 a. m.) y 05_VISTA_GENERAL cada hora.');
}

// =============================================================================
// Utilidades
// =============================================================================

// Separador de argumentos de la hoja: "," (inglés) o ";" (español y otras configuraciones con coma
// decimal). Se detecta escribiendo =SUM(1,2) en una pestaña temporal, sin cambiar la configuración regional.
let EST_SEPARADOR_ = '';
function estSeparadorHoja_(libro) {
  if (EST_SEPARADOR_) return EST_SEPARADOR_;
  let hoja = null;
  try {
    hoja = libro.insertSheet('_PRUEBA_FORMULA_' + Date.now());
    const celda = hoja.getRange(1, 1);
    celda.setFormula('=SUM(1,2)');
    SpreadsheetApp.flush();
    EST_SEPARADOR_ = Number(celda.getValue()) === 3 ? ',' : ';';
  } catch (error) {
    let local = '';
    try { local = String(libro.getSpreadsheetLocale() || ''); } catch (e) { local = ''; }
    EST_SEPARADOR_ = !local || /^en|^ja|^zh|^ko|^th|^he|^iw/.test(local) ? ',' : ';';
  } finally {
    if (hoja) { try { libro.deleteSheet(hoja); } catch (error) { /* se puede borrar a mano */ } }
  }
  Logger.log('Separador de fórmulas de la hoja: "' + EST_SEPARADOR_ + '"');
  return EST_SEPARADOR_;
}

// Adapta una fórmula escrita con "," al separador de la hoja. Con ";" las columnas de una matriz {a,b}
// se separan con "\". El texto entre comillas no se toca.
function estFormulaLocal_(formula, separador) {
  if (separador === ',') return formula;
  let dentroDeTexto = false;
  let llaves = 0;
  let resultado = '';
  for (const caracter of String(formula)) {
    if (caracter === '"') dentroDeTexto = !dentroDeTexto;
    if (!dentroDeTexto && caracter === '{') llaves++;
    if (!dentroDeTexto && caracter === '}') llaves--;
    resultado += !dentroDeTexto && caracter === ',' ? (llaves > 0 ? '\\' : separador) : caracter;
  }
  return resultado;
}

// Escribe las fórmulas con el separador correcto para la hoja (ya no cambia la configuración regional).
function estEnIngles_(libro, accion) {
  EST_SEPARADOR_ = '';
  estSeparadorHoja_(libro);
  return accion();
}

function estPonerFormula_(rango, formula) {
  return rango.setFormula(estFormulaLocal_(formula, EST_SEPARADOR_ || ','));
}

// Vuelve a escribir las fórmulas de 04_CATALOGOS (listas activas) y 05_VISTA_GENERAL. No toca datos.
function repararFormulas() {
  const libro = obtenerLibro();
  estEnIngles_(libro, () => {
    estCrearListasCatalogo_(libro);
    estCrearVistaGeneral_(libro);
  });
  aplicarValidacionesYProtecciones();
  mostrarMensaje('Fórmulas de 04_CATALOGOS y 05_VISTA_GENERAL reescritas, y validaciones reaplicadas.');
  return 'ok';
}

// Reglas de validación y de formato condicional con fórmula: primero con el separador de la hoja y, si
// Google la rechaza, con el otro. Si ninguno funciona, la regla se omite y se avisa sin detener el proceso
// (el radicado también lo controlan la aplicación y "Validar calidad").
function estConSeparadorLocal_(formula, aplicar) {
  const errores = [];
  const primero = estSeparadorHoja_(obtenerLibro());
  const intentos = primero === ',' ? [',', ';'] : [';', ','];
  for (const separador of intentos) {
    try { aplicar(estFormulaLocal_(formula, separador), separador); return true; }
    catch (error) { errores.push(String(error && error.message)); }
  }
  const aviso = 'No se pudo crear una regla con fórmula (se omitió y el proceso continúa): ' + String(formula).slice(0, 120) + ' · ' + errores.join(' | ').slice(0, 300);
  Logger.log(aviso);
  try { obtenerLibro().toast(aviso.slice(0, 200), 'Aviso', 8); } catch (error) { /* sin interfaz */ }
  return false;
}

// Cambia las comas que separan argumentos (fuera de los textos entre comillas) por el separador indicado.
function estSeparador_(formula, separador) {
  if (separador === ',') return formula;
  let dentroDeTexto = false;
  let resultado = '';
  for (const caracter of String(formula)) {
    if (caracter === '"') dentroDeTexto = !dentroDeTexto;
    resultado += !dentroDeTexto && caracter === ',' ? separador : caracter;
  }
  return resultado;
}

function estUsuario_() {
  try { return Session.getEffectiveUser().getEmail() || 'SCRIPT_BASE'; } catch (error) { return 'SCRIPT_BASE'; }
}

function estLeerTabla_(libro, tabla) {
  if (tabla === 'pendientes') return esqPuntosAGrupos_(estLeerPuntos_(libro)); // un grupo por proceso (ver esqPuntosAGrupos_)
  if (tabla === 'auditoria') estAuditoriaAlDia_(libro);
  const hoja = libro.getSheetByName(ESQUEMA[tabla].hoja);
  if (!hoja || hoja.getLastRow() < 2) return [];
  const ancho = esqEncabezados_(tabla).length;
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, ancho).getValues()
    .filter(fila => String(fila[0] || '').trim())
    .map(fila => esqFilaAObjeto_(tabla, fila));
}

// 06 tal como está en la hoja: una fila por proceso.
function estLeerPuntos_(libro) {
  const hoja = libro.getSheetByName(ESQUEMA.pendientes.hoja);
  if (!hoja || hoja.getLastRow() < 2) return [];
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, esqEncabezados_('pendientes').length).getValues()
    .filter(fila => String(fila[0] || '').trim())
    .map(fila => esqFilaAObjeto_('pendientes', fila));
}

// Reescribe los datos de la tabla (conserva encabezados, formatos y validaciones).
function estEscribirTabla_(libro, tabla, objetos) {
  if (tabla === 'pendientes') {
    const ahora = new Date().toISOString();
    const procesos = new Map();
    estLeerTabla_(libro, 'procesos').forEach(item => procesos.set(item.id, { shortNo: item.shortNo || '', radicado: item.radicado || '', lawyer: item.lawyer || '' }));
    objetos = esqGruposAFilas_(objetos, estLeerPuntos_(libro), ahora, procesos)
      .sort((a, b) => [a.status === 'PENDIENTE' ? '0' : '1', a.priority || '9', esqNormalizar_(a.lawyer || 'ZZZ'), a.shortNo || ''].join('|')
        .localeCompare([b.status === 'PENDIENTE' ? '0' : '1', b.priority || '9', esqNormalizar_(b.lawyer || 'ZZZ'), b.shortNo || ''].join('|')));
  }
  if (tabla === 'auditoria') { estAuditoriaAlDia_(libro); estCompletarAuditoria_(libro, objetos); }
  const hoja = libro.getSheetByName(ESQUEMA[tabla].hoja);
  const ancho = esqEncabezados_(tabla).length;
  const anteriores = Math.max(hoja.getLastRow() - 1, 0);
  const filas = objetos.map(objeto => esqObjetoAFila_(tabla, objeto));
  asegurarDimensiones(hoja, filas.length + 1, ancho);
  if (anteriores) hoja.getRange(2, 1, anteriores, ancho).clearContent();
  estMarcarCambioDatos_(libro);
  if (!filas.length) return;
  estFormatearColumnas_(hoja, tabla, 2, filas.length);
  escribirPorBloques(hoja, filas, 2, 1);
  if (tabla === 'pendientes') estFormatoPendientes_(hoja);
}

// 06 conserva todo el detalle en la fila del proceso.
function estFormatoPendientes_(hoja) {
  try {
    const ancho = esqEncabezados_('pendientes').length;
    const filas = Math.max(hoja.getMaxRows() - 1, 1);
    const col = nombre => esqIndice_('pendientes', nombre) + 1;
    const filtro = hoja.getFilter(); if (filtro) filtro.remove();
    hoja.getRange(1, 1, hoja.getLastRow() || 1, ancho).createFilter();
    hoja.setFrozenRows(1);
    const anchos = { ID_PENDIENTE: 120, ID_PROCESO: 120, NO_CORTO: 110, RADICADO: 190, ABOGADO_A_CARGO: 170, PRIORIDAD: 100, TIPO_PROBLEMA: 210, CAMPO: 180,
      NOMBRE_CAMPO: 210, QUE_ESTA_MAL: 320, VALOR_ENCONTRADO: 220, QUE_HACER: 360, RESPONSABLE: 150, DETALLE: 420, OBSERVACION_RESOLUCION: 300 };
    Object.keys(anchos).forEach(nombre => { if (col(nombre) > 0) hoja.setColumnWidth(col(nombre), anchos[nombre]); });
    ['TIPO_PROBLEMA', 'CAMPO', 'NOMBRE_CAMPO', 'QUE_ESTA_MAL', 'VALOR_ENCONTRADO', 'QUE_HACER', 'RESPONSABLE', 'DETALLE', 'OBSERVACION_RESOLUCION']
      .forEach(nombre => hoja.getRange(2, col(nombre), filas, 1).setWrap(true));
    hoja.getRange(2, 1, filas, ancho).setVerticalAlignment('top');
    [col('ID_PENDIENTE'), col('ID_PROCESO')].forEach(numero => hoja.hideColumns(numero));
    const letraEstado = nombreColumna(col('ESTADO')), letraPrioridad = nombreColumna(col('PRIORIDAD'));
    const todo = hoja.getRange(2, 1, filas, ancho);
    const regla = (formula, color, gris) => { const r = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(formula).setRanges([todo]); return (gris ? r.setFontColor('#8a96a3') : r.setBackground(color)).build(); };
    hoja.setConditionalFormatRules([
      regla('=$' + letraEstado + '2<>"PENDIENTE"', null, true),
      regla('=$' + letraPrioridad + '2="1. Crítica"', '#fde2e1'),
      regla('=$' + letraPrioridad + '2="2. Alta"', '#fdf0dc')
    ]);
  } catch (error) { Logger.log('Formato de 06_PENDIENTES_CALIDAD: ' + error.message); }
}

// Avisa a la aplicación que los datos cambiaron fuera de ella (metadato VIGIA_VERSION_DATOS del archivo):
// la próxima vez que alguien entre, la app rearma su precarga con estos cambios.
function estMarcarCambioDatos_(libro) {
  try {
    const clave = 'VIGIA_VERSION_DATOS';
    const valor = String(Date.now());
    const hallados = libro.createDeveloperMetadataFinder().withKey(clave).find();
    if (hallados.length) hallados[0].setValue(valor);
    else libro.addDeveloperMetadata(clave, valor, SpreadsheetApp.DeveloperMetadataVisibility.PROJECT);
  } catch (error) {
    Logger.log('No se pudo marcar el cambio de datos para la aplicación: ' + error.message);
  }
}

function estEscribirReporteMigracion_(reporte, resumen) {
  const filas = [['FILA_GENERAL', 'NO_CORTO', 'RADICADO', 'ID_PROCESO', 'RESULTADO', 'CLASIFICACION', 'HALLAZGOS']].concat(reporte);
  const hoja = prepararHoja(EST.hojaReporteMigracion);
  escribirPorBloques(hoja, filas.map(fila => fila.map(valor => String(valor === undefined || valor === null ? '' : valor))), 1, 1);
  hoja.getRange(1, 1, 1, 7).setFontWeight('bold');
  hoja.setFrozenRows(1);
  hoja.getRange(1, 9, 8, 2).setValues([['RESUMEN', ''], ['Filas', resumen.filas], ['Creados', resumen.creados], ['Actualizados', resumen.actualizados],
    ['Omitidos', resumen.omitidos], ['VALIDADO', resumen.validados], ['CORREGIBLE AUTOMÁTICAMENTE', resumen.corregibles], ['REQUIERE REVISIÓN JURÍDICA', resumen.revision]]);
}

function estHallazgo_(campo, original, aplicado, problema, clasificacion, responsable) {
  const etiqueta = (ESQUEMA.procesos.columnas.find(col => col[1] === campo) || [campo])[0];
  return { field: etiqueta, originalValue: String(original === undefined ? '' : original), appliedValue: String(aplicado === undefined ? '' : aplicado),
    problem: problema, classification: clasificacion, responsible: responsable };
}


// "2011-96", "2011/00096" o "2011-00096 DR. JUAN ... FALTAN PIEZAS" -> { codigo: '2011-00096', resto: 'DR. JUAN ...' }.
// Si no empieza por AAAA y un consecutivo, se deja igual (no se inventa un número).
function estSepararNoCorto_(texto) {
  const valor = String(texto || '').trim();
  const m = valor.match(/^(\d{4})\s*[-\/_. ]\s*(\d{1,5})(?![\d])(?:\s*[-–:,;.]?\s*(.*))?$/);
  if (!m) return { codigo: valor, resto: '' };
  return { codigo: m[1] + '-' + ('00000' + m[2]).slice(-5), resto: String(m[3] || '').trim() };
}

function estVacio_(valor) {
  if (valor === null || valor === undefined) return true;
  if (valor instanceof Date) return isNaN(valor.getTime());
  return EST_VACIOS.indexOf(String(valor).replace(/\s+/g, ' ').trim().toUpperCase()) >= 0;
}

function estTexto_(valor, zona) {
  if (estVacio_(valor)) return '';
  if (valor instanceof Date) return estFecha_(valor, zona);
  return String(valor).replace(/\u00A0/g, ' ').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function estEntero_(valor) {
  return typeof valor === 'number' && isFinite(valor) ? String(Math.round(valor)) : '';
}

function estLimpiarRadicado_(valor) {
  if (estVacio_(valor)) return '';
  const digitos = String(valor).replace(/\D/g, '');
  return digitos.length === 23 ? digitos : '';
}

// Valor de las pretensiones: solo pesos colombianos (COP), número entero sin $, puntos ni comas.
// "$ 1.500.000" -> 1500000. Lo que no está en pesos ("100 SMMLV", "indeterminada", "50 UVT") no se convierte:
// queda vacío, el texto original va a OBSERVACIONES y el caso a revisión jurídica (no se inventa una conversión).
function estValor_(valor, zona) {
  if (typeof valor === 'number' && isFinite(valor)) return { numero: String(Math.round(valor)), hallazgo: '' };
  if (estVacio_(valor)) return { numero: '', hallazgo: '' };
  const texto = estTexto_(valor, zona);
  const clave = esqNormalizar_(texto);
  if (/SMMLV|SMLMV|SMLV|SALARIO|UVT|INDETERMINAD|INDETERMINABLE/.test(clave)) {
    return { numero: '', hallazgo: 'El valor de las pretensiones no está en pesos ("' + texto + '"); requiere el valor en COP.' };
  }
  const limpio = texto.replace(/[$\s]/g, '').replace(/(COP|PESOS?|M\/?CTE)\.?/gi, '').replace(/,\d{1,2}$/, '').replace(/\.\d{1,2}$/, '');
  const digitos = limpio.replace(/[.,]/g, '');
  if (/^\d+$/.test(digitos)) return { numero: String(Number(digitos)), hallazgo: 'El valor estaba escrito como texto ("' + texto + '"); se dejó solo el número en pesos.' };
  return { numero: '', hallazgo: 'El valor de las pretensiones no es numérico ("' + texto + '").' };
}

function estSentenciaAnticipada_(valor) {
  return typeof valor === 'string' && /^SE?N?TENCIA\s+ANTICIPADA$/.test(esqNormalizar_(valor));
}

function estFecha_(valor, zona) {
  if (valor === null || valor === undefined || valor === '') return '';
  let iso = '';
  if (valor instanceof Date) {
    if (isNaN(valor.getTime())) return '';
    iso = Utilities.formatDate(valor, zona, 'yyyy-MM-dd');
  } else if (typeof valor === 'string') {
    const texto = valor.trim();
    let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) iso = m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
    m = !iso && texto.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
    if (m) iso = m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  }
  if (!iso || !esqFechaIsoValida_(iso)) return '';
  const anio = Number(iso.slice(0, 4));
  return anio >= 1950 && anio <= 2100 ? iso : '';
}

// Reconoce una fecha escrita al inicio de una anotación ("27/03/2023 - ESTADO - ...") y devuelve el resto del texto.
function estFechaAlInicio_(texto, zona) {
  const limpio = String(texto || '').trim();
  const m = limpio.match(/^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4}|\d{4}-\d{1,2}-\d{1,2})\s*[-–:,]?\s*/);
  if (!m) return { iso: '', resto: limpio };
  const iso = estFecha_(m[1], zona);
  const resto = limpio.slice(m[0].length).trim();
  return iso && resto ? { iso: iso, resto: resto } : { iso: '', resto: limpio };
}

function estTipoActuacion_(texto) {
  const clave = esqNormalizar_(texto);
  if (/CONTESTA.*MEDIDA/.test(clave)) return 'Contestación de medida cautelar';
  if (/CONTESTA.*DEMANDA/.test(clave)) return 'Contestación de demanda';
  if (/ALEGATO/.test(clave)) return 'Traslado para alegatos';
  if (/FIJA FECHA|SENALA FECHA|PROGRAMA|AUDIENCIA/.test(clave)) return 'Programación de diligencia';
  if (/RECURSO|APELACION/.test(clave)) return 'Recurso';
  if (/SENTENCIA|FALLO/.test(clave)) return 'Fallo';
  return 'Otra';
}

function estConflictoTerminacion_(proceso, actuaciones) {
  if (!proceso.endDate) return '';
  const fechas = [proceso.notificationDate, proceso.measureResponseDate, proceso.demandResponseDate, proceso.closingArgumentsDate,
    proceso.firstInstanceDecisionDate, proceso.appealDate, proceso.secondInstanceDecisionDate].concat(actuaciones.map(item => item.date)).filter(Boolean);
  return fechas.filter(fecha => fecha > proceso.endDate).sort().pop() || '';
}

function estIdSeguro_(valor) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(valor || ''));
}

// ID estable: la misma fila de General recibe siempre el mismo ID (igual que la versión anterior de la app).
function estIdImportacion_(proceso, usados) {
  const clave = [proceso.shortNo, proceso.radicado, proceso.claimant].map(esqNormalizar_).join('|');
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, clave, Utilities.Charset.UTF_8);
  const hex = digest.slice(0, 10).map(byte => ('0' + (byte & 0xff).toString(16)).slice(-2)).join('');
  const base = 'GEN_' + hex;
  const conteo = (usados.get(base) || 0) + 1;
  usados.set(base, conteo);
  return conteo === 1 ? base : base + '_' + conteo;
}

// =============================================================================
// Controles de coherencia (validarCalidadBase)
// =============================================================================
// Fechas que ya debieron ocurrir (no pueden ser futuras) y fechas que pueden estar programadas (vencimientos,
// audiencias), que solo se revisan si están demasiado lejos (posible error en el año).
const EST_FECHAS_PASADAS = ['notificationDate', 'measureResponseDate', 'demandResponseDate', 'closingArgumentsDate', 'firstInstanceDecisionDate',
  'appealDate', 'appealGrantedOrderDate', 'appealAdmittedOrderDate', 'secondInstanceDecisionDate', 'endDate'];
const EST_FECHAS_PROGRAMABLES = ['maxMeasureResponseDate', 'maxDemandResponseDate', 'initialAudienceDate', 'evidenceAudienceDate',
  'maxClosingArgumentsDate', 'maxAppealDate', 'maxAppealAnnouncementDate'];
const EST_FECHA_MINIMA = '1990-01-01';
// [campo que se corrige, campo de referencia]: el primero no puede ser anterior al segundo.
const EST_ORDEN_FECHAS = [
  ['demandResponseDate', 'notificationDate'], ['maxDemandResponseDate', 'notificationDate'], ['measureResponseDate', 'notificationDate'],
  ['initialAudienceDate', 'notificationDate'], ['evidenceAudienceDate', 'initialAudienceDate'], ['closingArgumentsDate', 'notificationDate'],
  ['firstInstanceDecisionDate', 'notificationDate'], ['appealDate', 'firstInstanceDecisionDate'], ['appealGrantedOrderDate', 'appealDate'],
  ['appealAdmittedOrderDate', 'appealGrantedOrderDate'], ['secondInstanceDecisionDate', 'firstInstanceDecisionDate'], ['secondInstanceDecisionDate', 'appealDate']
];

function estEtiquetaLegible_(campo) { return esqEtiquetaLegible_(campo); }

function estControlesCoherencia_(procesos, actuaciones) {
  const zona = Session.getScriptTimeZone();
  const hoy = Utilities.formatDate(new Date(), zona, 'yyyy-MM-dd');
  const masAnios = n => String(Number(hoy.slice(0, 4)) + n) + hoy.slice(4);
  const limiteProgramable = masAnios(3);
  const fmt = iso => { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : String(iso || ''); };
  const et = estEtiquetaLegible_;
  const resp = { juridico: EST.responsable.juridico, coordinacion: EST.responsable.coordinacion, analista: EST.responsable.analista };
  const salida = [];
  const add = (proceso, campo, valor, problema, responsable) => salida.push([proceso, campo, valor, problema, responsable]);

  const porProceso = new Map();
  (actuaciones || []).forEach(item => {
    if (!item.processId) return;
    if (!porProceso.has(item.processId)) porProceso.set(item.processId, []);
    porProceso.get(item.processId).push(item);
  });

  procesos.forEach(p => {
    // 1. Fechas imposibles.
    EST_FECHAS_PASADAS.forEach(campo => {
      const f = p[campo]; if (!f) return;
      if (f > hoy) add(p, campo, fmt(f), 'Fecha futura en un dato que ya debió ocurrir: revisa el día, el mes y el año.');
      else if (f < EST_FECHA_MINIMA) add(p, campo, fmt(f), 'Fecha anterior a 1990: posible error al escribir el año.');
    });
    EST_FECHAS_PROGRAMABLES.forEach(campo => {
      const f = p[campo]; if (!f) return;
      if (f > limiteProgramable) add(p, campo, fmt(f), 'Fecha a más de 3 años en el futuro: posible error al escribir el año.');
      else if (f < EST_FECHA_MINIMA) add(p, campo, fmt(f), 'Fecha anterior a 1990: posible error al escribir el año.');
    });
    // 2. Orden de las etapas.
    EST_ORDEN_FECHAS.forEach(([campo, referencia]) => {
      if (p[campo] && p[referencia] && p[campo] < p[referencia]) {
        add(p, campo, et(campo) + ' ' + fmt(p[campo]) + ' · ' + et(referencia) + ' ' + fmt(p[referencia]),
          'Orden de fechas: «' + et(campo) + '» no puede ser anterior a «' + et(referencia) + '». Revisa cuál de las dos está mal.');
      }
    });
    // 3. Radicados y números.
    const radicado = String(p.radicado || ''), actual = String(p.currentRadicado || '');
    if (actual && !/^\d{23}$/.test(actual)) add(p, 'currentRadicado', actual, 'El radicado actual no tiene 23 dígitos.', resp.juridico);
    const anioRadicado = /^\d{23}$/.test(radicado) ? Number(radicado.slice(12, 16)) : 0;
    const anioCorto = /^\d{4}-\d{5}$/.test(String(p.shortNo || '')) ? Number(String(p.shortNo).slice(0, 4)) : 0;
    if (anioRadicado && (anioRadicado < 1990 || anioRadicado > Number(hoy.slice(0, 4)))) add(p, 'radicado', radicado, 'El año dentro del radicado (posiciones 13 a 16) no es válido: revisa los dígitos.', resp.juridico);
    else if (anioRadicado && anioCorto && Math.abs(anioRadicado - anioCorto) > 1) add(p, 'shortNo', 'No. corto ' + p.shortNo + ' · año del radicado ' + anioRadicado, 'El año del No. corto y el del radicado no coinciden (más de un año de diferencia).', resp.coordinacion);
    if (anioRadicado && p.notificationDate && Number(p.notificationDate.slice(0, 4)) < anioRadicado) add(p, 'notificationDate', fmt(p.notificationDate) + ' · radicado de ' + anioRadicado, 'La notificación es de un año anterior al de radicación del proceso.');
    const monto = Number(p.amount || 0), montoRecurso = Number(p.appealAmount || 0);
    if (p.amount !== '' && p.amount !== undefined && monto > 1e13) add(p, 'amount', String(p.amount), 'Valor de pretensiones fuera de rango (más de 10 billones): revisa si sobran ceros.');
    if (montoRecurso && monto && montoRecurso < monto) add(p, 'appealAmount', montoRecurso + ' · primera instancia ' + monto, 'La pretensión del recurso es menor que la de primera instancia.');
    if (p.ids && !/\d/.test(String(p.ids))) add(p, 'ids', String(p.ids), 'Cédulas / identificadores sin ningún número: escribe el número de documento.', resp.analista);
    // 4. Campos que se contradicen.
    if (p.state === 'Activo' && p.endDate) add(p, 'state', 'Activo · terminación ' + fmt(p.endDate), 'El proceso tiene fecha de terminación pero su estado es Activo: corrige el estado o quita la fecha.');
    if (p.state === 'Activo' && p.terminationForm) add(p, 'state', 'Activo · ' + p.terminationForm, 'El proceso tiene forma de terminación pero su estado es Activo.');
    if (p.state === 'Terminado' && !p.terminationForm) add(p, 'terminationForm', '', 'Proceso Terminado sin forma de terminación.');
    if (p.cautelar === 'No' && (p.measureResponseDate || p.maxMeasureResponseDate)) add(p, 'cautelar', 'No · hay fechas de medida cautelar', 'Dice que no hay medida cautelar pero tiene fechas de la medida: corrige uno de los dos.');
    if (p.firstInstanceDecisionSense && !p.firstInstanceDecisionDate) add(p, 'firstInstanceDecisionDate', p.firstInstanceDecisionSense, 'Tiene el sentido del fallo de primera instancia pero no su fecha.');
    if (p.firstInstanceDecisionDate && !p.firstInstanceDecisionSense) add(p, 'firstInstanceDecisionSense', fmt(p.firstInstanceDecisionDate), 'Tiene la fecha del fallo de primera instancia pero no su sentido.');
    if (p.secondInstanceDecisionSense && !p.secondInstanceDecisionDate) add(p, 'secondInstanceDecisionDate', p.secondInstanceDecisionSense, 'Tiene el sentido del fallo de segunda instancia pero no su fecha.');
    if (p.secondInstanceDecisionDate && !p.secondInstanceDecisionSense) add(p, 'secondInstanceDecisionSense', fmt(p.secondInstanceDecisionDate), 'Tiene la fecha del fallo de segunda instancia pero no su sentido.');
    if (p.secondInstanceDecisionDate && !p.firstInstanceDecisionDate) add(p, 'firstInstanceDecisionDate', 'Segunda instancia ' + fmt(p.secondInstanceDecisionDate), 'Hay fallo de segunda instancia sin fecha del fallo de primera instancia.');
    if (/^Presentado/.test(String(p.appealStatus || '')) && !p.appealDate) add(p, 'appealDate', p.appealStatus, 'El recurso figura como presentado pero no tiene fecha de presentación.');
    if (p.appealStatus === 'No presentado' && p.appealDate) add(p, 'appealStatus', 'No presentado · recurso ' + fmt(p.appealDate), 'Dice que el recurso no se presentó pero tiene fecha de presentación.');
    // 5. Actuaciones del proceso (las diligencias y comités pueden estar programados a futuro: no se revisan aquí).
    const lista = (porProceso.get(p.id) || []).filter(item => (item.clase || 'ACTUACION') === 'ACTUACION');
    const futuras = lista.filter(item => item.date && item.date > hoy);
    const viejas = lista.filter(item => item.date && item.date < EST_FECHA_MINIMA);
    if (futuras.length) add(p, 'ACTUACIONES', futuras.length + ': ' + futuras.slice(0, 3).map(item => fmt(item.date)).join(', '), 'Actuaciones con fecha futura: revisa la fecha de cada una.', resp.analista);
    if (viejas.length) add(p, 'ACTUACIONES', viejas.length + ': ' + viejas.slice(0, 3).map(item => fmt(item.date)).join(', '), 'Actuaciones con fecha anterior a 1990: posible error en el año.', resp.analista);
    const vistas = new Map();
    lista.forEach(item => {
      const clave = [item.date, estNormalizarTexto_(item.type), estNormalizarTexto_(item.title), estNormalizarTexto_(item.description)].join('|');
      vistas.set(clave, (vistas.get(clave) || 0) + 1);
    });
    const repetidas = [...vistas.values()].filter(n => n > 1).reduce((total, n) => total + n - 1, 0);
    if (repetidas) add(p, 'ACTUACIONES', String(repetidas), 'Actuaciones repetidas con la misma fecha, tipo y texto: el administrador debe dejar solo una.', resp.coordinacion);
  });
  return salida;
}

function estNormalizarTexto_(texto) {
  return String(texto || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}