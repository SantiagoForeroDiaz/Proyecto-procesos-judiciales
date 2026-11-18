// Code.gs — aplicación web: inicio de sesión (roles) y procesos (lee y escribe la estructura de BaseProcesos.gs).

// =============================================================================
// ESQUEMA DE LA BASE (igual al de BaseProcesos.gs)
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

// Zona horaria de la aplicación: fija en Bogotá. No depende de la que tenga configurada el proyecto de Apps Script
// (si el proyecto quedó en otra zona, una fecha leída de la hoja podía correrse un día).
const ZONA_HORARIA_ = 'America/Bogota';
// Fecha AAAA-MM-DD en Bogotá de un instante (por defecto, ahora). Nunca toISOString().slice(0, 10): eso es la fecha
// en UTC, que entre las 7 p. m. y la medianoche de Bogotá ya es el día siguiente.
function fechaLocal_(instante) {
  return Utilities.formatDate(instante ? new Date(instante) : new Date(), ZONA_HORARIA_, 'yyyy-MM-dd');
}

// Valor de la celda -> texto (las fechas como AAAA-MM-DD en la zona horaria de Bogotá).
function esqTextoCelda_(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, ZONA_HORARIA_, 'yyyy-MM-dd');
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
  if (tipo === 'list') return Array.isArray(value) ? value.join('|') : String(value);
  return String(value);
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

// Convierte filas anteriores o combina registros agrupados repetidos.
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
// APLICACIÓN: ACCESO, ROLES Y PROCESOS
// =============================================================================

// Archivo con los ROLES (ADMINISTRADORES, INTERMEDIARIOS, ABOGADOS). Si existe la propiedad
// AUTH_SPREADSHEET_ID, la propiedad tiene prioridad.
const DEFAULT_SPREADSHEET_ID = '1o4w8dpVTJPA6JDZUqsbLnfHEkMjwKSJlGO98TFYn-70';
// Base de procesos: pestaña General (histórico, solo lectura) + estructura estandarizada
// 01_PROCESOS ... 07_AUDITORIA (definida en la sección ESQUEMA al inicio de este archivo y creada por BaseProcesos.gs).
// Si existe la propiedad DATA_SPREADSHEET_ID, la propiedad tiene prioridad.
const DEFAULT_DATA_SPREADSHEET_ID = '1kEF3qbsCQpzg3ZUhE0TvNdHUzVy03bfe0KjWF9MEdak';

const AUTH_CONFIG = {
  spreadsheetIdProperty: 'AUTH_SPREADSHEET_ID',
  dataSpreadsheetIdProperty: 'DATA_SPREADSHEET_ID',
  intermediariesSheet: 'INTERMEDIARIOS',
  legacyIntermediariesSheet: 'COLABORADORES',
  lawyersSheet: 'ABOGADOS',
  administratorsSheet: 'ADMINISTRADORES',
  codeLifetimeSeconds: 600,
  resendDelaySeconds: 60,
  maxCodeAttempts: 5,
  sessionLifetimeSeconds: 21600
};

function doGet() {
  // Al abrir el enlace: si falta el activador que mantiene la base en memoria, se instala solo (una vez).
  ensureTrigger_();
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gestión de procesos judiciales');
}

function verificarPermisoEnvioCorreo() {
  const cuotaDiariaRestante = MailApp.getRemainingDailyQuota();
  console.log('Cuota diaria restante de destinatarios: ' + cuotaDiariaRestante);
  return cuotaDiariaRestante;
}

function solicitarCodigoAcceso(email) {
  const correo = normalizeEmail_(email);
  if (!isValidEmail_(correo)) {
    return { enviado: false, mensaje: 'Escribe una dirección de correo válida.' };
  }

  const usuario = findAuthorizedUserByEmail_(correo);
  if (!usuario) {
    return {
      enviado: false,
      mensaje: 'Este correo no está registrado como activo en ADMINISTRADORES, INTERMEDIARIOS ni ABOGADOS. Contacta al administrador.'
    };
  }

  const cache = CacheService.getScriptCache();
  const rateLimitKey = getCacheKey_('AUTH_CODE_WAIT_', correo);
  const code = Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase();
  const now = Date.now();
  const codeKey = getCacheKey_('AUTH_CODE_', correo);
  const request = {
    code: code,
    attempts: 0,
    expiresAt: now + AUTH_CONFIG.codeLifetimeSeconds * 1000
  };

  // Si una importación ocupa el bloqueo, el acceso continúa igual (el bloqueo aquí solo evita carreras menores).
  const lock = LockService.getScriptLock();
  const locked = lock.tryLock(5000);
  try {
    if (cache.get(rateLimitKey)) {
      return {
        enviado: true,
        mensaje: 'Espera un minuto antes de solicitar otro código. Si el correo está autorizado, el código anterior sigue siendo válido.'
      };
    }
    cache.put(rateLimitKey, '1', AUTH_CONFIG.resendDelaySeconds);
    cache.put(codeKey, JSON.stringify(request), AUTH_CONFIG.codeLifetimeSeconds);
  } finally {
    if (locked) lock.releaseLock();
  }

  try {
    MailApp.sendEmail(
      correo,
      'Código de acceso - Gestión de procesos judiciales',
      'Tu código de acceso es: ' + code +
      '\n\nVence en 10 minutos. Si no solicitaste este código, puedes ignorar este mensaje.'
    );
  } catch (error) {
    cache.remove(codeKey);
    cache.remove(rateLimitKey);
    console.error('No se pudo enviar el código de acceso a ' + correo, error);
    const detail = error && error.message ? error.message : String(error);
    throw new Error('Apps Script no pudo enviar el correo: ' + detail);
  }

  return {
    enviado: true,
    mensaje: 'Se envió un código a tu correo. Revisa también la carpeta de spam.'
  };
}

function verificarCodigoAcceso(email, submittedCode) {
  const correo = normalizeEmail_(email);
  const code = String(submittedCode || '').trim().toUpperCase();
  if (!isValidEmail_(correo) || !/^[A-F0-9]{8}$/.test(code)) {
    return {
      autorizado: false,
      mensaje: 'Escribe el correo y el código de 8 caracteres que recibiste.'
    };
  }

  const cache = CacheService.getScriptCache();
  const codeKey = getCacheKey_('AUTH_CODE_', correo);
  // Si una importación ocupa el bloqueo, el acceso continúa igual (el bloqueo aquí solo evita carreras menores).
  const lock = LockService.getScriptLock();
  const locked = lock.tryLock(5000);
  try {
    const cachedRequest = cache.get(codeKey);
    if (!cachedRequest) {
      return {
        autorizado: false,
        mensaje: 'El código venció o no existe. Solicita uno nuevo.'
      };
    }

    const request = JSON.parse(cachedRequest);
    const remainingSeconds = Math.ceil((request.expiresAt - Date.now()) / 1000);
    if (remainingSeconds <= 0) {
      cache.remove(codeKey);
      return {
        autorizado: false,
        mensaje: 'El código venció. Solicita uno nuevo.'
      };
    }

    if (request.attempts >= AUTH_CONFIG.maxCodeAttempts) {
      cache.remove(codeKey);
      return {
        autorizado: false,
        mensaje: 'Se agotaron los intentos para este código. Solicita uno nuevo.'
      };
    }

    if (request.code !== code) {
      request.attempts++;
      if (request.attempts >= AUTH_CONFIG.maxCodeAttempts) {
        cache.remove(codeKey);
        return {
          autorizado: false,
          mensaje: 'El código no coincide y se agotaron los intentos. Solicita uno nuevo.'
        };
      }
      cache.put(codeKey, JSON.stringify(request), remainingSeconds);
      return {
        autorizado: false,
        mensaje: 'El código no coincide. Verifícalo e inténtalo de nuevo.'
      };
    }

    cache.remove(codeKey);
  } finally {
    if (locked) lock.releaseLock();
  }

  const usuario = findAuthorizedUserByEmail_(correo);
  if (!usuario) {
    return {
      autorizado: false,
      mensaje: 'El correo ya no está autorizado. Solicita al administrador que lo active.'
    };
  }

  return createAccessSession_(correo, usuario);
}

function verificarSesionAcceso(sessionToken) {
  const token = String(sessionToken || '');
  if (!/^[A-Fa-f0-9]{64}$/.test(token)) {
    return { autorizado: false, mensaje: 'La sesión no es válida. Ingresa de nuevo.' };
  }

  const cache = CacheService.getScriptCache();
  const sessionKey = getCacheKey_('AUTH_SESSION_', token);
  const correo = cache.get(sessionKey);
  if (!correo) {
    return { autorizado: false, mensaje: 'La sesión venció. Ingresa de nuevo.' };
  }

  const usuario = findAuthorizedUserByEmail_(correo);
  if (!usuario) {
    cache.remove(sessionKey);
    return { autorizado: false, mensaje: 'Tu correo ya no está autorizado. Ingresa de nuevo o contacta al administrador.' };
  }

  return sessionUserPayload_(correo, usuario);
}

function cerrarSesionAcceso(sessionToken) {
  const token = String(sessionToken || '');
  if (/^[A-Fa-f0-9]{64}$/.test(token)) {
    CacheService.getScriptCache().remove(getCacheKey_('AUTH_SESSION_', token));
  }
  return true;
}

function createAccessSession_(correo, usuario) {
  const token = Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put(
    getCacheKey_('AUTH_SESSION_', token),
    correo,
    AUTH_CONFIG.sessionLifetimeSeconds
  );
  return Object.assign(sessionUserPayload_(correo, usuario), { sessionToken: token });
}

function sessionUserPayload_(correo, usuario) {
  return {
    autorizado: true,
    correo: correo,
    nombre: usuario.nombre,
    rol: usuario.rol
  };
}

function getSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.spreadsheetIdProperty) || DEFAULT_SPREADSHEET_ID;
}

let spreadsheetMemo_ = null;
function openAuthSpreadsheet_() {
  if (spreadsheetMemo_) return spreadsheetMemo_;
  try {
    spreadsheetMemo_ = SpreadsheetApp.openById(getSpreadsheetId_());
    return spreadsheetMemo_;
  } catch (error) {
    console.error('No se pudo abrir el archivo de autorización.', error);
    throw new Error('No se pudo abrir el archivo de autorización. Verifica AUTH_SPREADSHEET_ID y los permisos del proyecto.');
  }
}

// Renombra COLABORADORES -> INTERMEDIARIOS y crea las hojas que falten.
function ensureRoleSheets_(spreadsheet) {
  if (!spreadsheet.getSheetByName(AUTH_CONFIG.intermediariesSheet)) {
    const legacy = spreadsheet.getSheetByName(AUTH_CONFIG.legacyIntermediariesSheet);
    if (legacy) {
      legacy.setName(AUTH_CONFIG.intermediariesSheet);
    } else {
      const sheet = spreadsheet.insertSheet(AUTH_CONFIG.intermediariesSheet);
      sheet.getRange(1, 1, 1, 3).setValues([['CORREO', 'NOMBRE', 'ACTIVO']]);
    }
  }
  // ABOGADOS: INTERMEDIARIO = correo del intermediario que hace el seguimiento de los procesos de ese abogado.
  let lawyers = spreadsheet.getSheetByName(AUTH_CONFIG.lawyersSheet);
  if (!lawyers) {
    lawyers = spreadsheet.insertSheet(AUTH_CONFIG.lawyersSheet);
    lawyers.getRange(1, 1, 1, 4).setValues([['CORREO', 'NOMBRE', 'ACTIVO', 'INTERMEDIARIO']]);
  } else if (lawyers.getLastColumn() > 0) {
    const headers = lawyers.getRange(1, 1, 1, lawyers.getLastColumn()).getValues()[0].map(value => String(value).trim().toUpperCase());
    if (headers.indexOf('INTERMEDIARIO') < 0) lawyers.getRange(1, headers.length + 1).setValue('INTERMEDIARIO');
  }
}

// El directorio de usuarios (3 hojas) se guarda 2 minutos en caché: cada llamada del cliente
// valida la sesión y, sin caché, leía las hojas de roles una y otra vez.
let directoryMemo_ = null;
// Usuarios y roles: en memoria hasta 6 horas y renovados por el activador cada 10 minutos (precargarAplicacion),
// así ninguna carga ni guardado tiene que leer la hoja de roles. Un cambio de roles se ve en máximo 10 minutos
// (o al instante con refrescarCacheAplicacion).
function getDirectory_(force) {
  if (directoryMemo_ && !force) return directoryMemo_;
  const cache = CacheService.getScriptCache();
  const cached = force ? null : cache.get('ROLE_DIRECTORY_V2');
  if (cached) {
    try { directoryMemo_ = JSON.parse(cached); return directoryMemo_; } catch (error) { /* se reconstruye */ }
  }
  const spreadsheet = openAuthSpreadsheet_();
  ensureRoleSheets_(spreadsheet);
  directoryMemo_ = {
    admins: readRoleUsers_(spreadsheet, AUTH_CONFIG.administratorsSheet),
    intermediaries: readRoleUsers_(spreadsheet, AUTH_CONFIG.intermediariesSheet),
    lawyers: readRoleUsers_(spreadsheet, AUTH_CONFIG.lawyersSheet)
  };
  try { cache.put('ROLE_DIRECTORY_V2', JSON.stringify(directoryMemo_), 21600); } catch (error) { /* sin caché */ }
  return directoryMemo_;
}

function findAuthorizedUserByEmail_(correo) {
  const directory = getDirectory_();
  const pick = (list, role) => {
    const user = list.find(item => item.correo === correo && item.activo);
    if (!user) return null;
    return { nombre: user.nombre, rol: role };
  };
  return pick(directory.admins, ROLES.admin) || pick(directory.intermediaries, ROLES.intermediary) || pick(directory.lawyers, ROLES.lawyer);
}

function directoryPeople_() {
  const out = {};
  try {
    const directory = getDirectory_();
    ['lawyers', 'intermediaries', 'admins'].forEach(group => (directory[group] || []).forEach(person => {
      const email = normalizeEmail_(person.correo);
      if (email && person.nombre) out[email] = String(person.nombre);
    }));
  } catch (error) { /* sin directorio: se muestra solo el correo */ }
  return out;
}

function normalizeEmail_(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail_(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getCacheKey_(prefix, correo) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, correo);
  const hash = Utilities.base64EncodeWebSafe(digest).replace(/=+$/, '');
  return prefix + hash;
}

function readRoleUsers_(spreadsheet, sheetName) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('No existe la hoja "' + sheetName + '" en el archivo de autorización.');
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    throw new Error('La hoja "' + sheetName + '" debe incluir CORREO, NOMBRE y ACTIVO en la primera fila.');
  }

  const headers = values[0].map(value => String(value).trim().toUpperCase());
  const emailColumn = headers.indexOf('CORREO');
  const nameColumn = headers.indexOf('NOMBRE');
  const activeColumn = headers.indexOf('ACTIVO');
  const intermediaryColumn = headers.indexOf('INTERMEDIARIO');
  if (emailColumn < 0 || nameColumn < 0 || activeColumn < 0) {
    throw new Error('Revisa los encabezados de la hoja "' + sheetName + '": se requieren CORREO, NOMBRE y ACTIVO.');
  }

  return values.slice(1).map(row => ({
    correo: normalizeEmail_(row[emailColumn]),
    nombre: String(row[nameColumn] || '').trim(),
    activo: String(row[activeColumn] || '').trim().toUpperCase() === 'SI',
    intermediario: intermediaryColumn >= 0 ? normalizeEmail_(row[intermediaryColumn]) : ''
  })).filter(user => user.correo);
}

// Una sola llamada al iniciar: procesos, catálogos y resumen de calidad.
// Carga rápida: se entrega la PRECARGA (una foto ya armada de la base, en la memoria de Apps Script) más los
// cambios guardados después (delta). Si la base cambió fuera de la app, se entrega igual (stale: true) y el
// navegador pide la versión fresca en segundo plano ({ fresco: true }), sin bloquear la pantalla.
function cargarInicial(sessionToken, opciones) {
  beginReadMemo_();
  try { return cargarInicialInterno_(sessionToken, opciones); } finally { endReadMemo_(); }
}
function lawyerPackKey_(snapshot, user) {
  const stamp = snapshot.builtAt + '|' + ((snapshot.lw || {})[esqNormalizar_(user.nombre)] || '');
  return 'APP_LAWYER_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, user.correo + '|' + stamp)).slice(0, 22);
}
function buildLawyerPack_(records, qualityAll, user, alreadyFiltered) {
  const visible = alreadyFiltered ? records : records.filter(process => lawyerCanSee_(process, user));
  const quality = {};
  visible.forEach(process => { if (qualityAll[process.id]) quality[process.id] = qualityAll[process.id]; });
  return { packed: packRecords_(visible), qualityGz: packRecords_(quality) };
}
// Activador: deja armada la parte de cada abogado activo que aún no la tenga. Se descomprime la base UNA vez para
// todos (en vez de una vez por abogado al abrir la app): en la mañana, cuando todos entran a la vez, cada abogado
// recibe su parte al instante y el servidor no se satura armándolas.
function prebuildLawyerPacks_(snapshot, budgetMs) {
  const started = Date.now();
  const lawyers = (getDirectory_().lawyers || []).filter(lawyer => lawyer.activo && lawyer.correo && lawyer.nombre);
  if (!lawyers.length || !snapshot) return 0;
  const users = lawyers.map(lawyer => ({ correo: normalizeEmail_(lawyer.correo), nombre: lawyer.nombre, rol: ROLES.lawyer }));
  const keys = users.map(user => lawyerPackKey_(snapshot, user));
  const present = {};
  const cache = CacheService.getScriptCache();
  for (let index = 0; index < keys.length; index += 100) Object.assign(present, cache.getAll(keys.slice(index, index + 100)) || {});
  const missing = users.map((user, index) => ({ user: user, key: keys[index] })).filter(item => !present[item.key]);
  if (!missing.length) return 0;
  // Si el activador acaba de integrar cambios, ya tiene la base descomprimida: no se descomprime otra vez.
  let records, qualityAll;
  if (compactedMemo_ && compactedMemo_.builtAt === snapshot.builtAt && compactedMemo_.seq === Number(snapshot.compactedSeq || 0)) {
    records = compactedMemo_.records; qualityAll = compactedMemo_.details;
  } else {
    const full = snapshot.lightGz ? snapshot : readSnapshot_();
    records = snapshotRecords_(full);
    if (!records) return 0;
    qualityAll = snapshot.qualityGz ? unpackRecords_(snapshot.qualityGz) : {};
  }
  // Procesos agrupados por abogado una sola vez (con 150 abogados y 20.000 procesos, filtrar la base para cada uno
  // eran 3 millones de comparaciones).
  const byLawyer = new Map();
  records.forEach(record => { const name = esqNormalizar_(record.lawyer); if (!name) return; if (!byLawyer.has(name)) byLawyer.set(name, []); byLawyer.get(name).push(record); });
  let built = 0;
  let batch = {};
  const flush = () => { if (Object.keys(batch).length) { try { cache.putAll(batch, SNAPSHOT_.seconds); } catch (error) { /* sin caché */ } batch = {}; } };
  for (let index = 0; index < missing.length; index++) {
    if (Date.now() - started > budgetMs) break;
    const item = missing[index];
    const value = JSON.stringify(buildLawyerPack_(byLawyer.get(esqNormalizar_(item.user.nombre)) || [], qualityAll, item.user, true));
    let chunks = 0;
    for (let start = 0; start < value.length; start += SNAPSHOT_.chunkSize) { batch[item.key + '_' + chunks] = value.slice(start, start + SNAPSHOT_.chunkSize); chunks++; }
    batch[item.key] = JSON.stringify({ chunks: chunks });
    built++;
    if (Object.keys(batch).length >= 20) flush();
  }
  flush();
  return built;
}

function cargarInicialInterno_(sessionToken, opciones) {
  const options = opciones || {};
  // Sesión + manifiesto de la precarga + versión de datos + índice de cambios: una sola llamada a la caché.
  const user = requireApplicationUser_(sessionToken, [SNAPSHOT_.manifestKey, DATA_VERSION_.cacheKey, DELTA_.indexKey]);
  // porPartes: el navegador descarga los procesos aparte y en paralelo (cargarParte); aquí van solo los datos livianos.
  let light = !!options.porPartes && !!options.comprimido && user.rol !== ROLES.lawyer;
  let snapshot = options.fresco ? null : readSnapshot_(true);
  if (!snapshot && !options.fresco) { endReadMemo_(); snapshot = restoreSnapshot_(); } // memoria vacía: copia durable (sin memo)
  let stale = snapshot ? !snapshotIsFresh_(snapshot) : true;
  let building = false;
  if (!snapshot || (options.fresco && stale !== false)) {
    // Solo un usuario rearma la foto; los demás reciben la anterior y vuelven a preguntar en unos segundos.
    endReadMemo_(); // rearmar tarda: desde aquí todo se lee directo (sin memo que pueda quedar viejo)
    const built = buildSnapshotOnce_();
    if (built) { snapshot = built; stale = false; }
    else {
      snapshot = snapshot || readSnapshot_(true);
      building = true;
      if (!snapshot) { snapshot = buildSnapshot_(); building = false; }
      stale = !snapshotIsFresh_(snapshot);
    }
  }
  // Solo los cambios que la foto aún no tiene (los ya integrados que siguen en el margen no hace falta enviarlos).
  let delta = readDelta_(Number(snapshot.compactedSeq || 0));
  if (!delta) { stale = true; delta = { seq: deltaSeq_(), entries: {} }; }
  // Si justo se integraron cambios a la foto entre las dos lecturas, se toma la foto nueva (no se pierde ninguno).
  const compacted = Number(propGet_(DELTA_.compactedProperty) || 0);
  if (compacted > Number(snapshot.compactedSeq || 0)) { const newer = readSnapshot_(true); if (newer) snapshot = newer; }
  const fullList = () => {
    const full = snapshot.lightGz ? snapshot : readSnapshot_();
    const list = snapshotRecords_(full);
    if (list) return list;
    endReadMemo_();
    let again = readSnapshot_() || restoreSnapshot_(); // los tramos se perdieron de la memoria
    if (!snapshotRecords_(again)) again = buildSnapshot_();
    snapshot = again;
    return snapshotRecords_(again);
  };
  let packed = '';
  let qualityGz = snapshot.qualityGz || '';
  if (user.rol === ROLES.lawyer) {
    // La parte de cada abogado se arma una vez por versión de la precarga y queda en memoria.
    // Sigue sirviendo mientras no cambie ninguno de SUS procesos (snapshot.lw anota qué abogados tuvieron cambios
    // integrados): con una base grande, rearmarla exige descomprimir todo y solo se hace cuando hace falta.
    // El activador las deja armadas para todos los abogados (prebuildLawyerPacks_): aquí casi siempre ya está.
    const key = lawyerPackKey_(snapshot, user);
    let mine = null;
    try { const hit = getChunks_(key + '_', key); if (hit) mine = JSON.parse(hit.text); } catch (error) { mine = null; }
    if (!mine) {
      mine = buildLawyerPack_(fullList(), snapshot.qualityGz ? unpackRecords_(snapshot.qualityGz) : {}, user);
      try { putChunks_(key + '_', key, JSON.stringify(mine), {}); } catch (error) { /* sin caché */ }
    }
    packed = mine.packed;
    qualityGz = mine.qualityGz;
  } else if (!light || !snapshot.rid) {
    light = false;
    packed = packRecords_(fullList());
    qualityGz = snapshot.qualityGz || '';
  }
  const entries = deltaFor_(user, delta.entries);
  // Con el detalle comprimido (qualityGz) el navegador arma el resumen él mismo: no viaja dos veces (≈500 KB menos con 20.000 procesos).
  const response = { catalogs: snapshot.catalogs, quality: options.comprimido && qualityGz ? { derivar: true } : snapshot.quality, scope: { lawyerNames: userLawyerNames_(user) },
    rol: user.rol, stale: stale, building: building, builtAt: snapshot.builtAt, qualityGz: qualityGz,
    foto: { builtAt: snapshot.builtAt, generation: snapshot.generation, dataVersion: String(snapshot.dataVersion || '0') },
    seq: delta.seq, deltaGz: Object.keys(entries).length ? packRecords_(entries) : '',
    // Nombre de cada persona del directorio (correo -> nombre): las listas muestran «Nombre (correo)» de quien modificó.
    people: directoryPeople_(),
    // Diccionario (00): qué significa cada campo, para la ayuda «Cómo corregir».
    fieldHelp: ESQUEMA.procesos.columnas.reduce((map, col) => { map[col[1]] = { columna: col[0], definicion: col[6], obligatorio: col[3], responsable: col[4] }; return map; }, {}) };
  if (light) response.partes = { rid: snapshot.rid, slices: snapshot.slices, dslices: snapshot.dslices || 0 };
  else if (options.comprimido) response.recordsGz = packed;
  else response.records = unpackRecords_(packed);
  return response;
}


// Ejecuta esta función una vez desde el editor: crea las hojas de roles, verifica que la base tenga la
// estructura estandarizada (la crea el script de la base: menú Estandarización).
function configurarHojas() {
  const spreadsheet = openAuthSpreadsheet_();
  ensureRoleSheets_(spreadsheet);
  const dataSpreadsheet = getDataSpreadsheet_();
  DATA_TABLES.forEach(tabla => requireDataSheet_(dataSpreadsheet, tabla));
  quitarActivadoresRetirados_();
  return 'Hojas listas: ' + [AUTH_CONFIG.administratorsSheet, AUTH_CONFIG.intermediariesSheet, AUTH_CONFIG.lawyersSheet]
    .concat(DATA_TABLES.map(tabla => ESQUEMA[tabla].hoja)).join(', ');
}

const ROLES = { admin: 'ADMINISTRADOR', intermediary: 'INTERMEDIARIO', lawyer: 'ABOGADO' };

// Pestañas de la base que usa la aplicación (sección ESQUEMA).
const DATA_TABLES = ['procesos', 'actuaciones', 'asignaciones', 'catalogos', 'pendientes', 'auditoria'];
const STORE_TABLES = ['procesos', 'actuaciones', 'asignaciones', 'auditoria', 'pendientes'];
const ALLOWED_CATALOGS = Object.keys(CATEGORIAS_APP);
const APP_CATEGORY_BY_SHEET = Object.keys(CATEGORIAS_APP).reduce((map, key) => { map[CATEGORIAS_APP[key]] = key; return map }, {});
const APP_SOURCE = 'Aplicación';

function loadCatalogsFrom_(spreadsheet) {
  return catalogsFromItems_(readTable_(spreadsheet, 'catalogos'));
}
function catalogsFromItems_(items) {
  return items.filter(item => item.active).reduce((catalogs, item) => {
    const key = APP_CATEGORY_BY_SHEET[item.category];
    if (!key) return catalogs;
    catalogs[key] = catalogs[key] || [];
    if (catalogs[key].indexOf(item.value) < 0) catalogs[key].push(item.value);
    return catalogs;
  }, {});
}

// Conjuntos de valores activos por categoría de 04_CATALOGOS (para validar listas cerradas).
// En memoria (cada guardado los usa); cambian de llave cuando se guarda un catálogo y el activador los renueva.
function catalogSetsKey_() { return 'APP_CATALOG_SETS_' + recordsCacheGeneration_(); }
function catalogSets_(spreadsheet, force) {
  const key = catalogSetsKey_();
  let plain = null;
  try { plain = force ? null : JSON.parse(cacheGet_(key) || 'null'); } catch (error) { plain = null; }
  if (!plain) {
    plain = {};
    readTable_(spreadsheet || getDataSpreadsheet_(), 'catalogos').filter(item => item.active).forEach(item => {
      plain[item.category] = plain[item.category] || [];
      plain[item.category].push(item.value);
    });
    try { cachePut_(key, JSON.stringify(plain), 21600); } catch (error) { /* sin caché */ }
  }
  const sets = {};
  Object.keys(plain).forEach(category => { sets[category] = new Set(plain[category]); });
  return sets;
}

function loadCatalogs(sessionToken) {
  requireApplicationUser_(sessionToken);
  return loadCatalogsFrom_(getDataSpreadsheet_());
}

// Los valores no se borran: los que salen de la lista quedan con ACTIVO = NO (histórico).
// Valores quitados (inactivos) de cada catálogo: siguen en 04_CATALOGOS con ACTIVO = NO. Solo administradores.
function cargarCatalogosInactivos(sessionToken) {
  const user = requireApplicationUser_(sessionToken);
  if (user.rol !== ROLES.admin) throw new Error('Solo los administradores pueden consultar los catálogos.');
  const reverse = {};
  Object.keys(CATEGORIAS_APP).forEach(key => { reverse[CATEGORIAS_APP[key]] = key; });
  const rows = readTable_(getDataSpreadsheet_(), 'catalogos');
  const activeKeys = new Set(rows.filter(item => item.active).map(item => item.category + '|' + esqClaveCatalogo_(item.value)));
  const out = {};
  rows.forEach(item => {
    const key = reverse[item.category];
    if (!key || item.active || !String(item.value || '').trim()) return;
    if (activeKeys.has(item.category + '|' + esqClaveCatalogo_(item.value))) return; // existe activo con otra escritura
    const when = item.updatedAt instanceof Date ? item.updatedAt.toISOString() : String(item.updatedAt || '');
    (out[key] = out[key] || []).push({ value: String(item.value), por: String(item.updatedBy || ''), fecha: when, origen: String(item.origin || '') });
  });
  Object.keys(out).forEach(key => out[key].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))));
  return { hoja: ESQUEMA.catalogos.hoja, inactivos: out };
}

function saveCatalogs(sessionToken, category, values) {
  const user = requireApplicationUser_(sessionToken);
  if (user.rol !== ROLES.admin) throw new Error('Solo los administradores pueden gestionar catálogos.');
  if (ALLOWED_CATALOGS.indexOf(category) < 0 || !Array.isArray(values) || values.length > 1000) {
    throw new Error('La categoría o la lista de valores del catálogo no es válida.');
  }
  // Sin repetidos: dos valores que solo cambian en tildes, mayúsculas, signos o espacios son el mismo.
  const byKey = new Map();
  values.map(value => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    .forEach(value => { if (!byKey.has(esqClaveCatalogo_(value))) byKey.set(esqClaveCatalogo_(value), value); });
  const cleaned = [...byKey.values()];
  if (cleaned.some(value => value.length > 150)) throw new Error('Cada valor de catálogo debe tener 150 caracteres o menos.');
  const sheetCategory = CATEGORIAS_APP[category];

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const spreadsheet = getDataSpreadsheet_();
    const sheet = requireDataSheet_(spreadsheet, 'catalogos');
    const rows = readTable_(spreadsheet, 'catalogos');
    const now = new Date().toISOString();
    const wanted = new Set(cleaned.map(esqClaveCatalogo_));
    const write = (index, item) => sheet.getRange(index + 2, 1, 1, esqEncabezados_('catalogos').length).setValues([esqObjetoAFila_('catalogos', item)]);
    // Si el valor ya existe con otra escritura, se reactiva esa fila (no se crea un repetido).
    rows.forEach((item, index) => {
      if (item.category !== sheetCategory) return;
      const active = wanted.has(esqClaveCatalogo_(item.value));
      if (active !== item.active) write(index, Object.assign(item, { active: active, updatedBy: user.correo, updatedAt: now }));
    });
    const known = new Set(rows.filter(item => item.category === sheetCategory).map(item => esqClaveCatalogo_(item.value)));
    const fresh = cleaned.filter(value => !known.has(esqClaveCatalogo_(value)))
      .map(value => esqObjetoAFila_('catalogos', { category: sheetCategory, value: value, active: true, origin: 'APLICACIÓN', updatedBy: user.correo, updatedAt: now }));
    appendRows_(sheet, 'catalogos', fresh);
    invalidateRecordsCache_();
    return loadCatalogsFrom_(spreadsheet);
  } finally {
    lock.releaseLock();
  }
}

const ISO_DATE_FIELDS = ESQUEMA.procesos.columnas.filter(col => col[2] === 'date').map(col => col[1]);
const ADMIN_REQUIRED_PROCESS_FIELDS = [
  'shortNo', 'radicado', 'currentRadicado', 'ids', 'claimant', 'defendant',
  'lawyer', 'quality', 'represents', 'type', 'instance', 'court',
  'cautelar', 'notificationDate'
];
// El intermediario no edita la sección "Abogado a cargo y representación" ni la asignación.
const INTERMEDIARY_LOCKED_PROCESS_FIELDS = ['lawyer', 'quality', 'lawyerLinkType', 'represents'];
const INTERMEDIARY_REQUIRED_PROCESS_FIELDS = [
  'shortNo', 'radicado', 'currentRadicado', 'siproJ', 'orfeo', 'ids',
  'claimant', 'defendant', 'area', 'instance', 'type', 'court', 'cause',
  'stage', 'state', 'endDate', 'terminationForm', 'terminationInstance',
  'terminationNotes', 'claim', 'amount', 'appealAmount', 'cautelar',
  'notificationDate', 'maxMeasureResponseDate', 'measureResponseDate',
  'maxDemandResponseDate', 'demandResponseDate', 'anticipatedJudgment',
  'initialAudienceDate', 'evidenceAudienceDate',
  'maxClosingArgumentsDate', 'closingArgumentsDate', 'firstInstanceDecisionDate',
  'firstInstanceDecisionSense', 'appealStatus', 'appealDate',
  'maxAppealAnnouncementDate', 'notes'
];
const INTERMEDIARY_EDITABLE_PROCESS_FIELDS = new Set([
  ...INTERMEDIARY_REQUIRED_PROCESS_FIELDS,
  'maxAppealDate', 'secondCourt', 'appealGrantedOrderDate', 'report',
  'appealAdmittedOrderDate', 'secondInstanceDecisionDate',
  'secondInstanceDecisionSense', 'secondInstanceDecision'
]);
// Campos del proceso que vienen del formulario (los demás los calcula el servidor).
const PROCESS_FORM_FIELDS = ESQUEMA.procesos.columnas.map(col => col[1])
  .filter(key => ['id', 'incomplete', 'missingFields', 'recordStatus', 'origin', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy',
    'lastIntermediaryEditAt', 'lastIntermediaryEditBy'].indexOf(key) < 0);
const PROCESS_CATALOG_FIELDS = ESQUEMA.procesos.columnas.filter(col => col[2].indexOf('cat:') === 0 && col[1] !== 'recordStatus')
  .reduce((map, col) => { map[col[1]] = col[2].slice(4); return map }, {});

function computeMissingFields_(process, role, exempt) {
  let required = role === ROLES.admin ? ADMIN_REQUIRED_PROCESS_FIELDS : INTERMEDIARY_REQUIRED_PROCESS_FIELDS;
  if (role !== ROLES.admin) {
    if (process.state !== 'Terminado') required = required.filter(field => field !== 'endDate');
    if (process.cautelar !== 'Sí') required = required.filter(field => ['maxMeasureResponseDate', 'measureResponseDate'].indexOf(field) < 0);
    if (process.anticipatedJudgment === 'Sí') required = required.filter(field => ['evidenceAudienceDate', 'maxClosingArgumentsDate', 'closingArgumentsDate'].indexOf(field) < 0);
    if (process.appealStatus === 'No presentado') required = required.filter(field => ['appealAmount', 'appealDate'].indexOf(field) < 0);
  }
  return required.filter(field => !String(process[field] === undefined || process[field] === null ? '' : process[field]).trim() && !(exempt && exempt.has(field)));
}

function loadApplicationData(sessionToken) {
  const user = requireApplicationUser_(sessionToken);
  return buildVisibleRecords_(user);
}

// =============================================================================
// GUARDADO AGRUPADO (muchas personas guardando a la vez)
// -----------------------------------------------------------------------------
// Cada guardado se anota en una cola (en la memoria de Google). Un solo «escritor» a la vez toma TODO lo que haya
// en la cola y lo escribe junto: una lectura y una escritura de la API de Sheets por tanda, no por guardado.
// Así el cupo de la API (60 por minuto) alcanza para muchos más guardados y nadie hace fila detrás de otro.
//
// Las validaciones NO se relajan: cada guardado de la tanda se valida por separado con las mismas reglas de
// siempre. Si uno no cumple (catálogo, fechas, radicado repetido, permisos, edición simultánea…), SOLO ese se
// rechaza y su autor recibe el mensaje; los demás de la tanda se guardan normalmente.
//
// Turno de escritura: el escritor lo toma solo para tomar la cola y para publicar el resultado; mientras lee y
// escribe en la hoja lo suelta (así los demás pueden anotarse), y la marca de escritor activo impide que otra
// operación escriba al mismo tiempo (eliminar, catálogos, calidad… esperan a que termine la tanda).
// =============================================================================
const GROUP_ = { queueKey: 'APP_COLA_GUARDADOS', itemPrefix: 'APP_COLA_I_', resultPrefix: 'APP_COLA_R_', writerKey: 'APP_COLA_ESCRITOR',
  pauseKey: 'APP_COLA_PAUSA', rateKey: 'APP_COLA_RITMO', seconds: 900, maxIds: 25, maxItemChars: 90000, maxQueue: 300, writerStaleMs: 60000,
  writerBudgetMs: 20000, pollMs: 300, lostCheckMs: 1500, waitTotalMs: 240000, pauseMs: 30000,
  // Prueba pesada de guardado (simulacion_guardado.py): con estos valores no se pierde ningún guardado con ráfagas de
  // 300 personas en 5 s ni con 600 guardados por minuto (perfil típico de Google).
  ownExtraMs: 4000,     // quien hace de escritor recibe su respuesta a lo sumo 4 s después de guardarse lo suyo
  maxPerMinute: 50,     // tandas por minuto como máximo: la API de Sheets admite 60 escrituras por minuto en total
  shortQueue: 8,        // con más guardados que esto en la fila, la ejecución no se queda esperando: responde «en cola»
  syncWaitMs: 8000 };   // y con poca fila espera a lo sumo 8 s; después el navegador pregunta con consultarGuardado
const LOST_MESSAGE_ = 'GUARDADO_NO_ENCONTRADO: el guardado no llegó a procesarse. Se envía de nuevo.';
const BUSY_MESSAGE_ = 'Hay muchos guardados en curso en este momento. Espera unos segundos y vuelve a intentarlo; tus datos siguen en el formulario.';
let groupWriterId_ = null;  // esta ejecución es el escritor activo
let groupTestHook_ = null;  // solo pruebas: se llama en puntos del ciclo para simular otras personas

function groupCache_() { return CacheService.getScriptCache(); }
function groupJson_(text, fallback) { try { const value = JSON.parse(text || 'null'); return value === null ? fallback : value; } catch (error) { return fallback; } }
function groupQueue_() { return groupJson_(groupCache_().get(GROUP_.queueKey), []); }
function groupSetQueue_(queue) { if (queue.length) groupCache_().put(GROUP_.queueKey, JSON.stringify(queue), GROUP_.seconds); else groupCache_().remove(GROUP_.queueKey); }
function groupWriterActive_(text) {
  const writer = groupJson_(text === undefined ? groupCache_().get(GROUP_.writerKey) : text, null);
  return !!writer && Date.now() - Number(writer.t) < GROUP_.writerStaleMs ? writer : null;
}
function groupSetWriter_(id) { groupCache_().put(GROUP_.writerKey, JSON.stringify({ w: id, t: Date.now() }), Math.ceil(GROUP_.writerStaleMs / 1000) + 30); }
function groupClearWriter_() { groupCache_().remove(GROUP_.writerKey); }
function groupPaused_(text) { const t = Number((text === undefined ? groupCache_().get(GROUP_.pauseKey) : text) || 0); return !!t && Date.now() - t < GROUP_.pauseMs; }
function groupHook_(stage, data) { if (typeof groupTestHook_ === 'function') groupTestHook_(stage, data); }

// Turno de escritura para todo lo demás (eliminar, catálogos, calidad, guardados grandes): espera a que el escritor
// termine su tanda y le pide que no empiece otra mientras tanto.
function writeLock_() {
  const deadline = Date.now() + 45000;
  const lock = LockService.getScriptLock();
  let asked = false;
  while (true) {
    if (!lock.tryLock(Math.max(1000, deadline - Date.now()))) throw new Error(BUSY_MESSAGE_);
    const writer = groupWriterActive_();
    if (!writer || writer.w === groupWriterId_) break;
    if (!asked) { groupCache_().put(GROUP_.pauseKey, String(Date.now()), Math.ceil(GROUP_.pauseMs / 1000)); asked = true; }
    lock.releaseLock();
    if (Date.now() > deadline) throw new Error(BUSY_MESSAGE_);
    Utilities.sleep(250);
  }
  return { releaseLock: () => { try { if (asked) groupCache_().remove(GROUP_.pauseKey); } finally { lock.releaseLock(); } }, hasLock: () => true };
}

function saveApplicationData(sessionToken, submittedRecords) {
  const user = requireApplicationUser_(sessionToken);
  if (user.rol === ROLES.lawyer) throw new Error('El rol Abogado solo permite consultar información.');
  if (!Array.isArray(submittedRecords) || submittedRecords.length > 500) {
    throw new Error('La lista de procesos tiene un formato inválido o excede el máximo permitido.');
  }
  const started = Date.now();
  const ids = [...new Set(submittedRecords.map(process => process && process.id).filter(Boolean).map(String))];
  const payload = JSON.stringify({ u: user, r: submittedRecords });
  // Guardados muy grandes (muchos procesos a la vez) van solos, como antes.
  if (!ids.length || ids.length > GROUP_.maxIds || payload.length > GROUP_.maxItemChars) return saveAlone_(user, submittedRecords, started);

  const key = Utilities.getUuid().replace(/-/g, '');
  const cache = groupCache_();
  // El pedido completo se deja en la memoria ANTES de tomar el turno: con el turno solo se anota en la fila
  // (así el turno dura lo mínimo y se pueden anotar muchas personas por segundo).
  cache.put(GROUP_.itemPrefix + key, payload, GROUP_.seconds);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(45000)) { try { cache.remove(GROUP_.itemPrefix + key); } catch (error) { /* vence solo */ } throw new Error(BUSY_MESSAGE_); }
  let writer = false, otherWriter = false, inLine = 0;
  try {
    // Una lectura y una escritura de la memoria: cola, escritor activo y pausa; se anota y, si no hay escritor, lo es.
    const got = cache.getAll([GROUP_.queueKey, GROUP_.writerKey, GROUP_.pauseKey]) || {};
    const queue = groupJson_(got[GROUP_.queueKey], []);
    if (queue.length >= GROUP_.maxQueue) { try { cache.remove(GROUP_.itemPrefix + key); } catch (error) { /* vence solo */ } throw new Error(BUSY_MESSAGE_); }
    queue.push({ k: key, ids: ids, t: started, c: user.correo });
    inLine = queue.length;
    const values = {};
    values[GROUP_.queueKey] = JSON.stringify(queue);
    otherWriter = !!groupWriterActive_(got[GROUP_.writerKey] || null);
    if (!otherWriter && !groupPaused_(got[GROUP_.pauseKey] || null)) {
      values[GROUP_.writerKey] = JSON.stringify({ w: key, t: Date.now() });
      writer = true;
    }
    cache.putAll(values, GROUP_.seconds);
  } finally {
    if (!writer) lock.releaseLock();
  }
  if (writer) {
    const own = runGroupWriter_(key, lock);
    if (own) return groupResponse_(own, started);
  }
  // Mucha fila: la ejecución no se queda esperando (Google permite 30 a la vez para toda la app); el navegador
  // pregunta cada ~2 s con consultarGuardado.
  if (otherWriter && inLine > GROUP_.shortQueue) return { enCola: key, posicion: inLine };
  return awaitGroupResult_(key, started, GROUP_.syncWaitMs);
}

// El navegador pregunta por un guardado que quedó en la fila. Llamada corta: si no hay escritor, se vuelve escritor.
function consultarGuardado(sessionToken, key) {
  const user = requireApplicationUser_(sessionToken);
  key = String(key || '');
  if (!/^[0-9a-f]{32}$/.test(key)) throw new Error('El guardado consultado no es válido.');
  const started = Date.now();
  const finished = result => {
    if (result.c && result.c !== user.correo) throw new Error('Ese guardado pertenece a otra persona.');
    try { groupCache_().removeAll([GROUP_.resultPrefix + key].concat(Array.from({ length: Number(result.partes) || 0 }, (u, i) => GROUP_.resultPrefix + key + '_' + i))); } catch (error) { /* vence solo */ }
    return groupResponse_(result, started);
  };
  let result = groupReadResult_(key);
  if (result && !result.curso) return finished(result);
  if (result && result.curso) {
    if (Date.now() - Number(result.curso) > GROUP_.writerStaleMs + 30000) {
      throw new Error('No se pudo confirmar si el guardado quedó registrado. Recarga la página para verificar antes de volver a intentarlo.');
    }
    return { enCola: key, posicion: 0 };
  }
  const cache = groupCache_();
  const got = cache.getAll([GROUP_.queueKey, GROUP_.writerKey, GROUP_.pauseKey]) || {};
  const queue = groupJson_(got[GROUP_.queueKey], []);
  const index = queue.findIndex(item => item.k === key);
  if (index < 0) {
    result = groupReadResult_(key); // pudo terminar entre las dos lecturas
    if (result && !result.curso) return finished(result);
    if (result && result.curso) return { enCola: key, posicion: 0 };
    throw new Error(LOST_MESSAGE_); // ni en la fila ni procesado: no se escribió nada, se puede enviar de nuevo
  }
  const item = queue[index];
  if (item.c && item.c !== user.correo) throw new Error('Ese guardado pertenece a otra persona.');
  if (Date.now() - Number(item.t) > GROUP_.waitTotalMs) {
    // Demasiado tiempo en la fila: se retira (aún no se ha tomado) para que se envíe de nuevo sin duplicar.
    const lock = LockService.getScriptLock();
    if (lock.tryLock(10000)) {
      try {
        const now = groupQueue_();
        const at = now.findIndex(entry => entry.k === key);
        if (at >= 0) { now.splice(at, 1); groupSetQueue_(now); throw new Error(BUSY_MESSAGE_); }
      } finally { lock.releaseLock(); }
    }
    return { enCola: key, posicion: index + 1 };
  }
  if (!groupWriterActive_(got[GROUP_.writerKey] || null) && !groupPaused_(got[GROUP_.pauseKey] || null)) {
    const lock = LockService.getScriptLock();
    if (lock.tryLock(3000)) {
      let writer = false;
      try {
        if (!groupWriterActive_() && !groupPaused_() && !groupReadResult_(key)) { groupSetWriter_(key); writer = true; }
      } finally { if (!writer) lock.releaseLock(); }
      if (writer) {
        const own = runGroupWriter_(key, lock);
        if (own) return groupResponse_(own, started);
        result = groupReadResult_(key);
        if (result && !result.curso) return finished(result);
      }
    }
  }
  return { enCola: key, posicion: index + 1 };
}

// Espera el resultado de su guardado. Si no hay escritor activo (terminó su tiempo o falló), se vuelve escritor.
function awaitGroupResult_(key, started, maxWaitMs) {
  let lastLostCheck = Date.now();
  while (true) {
    const result = groupReadResult_(key);
    if (maxWaitMs && Date.now() - started > maxWaitMs && !(result && !result.curso)) return { enCola: key, posicion: 0 };
    if (result && !result.curso) {
      try { groupCache_().removeAll([GROUP_.resultPrefix + key].concat(Array.from({ length: Number(result.partes) || 0 }, (u, i) => GROUP_.resultPrefix + key + '_' + i))); } catch (error) { /* vence solo */ }
      return groupResponse_(result, started);
    }
    if (result && result.curso && Date.now() - Number(result.curso) > GROUP_.writerStaleMs + 30000) {
      throw new Error('No se pudo confirmar si el guardado quedó registrado. Recarga la página para verificar antes de volver a intentarlo.');
    }
    if (Date.now() - started > GROUP_.waitTotalMs) {
      // Mucho tiempo en cola: se retira (si aún no se ha tomado) para que se pueda reintentar sin duplicar.
      const lock = LockService.getScriptLock();
      if (lock.tryLock(10000)) {
        try {
          const queue = groupQueue_();
          const index = queue.findIndex(item => item.k === key);
          if (index >= 0) { queue.splice(index, 1); groupSetQueue_(queue); throw new Error(BUSY_MESSAGE_); }
        } finally { lock.releaseLock(); }
      }
      if (Date.now() - started > GROUP_.waitTotalMs + 60000) throw new Error('No se pudo confirmar si el guardado quedó registrado. Recarga la página para verificar antes de volver a intentarlo.');
    }
    if (!result && Date.now() - lastLostCheck > GROUP_.lostCheckMs) {
      lastLostCheck = Date.now();
      // Ni en la cola ni tomado: la memoria lo perdió. No se escribió nada: se puede reintentar sin riesgo.
      if (!groupQueue_().some(item => item.k === key) && !groupReadResult_(key)) throw new Error(BUSY_MESSAGE_);
    }
    if (!result && !groupWriterActive_() && !groupPaused_()) {
      const lock = LockService.getScriptLock();
      if (lock.tryLock(5000)) {
        let writer = false;
        try {
          if (!groupWriterActive_() && !groupPaused_() && !groupReadResult_(key)) { groupSetWriter_(key); writer = true; }
        } finally { if (!writer) lock.releaseLock(); }
        if (writer) { const own = runGroupWriter_(key, lock); if (own) return groupResponse_(own, started); continue; }
      }
    }
    groupHook_('espera', key);
    Utilities.sleep(GROUP_.pollMs);
  }
}
function groupResponse_(result, started) {
  if (result.error) throw new Error(result.error);
  const times = Object.assign({}, result.tiempos || {}, { total: Date.now() - started });
  return { saved: true, count: result.records.length, records: result.records, seq: result.seq, tiempos: times };
}
function groupReadResult_(key) {
  const cache = groupCache_();
  const head = groupJson_(cache.get(GROUP_.resultPrefix + key), null);
  if (!head || !head.partes) return head;
  const keys = Array.from({ length: head.partes }, (u, i) => GROUP_.resultPrefix + key + '_' + i);
  const parts = cache.getAll(keys) || {};
  if (!keys.every(k => parts[k] !== undefined)) return { error: 'No se pudo leer el resultado del guardado. Recarga la página para verificar.' };
  return Object.assign(groupJson_(keys.map(k => parts[k]).join(''), {}), { partes: head.partes });
}
function groupResultValues_(key, value) {
  const text = JSON.stringify(value);
  const out = {};
  if (text.length < 90000) { out[GROUP_.resultPrefix + key] = text; return out; }
  let n = 0;
  for (let start = 0; start < text.length; start += 90000) out[GROUP_.resultPrefix + key + '_' + (n++)] = text.slice(start, start + 90000);
  out[GROUP_.resultPrefix + key] = JSON.stringify({ partes: n });
  return out;
}

// El escritor: con el turno tomado, toma una tanda de la cola; la escribe sin el turno; vuelve a tomar el turno para
// publicar los cambios y entregar a cada persona su resultado. Repite mientras haya cola (hasta ~20 s).
// Con el turno, publicar la tanda anterior y tomar la siguiente van juntas: una lectura y una escritura de la memoria
// (antes eran 9 llamadas), así el turno queda libre casi todo el tiempo para que los demás se anoten.
function runGroupWriter_(selfKey, heldLock) {
  let lock = heldLock;
  const began = Date.now();
  const cache = groupCache_();
  groupWriterId_ = selfKey;
  let cleared = false;
  let own = null, ownAt = 0; // resultado del guardado de quien hace de escritor (no necesita leerlo de la memoria)
  let done = null;           // tanda ya escrita, pendiente de publicar
  const resultOf = (item, outcome, seq, startedBatch, wroteMs, stats) => {
    const result = outcome.results[item.k] || { error: 'No se pudo guardar.' };
    if (item.c) result.c = item.c;
    if (!result.error) {
      if (seq) result.seq = seq;
      result.tiempos = { via: outcome.via, tanda: done ? done.batch.length : 0, espera_cola: startedBatch - item.t, escribir: wroteMs, busquedas: outcome.busquedas, filas_recordadas: outcome.recordadas };
      if (stats) stats.push(Object.assign({ t: Date.now(), via: outcome.via, total: Date.now() - item.t, espera: startedBatch - item.t, turno: wroteMs, n: result.records.length, tanda: done ? done.batch.length : 0 }, outcome.motivo ? { motivo: outcome.motivo } : {}));
    }
    return result;
  };
  try {
    while (true) {
      // A. (Con turno) Publicar la tanda anterior y tomar la siguiente. Los procesos que ya van en la tanda no se
      //    repiten: el segundo guardado de un mismo proceso va en la siguiente tanda, ya con lo que dejó el primero.
      const values = {};
      let removeKeys = [];
      let batch = [], stop = false, waitMs = 0;
      const memo = !!done; // la memoria de escritura solo hace falta para publicar una tanda
      const groupKeys = [GROUP_.queueKey, GROUP_.pauseKey, GROUP_.rateKey];
      let got = null;
      if (memo) beginWriteMemo_(); else got = cache.getAll(groupKeys) || {};
      const read = key => memo ? cacheGet_(key) : (got[key] === undefined ? null : got[key]);
      try {
        if (memo) cachePreload_(groupKeys.concat([DELTA_.indexKey, SAVE_STATS_.key]));
        if (done) {
          publishChanges_(done.outcome.changes);
          const seq = deltaSeq_();
          const stats = [];
          done.batch.forEach(item => {
            const result = resultOf(item, done.outcome, seq, done.startedBatch, done.wroteMs, stats);
            if (item.k === selfKey) { own = result; ownAt = Date.now(); }
            else Object.assign(values, groupResultValues_(item.k, result));
          });
          recordSaveStatsMany_(stats);
          removeKeys = done.batch.map(item => GROUP_.itemPrefix + item.k);
          if (done.batch.some(item => item.k === selfKey)) removeKeys.push(GROUP_.resultPrefix + selfKey);
          done = null;
        }
        const queue = groupJson_(read(GROUP_.queueKey), []);
        const rest = [], taken = new Set();
        queue.forEach(item => {
          const clash = item.ids.some(id => taken.has(id));
          if (!clash && taken.size + item.ids.length <= GROUP_.maxIds) { batch.push(item); item.ids.forEach(id => taken.add(id)); }
          else rest.push(item);
        });
        const timeUp = Date.now() - began > GROUP_.writerBudgetMs || groupPaused_(read(GROUP_.pauseKey) || null) ||
          (own && Date.now() - ownAt > GROUP_.ownExtraMs); // ya tiene lo suyo: otro sigue como escritor
        if (!batch.length || (timeUp && !batch.some(item => item.k === selfKey))) {
          stop = true; batch = [];
          values[GROUP_.writerKey] = JSON.stringify({ w: '', t: 0 }); // sin escritor (en la misma escritura)
        } else {
          // «En curso» y cola restante en la misma escritura: un guardado nunca queda ni fuera de la cola ni sin marcar.
          batch.forEach(item => { values[GROUP_.resultPrefix + item.k] = JSON.stringify({ curso: Date.now() }); });
          values[GROUP_.queueKey] = JSON.stringify(rest);
          values[GROUP_.writerKey] = JSON.stringify({ w: selfKey, t: Date.now() });
          // Cupo de la API de Sheets (60 escrituras por minuto para toda la app): como máximo 50 tandas por minuto.
          const now = Date.now();
          const rate = groupJson_(read(GROUP_.rateKey), []).filter(t => now - Number(t) < 60000);
          if (rate.length >= GROUP_.maxPerMinute) waitMs = Number(rate[rate.length - GROUP_.maxPerMinute]) + 60000 - now;
          rate.push(now + Math.max(0, waitMs));
          values[GROUP_.rateKey] = JSON.stringify(rate.slice(-GROUP_.maxPerMinute));
        }
      } finally {
        if (memo) endWriteMemo_(); // cambios publicados e índice: una escritura
      }
      cache.putAll(values, GROUP_.seconds); // resultados + marcas + cola + escritor: una escritura
      if (stop) cleared = true;
      lock.releaseLock(); lock = null;
      if (removeKeys.length) { try { cache.removeAll(removeKeys); } catch (error) { /* vencen solos */ } }
      if (stop) return own;
      groupHook_('tanda', batch.map(item => item.k));
      if (waitMs > 0) Utilities.sleep(Math.min(waitMs, 30000));

      // B. Leer, validar cada guardado y escribir la tanda (sin turno; nadie más escribe mientras haya escritor).
      const startedBatch = Date.now();
      let outcome;
      try { outcome = processGroupBatch_(batch); }
      catch (error) {
        console.error('La tanda de guardados falló.', error);
        const message = String(error && error.message || error).replace(/^API_FALLBACK:\s*/, '');
        outcome = { results: {}, changes: [], via: '', busquedas: 0 };
        batch.forEach(item => { outcome.results[item.k] = { error: 'No se pudo guardar: ' + message }; });
      }
      const wroteMs = Date.now() - startedBatch;
      done = { batch: batch, outcome: outcome, startedBatch: startedBatch, wroteMs: wroteMs };

      // C. Turno para publicar (y, en la misma vuelta, tomar la siguiente tanda).
      lock = LockService.getScriptLock();
      if (!lock.tryLock(45000)) {
        // Sin turno no se publica (la precarga se rearma), pero cada persona recibe su resultado.
        lock = null;
        invalidateRecordsCache_();
        const out = {};
        done.batch.forEach(item => {
          const result = resultOf(item, done.outcome, 0, done.startedBatch, done.wroteMs, null);
          if (item.k === selfKey) own = result; else Object.assign(out, groupResultValues_(item.k, result));
        });
        if (Object.keys(out).length) cache.putAll(out, GROUP_.seconds);
        try { cache.removeAll(done.batch.map(item => GROUP_.itemPrefix + item.k)); } catch (error) { /* vencen solos */ }
        done = null;
        groupClearWriter_(); cleared = true;
        return own;
      }
    }
  } finally {
    groupWriterId_ = null;
    if (!cleared) { try { groupClearWriter_(); } catch (error) { /* vence sola */ } }
    if (lock) lock.releaseLock();
  }
}

// Una tanda: por la API de Sheets si se puede (1 lectura + 1 escritura para todos); si no, por el camino normal.
function processGroupBatch_(batch) {
  beginWriteMemo_();
  try {
    // Los guardados de la tanda y lo que usa el guardado por la API, en una sola lectura de la memoria.
    cachePreload_(batch.map(item => GROUP_.itemPrefix + item.k).concat([DATA_VERSION_.cacheKey, DELTA_.indexKey, API_PAUSE_.key]));
    const items = batch.map(item => ({ k: item.k, data: groupJson_(cacheGet_(GROUP_.itemPrefix + item.k), null) }));
    const ids = [...new Set([].concat(...batch.map(item => item.ids)))];
    const records = [].concat(...items.filter(item => item.data).map(item => item.data.r));
    let store = null, motivo = '';
    try { store = loadStoreForSaveApi_(ids, records); }
    catch (error) { apiPause_(error); motivo = 'no se pudo leer por la API: ' + error.message; console.warn('Guardado por API no disponible: ' + error.message); store = null; }
    if (store) {
      try { return planGroup_(items, store, null); }
      catch (error) {
        if (!error || !error.apiFallback) throw error;
        motivo = 'la escritura por la API falló: ' + error.message;
        console.warn('Guardado por API no se completó (nada se escribió); se usa el guardado normal: ' + error.message);
      }
    }
    const spreadsheet = getDataSpreadsheet_();
    return Object.assign(planGroup_(items, loadStoreForSave_(spreadsheet, ids), spreadsheet), { motivo: String(motivo).slice(0, 300) });
  } finally {
    endWriteMemo_();
  }
}

// Valida cada guardado por separado (mismas reglas de siempre). Los que no cumplen se rechazan solos con su mensaje;
// los demás se escriben juntos.
function planGroup_(items, store, spreadsheet) {
  const now = new Date().toISOString();
  const context = { ids: new Set(), radicados: new Map(store.radicados), catalogs: catalogSets_(spreadsheet) };
  const results = {};
  const accepted = [];
  items.forEach(item => {
    if (!item.data) { results[item.k] = { error: 'El guardado venció antes de procesarse. Vuelve a intentarlo; tus datos siguen en el formulario.' }; return; }
    const ids = new Set(context.ids), radicados = new Map(context.radicados);
    try {
      const plans = JSON.parse(JSON.stringify(item.data.r)).map(process => planProcessSave_(process, item.data.u, store, context)).filter(Boolean);
      accepted.push({ item: item, user: item.data.u, plans: plans });
    } catch (error) {
      if (error && error.apiFallback) throw error;
      context.ids = ids; context.radicados = radicados; // lo de este guardado no cuenta para los demás
      results[item.k] = { error: String(error && error.message || error) };
    }
  });
  accepted.forEach(entry => { entry.saved = entry.plans.map(plan => applyProcessPlan_(plan, store, entry.user, now)); });
  if (store.api) { try { flushStore_(store); } catch (error) { throw apiFallbackError_(error); } }
  else flushStore_(store);
  radicadoIndexAfterSave_(store.api ? store.api.version : store.hints && store.hints.version, radicadoChangesFromPlans_([].concat(...accepted.map(entry => entry.plans))));
  const changes = [];
  accepted.forEach(entry => {
    results[entry.item.k] = { records: entry.saved };
    entry.saved.forEach(record => changes.push(Object.assign({ id: record.id, r: record }, record.revision06 ? { q: record.revision06.items || [] } : {})));
  });
  return { results: results, changes: changes, via: store.api ? 'api' : 'hoja', busquedas: store.stats ? store.stats.buscadas : 0, recordadas: store.stats ? store.stats.recordadas : 0 };
}

// Guardado individual (muchos procesos a la vez): turno completo, como antes.
function saveAlone_(user, submittedRecords, started) {
  const times = {};
  let mark = started;
  const lap = name => { const now = Date.now(); times[name] = (times[name] || 0) + now - mark; mark = now; };
  const ids = submittedRecords.map(process => process && process.id);
  const lock = writeLock_();
  const lockedAt = Date.now();
  beginWriteMemo_();
  lap('espera_turno');
  try {
    let result = null;
    let store = null;
    try { store = loadStoreForSaveApi_(ids, submittedRecords); }
    catch (error) { apiPause_(error); times.motivo = 'no se pudo leer por la API: ' + error.message; console.warn('Guardado por API no disponible: ' + error.message); store = null; }
    lap('api_leer');
    if (store) {
      try { result = runSave_(JSON.parse(JSON.stringify(submittedRecords)), store, null, user, lap, times); times.via = 'api'; }
      catch (error) {
        if (!error || !error.apiFallback) throw error;
        console.warn('Guardado por API no se completó (nada se escribió); se usa el guardado normal: ' + error.message);
        times.motivo = 'la escritura por la API falló: ' + error.message;
        result = null;
      }
    }
    if (!result) {
      const spreadsheet = getDataSpreadsheet_();
      result = runSave_(submittedRecords, loadStoreForSave_(spreadsheet, ids), spreadsheet, user, lap, times);
      times.via = 'hoja';
    }
    publishChanges_(result.savedRecords.map(record => Object.assign({ id: record.id, r: record }, record.revision06 ? { q: record.revision06.items || [] } : {})));
    times.en_turno = Date.now() - lockedAt;
    times.total = Date.now() - started;
    recordSaveStatsMany_([Object.assign({ t: Date.now(), via: times.via, total: times.total, espera: times.espera_turno || 0, turno: times.en_turno, n: result.savedRecords.length, tanda: 1 },
      times.via === 'hoja' ? { motivo: String(times.motivo || 'la API no estaba lista').slice(0, 300) } : {})]);
    return { saved: true, count: result.savedRecords.length, records: result.savedRecords, seq: deltaSeq_(), tiempos: times };
  } finally {
    endWriteMemo_();
    lock.releaseLock();
  }
}

// Últimos guardados (vía y tiempos) para el diagnóstico del administrador.
const SAVE_STATS_ = { key: 'APP_ULTIMOS_GUARDADOS', keep: 60 };
function recordSaveStatsMany_(entries) {
  if (!entries.length) return;
  try {
    const list = groupJson_(cacheGet_(SAVE_STATS_.key), []).concat(entries);
    cachePut_(SAVE_STATS_.key, JSON.stringify(list.slice(-SAVE_STATS_.keep)), CACHE_OUT_SECONDS_); // con el memo: va en la misma escritura
  } catch (error) { /* solo diagnóstico */ }
}

// Valida, arma y escribe un guardado con el almacén dado (API o SpreadsheetApp).
function runSave_(submittedRecords, store, spreadsheet, user, lap, times) {
  lap('leer_proceso');
  if (store.stats) { times.filas_recordadas = store.stats.recordadas; times.busquedas = store.stats.buscadas; }
  const now = new Date().toISOString();
  const context = { ids: new Set(), radicados: new Map(store.radicados), catalogs: catalogSets_(spreadsheet) };
  const plans = submittedRecords
    .map(process => planProcessSave_(process, user, store, context))
    .filter(Boolean);
  lap('validar');
  const savedRecords = plans.map(plan => applyProcessPlan_(plan, store, user, now));
  if (store.api) {
    try { flushStore_(store); } catch (error) { throw apiFallbackError_(error); }
  } else flushStore_(store);
  radicadoIndexAfterSave_(store.api ? store.api.version : store.hints && store.hints.version, radicadoChangesFromPlans_(plans));
  lap('escribir' + (store.api ? '_api' : store.direct ? '_directo' : '_con_reglas'));
  return { savedRecords: savedRecords };
}

// Lista cerrada: un valor nuevo o cambiado debe existir activo en 04_CATALOGOS.
function assertInCatalog_(context, category, value, label) {
  const text = String(value || '').trim();
  if (!text) return;
  const set = context.catalogs[category];
  if (set && set.size && !set.has(text)) {
    throw new Error('"' + text + '" no está en el catálogo ' + category + ' (' + label + '). Pide al administrador que lo agregue en Catálogos.');
  }
}

// Edición simultánea, campo por campo. process.baseValues = el valor con el que el usuario abrió cada campo que
// cambió. Si nadie más tocó esos campos, sus cambios se aplican sobre la versión ACTUAL de la base (lo que otros
// guardaron mientras tanto se conserva, también diligencias, comités y actuaciones nuevas). Solo hay conflicto
// cuando otra persona cambió el mismo campo con otro valor.
function mergeConcurrentEdit_(process, previous) {
  if (!previous || !process.baseValues || typeof process.baseValues !== 'object') return;
  const norm = value => Array.isArray(value) ? value.join('|') : String(value === undefined || value === null ? '' : value).trim();
  const touched = Object.keys(process.baseValues).filter(key => PROCESS_FORM_FIELDS.indexOf(key) >= 0);
  const clashes = touched.filter(key => norm(previous[key]) !== norm(process.baseValues[key]) && norm(previous[key]) !== norm(process[key]));
  if (clashes.length) {
    const when = previous.updatedAt && !isNaN(Date.parse(previous.updatedAt))
      ? ' el ' + Utilities.formatDate(new Date(Date.parse(previous.updatedAt)), ZONA_HORARIA_, 'dd/MM/yyyy HH:mm') : '';
    throw new Error('CONFLICTO: mientras editabas el proceso ' + (previous.shortNo || process.id) + ', ' + (previous.updatedBy || 'otra persona') + when +
      ' cambió también: ' + clashes.map(key => esqEtiquetaCampo_('procesos', key)).join(', ') +
      '. Para no borrar su trabajo no se guardó tu cambio en esos campos: revisa la versión actual y vuelve a aplicarlo.');
  }
  PROCESS_FORM_FIELDS.forEach(key => { if (touched.indexOf(key) < 0) process[key] = previous[key]; });
  // Diligencias, comités y actuaciones: el navegador envía solo lo nuevo o lo que cambió; lo demás se toma de la
  // versión actual del servidor (en su orden), así nadie pisa lo que otra persona agregó o corrigió entre tanto.
  ['hearings', 'committees', 'actions'].forEach(list => {
    const mine = new Map((Array.isArray(process[list]) ? process[list] : []).map(item => [String(item.id), item]));
    const current = previous[list] || [];
    const merged = current.map(item => mine.has(String(item.id)) ? mine.get(String(item.id)) : item);
    const known = new Set(current.map(item => String(item.id)));
    mine.forEach((item, key) => { if (!known.has(key)) merged.push(item); });
    process[list] = merged;
  });
  // Actuación corregida a la vez por dos personas: baseActions trae la versión con la que se abrió cada actuación
  // que se envía. Si la de la otra persona ya cambió y no coincide con la propia, no se pisa: se avisa.
  const bases = process.baseActions && typeof process.baseActions === 'object' ? process.baseActions : null;
  if (bases) {
    const comparable = action => JSON.stringify(actionComparable_(action || {}));
    const currentById = new Map((previous.actions || []).map(action => [String(action.id), action]));
    const actionClashes = [];
    process.actions = process.actions.map(action => {
      const key = String(action.id), current = currentById.get(key), base = bases[key];
      if (!current || !base) return action;
      if (comparable(action) === comparable(base)) return current; // no la cambió quien guarda: queda la versión actual
      if (comparable(current) !== comparable(base) && comparable(current) !== comparable(action)) actionClashes.push(action.title || key);
      return action;
    });
    if (actionClashes.length) {
      throw new Error('CONFLICTO: mientras editabas el proceso ' + (previous.shortNo || process.id) + ', ' + (previous.updatedBy || 'otra persona') +
        ' corrigió también la actuación ' + actionClashes.join(', ') + '. Para no borrar su trabajo no se guardó tu cambio: revisa la versión actual y vuelve a aplicarlo.');
    }
  }
  delete process.baseActions;
  delete process.baseUpdatedAt; // ya se resolvió campo por campo
}

// Límites de lo que llega del navegador (se revisa por proceso: si uno no cumple, solo ese guardado se rechaza y los
// demás de la misma tanda se escriben). Sheets admite 50.000 caracteres por celda: un texto más largo haría fallar la
// escritura completa de la tanda, es decir, los guardados de otras personas.
const SUBMIT_LIMITS_ = { cellChars: 45000, listItems: 500 };
function checkSubmittedShape_(process) {
  const plain = value => value === null || value === undefined || ['string', 'number', 'boolean'].indexOf(typeof value) >= 0;
  ESQUEMA.procesos.columnas.forEach(col => {
    const value = process[col[1]];
    if (col[2] === 'list') {
      if (value !== undefined && value !== null && value !== '' && !Array.isArray(value) && typeof value !== 'string') throw new Error('El campo ' + col[0] + ' tiene un formato inválido.');
      if (Array.isArray(value) && (value.length > 200 || !value.every(plain))) throw new Error('El campo ' + col[0] + ' tiene un formato inválido.');
      return;
    }
    if (!plain(value)) throw new Error('El campo ' + col[0] + ' tiene un formato inválido.');
    if (typeof value === 'string' && value.length > SUBMIT_LIMITS_.cellChars)
      throw new Error('El campo ' + col[0] + ' es demasiado largo (' + value.length.toLocaleString('es-CO') + ' caracteres; máximo ' + SUBMIT_LIMITS_.cellChars.toLocaleString('es-CO') + '). Resume el texto o déjalo en el expediente.');
  });
  [['hearings', 'diligencias'], ['committees', 'registros del comité'], ['actions', 'actuaciones']].forEach(([list, name]) => {
    const items = process[list];
    if (items === undefined || items === null) return;
    if (!Array.isArray(items)) throw new Error('La lista de ' + name + ' tiene un formato inválido.');
    if (items.length > SUBMIT_LIMITS_.listItems) throw new Error('Se enviaron ' + items.length + ' ' + name + ' en un solo guardado (máximo ' + SUBMIT_LIMITS_.listItems + ').');
    items.forEach(item => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('La lista de ' + name + ' tiene un formato inválido.');
      Object.keys(item).forEach(key => {
        const value = item[key];
        if (!plain(value)) throw new Error('Un dato de ' + name + ' tiene un formato inválido (' + key + ').');
        if (typeof value === 'string' && value.length > SUBMIT_LIMITS_.cellChars) throw new Error('Un texto de ' + name + ' es demasiado largo (máximo ' + SUBMIT_LIMITS_.cellChars.toLocaleString('es-CO') + ' caracteres).');
      });
    });
  });
}

function planProcessSave_(process, user, store, context) {
  if (!process || !process.id || !isSafeId_(process.id) || context.ids.has(String(process.id))) {
    throw new Error('Cada proceso debe tener un identificador único.');
  }
  const id = String(process.id);
  context.ids.add(id);
  checkSubmittedShape_(process);
  mergeConcurrentEdit_(process, store.existing.get(id));
  ISO_DATE_FIELDS.forEach(field => {
    if (process[field] && !isValidIsoDate_(process[field])) {
      throw new Error('La fecha del campo ' + field + ' no tiene formato válido.');
    }
  });
  ['amount', 'appealAmount'].forEach(field => {
    if (process[field] && !/^\d+$/.test(String(process[field]))) throw new Error('El campo ' + field + ' debe ser un número sin $ ni separadores.');
  });
  if (process.appealAmount && process.amount && Number(process.appealAmount) < Number(process.amount)) {
    throw new Error('La pretensión del recurso no puede ser menor que la pretensión de primera instancia.');
  }
  const hearings = process.hearings || [];
  const committees = process.committees || [];
  const actions = process.actions || [];
  const milestoneDates = [
    process.measureResponseDate, process.demandResponseDate,
    process.closingArgumentsDate, process.firstInstanceDecisionDate, process.appealDate,
    process.appealGrantedOrderDate, process.appealAdmittedOrderDate,
    process.secondInstanceDecisionDate, process.initialAudienceDate, process.evidenceAudienceDate,
    ...hearings.map(hearing => hearing.date),
    ...actions.map(action => action.date)
  ].filter(Boolean);
  // Solo es imposible terminar antes de la notificación. Que haya fechas posteriores a la terminación
  // puede ser real (desvinculación, actuaciones después del archivo, datos históricos): se guarda y queda
  // en 06_PENDIENTES_CALIDAD para validación jurídica.
  if (process.endDate && process.notificationDate && process.endDate < process.notificationDate) {
    throw new Error('La fecha de terminación no puede ser anterior a la fecha de notificación de la demanda.');
  }
  const endDateConflict = !!process.endDate && milestoneDates.some(date => process.endDate < date);
  const radicado = String(process.radicado || '').trim();
  if (radicado && !/^\d{23}$/.test(radicado)) {
    throw new Error('El radicado del proceso ' + id + ' debe contener exactamente 23 dígitos.');
  }
  const before = store.existing.get(id);
  // Solo se verifica al crear o al cambiar el radicado: editar un proceso sin tocar su radicado siempre se permite
  // (la base histórica tiene radicados repetidos que se revisan en 06).
  const radicadoOwner = !radicado || (before && String(before.radicado || '') === radicado) ? ''
    : context.radicados.has(radicado) ? context.radicados.get(radicado) : findRadicadoOwner_(store, radicado);
  if (radicado && radicadoOwner && radicadoOwner !== id) {
    throw new Error('El radicado ' + radicado + ' ya está asignado a otro proceso.');
  }
  if (radicado) context.radicados.set(radicado, id);

  const previous = store.existing.get(id);
  if (!previous && store.deleted.has(id)) throw new Error('El proceso ' + id + ' fue eliminado y no se puede modificar.');
  const changedFields = PROCESS_FORM_FIELDS.filter(key =>
    String(process[key] === undefined || process[key] === null ? '' : process[key]) !== String(previous && previous[key] !== undefined ? previous[key] : '')
  );

  // Listas cerradas para los campos categóricos que cambian (los valores históricos sin cambios se respetan).
  changedFields.forEach(field => {
    if (PROCESS_CATALOG_FIELDS[field]) assertInCatalog_(context, PROCESS_CATALOG_FIELDS[field], process[field], field);
  });
  // Regla condicional: Terminado exige fecha de terminación, salvo justificación expresa (queda en 06 para validación).
  const terminationTouched = !previous || ['state', 'endDate', 'terminationNotes'].some(field => changedFields.indexOf(field) >= 0);
  const justifiedWithoutDate = process.state === 'Terminado' && !process.endDate;
  if (terminationTouched && justifiedWithoutDate && !String(process.terminationNotes || '').trim()) {
    throw new Error('Un proceso Terminado requiere la fecha de terminación. Si jurídicamente no se tiene, registre la justificación en "Observaciones de terminación".');
  }

  hearings.forEach(hearing => {
    if (!hearing || !isSafeId_(hearing.id) || !isValidIsoDate_(hearing.date)) {
      throw new Error('Cada diligencia requiere un identificador válido y una fecha válida.');
    }
    if (hearing.registrationDate && !isValidIsoDate_(hearing.registrationDate)) throw new Error('La fecha de registro de la diligencia no es válida.');
  });
  committees.forEach(committee => {
    if (!committee || !isSafeId_(committee.id) || !isValidIsoDate_(committee.date)) {
      throw new Error('Cada registro del comité requiere un identificador válido y una fecha de pronunciamiento válida.');
    }
  });
  actions.forEach(action => {
    if (!action || !isSafeId_(action.id) || !isValidIsoDate_(action.date) || !action.title || !action.description ||
      (action.registrationDate && !isValidIsoDate_(action.registrationDate)) || (action.dueDate && !isValidIsoDate_(action.dueDate))) {
      throw new Error('Cada actuación requiere identificador, fecha, título y descripción válidos.');
    }
  });

  const previousHearings = previous ? previous.hearings : [];
  const previousCommittees = previous ? previous.committees : [];
  const previousActions = previous ? previous.actions : [];
  assertAppendOnly_(previousHearings, hearings, 'diligencias', hearingComparable_);
  assertAppendOnly_(previousCommittees, committees, 'comités de conciliación', committeeComparable_);
  assertNoDeletion_(previousActions, actions, 'actuaciones');

  const previousActionRows = new Map(previousActions.map(action => [String(action.id), JSON.stringify(actionComparable_(action))]));
  const newHearings = hearings.filter(hearing => !previousHearings.some(item => String(item.id) === String(hearing.id)));
  const newCommittees = committees.filter(committee => !previousCommittees.some(item => String(item.id) === String(committee.id)));
  const newActions = actions.filter(action => !previousActionRows.has(String(action.id)));
  const editedActions = actions.filter(action => previousActionRows.has(String(action.id)) &&
    previousActionRows.get(String(action.id)) !== JSON.stringify(actionComparable_(action)));

  newHearings.forEach(hearing => {
    assertInCatalog_(context, 'TIPO_DILIGENCIA', hearing.type, 'tipo de diligencia');
    assertInCatalog_(context, 'DESPACHO', hearing.court, 'despacho de la diligencia');
    assertInCatalog_(context, 'FUENTE', hearing.source, 'fuente');
  });
  newActions.concat(editedActions).forEach(action => {
    assertInCatalog_(context, 'TIPO_ACTUACION', action.type, 'tipo de actuación');
    assertInCatalog_(context, 'ESTADO_ACTUACION', action.status, 'estado de la actuación');
    assertInCatalog_(context, 'FUENTE', action.source, 'fuente');
  });

  if ((!previous || changedFields.indexOf('shortNo') >= 0) && process.shortNo && !/^\d{4}-\d{5}$/.test(String(process.shortNo))) {
    throw new Error('El No. corto "' + process.shortNo + '" debe tener el formato AAAA-NNNNN (solo números). Ejemplo: 2011-00096.');
  }

  const hasChanges = !previous || changedFields.length || newHearings.length || newCommittees.length || newActions.length || editedActions.length;
  if (!hasChanges) return null;

  // Edición simultánea: si otra persona guardó este proceso después de que lo abriste, no se sobrescribe.
  if (previous && process.baseUpdatedAt && previous.updatedAt) {
    const base = Date.parse(process.baseUpdatedAt);
    const current = Date.parse(previous.updatedAt);
    if (!isNaN(base) && !isNaN(current) && current - base > 1500) {
      const when = Utilities.formatDate(new Date(current), ZONA_HORARIA_, 'dd/MM/yyyy HH:mm');
      throw new Error('CONFLICTO: el proceso ' + (previous.shortNo || id) + ' fue modificado por ' + (previous.updatedBy || 'otra persona') + ' el ' + when +
        ' mientras lo editabas. Para no borrar su trabajo no se guardó tu cambio: cierra el formulario, revisa la versión actual y vuelve a aplicar lo tuyo.');
    }
  }

  if (user.rol === ROLES.intermediary) {
    if (!previous) throw new Error('Los intermediarios solo pueden modificar procesos existentes.');
    // Corrección entre intermediarios (opcional): desde «Qué hay que revisar» un intermediario puede corregir un
    // proceso de otro abogado. Mismas reglas de campos; el cambio queda en 07_AUDITORIA con su correo.
    if (!isAssignedTo_(previous, user) && process.correccion !== true) {
      throw new Error('El proceso ' + (previous.shortNo || id) + ' pertenece a otro responsable: solo puedes consultarlo.');
    }
    const forbidden = changedFields.filter(field => !INTERMEDIARY_EDITABLE_PROCESS_FIELDS.has(field));
    if (forbidden.length) {
      throw new Error('No tienes permiso para modificar estos campos: ' + forbidden.join(', '));
    }
  }

  return { process, previous, changedFields, newHearings, newCommittees, newActions, editedActions, justifiedWithoutDate: terminationTouched && justifiedWithoutDate, endDateConflict };
}

function applyProcessPlan_(plan, store, user, now) {
  const process = plan.process;
  const id = String(process.id);
  const previous = plan.previous;
  const today = fechaLocal_(now);
  const actor = user.nombre || user.correo;
  const exempt = store.fast
    ? new Set((Array.isArray(process.exemptFields) ? process.exemptFields : []).filter(key => PROCESS_FORM_FIELDS.indexOf(key) >= 0))
    : esqExentosObligatorios_((store.rows.auditoria || []).map(row => esqFilaAObjeto_('auditoria', row))).get(id);
  const missingFields = computeMissingFields_(process, user.rol, exempt);
  const saved = {};
  PROCESS_FORM_FIELDS.forEach(key => { saved[key] = process[key] === undefined || process[key] === null ? '' : String(process[key]) });
  Object.assign(saved, {
    id: id,
    incomplete: missingFields.length > 0,
    missingFields: missingFields,
    recordStatus: 'ACTIVO',
    origin: (previous && previous.origin) || 'APLICACIÓN',
    createdAt: (previous && previous.createdAt) || now,
    createdBy: (previous && previous.createdBy) || user.correo,
    updatedAt: now,
    updatedBy: user.correo,
    lastIntermediaryEditAt: (previous && previous.lastIntermediaryEditAt) || '',
    lastIntermediaryEditBy: (previous && previous.lastIntermediaryEditBy) || ''
  });
  if (user.rol === ROLES.intermediary) {
    saved.lastIntermediaryEditAt = now;
    saved.lastIntermediaryEditBy = user.correo;
  }
  writeRow_(store, 'procesos', id, esqObjetoAFila_('procesos', saved));

  // 02_ACTUACIONES: una fila por actuación, diligencia o comité (historial vertical).
  plan.newHearings.forEach(hearing => writeRow_(store, 'actuaciones', String(hearing.id), esqObjetoAFila_('actuaciones', hearingRecord_(hearing, saved, actor, now))));
  plan.newCommittees.forEach(committee => writeRow_(store, 'actuaciones', String(committee.id), esqObjetoAFila_('actuaciones', committeeRecord_(committee, saved, actor, now))));
  const previousActions = new Map(((previous && previous.actions) || []).map(action => [String(action.id), action]));
  // Guardado rápido: 07 no se leyó; se devuelven solo los cambios de este guardado (el navegador consulta el historial completo al abrir el proceso).
  const audit = !previous ? [] : store.fast ? [] : previous.audit.slice(-AUDIT_IN_APP_);
  const actionsOut = (process.actions || []).map(action => {
    const isNew = plan.newActions.indexOf(action) >= 0;
    const edited = plan.editedActions.indexOf(action) >= 0;
    const before = previousActions.get(String(action.id));
    const record = actionRecord_(action, saved, actor, now, edited, before);
    if (isNew || edited) writeRow_(store, 'actuaciones', String(action.id), esqObjetoAFila_('actuaciones', record));
    if (edited) {
      // La versión anterior de la actuación queda en 07_AUDITORIA, campo por campo (no se pierde el histórico).
      const anterior = actionComparable_(before);
      const nueva = actionComparable_(action);
      const campos = Object.keys(nueva).filter(clave => anterior[clave] !== nueva[clave]);
      esqFilasAuditoria_({ processId: id, processShortNo: saved.shortNo || '', processRadicado: saved.radicado || '', changedAt: now, changedBy: user.correo, origin: 'APLICACIÓN', recordType: 'ACTUACION', recordId: String(action.id) },
        'actuaciones', campos, anterior, nueva).forEach(entry => {
        writeRow_(store, 'auditoria', entry.id, esqObjetoAFila_('auditoria', entry));
        audit.push(entry);
      });
    }
    return actionFromRecord_(record);
  });

  // 03_ASIGNACIONES: el cambio de abogado cierra la asignación vigente y abre otra.
  const assignments = previous ? previous.assignments.map(item => Object.assign({}, item)) : [];
  const lawyerChanged = !previous || plan.changedFields.indexOf('lawyer') >= 0;
  if (lawyerChanged) {
    assignments.filter(item => !item.endDate).forEach(item => {
      item.endDate = today;
      writeRow_(store, 'asignaciones', item.id, esqObjetoAFila_('asignaciones', item));
    });
    if (saved.lawyer) {
      const assignment = { id: 'AS_' + Utilities.getUuid().replace(/-/g, '').slice(0, 16), processId: id, radicado: saved.radicado,
        lawyer: saved.lawyer, lawyerLinkType: saved.lawyerLinkType, startDate: today, endDate: '',
        origin: 'APLICACIÓN', registeredBy: user.correo, registeredAt: now, note: '' };
      writeRow_(store, 'asignaciones', assignment.id, esqObjetoAFila_('asignaciones', assignment));
      assignments.push(assignment);
    }
  }

  // 07_AUDITORIA: una fila por campo cambiado (valor anterior y nuevo) y una por cada registro agregado.
  if (previous) {
    const base = { processId: id, processShortNo: saved.shortNo || '', processRadicado: saved.radicado || '', changedAt: now, changedBy: user.correo, origin: 'APLICACIÓN' };
    const filas = esqFilasAuditoria_(Object.assign({ recordType: 'PROCESO', recordId: id }, base), 'procesos', plan.changedFields, previous, saved);
    const nuevo = (tipo, item, resumen) => filas.push(Object.assign({}, base, { id: 'AU_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20),
      recordType: tipo, recordId: String(item.id), field: 'REGISTRO_NUEVO', previousValue: '', newValue: resumen }));
    plan.newHearings.forEach(item => nuevo('DILIGENCIA', item, [item.date, item.type, item.observation].filter(Boolean).join(' · ')));
    plan.newCommittees.forEach(item => nuevo('COMITE', item, [item.date, 'Sesión ' + (item.sessionNumber || ''), item.notes].filter(Boolean).join(' · ')));
    plan.newActions.forEach(item => nuevo('ACTUACION', item, [item.date, item.type, item.title].filter(Boolean).join(' · ')));
    filas.forEach(entry => {
      writeRow_(store, 'auditoria', entry.id, esqObjetoAFila_('auditoria', entry));
      audit.push(entry);
    });
  }

  // 06_PENDIENTES_CALIDAD: los puntos de revisión de los campos que se acaban de corregir se cierran
  // (el cambio queda en 07_AUDITORIA). Los de control los vuelve a evaluar «Validar calidad».
  let quality = null;
  if (previous) {
    const corrected = new Set(plan.changedFields
      .filter(key => { const value = saved[key]; return Array.isArray(value) ? value.length > 0 : String(value === undefined || value === null ? '' : value).trim() !== ''; })
      .map(key => esqEtiquetaCampo_('procesos', key)));
    const row = pendGroupOf_(store, id, true);
    if (row && corrected.size) {
      const items = esqItemsPendiente_(row);
      const header = item => item.replace(PEND_CONTROL, '').split(':')[0].trim();
      const remaining = items.filter(item => (item.indexOf(PEND_CONTROL) === 0 && item.indexOf(PEND_FALTANTE) < 0) || !corrected.has(header(item)));
      if (remaining.length !== items.length) {
        row.detail = remaining.join(PEND_SEP);
        row.count = remaining.length;
        row.fields = [...new Set(remaining.map(item => item.replace(PEND_CONTROL, '').split(':')[0].trim()).filter(Boolean))];
        row.updatedAt = now;
        if (!remaining.length) {
          row.status = 'RESUELTO'; row.resolvedAt = now; row.resolvedBy = user.correo;
          row.resolutionNote = 'Corregido desde la aplicación (cambios en 07_AUDITORIA).';
        }
        row.cierre = { status: 'RESUELTO', at: now, by: user.correo, note: 'Corregido desde la aplicación (cambios en 07_AUDITORIA).' };
        pendWriteGroup_(store, row, now, saved);
      }
      quality = { items: row.status === 'PENDIENTE' ? qualityItems_(row) : [] };
    }
  }

  // 06_PENDIENTES_CALIDAD: fecha de terminación anterior a otras fechas del proceso (control: «Validar calidad»
  // lo vuelve a evaluar y lo cierra cuando ya no se cumpla).
  if (plan.endDateConflict) {
    const existing = [pendGroupOf_(store, id)].filter(Boolean);
    const merged = esqFusionarPendientes_(existing, [{ processId: id, field: 'FECHA_TERMINACION', originalValue: saved.endDate,
      problem: 'La fecha de terminación es anterior a otras fechas del proceso.', classification: 'REQUIERE REVISIÓN JURÍDICA',
      responsible: 'Abogado a cargo', origin: 'CONTROL AUTOMÁTICO' }], now, { procesos: new Map([[id, { shortNo: saved.shortNo, radicado: saved.radicado }]]),
        cerrados: esqCerradosCalidad_(auditRowsFor_(store, id)) })
      .find(item => item.processId === id);
    if (merged) {
      pendWriteGroup_(store, merged, now, saved);
      quality = { items: qualityItems_(merged) };
    }
  }

  // 06_PENDIENTES_CALIDAD: Terminado sin fecha con justificación queda para validación jurídica,
  // en el registro único del proceso (se agrega a lo que ya haya por revisar).
  if (plan.justifiedWithoutDate) {
    const existing = [pendGroupOf_(store, id)].filter(Boolean);
    const merged = esqFusionarPendientes_(existing, [{ processId: id, field: 'FECHA_TERMINACION', originalValue: saved.terminationNotes,
      problem: 'Terminado sin fecha de terminación (con justificación: validar).', classification: 'REQUIERE REVISIÓN JURÍDICA',
      responsible: 'Abogado a cargo', origin: 'APLICACIÓN' }], now, { procesos: new Map([[id, { shortNo: saved.shortNo, radicado: saved.radicado }]]),
        cerrados: esqCerradosCalidad_(auditRowsFor_(store, id)) })
      .find(item => item.processId === id);
    if (merged) { pendWriteGroup_(store, merged, now, saved); quality = { items: qualityItems_(merged) }; }
  }

  // «revision06»: lo que queda por revisar en 06. No se llama «quality» porque ese es el campo Calidad activa/pasiva
  // del proceso: con ese nombre lo pisaba y los demás navegadores lo veían vacío hasta la siguiente integración.
  return Object.assign({}, saved, {
    revision06: quality,
    exemptFields: exempt ? [...exempt] : [],
    notificationYear: String(saved.notificationDate || '').slice(0, 4),
    hearings: (process.hearings || []).map(hearing => hearingFromRecord_(hearingRecord_(hearing, saved, actor, now))),
    committees: (process.committees || []).map(committee => committeeFromRecord_(committeeRecord_(committee, saved, actor, now))),
    actions: actionsOut, audit: audit.map(stripAudit_), assignments: assignments
  });
}

// ---- Conversión entre los objetos de la aplicación y las filas de 02_ACTUACIONES ----

function hearingRecord_(hearing, process, actor, now) {
  return {
    id: String(hearing.id), processId: process.id, radicado: process.radicado, clase: 'DILIGENCIA', date: String(hearing.date),
    source: String(hearing.source || APP_SOURCE), type: String(hearing.type || ''), title: String(hearing.reference || ''),
    description: String(hearing.observation || ''), status: '', dueDate: '', sessionNumber: String(Number(hearing.number) || 1),
    court: String(hearing.court || ''), registrationDate: String(hearing.registrationDate || fechaLocal_(now)),
    registeredBy: String(hearing.registeredBy || actor), createdAt: String(hearing.createdAt || now), updatedAt: '', updatedBy: ''
  };
}

function committeeRecord_(committee, process, actor, now) {
  return {
    id: String(committee.id), processId: process.id, radicado: process.radicado, clase: 'COMITE', date: String(committee.date),
    source: APP_SOURCE, type: 'Comité de conciliación', title: 'Comité de conciliación', description: String(committee.notes || ''),
    status: '', dueDate: '', sessionNumber: String(committee.sessionNumber || ''), court: '',
    registrationDate: String(committee.registrationDate || fechaLocal_(now)), registeredBy: String(committee.registeredBy || actor),
    createdAt: String(committee.createdAt || now), updatedAt: '', updatedBy: ''
  };
}

// Actuación cargada por la migración y no editada después por una persona: su fecha de registro no es real.
function migratedRegistration_(action) {
  const migration = ['MIGRACION_GENERAL', 'IMPORTACION_GENERAL'];
  return !!action && migration.indexOf(String(action.registeredBy || '')) >= 0 && (!action.updatedBy || migration.indexOf(String(action.updatedBy)) >= 0);
}

function actionRecord_(action, process, actor, now, edited, before) {
  return {
    id: String(action.id), processId: process.id, radicado: process.radicado, clase: 'ACTUACION', date: String(action.date),
    source: String(action.source || (before && before.source) || APP_SOURCE), type: String(action.type || ''), title: String(action.title || ''),
    description: String(action.description || ''), status: String(action.status || ''), dueDate: String(action.dueDate || ''),
    // Fecha de registro: la que trae la actuación; al editar sin fecha se conserva la anterior, salvo la que puso la
    // migración (General no tiene fecha de registro: esa era la del día en que se migró y no se conserva).
    sessionNumber: '', court: '', registrationDate: String(action.registrationDate || (before && !migratedRegistration_(before) && before.registrationDate) || (before ? '' : fechaLocal_(now))),
    registeredBy: String(action.registeredBy || (before && before.registeredBy) || actor),
    createdAt: String(action.createdAt || (before && before.createdAt) || now),
    updatedAt: edited ? now : String(action.updatedAt || ''), updatedBy: edited ? actor : String(action.updatedBy || '')
  };
}

function hearingFromRecord_(record) {
  return { id: record.id, processId: record.processId, type: record.type, number: Number(record.sessionNumber) || 1, date: record.date,
    observation: record.description, court: record.court, registrationDate: record.registrationDate, source: record.source,
    reference: record.title, registeredBy: record.registeredBy };
}

function committeeFromRecord_(record) {
  return { id: record.id, processId: record.processId, date: record.date, sessionNumber: record.sessionNumber, notes: record.description,
    registrationDate: record.registrationDate, registeredBy: record.registeredBy };
}

function actionFromRecord_(record) {
  return { id: record.id, processId: record.processId, date: record.date, type: record.type, title: record.title,
    description: record.description, status: record.status, registeredBy: record.registeredBy, createdAt: record.createdAt,
    dueDate: record.dueDate, registrationDate: record.registrationDate, updatedAt: record.updatedAt, updatedBy: record.updatedBy,
    source: record.source };
}

function stripAudit_(entry) {
  // recordType / recordId: el historial muestra a qué actuación, diligencia o comité corresponde cada cambio.
  return { id: entry.id, processId: entry.processId, changedAt: entry.changedAt, changedBy: entry.changedBy,
    changedFields: [entry.field].filter(Boolean), previousValue: entry.previousValue, newValue: entry.newValue,
    recordType: entry.recordType || '', recordId: entry.recordId || '' };
}

function hearingComparable_(hearing) {
  return { type: String(hearing.type || ''), number: String(Number(hearing.number) || 1), date: String(hearing.date || ''),
    observation: String(hearing.observation || ''), court: String(hearing.court || '') };
}

function committeeComparable_(committee) {
  return { date: String(committee.date || ''), sessionNumber: String(committee.sessionNumber || ''), notes: String(committee.notes || '') };
}

function actionComparable_(action) {
  return {
    date: String(action.date || ''), type: String(action.type || ''), title: String(action.title || ''),
    description: String(action.description || ''), status: String(action.status || ''),
    dueDate: String(action.dueDate || ''), registrationDate: String(action.registrationDate || '')
  };
}

function isSafeId_(value) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(String(value || ''));
}

// Nombres (normalizados) de los abogados a cargo que corresponden al usuario:
// - abogado: él mismo (el NOMBRE de su fila en ABOGADOS);
// - intermediario: los abogados que lo tienen como INTERMEDIARIO (por correo) en la hoja ABOGADOS, y él mismo.
// El dato no se repite en 01_PROCESOS: el proceso solo guarda ABOGADO_A_CARGO.
function userLawyerNames_(user) {
  const names = [esqNormalizar_(user.nombre)];
  if (user.rol === ROLES.intermediary) {
    getDirectory_().lawyers.filter(lawyer => lawyer.activo && lawyer.intermediario === normalizeEmail_(user.correo))
      .forEach(lawyer => names.push(esqNormalizar_(lawyer.nombre)));
  }
  return names.filter(Boolean);
}

function isAssignedTo_(process, user) {
  const lawyer = esqNormalizar_(process.lawyer);
  return !!lawyer && userLawyerNames_(user).indexOf(lawyer) >= 0;
}

// El abogado consulta (solo lectura) los procesos en los que figura como abogado a cargo.
function lawyerCanSee_(process, user) {
  return isAssignedTo_(process, user);
}

// Lo que hay que revisar de un proceso (su línea de 06_PENDIENTES_CALIDAD), separado por campo, para la
// ventana del proceso en la aplicación. Se consulta al abrir el proceso (no viaja con la carga inicial).
// Historial de modificaciones de un proceso (07_AUDITORIA), al abrirlo. Se busca solo ese proceso en 07.
function cargarHistorialProceso(sessionToken, processId) {
  const user = requireApplicationUser_(sessionToken);
  const id = String(processId || '');
  if (!isSafeId_(id)) throw new Error('El identificador del proceso no es válido.');
  const store = loadStoreForSave_(getDataSpreadsheet_(), [id], { withAudit: true, consulta: true, tables: ['procesos', 'auditoria'] });
  const process = store.existing.get(id);
  if (!process) return { id: id, audit: [] }; // aún no está en la base (recién creado en otro lugar) o se eliminó
  if (user.rol === ROLES.lawyer && !lawyerCanSee_(process, user)) throw new Error('No tienes acceso a este proceso.');
  let audit = (process.audit || []).slice();
  // Lo más antiguo pudo pasar al archivo histórico: si en 07 no alcanza para la ventana, se completa desde allí.
  if (audit.length < HISTORY_IN_DIALOG_ && archiveIds_().length) {
    const seen = new Set(audit.map(item => String(item.id)));
    archivedAuditFor_(id, HISTORY_IN_DIALOG_ - audit.length).forEach(item => { if (!seen.has(String(item.id))) audit.push(item); });
  }
  audit = audit.sort((a, b) => String(a.changedAt || '').localeCompare(String(b.changedAt || '')));
  return { id: id, total: audit.length, audit: audit.slice(-HISTORY_IN_DIALOG_) };
}
const HISTORY_IN_DIALOG_ = 60;

function cargarCalidadProceso(sessionToken, processId) {
  const user = requireApplicationUser_(sessionToken);
  const id = String(processId || '');
  if (!isSafeId_(id)) throw new Error('El identificador del proceso no es válido.');
  const store = loadStoreForSave_(getDataSpreadsheet_(), [id]);
  const process = store.existing.get(id);
  if (!process) throw new Error('No se encontró el proceso.');
  if (user.rol === ROLES.lawyer && !lawyerCanSee_(process, user)) throw new Error('No tienes acceso a este proceso.');
  const group = pendGroupOf_(store, id);
  const open = group && group.status === 'PENDIENTE' ? group : null;
  return { status: group ? group.status : '', detectedAt: open ? open.detectedAt : '', items: open ? qualityItems_(open) : [] };
}

// Cierra puntos de «Qué hay que revisar» desde la aplicación, sin editar la hoja. Solo el administrador;
// el colaborador (intermediario) corrige los datos con «Corregir».
// solicitud = { items: [{ header, problem, key, missing }], action: 'RESUELTO' | 'DESCARTADO', note, assignmentDate }
//  - Puntos de 06_PENDIENTES_CALIDAD y campos obligatorios sin diligenciar (CAMPOS_FALTANTES de 01).
//  - RESUELTO se valida contra la base: el campo debe tener valor en 01_PROCESOS; FECHA ASIGNACION pide la fecha,
//    que se escribe en la asignación vigente de 03_ASIGNACIONES.
//  - DESCARTADO («No aplica») = el dato queda como está; un obligatorio marcado así deja de contarse como faltante.
// Cada cierre queda en 07_AUDITORIA (TIPO_REGISTRO = CALIDAD) y no se vuelve a abrir al validar, depurar o migrar.
function resolverCalidadProceso(sessionToken, processId, solicitud) {
  const user = requireApplicationUser_(sessionToken);
  const id = String(processId || '');
  if (!isSafeId_(id)) throw new Error('El identificador del proceso no es válido.');
  const request = solicitud && typeof solicitud === 'object' ? solicitud : {};
  const action = String(request.action || '');
  // El intermediario también puede registrar la fecha de asignación (único punto de 06 sin campo en el formulario).
  const onlyAssignment = action === 'RESUELTO' && Array.isArray(request.items) && request.items.length > 0
    && request.items.every(item => item && !item.missing && String(item.header || '') === 'FECHA ASIGNACION');
  if (user.rol !== ROLES.admin && !(onlyAssignment && user.rol === ROLES.intermediary))
    throw new Error('Solo el administrador puede marcar puntos como Resuelto o No aplica. Usa «Corregir» para cambiar el dato.');
  if (['RESUELTO', 'DESCARTADO'].indexOf(action) < 0) throw new Error('Acción no válida: usa RESUELTO o DESCARTADO.');
  const note = String(request.note || '').replace(/\s+/g, ' ').trim();
  if (note.length < 5) throw new Error('Escribe una observación (qué se revisó o por qué no aplica).');
  const requested = (Array.isArray(request.items) ? request.items : []).slice(0, 200).filter(Boolean);
  if (!requested.length) throw new Error('No se indicó qué punto cerrar.');
  const isEmpty = value => Array.isArray(value) ? !value.length : String(value === undefined || value === null ? '' : value).trim() === '';

  const lock = writeLock_();
  beginWriteMemo_();
  try {
    const store = loadStoreForSave_(getDataSpreadsheet_(), [id]);
    const process = store.existing.get(id);
    if (!process) throw new Error('No se encontró el proceso.');
    const now = new Date().toISOString();
    const today = fechaLocal_(now);

    // Campos obligatorios sin diligenciar (no están en 06: se calculan en 01).
    const currentMissing = (Array.isArray(process.missingFields) ? process.missingFields : String(process.missingFields || '').split('|')).map(String).filter(Boolean);
    const missingSelected = requested.filter(item => item.missing).map(item => String(item.key || ''))
      .filter(key => ESQUEMA.procesos.columnas.some(col => col[1] === key));
    // Puntos de 06.
    const wanted = requested.filter(item => !item.missing)
      .map(item => esqClaveItemPendiente_(String(item.header || '') + ': ' + String(item.problem || '')));
    const row = pendGroupOf_(store, id, true);
    if (wanted.length && !row) throw new Error('Este proceso ya no tiene puntos pendientes por revisar en calidad. Recarga la información.');
    const items = row ? esqItemsPendiente_(row) : [];
    const parsed = row ? qualityItems_(row) : [];
    const selected = [];
    items.forEach((text, index) => { if (wanted.indexOf(esqClaveItemPendiente_(text)) >= 0) selected.push({ text: text, item: parsed[index] }); });
    if (wanted.length && !selected.length) throw new Error('Esos puntos ya no están pendientes. Recarga la información.');
    if (!selected.length && !missingSelected.length) throw new Error('Esos puntos ya no están pendientes. Recarga la información.');
    // Obligatorios que también están como punto en 06: se cierran allí (la auditoría ya la deja el cierre del faltante).
    const missingIn06 = items.filter((text, index) => parsed[index] && parsed[index].missing && missingSelected.indexOf(parsed[index].key) >= 0);
    const labelOf = item => item.header || 'Dato';

    if (action === 'RESUELTO') {
      const problems = [];
      selected.forEach(({ item }) => {
        if (item.key) {
          if (isEmpty(process[item.key])) problems.push(labelOf(item) + ': sigue vacío en la base. Corrígelo con «Corregir» o usa «No aplica» si debe quedar vacío.');
        } else if (item.header === 'FECHA ASIGNACION') {
          const date = String(request.assignmentDate || '');
          if (!isValidIsoDate_(date) || date > today) problems.push('FECHA ASIGNACION: indica una fecha válida (no futura) desde la que el abogado tiene el proceso.');
          else if (!(process.assignments || []).some(item2 => !item2.endDate)) problems.push('FECHA ASIGNACION: el proceso no tiene una asignación vigente en 03_ASIGNACIONES.');
        }
      });
      missingSelected.forEach(key => {
        if (isEmpty(process[key])) problems.push(esqEtiquetaCampo_('procesos', key) + ': sigue vacío en la base. Diligéncialo con «Corregir» o usa «No aplica» si no aplica a este proceso.');
      });
      if (problems.length) throw new Error(problems.join('\n'));
    }

    // FECHA ASIGNACION resuelta: se escribe la fecha de inicio en la asignación vigente (03) y queda en 07.
    const assignments = process.assignments || [];
    if (action === 'RESUELTO' && selected.some(({ item }) => item.header === 'FECHA ASIGNACION')) {
      const current = assignments.filter(item => !item.endDate).sort((a, b) => String(b.registeredAt).localeCompare(String(a.registeredAt)))[0];
      const before = current.startDate || '';
      current.startDate = String(request.assignmentDate);
      current.note = String(current.note || '').replace('Sin fecha de asignación en General.', '').trim();
      writeRow_(store, 'asignaciones', current.id, esqObjetoAFila_('asignaciones', current));
      esqFilasAuditoria_({ processId: id, processShortNo: process.shortNo || '', processRadicado: process.radicado || '', changedAt: now, changedBy: user.correo, origin: 'APLICACIÓN', recordType: 'ASIGNACION', recordId: String(current.id) },
        'asignaciones', ['startDate'], { startDate: before }, { startDate: current.startDate })
        .forEach(entry => writeRow_(store, 'auditoria', entry.id, esqObjetoAFila_('auditoria', entry)));
    }

    // 07_AUDITORIA: una fila por punto cerrado (así no se vuelve a abrir).
    const auditClose = (field, text) => {
      const entry = { id: 'AU_' + Utilities.getUuid().replace(/-/g, '').slice(0, 20), processId: id, processShortNo: process.shortNo || '', processRadicado: process.radicado || '',
        changedAt: now, changedBy: user.correo, origin: 'APLICACIÓN', recordType: 'CALIDAD', recordId: row ? String(row.id) : id, field: field, previousValue: text,
        newValue: (action + ': ' + note).slice(0, 500) };
      writeRow_(store, 'auditoria', entry.id, esqObjetoAFila_('auditoria', entry));
    };
    selected.forEach(({ text, item }) => auditClose(labelOf(item), text));
    missingSelected.forEach(key => auditClose(esqEtiquetaCampo_('procesos', key), esqEtiquetaCampo_('procesos', key) + ': ' + PEND_FALTANTE));

    // 01: los obligatorios cerrados dejan de figurar en CAMPOS_FALTANTES.
    let missingFields = currentMissing;
    if (missingSelected.length) {
      missingFields = currentMissing.filter(key => missingSelected.indexOf(key) < 0);
      const saved = {};
      ESQUEMA.procesos.columnas.forEach(col => { saved[col[1]] = process[col[1]] });
      Object.assign(saved, { missingFields: missingFields, incomplete: missingFields.length > 0, updatedAt: now, updatedBy: user.correo });
      writeRow_(store, 'procesos', id, esqObjetoAFila_('procesos', saved));
    }

    // 06: se quitan los puntos cerrados; si no queda ninguno, la línea queda RESUELTO / DESCARTADO.
    if (row && (selected.length || missingIn06.length)) {
      const closed = new Set(selected.map(({ text }) => text).concat(missingIn06));
      const remaining = items.filter(text => !closed.has(text));
      const log = '[' + today + ' ' + user.correo + '] ' + action + ' ' + selected.map(({ item }) => labelOf(item)).concat(missingIn06.map(text => text.replace(PEND_CONTROL, '').split(':')[0].trim())).join(', ') + ': ' + note;
      row.detail = remaining.join(PEND_SEP);
      row.count = remaining.length;
      row.fields = [...new Set(remaining.map(text => text.replace(PEND_CONTROL, '').split(':')[0].trim()).filter(Boolean))];
      row.updatedAt = now;
      row.resolutionNote = log.slice(0, 500);
      row.cierre = { status: action, at: now, by: user.correo, note: log.slice(0, 500) };
      if (!remaining.length) {
        row.status = action;
        row.resolvedAt = now;
        row.resolvedBy = user.correo;
      }
      pendWriteGroup_(store, row, now, process);
    }
    flushStore_(store);
    const open = row && row.status === 'PENDIENTE';
    const exemptFields = [...new Set([...(esqExentosObligatorios_(auditRowsFor_(store, id)).get(id) || [])]
      .concat(action === 'DESCARTADO' ? missingSelected : []))];
    const items2 = open ? qualityItems_(row) : [];
    const updated = Object.assign({}, process, { missingFields: missingFields, incomplete: missingFields.length > 0, assignments: assignments, exemptFields: exemptFields },
      missingSelected.length ? { updatedAt: now, updatedBy: user.correo } : {});
    publishChanges_([{ id: id, r: updated, q: items2 }]);
    return { processId: id, status: row ? row.status : '', closed: selected.length + missingSelected.length,
      items: items2, missingFields: missingFields, incomplete: missingFields.length > 0, assignments: assignments,
      exemptFields: exemptFields, updatedAt: updated.updatedAt, seq: deltaSeq_() };
  } finally {
    endWriteMemo_();
    lock.releaseLock();
  }
}

// ---- 06 por proceso dentro de un guardado ----
function pendPointsOf_(store, id) {
  return (store.rows.pendientes || []).map(row => esqFilaAObjeto_('pendientes', row)).filter(punto => punto.processId === id);
}
// Grupo del proceso. abierto: solo si tiene puntos pendientes.
function pendGroupOf_(store, id, abierto) {
  const grupo = esqPuntosAGrupos_(pendPointsOf_(store, id))[0] || null;
  return abierto && (!grupo || grupo.status !== 'PENDIENTE') ? null : grupo;
}
// Escribe el grupo y reemplaza la fila anterior del proceso.
function pendWriteGroup_(store, group, now, process) {
  const previos = pendPointsOf_(store, group.processId);
  const datos = process || {};
  const mapa = new Map([[group.processId, { shortNo: datos.shortNo || group.shortNo || '', radicado: datos.radicado || group.radicado || '', lawyer: datos.lawyer || '' }]]);
  const updated = esqGruposAFilas_([group], previos, now, mapa)[0];
  const row = esqObjetoAFila_('pendientes', updated);
  writeRow_(store, 'pendientes', updated.id, row);
  store.rows.pendientes = (store.rows.pendientes || []).filter(values => esqFilaAObjeto_('pendientes', values).processId !== group.processId).concat([row]);
  return updated;
}

// Separa la línea de 06 de un proceso en hallazgos por campo: { header, key, problem, value, control }.
function qualityItems_(row) {
  if (!qualityItems_.keys) {
    qualityItems_.keys = {};
    ESQUEMA.procesos.columnas.forEach(col => { qualityItems_.keys[col[0]] = col[1]; });
  }
  return esqItemsPendiente_(row).map(text => {
    const control = text.indexOf(PEND_CONTROL) === 0;
    const body = control ? text.slice(PEND_CONTROL.length) : text;
    const match = body.match(/^([^:]+):\s*([\s\S]*?)(?:\s*\[valor:\s*([\s\S]*)\])?$/) || [body, '', body, ''];
    const header = String(match[1] || '').trim();
    const problem = String(match[2] || '').trim();
    // Obligatorio sin diligenciar: se cierra como faltante (Resuelto valida que tenga valor; No aplica lo exime).
    return { header: header, key: qualityItems_.keys[header] || '', problem: problem, value: String(match[3] || '').trim(), control: control, missing: problem === PEND_FALTANTE };
  });
}


// Los procesos no se borran (no se sobrescriben históricos): quedan con ESTADO_REGISTRO = ELIMINADO.
function deleteApplicationProcess(sessionToken, processId) {
  const user = requireApplicationUser_(sessionToken);
  if (user.rol !== ROLES.admin) throw new Error('Solo los administradores pueden eliminar procesos.');
  const id = String(processId || '');
  if (!isSafeId_(id)) throw new Error('El identificador del proceso no es válido.');
  const lock = writeLock_();
  beginWriteMemo_();
  try {
    const store = loadStoreForSave_(getDataSpreadsheet_(), [id]);
    const process = store.existing.get(id);
    if (!process) throw new Error('No se encontró el proceso que intentas eliminar.');
    const now = new Date().toISOString();
    const saved = {};
    ESQUEMA.procesos.columnas.forEach(col => { saved[col[1]] = process[col[1]] });
    Object.assign(saved, { recordStatus: 'ELIMINADO', updatedAt: now, updatedBy: user.correo });
    writeRow_(store, 'procesos', id, esqObjetoAFila_('procesos', saved));
    esqFilasAuditoria_({ processId: id, processShortNo: process.shortNo || '', processRadicado: process.radicado || '', changedAt: now, changedBy: user.correo, origin: 'APLICACIÓN', recordType: 'PROCESO', recordId: id },
      'procesos', ['recordStatus'], { recordStatus: 'ACTIVO' }, { recordStatus: 'ELIMINADO' })
      .forEach(entry => writeRow_(store, 'auditoria', entry.id, esqObjetoAFila_('auditoria', entry)));
    // Lo que tenía por revisar en 06 se cierra: el proceso ya no hace parte de la base.
    (store.rows.pendientes || []).map(row => esqFilaAObjeto_('pendientes', row)).filter(item => item.processId === id && item.status === 'PENDIENTE').forEach(item => {
      Object.assign(item, { status: 'DESCARTADO', resolvedAt: now, resolvedBy: user.correo, updatedAt: now,
        resolutionNote: (item.resolutionNote ? item.resolutionNote + ' ' : '') + 'Proceso eliminado desde la aplicación.' });
      writeRow_(store, 'pendientes', item.id, esqObjetoAFila_('pendientes', item));
    });
    flushStore_(store);
    radicadoIndexAfterSave_(store.hints && store.hints.version, [{ id: id, radicado: '', previous: String(process.radicado || '').trim(), deleted: true }]);
    publishChanges_([{ id: id, d: true }]);
    return { deleted: true, seq: deltaSeq_() };
  } finally {
    endWriteMemo_();
    lock.releaseLock();
  }
}

// ---- Lecturas de caché y propiedades agrupadas (una llamada en vez de muchas) ----
// Durante un guardado se piden de una vez todas las llaves de la caché que se van a usar y todas las
// propiedades del script. Fuera de los guardados no hay memoria: cada lectura va directo al servicio.
let cacheMemo_ = null;
let propsMemo_ = null;
function cachePreload_(keys) {
  if (!cacheMemo_) return; // solo dentro de un guardado (beginWriteMemo_)
  const wanted = [...new Set(keys.filter(Boolean))].filter(key => !(key in cacheMemo_));
  if (!wanted.length) return;
  let found = {};
  try { found = CacheService.getScriptCache().getAll(wanted) || {}; } catch (error) { found = {}; }
  wanted.forEach(key => { cacheMemo_[key] = key in found ? found[key] : null; });
}
function cacheGet_(key) {
  if (cacheMemo_ && key in cacheMemo_) return cacheMemo_[key];
  return CacheService.getScriptCache().get(key);
}
// Dentro de un guardado, lo que se escribe en la caché con la vigencia normal (6 h) se junta y se envía en UNA
// sola llamada al final (posiciones de filas, tamaño de tablas, cambio publicado e índice).
let cacheOut_ = null;
const CACHE_OUT_SECONDS_ = 21600;
function cachePut_(key, value, seconds) {
  if (cacheMemo_) cacheMemo_[key] = value;
  if (cacheOut_ && seconds === CACHE_OUT_SECONDS_) { cacheOut_[key] = value; return; }
  CacheService.getScriptCache().put(key, value, seconds);
}
function cachePutAll_(values, seconds) {
  if (cacheMemo_) Object.keys(values).forEach(key => { cacheMemo_[key] = values[key]; });
  if (cacheOut_ && seconds === CACHE_OUT_SECONDS_) { Object.assign(cacheOut_, values); return; }
  CacheService.getScriptCache().putAll(values, seconds);
}
function flushCacheWrites_() {
  const values = cacheOut_;
  cacheOut_ = null;
  if (!values || !Object.keys(values).length) return;
  try {
    CacheService.getScriptCache().putAll(values, CACHE_OUT_SECONDS_);
  } catch (error) {
    // Sin esto la memoria quedaría atrasada respecto a la hoja: se descarta y se rearma sola.
    console.error('No se pudo actualizar la memoria tras el guardado; se rearma.', error);
    try { rowHintsForget_(null); } catch (ignored) { /* */ }
    try { invalidateRecordsCache_(); } catch (ignored) { /* */ }
  }
}
function propGet_(name) {
  if (propsMemo_) return Object.prototype.hasOwnProperty.call(propsMemo_, name) ? propsMemo_[name] : null;
  return PropertiesService.getScriptProperties().getProperty(name);
}
function propSet_(name, value) {
  PropertiesService.getScriptProperties().setProperty(name, value);
  if (propsMemo_) propsMemo_[name] = String(value);
}
// Se llama con el bloqueo de escritura tomado: lo leído antes de entrar en turno podría estar viejo.
function beginWriteMemo_() {
  cacheMemo_ = {};
  cacheOut_ = {};
  try { propsMemo_ = PropertiesService.getScriptProperties().getProperties() || {}; } catch (error) { propsMemo_ = null; }
}
function endWriteMemo_() { flushCacheWrites_(); cacheMemo_ = null; propsMemo_ = null; }

// Memo de solo lectura (consultas): propiedades en una lectura y llaves de caché ya traídas junto con la sesión.
function beginReadMemo_() {
  cacheMemo_ = {};
  cacheOut_ = null;
  try { propsMemo_ = PropertiesService.getScriptProperties().getProperties() || null; } catch (error) { propsMemo_ = null; }
}
function endReadMemo_() { cacheMemo_ = null; propsMemo_ = null; }

// extraKeys (opcional): otras llaves de caché que la consulta va a necesitar; se traen en la MISMA llamada que la
// sesión y quedan en el memo (cacheGet_), si hay uno activo.
function requireApplicationUser_(sessionToken, extraKeys) {
  const token = String(sessionToken || '');
  if (!/^[A-Fa-f0-9]{64}$/.test(token)) throw new Error('Se requiere una sesión válida para esta operación.');
  // Sesión y directorio de usuarios en una sola llamada a la caché.
  const sessionKey = getCacheKey_('AUTH_SESSION_', token);
  const extras = (extraKeys || []).filter(Boolean);
  if (!directoryMemo_ || extras.length) {
    let both = null;
    try { both = CacheService.getScriptCache().getAll([sessionKey, 'ROLE_DIRECTORY_V2'].concat(extras)) || null; } catch (error) { both = null; }
    if (both) {
      if (!directoryMemo_ && both.ROLE_DIRECTORY_V2) { try { directoryMemo_ = JSON.parse(both.ROLE_DIRECTORY_V2); } catch (error) { directoryMemo_ = null; } }
      if (cacheMemo_) extras.forEach(key => { cacheMemo_[key] = key in both ? both[key] : null; });
      return authorizedUser_(both[sessionKey]);
    }
  }
  return authorizedUser_(CacheService.getScriptCache().get(sessionKey));
}

function authorizedUser_(correo) {
  if (!correo) throw new Error('La sesión venció. Ingresa nuevamente.');
  const user = findAuthorizedUserByEmail_(correo);
  if (!user || [ROLES.admin, ROLES.intermediary, ROLES.lawyer].indexOf(user.rol) < 0) {
    throw new Error('No tienes autorización para esta operación.');
  }
  return {
    correo: normalizeEmail_(correo), nombre: user.nombre, rol: user.rol
  };
}

function getDataSpreadsheetId_() {
  return propGet_(AUTH_CONFIG.dataSpreadsheetIdProperty) || DEFAULT_DATA_SPREADSHEET_ID;
}

let dataSpreadsheetMemo_ = null;
function getDataSpreadsheet_() {
  if (dataSpreadsheetMemo_) return dataSpreadsheetMemo_;
  try {
    dataSpreadsheetMemo_ = SpreadsheetApp.openById(getDataSpreadsheetId_());
    return dataSpreadsheetMemo_;
  } catch (error) {
    console.error('No se pudo abrir el archivo de datos.', error);
    throw new Error('No se pudo abrir la base de procesos. Verifica DATA_SPREADSHEET_ID y los permisos del proyecto.');
  }
}

// La estructura la crea el script de la base (menú Estandarización > Crear estructura). Aquí solo se verifica.
const ensuredSheets_ = {};
// 06_PENDIENTES_CALIDAD con el formato anterior (una fila por hallazgo, columna VALOR_ORIGINAL): la aplicación
// la pasa sola al formato actual (un registro por proceso, solo lo que hay que revisar), igual que
// crearEstructuraBase en BaseProcesos.gs. Así la aplicación no se bloquea si aún no se corrió ese paso.
function lockHeld_(lock) { try { return typeof lock.hasLock === 'function' && lock.hasLock(); } catch (error) { return false; } }

// 07_AUDITORIA de la versión anterior (sin NO_CORTO y RADICADO): la aplicación la pone al día sola, una vez.
function convertOldAuditSheet_(sheet) {
  if (!esqAuditoriaSinProceso_(sheet)) return false;
  const lock = LockService.getScriptLock();
  const held = lockHeld_(lock);
  if (!held) lock.waitLock(30000);
  try {
    const done = esqAuditoriaConProceso_(sheet); // vuelve a mirar los encabezados: otra persona pudo convertirla
    if (done) { SpreadsheetApp.flush(); console.log('07_AUDITORIA: se agregaron NO_CORTO y RADICADO (se llenaron con los datos de 01_PROCESOS).'); }
    return done;
  } finally {
    if (!held) lock.releaseLock();
  }
}

function convertOldPendingSheet_(sheet) {
  if (sheet.getLastColumn() < 1) return false;
  const data = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), sheet.getLastColumn()).getValues();
  const head = data[0].map(value => String(value).trim());
  const headers = esqEncabezados_('pendientes');
  const currentSchema = headers.every((header, index) => head[index] === header);
  const processColumn = head.indexOf('ID_PROCESO');
  const processIds = processColumn < 0 ? [] : data.slice(1).map(row => String(row[processColumn] || '').trim()).filter(Boolean);
  const hasDuplicateProcesses = new Set(processIds).size !== processIds.length;
  if (currentSchema && !hasDuplicateProcesses) return false;
  const oldest = head.indexOf('VALOR_ORIGINAL') >= 0;
  const grouped = (head.indexOf('DETALLE') >= 0 && !oldest && !currentSchema) || (currentSchema && hasDuplicateProcesses);
  const pointRows = !oldest && !grouped && !currentSchema && head.indexOf('CAMPO') >= 0 && head.indexOf('QUE_ESTA_MAL') >= 0;
  if (!oldest && !grouped && !pointRows) return false;
  const lock = LockService.getScriptLock();
  const held = lockHeld_(lock); // si ya se tiene el turno (guardado en curso) no se suelta aquí
  if (!held) lock.waitLock(30000);
  try {
    const col = name => head.indexOf(name);
    const cell = (row, name) => col(name) >= 0 ? esqTextoCelda_(row[col(name)]) : '';
    const findings = [];
    const oldPoints = [];
    data.slice(1).forEach(row => {
      const processId = cell(row, 'ID_PROCESO');
      if (!processId) return;
      if (oldest) {
        if (cell(row, 'CLASIFICACION') !== 'REQUIERE REVISIÓN JURÍDICA' || cell(row, 'ESTADO') !== 'PENDIENTE') return;
        findings.push({ processId, field: cell(row, 'CAMPO'), problem: cell(row, 'PROBLEMA'),
          originalValue: cell(row, 'VALOR_ORIGINAL'), classification: 'REQUIERE REVISIÓN JURÍDICA',
          responsible: cell(row, 'RESPONSABLE'), origin: cell(row, 'ORIGEN'), sourceRow: cell(row, 'FILA_GENERAL') });
      } else if (pointRows) {
        oldPoints.push({
          id: cell(row, 'ID_PENDIENTE'), processId, shortNo: cell(row, 'NO_CORTO'), radicado: cell(row, 'RADICADO'),
          lawyer: cell(row, 'ABOGADO_A_CARGO'), priority: cell(row, 'PRIORIDAD'), field: cell(row, 'CAMPO'),
          fieldLabel: cell(row, 'NOMBRE_CAMPO'), problem: cell(row, 'QUE_ESTA_MAL'), value: cell(row, 'VALOR_ENCONTRADO'),
          howTo: cell(row, 'QUE_HACER'), responsible: cell(row, 'RESPONSABLE'), classification: cell(row, 'CLASIFICACION'),
          status: cell(row, 'ESTADO'), origin: cell(row, 'ORIGEN'), sourceRow: cell(row, 'FILA_GENERAL'),
          detectedAt: cell(row, 'FECHA_DETECCION'), updatedAt: cell(row, 'ACTUALIZADO_EN'),
          resolvedAt: cell(row, 'FECHA_RESOLUCION'), resolvedBy: cell(row, 'RESUELTO_POR'),
          resolutionNote: cell(row, 'OBSERVACION_RESOLUCION')
        });
      }
    });
    // No. corto y radicado tal como están en 01_PROCESOS.
    const processes = new Map();
    const p01 = sheet.getParent().getSheetByName(ESQUEMA.procesos.hoja);
    if (p01 && p01.getLastRow() > 1) {
      const width = esqEncabezados_('procesos').length;
      p01.getRange(2, 1, p01.getLastRow() - 1, width).getValues().forEach(row => {
        const item = esqFilaAObjeto_('procesos', row);
        if (item.id) processes.set(item.id, { shortNo: item.shortNo, radicado: item.radicado, lawyer: item.lawyer || '' });
      });
    }
    const now = new Date().toISOString();
    const groups = oldest ? esqFusionarPendientes_([], findings, now, { procesos: processes })
      : pointRows ? esqPuntosAGrupos_(oldPoints)
      : data.slice(1).filter(row => cell(row, 'ID_PROCESO') && (cell(row, 'ESTADO') || 'PENDIENTE') === 'PENDIENTE').map(row => ({
        processId: cell(row, 'ID_PROCESO'), shortNo: cell(row, 'NO_CORTO'), radicado: cell(row, 'RADICADO'), sourceRow: cell(row, 'FILA_GENERAL'),
        lawyer: cell(row, 'ABOGADO_A_CARGO'), detail: cell(row, 'DETALLE'), status: cell(row, 'ESTADO') || 'PENDIENTE',
        origin: cell(row, 'ORIGEN'), detectedAt: cell(row, 'FECHA_DETECCION'), updatedAt: cell(row, 'ACTUALIZADO_EN'),
        resolvedAt: cell(row, 'FECHA_RESOLUCION'), resolvedBy: cell(row, 'RESUELTO_POR'), resolutionNote: cell(row, 'OBSERVACION_RESOLUCION') }));
    const detected = new Map(groups.map(group => [group.processId, group.detectedAt || now]));
    const rows = esqGruposAFilas_(groups, [], now, processes).map(group => esqObjetoAFila_('pendientes', Object.assign(group, { detectedAt: detected.get(group.processId) || now })));
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(item => item.remove());
    sheet.clear();
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
    const headers = esqEncabezados_('pendientes');
    if (sheet.getMaxColumns() < headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    if (sheet.getMaxRows() < rows.length + 1) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length + 1 - sheet.getMaxRows());
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    // Formato en todas las filas (las que se agreguen después lo heredan, como deja la hoja BaseProcesos.gs).
    esqFormatosFila_('pendientes').forEach((format, index) => sheet.getRange(2, index + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat(format));
    if (rows.length) sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    const bodyRows = Math.max(sheet.getMaxRows() - 1, 1);
    ['TIPO_PROBLEMA', 'CAMPO', 'NOMBRE_CAMPO', 'QUE_ESTA_MAL', 'VALOR_ENCONTRADO', 'QUE_HACER', 'RESPONSABLE', 'DETALLE', 'OBSERVACION_RESOLUCION']
      .forEach(name => sheet.getRange(2, esqIndice_('pendientes', name) + 1, bodyRows, 1).setWrap(true));
    sheet.getRange(2, 1, bodyRows, headers.length).setVerticalAlignment('top');
    sheet.setColumnWidth(esqIndice_('pendientes', 'DETALLE') + 1, 420);
    sheet.setFrozenRows(1);
    SpreadsheetApp.flush();
    rowHintsForget_(null); // las filas de 06 cambiaron de lugar
    console.log('06_PENDIENTES_CALIDAD consolidada: ' + (data.length - 1) + ' filas antiguas -> ' + rows.length + ' procesos.');
    return true;
  } finally {
    if (!held) lock.releaseLock();
  }
}

function schemaKey_(tabla) { return 'SCHEMA_V3_' + dataVersion_() + '_' + ESQUEMA[tabla].hoja + '_' + ESQUEMA[tabla].columnas.length; }
function requireDataSheet_(spreadsheet, tabla) {
  const config = ESQUEMA[tabla];
  const schemaKey = schemaKey_(tabla);
  if (ensuredSheets_[schemaKey]) return ensuredSheets_[schemaKey];
  const sheet = spreadsheet.getSheetByName(config.hoja);
  if (!sheet) {
    throw new Error('La base no tiene la pestaña ' + config.hoja + '. En la hoja de cálculo ejecuta el menú Estandarización > 1. Crear estructura de la base y luego 2. Migrar General.');
  }
  if (!cacheGet_(schemaKey)) {
    const headers = esqEncabezados_(tabla);
    if (tabla === 'pendientes') convertOldPendingSheet_(sheet);
    if (tabla === 'auditoria') convertOldAuditSheet_(sheet);
    const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
    const position = headers.findIndex((header, index) => current[index] !== header);
    if (position >= 0) {
      throw new Error('Los encabezados de ' + config.hoja + ' (archivo "' + spreadsheet.getName() + '") no coinciden con el modelo: en la columna ' +
        (position + 1) + ' se esperaba ' + headers[position] + ' y la hoja tiene "' + (current[position] || 'vacío') + '". ' +
        'En ESE archivo abre Extensiones > Apps Script, pega el BaseProcesos.gs más reciente y ejecuta crearEstructuraBase.');
    }
    cachePut_(schemaKey, '1', 21600);
  }
  ensuredSheets_[schemaKey] = sheet;
  return sheet;
}

function isValidIsoDate_(value) {
  return esqFechaIsoValida_(value);
}

function readTable_(spreadsheet, tabla) {
  const sheet = requireDataSheet_(spreadsheet, tabla);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, esqEncabezados_(tabla).length).getValues()
    .filter(row => String(row[0] || '').trim())
    .map(row => esqFilaAObjeto_(tabla, row));
}


// ---- Almacén en memoria: lee las pestañas una vez y arma los procesos con sus registros hijos ----

function newStore_() {
  return { sheets: {}, rows: {}, byId: {}, pending: {}, existing: new Map(), deleted: new Set(), radicados: new Map(), openPendingKeys: new Set() };
}

function loadStore_(spreadsheet) {
  const store = newStore_();
  STORE_TABLES.forEach(tabla => {
    const sheet = requireDataSheet_(spreadsheet, tabla);
    const width = esqEncabezados_(tabla).length;
    const lastRow = sheet.getLastRow();
    const rows = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, width).getValues();
    store.sheets[tabla] = sheet;
    store.rows[tabla] = rows;
    store.byId[tabla] = new Map(rows.map((row, index) => [String(row[0]), index + 2]));
    store.pending[tabla] = [];
  });
  return assembleStore_(store);
}

// Igual que loadStore_, pero arma solo los procesos indicados. De las demás filas lee solo las columnas de ID.
function loadStoreFor_(spreadsheet, ids) {
  const wanted = new Set((ids || []).filter(Boolean).map(String));
  const store = newStore_();
  STORE_TABLES.forEach(tabla => {
    const sheet = requireDataSheet_(spreadsheet, tabla);
    const width = esqEncabezados_(tabla).length;
    store.sheets[tabla] = sheet;
    store.pending[tabla] = [];
    const lastRow = sheet.getLastRow();
    const keys = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, tabla === 'procesos' ? 3 : 2).getValues().map(row => row.map(esqTextoCelda_));
    store.byId[tabla] = new Map(keys.map((row, index) => [String(row[0]), index + 2]));
    if (tabla === 'procesos' && keys.length) {
      const statusColumn = esqIndice_('procesos', 'ESTADO_REGISTRO') + 1;
      const statuses = sheet.getRange(2, statusColumn, lastRow - 1, 1).getValues();
      keys.forEach((row, index) => {
        if (String(statuses[index][0]) === 'ELIMINADO') { store.deleted.add(String(row[0])); return; }
        if (row[2]) store.radicados.set(String(row[2]), String(row[0]));
      });
    }
    const matchColumn = tabla === 'procesos' ? 0 : 1;
    const rowNumbers = keys.map((row, index) => (wanted.has(String(row[matchColumn])) ? index + 2 : 0)).filter(Boolean);
    store.rows[tabla] = readRowGroups_(sheet, rowNumbers, width);
  });
  return assembleStore_(store);
}

// ---- Posición de las filas de cada proceso (la «fila» que guarda en su copia rápida el proyecto de contratos) ----
// Para cada proceso se recuerda en qué filas están su registro de 01 y sus filas de 02, 03 y 06. Al guardar se lee
// directo esa fila (y se confirma por ID que sigue siendo la misma) en vez de BUSCARLA en la columna completa.
// Las posiciones se guardan en 64 grupos por ID y llevan la versión de datos que marca BaseProcesos.gs: si se
// migra, depura o valida, se descartan solas. Si una posición no coincide, se busca como antes (nunca se escribe
// sobre una fila sin confirmar su ID).
const ROW_HINTS_ = { prefix: 'APP_FILAS_V1_', buckets: 64, seconds: 21600, maxBytes: 95000,
  letters: { procesos: 'p', actuaciones: 'a', asignaciones: 's', pendientes: 'q' } };

function rowHintBucket_(id) {
  const text = String(id);
  let hash = 0;
  for (let index = 0; index < text.length; index++) hash = (hash * 31 + text.charCodeAt(index)) | 0;
  return Math.abs(hash) % ROW_HINTS_.buckets;
}
function rowHintKey_(version, bucket) { return ROW_HINTS_.prefix + version + '_' + bucket; }
function rowHintKeysFor_(version, ids) { return [...new Set(ids.map(id => rowHintKey_(version, rowHintBucket_(id))))]; }

// Grupos de posiciones de esos procesos: { clave: { t, ids: { id: { p:[fila], a:[...], s:[...], q:[...] } } } }.
function rowHintBucketsFor_(version, ids) {
  const buckets = {};
  const keys = rowHintKeysFor_(version, ids);
  cachePreload_(keys);
  keys.forEach(key => {
    let value = null;
    try { value = JSON.parse(cacheGet_(key) || 'null'); } catch (error) { value = null; }
    buckets[key] = value && value.ids ? value : null;
  });
  return buckets;
}

// Con el bloqueo de escritura tomado: guarda las posiciones (ya confirmadas) de los procesos del almacén.
function rowHintsWrite_(store, appended) {
  if (!store.hints) return;
  try {
    const version = store.hints.version;
    const tables = Object.keys(ROW_HINTS_.letters);
    const ids = new Set(store.hints.ids);
    (appended.procesos || []).forEach(item => ids.add(String(item.values[0])));
    const changed = {};
    ids.forEach(id => {
      const entry = {};
      tables.forEach(tabla => {
        const rows = ((store.found[tabla] || {})[id] || []).slice();
        (appended[tabla] || []).forEach(item => { if (String(item.values[tabla === 'procesos' ? 0 : 1]) === id) rows.push(item.row); });
        entry[ROW_HINTS_.letters[tabla]] = [...new Set(rows)].sort((a, b) => a - b);
      });
      const key = rowHintKey_(version, rowHintBucket_(id));
      const bucket = store.hints.buckets[key] || { t: 0, full: false, ids: {} };
      if (!entry.p.length) delete bucket.ids[id]; else bucket.ids[id] = entry;
      bucket.t = Date.now();
      store.hints.buckets[key] = bucket;
      changed[key] = bucket;
    });
    const values = {};
    Object.keys(changed).forEach(key => {
      const text = JSON.stringify(changed[key]);
      if (text.length < ROW_HINTS_.maxBytes) values[key] = text;
    });
    if (Object.keys(values).length) cachePutAll_(values, ROW_HINTS_.seconds);
    const dropped = Object.keys(changed).filter(key => !(key in values));
    if (dropped.length) CacheService.getScriptCache().removeAll(dropped);
  } catch (error) {
    console.error('No se pudieron guardar las posiciones de las filas (el próximo guardado las busca).', error);
  }
}

// Renueva la vigencia (6 h) de las posiciones y del tamaño de las tablas, con el bloqueo de escritura para no
// pisar lo que un guardado esté actualizando.
function rowHintsRenew_() {
  const version = dataVersion_();
  const keys = Array.from({ length: ROW_HINTS_.buckets }, (unused, bucket) => rowHintKey_(version, bucket)).concat([geometryKey_(version)]);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return false;
  try {
    if (groupWriterActive_()) return false; // hay una tanda de guardados escribiendo: se renueva en la próxima pasada
    const cache = CacheService.getScriptCache();
    const current = cache.getAll(keys) || {};
    const present = Object.keys(current);
    for (let index = 0; index < present.length; index += 16) {
      const part = {};
      present.slice(index, index + 16).forEach(key => { part[key] = current[key]; });
      cache.putAll(part, ROW_HINTS_.seconds);
    }
    return true;
  } finally {
    lock.releaseLock();
  }
}

// Guardado sin posiciones (lote grande): se olvidan las de esos procesos; el próximo guardado las busca.
function rowHintsForget_(ids) {
  try {
    const keys = (ids === null ? Array.from({ length: ROW_HINTS_.buckets }, (unused, bucket) => rowHintKey_(dataVersion_(), bucket))
      : rowHintKeysFor_(dataVersion_(), [...new Set(ids.filter(Boolean))])).concat([geometryKey_(dataVersion_())]);
    for (let index = 0; index < keys.length; index += 100) CacheService.getScriptCache().removeAll(keys.slice(index, index + 100));
  } catch (error) { console.error('No se pudieron descartar posiciones de filas.', error); }
}

// Al armar la precarga (lectura completa de la base): posiciones de TODOS los procesos. Se escriben con el
// bloqueo de escritura y sin pisar un grupo que un guardado actualizó mientras se leía la base.
// Índice de radicados en la memoria (64 grupos por radicado): ¿a qué proceso pertenece un radicado? Así, al
// REGISTRAR un proceso nuevo (o cambiar un radicado) no hay que leer la columna completa de radicados de 01
// (con 20.000 procesos eran 60.000 celdas en cada registro). Se arma con la precarga y se mantiene con cada guardado.
// Si un grupo falta o no está completo, se lee la columna como antes (nunca se omite la verificación).
const RADIC_ = { prefix: 'APP_RADIC_V1_', buckets: 64, seconds: 21600 };
function radicadoKey_(version, radicado) { return RADIC_.prefix + version + '_' + (rowHintBucket_('R' + radicado) % RADIC_.buckets); }
// Pares [radicado, id] de 01 (el primero no eliminado de cada radicado, como apiRadicadoOwnerRead_).
function radicadoIndexBuckets_(pairs, version) {
  const buckets = {};
  for (let bucket = 0; bucket < RADIC_.buckets; bucket++) buckets[RADIC_.prefix + version + '_' + bucket] = { t: 0, full: true, r: {} };
  pairs.forEach(([radicado, id, deleted]) => {
    if (!radicado || deleted) return;
    const bucket = buckets[radicadoKey_(version, radicado)];
    if (!(radicado in bucket.r)) bucket.r[radicado] = id;
  });
  return buckets;
}
// Después de escribir: radicados nuevos al índice; un radicado que cambió o se eliminó deja su grupo «incompleto»
// (el próximo registro de ese grupo lee la columna y la precarga lo rearma).
function radicadoIndexAfterSave_(version, changes) {
  if (!changes.length) return;
  try {
    version = version || dataVersion_();
    const keys = [...new Set([].concat(...changes.map(change => [change.radicado, change.previous].filter(Boolean).map(radicado => radicadoKey_(version, radicado)))))];
    if (!keys.length) return;
    cachePreload_(keys);
    const buckets = {};
    keys.forEach(key => { const value = groupJson_(cacheGet_(key), null); if (value && value.r) buckets[key] = value; });
    const touched = {};
    changes.forEach(change => {
      if (change.previous && change.previous !== change.radicado) {
        const key = radicadoKey_(version, change.previous), bucket = buckets[key];
        if (bucket && bucket.r[change.previous] === change.id) { delete bucket.r[change.previous]; bucket.full = false; touched[key] = bucket; }
      }
      if (change.radicado && !change.deleted) {
        const key = radicadoKey_(version, change.radicado), bucket = buckets[key];
        if (bucket && !(change.radicado in bucket.r)) { bucket.r[change.radicado] = change.id; touched[key] = bucket; }
      }
    });
    const values = {};
    Object.keys(touched).forEach(key => { touched[key].t = Date.now(); const text = JSON.stringify(touched[key]); if (text.length < 95000) values[key] = text; });
    if (Object.keys(values).length) cachePutAll_(values, RADIC_.seconds);
    const big = Object.keys(touched).filter(key => !(key in values));
    if (big.length) CacheService.getScriptCache().removeAll(big);
  } catch (error) {
    console.warn('No se pudo actualizar el índice de radicados (se leerá la columna).', error);
  }
}
function radicadoChangesFromPlans_(plans) {
  return plans.map(plan => ({ id: String(plan.process.id), radicado: String(plan.process.radicado || '').trim(),
    previous: plan.previous ? String(plan.previous.radicado || '').trim() : '', deleted: plan.process.recordStatus === 'ELIMINADO' }));
}

function rowHintsWriteAll_(store, version, startedAt) {
  const tables = Object.keys(ROW_HINTS_.letters);
  const buckets = {};
  // Todos los grupos, aunque queden vacíos: «full» = tiene TODOS los procesos de su grupo (un ID que no esté
  // en un grupo completo es un proceso nuevo y no hace falta buscarlo en la hoja).
  for (let bucket = 0; bucket < ROW_HINTS_.buckets; bucket++) buckets[rowHintKey_(version, bucket)] = { t: 0, full: true, ids: {} };
  tables.forEach(tabla => {
    const letter = ROW_HINTS_.letters[tabla];
    const column = tabla === 'procesos' ? 0 : 1;
    (store.rows[tabla] || []).forEach((row, index) => {
      const id = esqTextoCelda_(row[column]);
      if (!id || (!store.existing.has(id) && !store.deleted.has(id))) return;
      const key = rowHintKey_(version, rowHintBucket_(id));
      const bucket = buckets[key];
      const entry = bucket.ids[id] = bucket.ids[id] || { p: [], a: [], s: [], q: [] };
      entry[letter].push(index + 2);
    });
  });
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false; // muy ocupado: los guardados las buscan y las van guardando
  try {
    if (groupWriterActive_()) return false; // una tanda de guardados está escribiendo: las suyas quedan al día
    const cache = CacheService.getScriptCache();
    const keys = Object.keys(buckets);
    const current = cache.getAll(keys) || {};
    const values = {};
    keys.forEach(key => {
      let previous = null;
      try { previous = JSON.parse(current[key] || 'null'); } catch (error) { previous = null; }
      if (previous && Number(previous.t) >= startedAt) return; // un guardado lo actualizó durante la lectura
      buckets[key].t = startedAt - 1;
      const text = JSON.stringify(buckets[key]);
      if (text.length < ROW_HINTS_.maxBytes) values[key] = text;
    });
    // Tamaño de cada tabla (última fila con datos) para el guardado por la API de Sheets.
    let geometry = null;
    try { geometry = JSON.parse(current[geometryKey_(version)] || cache.get(geometryKey_(version)) || 'null'); } catch (error) { geometry = null; }
    if (!geometry || Number(geometry.t) < startedAt) {
      const tablesGeo = {};
      STORE_TABLES.forEach(tabla => { tablesGeo[tabla] = { last: (store.rows[tabla] || []).length + 1 }; });
      values[geometryKey_(version)] = JSON.stringify({ t: startedAt - 1, tables: tablesGeo });
    }
    // Índice de radicados (con lo que se leyó de 01).
    const pairs = store.radicadoPairs || (store.rows.procesos || []).map(row => [esqTextoCelda_(row[esqIndice_('procesos', 'RADICADO')]).trim(),
      esqTextoCelda_(row[0]), String(row[esqIndice_('procesos', 'ESTADO_REGISTRO')] || '') === 'ELIMINADO']);
    if (pairs.length && pairs.some(pair => pair[0])) {
      const radicados = radicadoIndexBuckets_(pairs, version);
      const radicadoKeys = Object.keys(radicados);
      const currentRadicados = cache.getAll(radicadoKeys) || {};
      radicadoKeys.forEach(key => {
        const previous = groupJson_(currentRadicados[key], null);
        if (previous && Number(previous.t) >= startedAt) return; // un guardado lo actualizó durante la lectura
        radicados[key].t = startedAt - 1;
        const text = JSON.stringify(radicados[key]);
        if (text.length < 95000) values[key] = text;
      });
    }
    const keysOut = Object.keys(values);
    for (let index = 0; index < keysOut.length; index += 16) {
      const part = {};
      keysOut.slice(index, index + 16).forEach(key => { part[key] = values[key]; });
      cache.putAll(part, ROW_HINTS_.seconds);
    }
    return true;
  } catch (error) {
    console.error('No se pudieron guardar las posiciones de las filas.', error);
    return false;
  } finally {
    lock.releaseLock();
  }
}

// Versión rápida para guardar pocos procesos: no se traen columnas completas. Cada fila se lee en la posición que
// se recuerda (y se confirma por ID); solo si no se conoce o no coincide se BUSCA (TextFinder). Un proceso nuevo
// solo se busca en 01. 07_AUDITORIA no se lee (solo se le agregan filas). Los radicados repetidos se buscan solo
// cuando el radicado es nuevo o cambia (findRadicadoOwner_).
function loadStoreForSave_(spreadsheet, ids, opciones) {
  const options = opciones || {};
  const wanted = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!wanted.length || wanted.length > 25) return loadStoreFor_(spreadsheet, wanted);
  const store = newStore_();
  store.fast = true;
  // Fresca al guardar: si BaseProcesos.gs acaba de cambiar la base, no se usan posiciones viejas. Para solo consultar
  // (historial, calidad) basta la de memoria: cada fila recordada se confirma por ID y no gasta cupo de la API.
  const version = options.consulta ? dataVersion_() : dataVersion_(true);
  cachePreload_([rulesLenientKey_(), catalogSetsKey_(), DELTA_.indexKey].concat(STORE_TABLES.map(schemaKey_), rowHintKeysFor_(version, wanted)));
  store.direct = rulesLenient_(spreadsheet);
  const buckets = rowHintBucketsFor_(version, wanted);
  store.hints = { version: version, ids: wanted, buckets: buckets };
  store.found = {};
  store.stats = { recordadas: 0, buscadas: 0 };
  const hintOf = id => { const bucket = buckets[rowHintKey_(version, rowHintBucket_(id))]; return bucket ? bucket.ids[id] || null : null; };
  const search = (sheet, tabla, id) => {
    store.stats.buscadas++;
    return sheet.getRange(tabla === 'procesos' ? 'A:A' : 'B:B').createTextFinder(id).matchEntireCell(true).findAll()
      .map(cell => cell.getRow()).filter(row => row > 1);
  };
  const known = new Set(); // procesos que existen en 01

  STORE_TABLES.forEach(tabla => {
    store.pending[tabla] = [];
    store.byId[tabla] = new Map();
    store.rows[tabla] = [];
    if (options.tables && options.tables.indexOf(tabla) < 0) return; // solo consulta: no se leen las demás tablas
    const sheet = requireDataSheet_(spreadsheet, tabla);
    const width = esqEncabezados_(tabla).length;
    store.sheets[tabla] = sheet;
    if (tabla === 'auditoria') {
      if (!options.withAudit) return;
      const found = new Set();
      wanted.forEach(id => search(sheet, tabla, id).forEach(row => found.add(row)));
      const numbers = [...found].sort((a, b) => a - b);
      store.rows[tabla] = readRowGroups_(sheet, numbers, width);
      store.rows[tabla].forEach((row, index) => store.byId[tabla].set(esqTextoCelda_(row[0]), numbers[index]));
      return;
    }
    const letter = ROW_HINTS_.letters[tabla];
    const column = tabla === 'procesos' ? 0 : 1;
    const plan = {};
    wanted.forEach(id => {
      const hint = hintOf(id);
      if (hint && Array.isArray(hint[letter])) { plan[id] = { rows: hint[letter], hinted: true }; store.stats.recordadas++; }
      else if (tabla === 'procesos' || known.has(id)) plan[id] = { rows: search(sheet, tabla, id), hinted: false };
      else plan[id] = { rows: [], hinted: false }; // proceso nuevo: no tiene filas en las demás hojas
    });
    const readAll = numbers => {
      const sorted = [...new Set(numbers)].sort((a, b) => a - b);
      const values = readRowGroups_(sheet, sorted, width);
      const map = new Map();
      sorted.forEach((row, index) => map.set(row, values[index]));
      return map;
    };
    const byRow = readAll([].concat(...wanted.map(id => plan[id].rows)));
    // Confirmación por ID: si alguna fila recordada ya no es de ese proceso, se busca de nuevo.
    const retry = wanted.filter(id => plan[id].hinted && plan[id].rows.some(row => !byRow.has(row) || esqTextoCelda_(byRow.get(row)[column]) !== id));
    retry.forEach(id => { plan[id] = { rows: search(sheet, tabla, id), hinted: false }; });
    if (retry.length) readAll([].concat(...retry.map(id => plan[id].rows))).forEach((row, number) => byRow.set(number, row));
    store.found[tabla] = {};
    const numbers = [];
    wanted.forEach(id => {
      const rows = plan[id].rows.filter(row => byRow.has(row) && esqTextoCelda_(byRow.get(row)[column]) === id);
      store.found[tabla][id] = rows;
      rows.forEach(row => numbers.push(row));
      if (tabla === 'procesos' && rows.length) known.add(id);
    });
    [...new Set(numbers)].sort((a, b) => a - b).forEach(number => {
      const row = byRow.get(number);
      store.rows[tabla].push(row);
      store.byId[tabla].set(esqTextoCelda_(row[0]), number);
    });
  });
  return assembleStore_(store);
}

// ==== Guardado por la API de Sheets (servicio avanzado «Google Sheets API») ====
// En vez de abrir el archivo (SpreadsheetApp.openById) y hacer un viaje por cada hoja, el guardado hace DOS llamadas:
//   1) Sheets.Spreadsheets.get: en una sola lectura trae la versión de datos que marca BaseProcesos.gs, el tamaño de
//      cada hoja y las filas del proceso (en las posiciones que se recuerdan) más las filas vacías donde irán las nuevas.
//   2) Sheets.Spreadsheets.Values.batchUpdate: escribe en 01, 02, 03, 06 y 07 en una sola llamada.
// Todo se confirma antes de escribir (ID de cada fila, filas nuevas vacías, versión de datos). Si algo no cuadra
// —servicio no activado, caché vacía, base cambiada por BaseProcesos.gs, una fila que se movió— se usa el guardado
// normal con SpreadsheetApp, que sigue funcionando igual.
const API_SAVE_ = { geometryPrefix: 'APP_TABLAS_V1_', window: 20, seconds: 21600 };

function geometryKey_(version) { return API_SAVE_.geometryPrefix + version; }

function sheetsApiAvailable_() {
  try { return typeof Sheets !== 'undefined' && !!Sheets.Spreadsheets && !!Sheets.Spreadsheets.Values; } catch (error) { return false; }
}

function columnLetter_(number) {
  let text = '';
  for (let n = number; n > 0; n = Math.floor((n - 1) / 26)) text = String.fromCharCode(65 + (n - 1) % 26) + text;
  return text;
}

function apiRange_(tabla, fromRow, toRow, fromColumn, toColumn) {
  const width = esqEncabezados_(tabla).length;
  return "'" + ESQUEMA[tabla].hoja.replace(/'/g, "''") + "'!" + columnLetter_(fromColumn || 1) + fromRow + ':' + columnLetter_(toColumn || width) + toRow;
}

// Valor que devuelve la API (effectiveValue) -> el mismo valor que daría getValues() para esa columna.
function apiCellValue_(tipo, cell) {
  const value = cell && cell.effectiveValue;
  if (!value) return '';
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.boolValue !== undefined) return value.boolValue;
  if (value.numberValue !== undefined) {
    if (tipo !== 'date') return value.numberValue;
    // Número de serie de Sheets (días desde 1899-12-30) -> AAAA-MM-DD.
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value.numberValue * 86400000));
    return date.toISOString().slice(0, 10);
  }
  return '';
}

// Valor de la aplicación -> lo que se escribe con valueInputOption USER_ENTERED (igual que setValues).
function apiWriteValue_(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, ZONA_HORARIA_, 'yyyy-MM-dd');
  return value === null || value === undefined ? '' : value;
}

function readGeometry_(version) {
  try { return JSON.parse(cacheGet_(geometryKey_(version)) || 'null'); } catch (error) { return null; }
}

// Con el bloqueo tomado, tras añadir filas con SpreadsheetApp: se actualiza (o se crea) el tamaño de cada tabla.
function geometryAfterAppend_(store, appended) {
  try {
    const version = store.hints.version;
    let geometry = readGeometry_(version);
    if (!geometry || !geometry.tables) {
      geometry = { tables: {} };
      STORE_TABLES.forEach(tabla => { geometry.tables[tabla] = { last: store.sheets[tabla].getLastRow() }; });
    }
    Object.keys(appended).forEach(tabla => {
      const rows = appended[tabla];
      if (rows.length) geometry.tables[tabla] = { last: rows[rows.length - 1].row };
    });
    geometry.t = Date.now();
    cachePut_(geometryKey_(version), JSON.stringify(geometry), API_SAVE_.seconds);
  } catch (error) { console.error('No se pudo guardar el tamaño de las tablas.', error); }
}

// Arma el almacén del guardado con UNA lectura de la API. Devuelve null si hay que usar el guardado normal.
function loadStoreForSaveApi_(ids, records) {
  const wanted = [...new Set((ids || []).filter(Boolean).map(String))];
  if (!wanted.length || wanted.length > 25 || !sheetsApiAvailable_()) return null;
  const version = dataVersion_();
  cachePreload_([rulesLenientKey_(), catalogSetsKey_(), DELTA_.indexKey, geometryKey_(version), API_PAUSE_.key]
    .concat(STORE_TABLES.map(schemaKey_), rowHintKeysFor_(version, wanted)));
  if (apiPaused_()) return null; // cupo por minuto agotado: camino normal hasta que se libere
  if (STORE_TABLES.some(tabla => !cacheGet_(schemaKey_(tabla)))) return null; // encabezados sin confirmar
  if (cacheGet_(rulesLenientKey_()) !== '1') return null;                     // listas que rechazan: guardado normal
  if (!cacheGet_(catalogSetsKey_())) return null;
  const geometry = readGeometry_(version);
  if (!geometry || !geometry.tables || STORE_TABLES.some(tabla => !geometry.tables[tabla])) return null;
  const buckets = rowHintBucketsFor_(version, wanted);
  const hints = {};
  for (let index = 0; index < wanted.length; index++) {
    const id = wanted[index];
    const bucket = buckets[rowHintKey_(version, rowHintBucket_(id))];
    if (bucket && bucket.ids[id]) hints[id] = bucket.ids[id];
    else if (bucket && bucket.full) hints[id] = null; // no existe: proceso nuevo
    else return null;                                  // posición desconocida: el guardado normal la busca
  }
  // Radicados de 01 solo si hay un proceso nuevo o un radicado que cambió. Primero el índice en memoria (los grupos
  // de esos radicados); si alguno falta o está incompleto, se lee la columna como siempre.
  const byId = new Map((records || []).filter(Boolean).map(record => [String(record.id), record]));
  const checkIds = wanted.filter(id => !hints[id] || !byId.get(id) || !byId.get(id).baseValues || 'radicado' in byId.get(id).baseValues);
  let needRadicados = checkIds.length > 0;
  let indexedOwners = null;
  if (needRadicados) {
    const radicados = checkIds.map(id => String((byId.get(id) || {}).radicado || '').trim()).filter(Boolean);
    const keys = [...new Set(radicados.map(radicado => radicadoKey_(version, radicado)))];
    cachePreload_(keys);
    const buckets = keys.map(key => groupJson_(cacheGet_(key), null));
    if (buckets.every(bucket => bucket && bucket.full && bucket.r)) {
      indexedOwners = new Map();
      radicados.forEach(radicado => { const owner = buckets[keys.indexOf(radicadoKey_(version, radicado))].r[radicado]; if (owner) indexedOwners.set(radicado, owner); });
      needRadicados = false;
    }
  }

  const ranges = [];
  const groups = (tabla, numbers) => {
    const sorted = [...new Set(numbers)].sort((a, b) => a - b);
    for (let index = 0; index < sorted.length;) {
      let end = index;
      while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end++;
      ranges.push(apiRange_(tabla, sorted[index], sorted[end]));
      index = end + 1;
    }
  };
  Object.keys(ROW_HINTS_.letters).forEach(tabla => {
    const letter = ROW_HINTS_.letters[tabla];
    groups(tabla, [].concat(...wanted.map(id => hints[id] ? hints[id][letter] || [] : [])));
  });
  // Última fila con datos + las siguientes (deben estar vacías: ahí van las filas nuevas).
  STORE_TABLES.forEach(tabla => {
    const last = Math.max(1, Number(geometry.tables[tabla].last) || 1);
    ranges.push(apiRange_(tabla, last, last + API_SAVE_.window));
  });
  const columns = ['ID_PROCESO', 'RADICADO', 'ESTADO_REGISTRO'].map(header => esqIndice_('procesos', header) + 1);
  const lastProcess = Math.max(2, Number(geometry.tables.procesos.last) || 2);
  if (needRadicados) columns.forEach(column => ranges.push(apiRange_('procesos', 2, lastProcess, column, column)));

  const spreadsheetId = getDataSpreadsheetId_();
  const response = Sheets.Spreadsheets.get(spreadsheetId, {
    ranges: ranges,
    fields: 'developerMetadata(metadataKey,metadataValue),sheets(properties(sheetId,title,gridProperties(rowCount)),data(startRow,startColumn,rowData(values(effectiveValue))))'
  });

  // ¿BaseProcesos.gs cambió la base? Entonces las posiciones no sirven: guardado normal (y versión al día).
  const marker = (response.developerMetadata || []).find(item => item.metadataKey === DATA_VERSION_.metadataKey);
  const currentVersion = marker ? String(marker.metadataValue || '0') : '0';
  if (currentVersion !== version) { try { cachePut_(DATA_VERSION_.cacheKey, currentVersion, DATA_VERSION_.seconds); } catch (error) { /* sin caché */ } return null; }

  // Celdas leídas por hoja: fila -> columna -> valor.
  const tableOf = {};
  STORE_TABLES.forEach(tabla => { tableOf[ESQUEMA[tabla].hoja] = tabla; });
  const cells = {};
  const maxRows = {};
  const sheetIds = {};
  (response.sheets || []).forEach(sheet => {
    const tabla = tableOf[sheet.properties.title];
    if (!tabla) return;
    sheetIds[tabla] = sheet.properties.sheetId;
    maxRows[tabla] = Number(sheet.properties.gridProperties && sheet.properties.gridProperties.rowCount) || 0;
    const tipos = ESQUEMA[tabla].columnas.map(col => col[2]);
    const map = cells[tabla] = cells[tabla] || new Map();
    (sheet.data || []).forEach(grid => {
      const startRow = (grid.startRow || 0) + 1;
      const startColumn = grid.startColumn || 0;
      (grid.rowData || []).forEach((rowData, r) => {
        const row = map.get(startRow + r) || [];
        (rowData.values || []).forEach((cell, c) => { row[startColumn + c] = apiCellValue_(tipos[startColumn + c], cell); });
        map.set(startRow + r, row);
      });
    });
  });
  const rowAt = (tabla, number) => {
    const width = esqEncabezados_(tabla).length;
    const raw = (cells[tabla] && cells[tabla].get(number)) || [];
    return Array.from({ length: width }, (unused, index) => raw[index] === undefined ? '' : raw[index]);
  };
  const isEmpty = row => row.every(value => value === '' || value === null || value === undefined);

  // Filas nuevas: la última fila conocida debe tener datos y las siguientes estar vacías.
  for (let index = 0; index < STORE_TABLES.length; index++) {
    const tabla = STORE_TABLES[index];
    const last = Math.max(1, Number(geometry.tables[tabla].last) || 1);
    const lastOk = last === 1 || !isEmpty(rowAt(tabla, last));
    let nextOk = true;
    for (let row = last + 1; row <= last + API_SAVE_.window; row++) if (!isEmpty(rowAt(tabla, row))) { nextOk = false; break; }
    if (!lastOk || !nextOk) { try { CacheService.getScriptCache().remove(geometryKey_(version)); } catch (error) { /* */ } return null; }
  }

  const store = newStore_();
  store.fast = true;
  store.direct = true;
  store.api = { spreadsheetId: spreadsheetId, geometry: geometry, maxRows: maxRows, sheetIds: sheetIds, writes: [], version: version };
  store.hints = { version: version, ids: wanted, buckets: buckets };
  store.found = {};
  store.stats = { recordadas: 0, buscadas: 0 };
  if (indexedOwners) store.api.radicados = indexedOwners;
  if (needRadicados) {
    const owners = new Map();
    for (let row = 2; row <= lastProcess; row++) {
      const raw = cells.procesos.get(row) || [];
      const radicado = esqTextoCelda_(raw[columns[1] - 1]);
      if (radicado && !owners.has(radicado) && String(raw[columns[2] - 1] || '') !== 'ELIMINADO') owners.set(radicado, esqTextoCelda_(raw[columns[0] - 1]));
    }
    store.api.radicados = owners;
  }
  STORE_TABLES.forEach(tabla => {
    store.sheets[tabla] = null; // no se abre el archivo
    store.pending[tabla] = [];
    store.byId[tabla] = new Map();
    store.rows[tabla] = [];
  });
  let mismatch = false;
  Object.keys(ROW_HINTS_.letters).forEach(tabla => {
    const letter = ROW_HINTS_.letters[tabla];
    const column = tabla === 'procesos' ? 0 : 1;
    store.found[tabla] = {};
    const numbers = [];
    wanted.forEach(id => {
      const rows = hints[id] ? hints[id][letter] || [] : [];
      store.stats.recordadas += hints[id] ? 1 : 0;
      rows.forEach(number => { if (esqTextoCelda_(rowAt(tabla, number)[column]) !== id) mismatch = true; });
      store.found[tabla][id] = rows.slice();
      rows.forEach(number => numbers.push(number));
    });
    [...new Set(numbers)].sort((a, b) => a - b).forEach(number => {
      const row = rowAt(tabla, number);
      store.rows[tabla].push(row);
      store.byId[tabla].set(esqTextoCelda_(row[0]), number);
    });
  });
  if (mismatch) return null; // alguna fila se movió: el guardado normal la busca y recuerda la nueva posición
  return assembleStore_(store);
}

// Cupo de la API de Sheets: la app se ejecuta con la cuenta del propietario, así que TODAS las personas comparten
// su cupo (60 lecturas y 60 escrituras por minuto). Si Google responde que se agotó, la API se pausa 60 s para
// todos: los guardados van directo por el camino normal en vez de gastar tiempo (y turno) en intentos rechazados.
const API_PAUSE_ = { key: 'APP_API_PAUSA', seconds: 60 };
function apiQuotaError_(error) {
  return /\b429\b|quota|cuota|rate.?limit|too many requests|RESOURCE_EXHAUSTED/i.test(String(error && error.message || error));
}
function apiPaused_() { try { return cacheGet_(API_PAUSE_.key) === '1'; } catch (error) { return false; } }
function apiPause_(error) {
  if (!apiQuotaError_(error)) return;
  try { CacheService.getScriptCache().put(API_PAUSE_.key, '1', API_PAUSE_.seconds); if (cacheMemo_) cacheMemo_[API_PAUSE_.key] = '1'; } catch (e) { /* */ }
  console.warn('Cupo por minuto de la API de Sheets agotado: se pausa 60 s y se guarda por el camino normal.');
}

function apiFallbackError_(error) {
  apiPause_(error);
  const wrapped = new Error('API_FALLBACK: ' + (error && error.message ? error.message : error));
  wrapped.apiFallback = true;
  return wrapped;
}

function apiRadicadoOwner_(store, radicado) {
  try { return apiRadicadoOwnerRead_(store, radicado); } catch (error) { throw apiFallbackError_(error); }
}
function apiRadicadoOwnerRead_(store, radicado) {
  if (!store.api.radicados) {
    // Se cambió un radicado sin indicarlo en baseValues: lectura de las tres columnas.
    const columns = ['ID_PROCESO', 'RADICADO', 'ESTADO_REGISTRO'].map(header => esqIndice_('procesos', header) + 1);
    const last = Math.max(2, Number(store.api.geometry.tables.procesos.last) || 2);
    const result = Sheets.Spreadsheets.Values.batchGet(store.api.spreadsheetId, {
      ranges: columns.map(column => apiRange_('procesos', 2, last, column, column)), valueRenderOption: 'UNFORMATTED_VALUE' });
    const values = (result.valueRanges || []).map(range => range.values || []);
    const owners = new Map();
    for (let index = 0; index < last - 1; index++) {
      const radicadoValue = String(((values[1] || [])[index] || [])[0] || '');
      const status = String(((values[2] || [])[index] || [])[0] || '');
      if (radicadoValue && !owners.has(radicadoValue) && status !== 'ELIMINADO') owners.set(radicadoValue, String(((values[0] || [])[index] || [])[0] || ''));
    }
    store.api.radicados = owners;
  }
  return store.api.radicados.get(radicado) || '';
}

// Escribe TODO el guardado en una sola llamada (filas existentes + filas nuevas al final de cada hoja).
// Filas libres al final de cada tabla. El activador las mantiene (cada 10 minutos, fuera de los guardados) para
// que ningún guardado tenga que agrandar la hoja; si aun así se llena, el guardado la crece por la API.
const GROW_ = { inSave: 1000, reserve: { procesos: 600, actuaciones: 2000, asignaciones: 600, auditoria: 5000, pendientes: 600 } };

// Agrega filas al final de una tabla y les deja el formato de cada columna (texto, fecha o número).
function apiGrowRequests_(tabla, sheetId, firstNewRow, extra) {
  const requests = [{ appendDimension: { sheetId: sheetId, dimension: 'ROWS', length: extra } }];
  const formats = esqFormatosFila_(tabla);
  const type = format => format === '@' ? 'TEXT' : format === '0' ? 'NUMBER' : 'DATE';
  for (let from = 0; from < formats.length;) {
    let to = from;
    while (to + 1 < formats.length && formats[to + 1] === formats[from]) to++;
    requests.push({ repeatCell: {
      range: { sheetId: sheetId, startRowIndex: firstNewRow - 1, endRowIndex: firstNewRow - 1 + extra, startColumnIndex: from, endColumnIndex: to + 1 },
      cell: { userEnteredFormat: { numberFormat: { type: type(formats[from]), pattern: formats[from] } } },
      fields: 'userEnteredFormat.numberFormat' } });
    from = to + 1;
  }
  return requests;
}

// Activador: deja filas libres (con formato) al final de cada tabla. No necesita turno: agregar filas vacías
// no estorba a quien esté guardando.
function ensureFreeRows_() {
  if (!sheetsApiAvailable_()) return 0;
  const geometry = readGeometry_(dataVersion_());
  if (!geometry || !geometry.tables) return 0;
  const id = getDataSpreadsheetId_();
  const info = Sheets.Spreadsheets.get(id, { fields: 'sheets(properties(sheetId,title,gridProperties(rowCount)))' });
  const requests = [];
  let added = 0;
  STORE_TABLES.forEach(tabla => {
    const sheet = (info.sheets || []).find(item => item.properties && item.properties.title === ESQUEMA[tabla].hoja);
    const last = geometry.tables[tabla] ? Number(geometry.tables[tabla].last) : 0;
    if (!sheet || !last) return;
    const rowCount = Number(sheet.properties.gridProperties && sheet.properties.gridProperties.rowCount) || 0;
    const reserve = GROW_.reserve[tabla] || 600;
    if (!rowCount || rowCount - last >= reserve / 2) return;
    const extra = last + reserve - rowCount;
    requests.push.apply(requests, apiGrowRequests_(tabla, sheet.properties.sheetId, rowCount + 1, extra));
    added += extra;
  });
  if (requests.length) Sheets.Spreadsheets.batchUpdate({ requests: requests }, id);
  return added;
}

function apiFlush_(store) {
  const api = store.api;
  const data = api.writes.map(write => ({ range: apiRange_(write.tabla, write.row, write.row), values: [write.values.map(apiWriteValue_)] }));
  const appended = {};
  const grow = [];
  const geometry = JSON.parse(JSON.stringify(api.geometry));
  Object.keys(store.pending).forEach(tabla => {
    const rows = store.pending[tabla];
    if (!rows.length) return;
    const start = Number(geometry.tables[tabla].last) + 1;
    const end = start + rows.length - 1;
    const verifiedUntil = api.windowEnd ? api.windowEnd[tabla] : Number(api.geometry.tables[tabla].last) + API_SAVE_.window;
    if (end > verifiedUntil) {
      // Más filas nuevas que las verificadas vacías: se confirma el resto antes de escribir.
      const check = Sheets.Spreadsheets.Values.get(api.spreadsheetId, apiRange_(tabla, Math.max(start, verifiedUntil + 1), end), { valueRenderOption: 'UNFORMATTED_VALUE' });
      if ((check.values || []).some(row => row.some(value => value !== '' && value !== null))) throw new Error('API_FALLBACK');
    }
    if (end > (api.maxRows[tabla] || 0)) {
      // La hoja se llenó (caso raro: el activador mantiene filas libres): se crece por la API, con reserva y formato.
      const maxRows = Number(api.maxRows[tabla]) || 0;
      const sheetId = api.sheetIds ? api.sheetIds[tabla] : null;
      if (!maxRows || sheetId === null || sheetId === undefined) throw new Error('API_FALLBACK');
      grow.push.apply(grow, apiGrowRequests_(tabla, sheetId, maxRows + 1, end - maxRows + GROW_.inSave));
    }
    data.push({ range: apiRange_(tabla, start, end), values: rows.map(row => row.map(apiWriteValue_)) });
    appended[tabla] = rows.map((values, index) => ({ values: values, row: start + index }));
    geometry.tables[tabla] = { last: end };
  });
  if (grow.length) Sheets.Spreadsheets.batchUpdate({ requests: grow }, api.spreadsheetId);
  if (data.length) Sheets.Spreadsheets.Values.batchUpdate({ valueInputOption: 'USER_ENTERED', data: data }, api.spreadsheetId);
  geometry.t = Date.now();
  try { cachePut_(geometryKey_(api.version), JSON.stringify(geometry), API_SAVE_.seconds); } catch (error) { console.error(error); }
  rowHintsWrite_(store, appended);
}

// Dueño de un radicado en 01_PROCESOS (sin leer la hoja completa). '' si nadie lo tiene.
function findRadicadoOwner_(store, radicado) {
  if (!store.fast) return store.radicados.get(radicado) || '';
  if (store.api) return apiRadicadoOwner_(store, radicado);
  const sheet = store.sheets.procesos;
  const column = esqIndice_('procesos', 'RADICADO') + 1;
  const status = esqIndice_('procesos', 'ESTADO_REGISTRO') + 1;
  const cells = sheet.getRange(1, column, Math.max(sheet.getMaxRows(), 1), 1).createTextFinder(radicado).matchEntireCell(true).findAll()
    .filter(cell => cell.getRow() > 1);
  for (let index = 0; index < cells.length; index++) {
    const row = cells[index].getRow();
    const id = esqTextoCelda_(sheet.getRange(row, 1).getValue());
    if (String(sheet.getRange(row, status).getValue()) !== 'ELIMINADO') return id;
  }
  return '';
}

// Filas de 07_AUDITORIA de un proceso, solo cuando hacen falta (cierres de calidad ya hechos).
function auditRowsFor_(store, id) {
  if (!store.fast) return (store.rows.auditoria || []).map(row => esqFilaAObjeto_('auditoria', row));
  if (!store.auditCache) store.auditCache = new Map();
  if (store.auditCache.has(id)) return store.auditCache.get(id);
  // Con la API (caso poco frecuente: cierres de calidad) se abre el archivo solo para esta búsqueda.
  const sheet = store.sheets.auditoria || (store.sheets.auditoria = requireDataSheet_(getDataSpreadsheet_(), 'auditoria'));
  const rowNumbers = sheet.getRange('B:B').createTextFinder(id).matchEntireCell(true).findAll().map(cell => cell.getRow()).filter(row => row > 1).sort((a, b) => a - b);
  const rows = readRowGroups_(sheet, rowNumbers, esqEncabezados_('auditoria').length).map(row => esqFilaAObjeto_('auditoria', row));
  store.auditCache.set(id, rows);
  return rows;
}

// ¿Las listas de la base solo ADVIERTEN (no rechazan) los valores fuera de lista? Así lo deja BaseProcesos.gs
// desde esta versión: la app escribe directo, sin quitar y poner reglas (mucho más rápido). Se consulta una vez
// por versión de datos.
function rulesLenientKey_() { return 'APP_RULES_LENIENT_' + dataVersion_(); }
function rulesLenient_(spreadsheet) {
  const key = rulesLenientKey_();
  const cached = cacheGet_(key);
  if (cached !== null && cached !== undefined) return cached === '1';
  let lenient = false;
  try {
    const sheet = (spreadsheet || getDataSpreadsheet_()).getSheetByName(ESQUEMA.procesos.hoja);
    const columns = ['DESPACHO_INICIAL', 'ESTADO', 'FECHA_NOTIFICACION'].map(header => esqIndice_('procesos', header)).filter(index => index >= 0);
    lenient = columns.every(index => {
      const rule = sheet.getRange(2, index + 1).getDataValidation();
      return !rule || rule.getAllowInvalid();
    });
  } catch (error) { lenient = false; }
  try { cachePut_(key, lenient ? '1' : '0', 21600); } catch (error) { /* sin caché */ }
  return lenient;
}

function assembleStore_(store) {
  store.rows.procesos.forEach(row => {
    const process = esqFilaAObjeto_('procesos', row);
    if (!process.id) return;
    if (process.recordStatus === 'ELIMINADO') { store.deleted.add(process.id); return; }
    process.notificationYear = String(process.notificationDate || '').slice(0, 4);
    process.hearings = [];
    process.committees = [];
    process.actions = [];
    process.audit = [];
    process.assignments = [];
    store.existing.set(process.id, process);
    if (process.radicado) store.radicados.set(process.radicado, process.id);
  });
  store.rows.actuaciones.forEach(row => {
    const record = esqFilaAObjeto_('actuaciones', row);
    const process = store.existing.get(record.processId);
    if (!process) return;
    if (record.clase === 'DILIGENCIA') process.hearings.push(hearingFromRecord_(record));
    else if (record.clase === 'COMITE') process.committees.push(committeeFromRecord_(record));
    else process.actions.push(actionFromRecord_(record));
  });
  store.rows.asignaciones.forEach(row => {
    const record = esqFilaAObjeto_('asignaciones', row);
    const process = store.existing.get(record.processId);
    if (process) process.assignments.push(record);
  });
  const auditRecords = [];
  store.rows.auditoria.forEach(row => {
    const record = esqFilaAObjeto_('auditoria', row);
    auditRecords.push(record);
    const process = store.existing.get(record.processId);
    if (process) process.audit.push(stripAudit_(record));
  });
  // Obligatorios marcados «No aplica» por el administrador: no se piden en el formulario.
  const exempt = esqExentosObligatorios_(auditRecords);
  exempt.forEach((keys, processId) => { const process = store.existing.get(processId); if (process) process.exemptFields = [...keys]; });
  return store;
}

// Actualiza una fila existente o la deja pendiente para añadirla en bloque.
function writeRow_(store, tabla, id, values) {
  const rowNumber = store.byId[tabla].get(String(id));
  if (rowNumber > 0 && store.api) {
    store.api.writes.push({ tabla: tabla, row: rowNumber, values: values });
  } else if (rowNumber > 0) {
    esqEscribirValores_(store.sheets[tabla].getRange(rowNumber, 1, 1, values.length), [values], { directo: !!store.direct });
  } else {
    store.pending[tabla].push(values);
    store.byId[tabla].set(String(id), -1);
  }
}

function flushStore_(store) {
  if (store.api) return apiFlush_(store);
  const appended = {};
  Object.keys(store.pending).forEach(tabla => {
    const rows = store.pending[tabla];
    const start = appendRows_(store.sheets[tabla], tabla, rows, !!store.direct);
    if (start) appended[tabla] = rows.map((values, index) => ({ values: values, row: start + index }));
  });
  if (store.hints) { rowHintsWrite_(store, appended); geometryAfterAppend_(store, appended); }
  else if (Object.keys(appended).length) rowHintsForget_([...store.existing.keys()].concat(...Object.keys(appended).map(tabla =>
    appended[tabla].map(item => String(item.values[tabla === 'procesos' ? 0 : 1])))));
}

// Añade filas al final con el formato de cada columna (texto plano, fecha o número).
// Devuelve la fila donde quedó la primera. Con la base actual (BaseProcesos.gs deja el formato puesto en todas las
// filas de cada columna y las listas solo advierten) el formato no se vuelve a aplicar: es una llamada menos por hoja.
const APPEND_RESERVE_ROWS_ = 300;
function appendRows_(sheet, tabla, rows, direct) {
  if (!rows.length) return 0;
  const start = sheet.getLastRow() + 1;
  const end = start + rows.length - 1;
  const maxRows = sheet.getMaxRows();
  const formats = esqFormatosFila_(tabla);
  if (maxRows < end) {
    // La hoja está llena: se agregan filas de reserva (con su formato) para que los próximos guardados no
    // tengan que crecerla ni volver a aplicar el formato.
    const extra = end - maxRows + APPEND_RESERVE_ROWS_;
    sheet.insertRowsAfter(maxRows, extra);
    sheet.getRange(maxRows + 1, 1, extra, formats.length).setNumberFormats(Array.from({ length: extra }, () => formats));
  }
  const range = sheet.getRange(start, 1, rows.length, rows[0].length);
  if (!direct) range.setNumberFormats(rows.map(() => formats));
  esqEscribirValores_(range, rows, { directo: !!direct });
  return start;
}

// Diligencias y comités son un historial: se pueden agregar, pero no borrar ni cambiar.
function assertAppendOnly_(oldEntries, newEntries, label, comparable) {
  const nextById = new Map(newEntries.map(entry => [String(entry.id), JSON.stringify(comparable(entry))]));
  oldEntries.forEach(entry => {
    if (!nextById.has(String(entry.id)) || nextById.get(String(entry.id)) !== JSON.stringify(comparable(entry))) {
      throw new Error('El historial de ' + label + ' no se puede borrar ni modificar.');
    }
  });
}

function assertNoDeletion_(oldEntries, newEntries, label) {
  const ids = new Set(newEntries.map(entry => String(entry.id)));
  oldEntries.forEach(entry => {
    if (!ids.has(String(entry.id))) throw new Error('No se permite borrar ' + label + '.');
  });
}

// El reporte mensual por correo se retiró (no hace parte de la propuesta). Si quedó programado
// en una versión anterior, configurarHojas() borra ese activador.
function quitarActivadoresRetirados_() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'reporteMensualProcesosSinEdicion')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

// Ejecuta esta función desde el editor y revisa el registro: archivo usado, pestañas y encabezados.
// Estado del sistema para el administrador (botón «Estado del sistema» de la aplicación): confirma si el guardado
// rápido por la API de Sheets está en uso y cómo van los tiempos reales de los últimos guardados.
// Desde el editor de Apps Script: ejecuta «estadoDelSistema» y mira el resultado en el registro de ejecución.
function estadoDelSistema() {
  const owner = String(Session.getEffectiveUser().getEmail() || '');
  if (!owner || String(Session.getActiveUser().getEmail() || '') !== owner) throw new Error('Solo se puede ejecutar desde el editor de Apps Script.');
  const result = diagnosticoAplicacion_();
  const text = result.puntos.map(item => (item.ok === true ? '✓ ' : item.ok === false ? '✗ ' : '… ') + item.titulo + ': ' + item.detalle).join('\n') + '\n\n' + result.resumen;
  console.log(text);
  return text;
}
function diagnosticoAplicacion(sessionToken) {
  const user = requireApplicationUser_(sessionToken);
  if (user.rol !== ROLES.admin) throw new Error('Solo el administrador puede consultar el estado del sistema.');
  return diagnosticoAplicacion_();
}
// Para ejecutar desde el editor de Apps Script (Ejecutar ▸ revisarSistema): no pide sesión porque quien ejecuta es
// el dueño del proyecto. El resultado sale en el Registro de ejecución. diagnosticoAplicacion (con sesión) es la
// versión que usa la aplicación para el administrador.
function revisarSistema() {
  const resultado = diagnosticoAplicacion_();
  const marca = ok => ok === true ? 'OK      ' : ok === false ? 'FALTA   ' : 'REVISAR ';
  const lineas = resultado.puntos.map(punto => marca(punto.ok) + punto.titulo + ': ' + punto.detalle);
  if (resultado.resumen) lineas.push('', resultado.resumen);
  const texto = lineas.join('\n');
  console.log(texto);
  return texto;
}

function diagnosticoAplicacion_() {
  const puntos = [];
  const add = (ok, titulo, detalle) => puntos.push({ ok: ok, titulo: titulo, detalle: detalle });
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties().getProperties() || {};

  // 1. API de Sheets (servicio avanzado).
  let info = null;
  if (!sheetsApiAvailable_()) {
    add(false, 'API de Sheets', 'No está agregada al proyecto: los guardados van por el camino normal (más lento). En el editor: Servicios > + > Google Sheets API > Agregar, y publica una versión nueva.');
  } else {
    try {
      info = Sheets.Spreadsheets.get(getDataSpreadsheetId_(), { fields: 'sheets(properties(title,hidden,gridProperties(rowCount)))' });
      add(true, 'API de Sheets', 'Activa y con acceso a la base.');
    } catch (error) {
      add(false, 'API de Sheets', 'Está agregada pero no responde: ' + String(error.message || error).slice(0, 160));
    }
  }

  // 2. Lo que necesita el guardado rápido.
  let version = '0';
  try { version = dataVersion_(); } catch (error) { /* */ }
  const hintKeys = Array.from({ length: ROW_HINTS_.buckets }, (unused, bucket) => rowHintKey_(version, bucket));
  const keys = STORE_TABLES.map(schemaKey_).concat([rulesLenientKey_(), catalogSetsKey_(), geometryKey_(version), SNAPSHOT_.manifestKey, SAVE_STATS_.key, API_PAUSE_.key]);
  let found = {};
  try { found = Object.assign({}, cache.getAll(keys) || {}, cache.getAll(hintKeys) || {}); } catch (error) { found = {}; }
  let full = 0;
  hintKeys.forEach(key => { try { if (found[key] && JSON.parse(found[key]).full) full++; } catch (error) { /* */ } });
  const missing = [];
  if (STORE_TABLES.some(tabla => !found[schemaKey_(tabla)])) missing.push('encabezados sin confirmar');
  if (found[rulesLenientKey_()] !== '1') missing.push('las listas de la base rechazan valores (ejecuta «Aplicar validaciones» en la hoja)');
  if (!found[catalogSetsKey_()]) missing.push('catálogos sin cargar');
  if (!found[geometryKey_(version)]) missing.push('tamaño de las tablas sin recordar');
  if (full < ROW_HINTS_.buckets) missing.push('posiciones de filas recordadas: ' + full + ' de ' + ROW_HINTS_.buckets + ' grupos');
  if (found[API_PAUSE_.key] === '1') missing.push('cupo por minuto de la API agotado en este momento (se reanuda solo en menos de un minuto)');
  add(missing.length ? null : true, 'Guardado rápido', missing.length
    ? 'Preparándose (' + missing.join('; ') + '). Se completa solo con la siguiente carga o con el activador; mientras tanto se guarda por el camino normal.'
    : 'Listo: posiciones de filas y tamaño de tablas recordados.');

  // 3. Precarga y copia durable.
  add(found[SNAPSHOT_.manifestKey] ? true : null, 'Precarga en memoria',
    found[SNAPSHOT_.manifestKey] ? 'Lista (armada el ' + String(props[SNAPSHOT_.builtProperty] || '').replace('T', ' ').slice(0, 16) + ' UTC).' : 'Vacía: la próxima carga la recupera de la copia durable.');
  if (info) {
    const copy = (info.sheets || []).find(item => item.properties && item.properties.title === PERSIST_.sheet);
    add(copy ? true : null, 'Copia durable (' + PERSIST_.sheet + ')', copy ? 'Existe' + (copy.properties.hidden ? ' y está oculta.' : ' (visible: se oculta sola).') : 'Aún no existe: se crea sola al armar la precarga.');
    const tight = STORE_TABLES.filter(tabla => {
      const sheet = (info.sheets || []).find(item => item.properties && item.properties.title === ESQUEMA[tabla].hoja);
      let last = 0;
      try { last = Number(JSON.parse(found[geometryKey_(version)]).tables[tabla].last) || 0; } catch (error) { last = 0; }
      return sheet && last && Number(sheet.properties.gridProperties.rowCount) - last < 50;
    }).map(tabla => ESQUEMA[tabla].hoja);
    add(tight.length ? null : true, 'Filas libres en las tablas', tight.length ? 'Pocas en ' + tight.join(', ') + ': el activador las agrega (o el guardado, si hace falta).' : 'Suficientes.');
  }

  // 4. Activador automático.
  let trigger = null;
  try { trigger = ScriptApp.getProjectTriggers().some(item => item.getHandlerFunction() === 'precargarAplicacion'); } catch (error) { trigger = null; }
  add(trigger === true ? true : trigger === false ? false : null, 'Activador automático (cada 10 minutos)',
    trigger === true ? 'Instalado.' : trigger === false ? 'No está instalado: ejecuta programarPrecarga una vez desde el editor.' : 'No se pudo consultar.');

  // 5. Últimos guardados reales.
  let saves = [];
  try { saves = JSON.parse(found[SAVE_STATS_.key] || '[]') || []; } catch (error) { saves = []; }
  const median = list => { const sorted = list.slice().sort((a, b) => a - b); return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0; };
  const seconds = ms => (Math.round(ms / 100) / 10).toString().replace('.', ',') + ' s';
  let resumen = 'Aún no hay guardados recientes para medir (se muestran los de las últimas horas).';
  if (saves.length) {
    const byApi = saves.filter(item => item.via === 'api').length;
    const last = saves[saves.length - 1];
    resumen = 'Últimos ' + saves.length + ' guardados: ' + byApi + ' por la API de Sheets y ' + (saves.length - byApi) + ' por el camino normal. ' +
      'Tiempo típico: ' + seconds(median(saves.map(item => item.total))) + ' en total, ' + seconds(median(saves.map(item => item.espera))) + ' en cola y ' +
      seconds(median(saves.map(item => item.turno))) + ' escribiendo la tanda (en promedio ' + (Math.round(10 * saves.reduce((a, item) => a + (Number(item.tanda) || 1), 0) / saves.length) / 10).toString().replace('.', ',') + ' guardados por tanda). El más lento: ' + seconds(Math.max.apply(null, saves.map(item => item.total))) +
      '. Último: ' + (last.via === 'api' ? 'por la API' : 'camino normal') + ', ' + seconds(last.total) + '.';
    const lento = saves.slice().reverse().find(item => item.via !== 'api');
    add(byApi >= saves.length / 2 ? true : null, 'Uso real de la API al guardar', byApi + ' de ' + saves.length + ' guardados recientes.' +
      (lento ? ' El último por el camino normal fue el ' + new Date(lento.t).toLocaleString('es-CO', { timeZone: ZONA_HORARIA_ }) + (lento.motivo ? ' porque ' + lento.motivo : ' (sin motivo registrado: fue antes de esta versión)') + '.' : ''));
  }
  return { puntos: puntos, resumen: resumen, guardados: saves.slice(-10) };
}

function diagnosticoConexion() {
  const props = PropertiesService.getScriptProperties();
  const authProperty = props.getProperty(AUTH_CONFIG.spreadsheetIdProperty);
  const dataProperty = props.getProperty(AUTH_CONFIG.dataSpreadsheetIdProperty);
  const lines = [
    'Usuario que ejecuta: ' + Session.getActiveUser().getEmail(),
    '--- ARCHIVO DE ROLES ---',
    'Propiedad AUTH_SPREADSHEET_ID: ' + (authProperty || '(no definida)'),
    'ID que se usará: ' + getSpreadsheetId_(),
    '--- BASE DE PROCESOS ---',
    'Propiedad DATA_SPREADSHEET_ID: ' + (dataProperty || '(no definida)'),
    'ID que se usará: ' + getDataSpreadsheetId_()
  ];
  try {
    const auth = SpreadsheetApp.openById(getSpreadsheetId_());
    lines.push('Roles - archivo abierto: ' + auth.getName() + ' | pestañas: ' + auth.getSheets().map(sheet => sheet.getName()).join(', '));
    [AUTH_CONFIG.administratorsSheet, AUTH_CONFIG.intermediariesSheet, AUTH_CONFIG.legacyIntermediariesSheet, AUTH_CONFIG.lawyersSheet].forEach(name => {
      const sheet = auth.getSheetByName(name);
      lines.push('  ' + name + ': ' + (sheet ? (sheet.getLastRow() - 1) + ' fila(s) de usuarios' : 'no existe'));
    });
  } catch (error) {
    lines.push('ERROR al abrir el archivo de roles: ' + error.message);
  }
  try {
    const data = SpreadsheetApp.openById(getDataSpreadsheetId_());
    lines.push('Base - archivo abierto: ' + data.getName() + ' | pestañas: ' + data.getSheets().map(sheet => sheet.getName()).join(', '));
    DATA_TABLES.forEach(tabla => {
      const config = ESQUEMA[tabla];
      const sheet = data.getSheetByName(config.hoja);
      if (!sheet) { lines.push('  ' + config.hoja + ': NO EXISTE (menú Estandarización > Crear estructura en la base)'); return; }
      const headers = esqEncabezados_(tabla);
      const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
      const ok = headers.every((header, index) => current[index] === header);
      lines.push('  ' + config.hoja + ': ' + (ok ? (sheet.getLastRow() - 1) + ' fila(s), encabezados correctos' : 'ENCABEZADOS DISTINTOS -> ' + current.join(' | ')));
    });
    const directory = getDirectory_();
    const users = new Set(directory.lawyers.filter(user => user.activo).map(user => esqNormalizar_(user.nombre)));
    const missing = (loadCatalogsFrom_(data).lawyer || []).filter(name => !users.has(esqNormalizar_(name)));
    lines.push('--- ABOGADOS ---');
    lines.push(missing.length ? 'Abogados del catálogo sin usuario activo en ABOGADOS (no podrán ver sus procesos): ' + missing.join(', ') : 'Todos los abogados del catálogo tienen usuario en ABOGADOS.');
    const intermediaries = new Set(directory.intermediaries.filter(user => user.activo).map(user => user.correo));
    const orphan = directory.lawyers.filter(user => user.activo && user.intermediario && !intermediaries.has(user.intermediario));
    if (orphan.length) lines.push('Abogados con INTERMEDIARIO que no es un intermediario activo: ' + orphan.map(user => user.nombre + ' -> ' + user.intermediario).join(', '));
  } catch (error) {
    lines.push('ERROR al abrir la base: ' + error.message);
  }
  console.log(lines.join('\n'));
  return lines.join('\n');
}

// ============================================================================
// RENDIMIENTO: lectura dirigida, compresión y caché de la carga inicial
// ============================================================================

// Lee filas sueltas agrupando las consecutivas en un solo rango.
function readRowGroups_(sheet, rowNumbers, width) {
  const rows = [];
  let start = 0;
  let previous = 0;
  const flush = () => {
    if (!start) return;
    sheet.getRange(start, 1, previous - start + 1, width).getValues().forEach(row => rows.push(row));
  };
  rowNumbers.forEach(rowNumber => {
    if (start && rowNumber === previous + 1) { previous = rowNumber; return; }
    flush();
    start = rowNumber;
    previous = rowNumber;
  });
  flush();
  return rows;
}

const AUDIT_IN_APP_ = 15;
function buildVisibleRecords_(user, loadedStore) {
  const store = loadedStore || loadStore_(getDataSpreadsheet_());
  const records = [];
  store.existing.forEach(process => {
    if (user.rol === ROLES.lawyer && !lawyerCanSee_(process, user)) return;
    (process.actions || []).forEach(action => {
      delete action.processId; // el navegador lo vuelve a poner
      Object.keys(action).forEach(key => { if (action[key] === '') delete action[key]; });
    });
    Object.keys(process).forEach(key => { if (process[key] === '') delete process[key]; });
    // El historial completo está en 07_AUDITORIA; a la aplicación viajan los últimos cambios de cada proceso
    // (así la carga no crece sin límite con el uso).
    if (process.audit && process.audit.length > AUDIT_IN_APP_) process.audit = process.audit.slice(-AUDIT_IN_APP_);
    records.push(process);
  });
  return records;
}

function packRecords_(records) {
  const blob = Utilities.newBlob(JSON.stringify(records), 'application/json', 'procesos.json');
  return Utilities.base64Encode(Utilities.gzip(blob).getBytes());
}

function unpackRecords_(packed) {
  const blob = Utilities.newBlob(Utilities.base64Decode(packed), 'application/x-gzip');
  return JSON.parse(Utilities.ungzip(blob).getDataAsString());
}

// ---- Precarga de la aplicación y cambios en vivo ----
// Una foto de todo lo que necesita la pantalla inicial (procesos comprimidos, catálogos y calidad), guardada
// SOLO en la memoria de Apps Script (CacheService): sin archivos en Drive y sin nada en el navegador.
// El activador precargarAplicacion (cada 10 minutos) la mantiene siempre caliente; si la memoria la descarta,
// la primera persona que entra la rearma desde la hoja (una sola vez, los demás esperan esa misma).
// Con muchos usuarios a la vez, la foto NO se rearma en cada guardado: cada guardado publica solo lo que
// cambió (un "delta" pequeño en la caché) y cada navegador lo aplica encima de la foto. El delta se integra a la
// foto cada 10 minutos o cuando crece. La foto completa solo se rearma cuando:
//  - BaseProcesos.gs cambió los datos (migrar, depurar, validar...: marca VIGIA_VERSION_DATOS en el archivo);
//  - cambian los catálogos o se corre refrescarCacheAplicacion (cambia la "generación");
//  - la memoria descartó la foto o el delta.
const RECORDS_CACHE_ = { generationProperty: 'RECORDS_CACHE_GENERATION' };
const SNAPSHOT_ = { manifestKey: 'APP_SNAPSHOT_MANIFEST_V1', chunkPrefix: 'APP_SNAPSHOT_V1_', chunkSize: 90000, seconds: 21600,
  builtProperty: 'APP_SNAPSHOT_BUILT', buildingKey: 'APP_SNAPSHOT_BUILDING', buildingSeconds: 240 };
// La versión se confirma en cada guardado (viene en la misma lectura) y el activador la renueva cada 10 minutos.
const DATA_VERSION_ = { metadataKey: 'VIGIA_VERSION_DATOS', cacheKey: 'APP_DATA_VERSION', seconds: 900 };

function recordsCacheGeneration_() {
  return propGet_(RECORDS_CACHE_.generationProperty) || '0';
}

// Obliga a rearmar la foto completa (catálogos, refrescarCacheAplicacion o delta perdido).
function invalidateRecordsCache_() {
  try {
    propSet_(RECORDS_CACHE_.generationProperty, String(Date.now()));
  } catch (error) {
    console.error('No se pudo marcar la precarga como desactualizada.', error);
  }
}

// Versión de los datos que marca BaseProcesos.gs al migrar, depurar o validar (metadatos del archivo).
// Se consulta como mucho cada 60 segundos (caché); el activador la renueva.
function dataVersion_(force) {
  const cached = force ? null : cacheGet_(DATA_VERSION_.cacheKey);
  if (cached !== null && cached !== undefined) { if (cacheMemo_) cacheMemo_[DATA_VERSION_.cacheKey] = cached; return cached; } // una sola lectura por ejecución
  let value = null;
  if (sheetsApiAvailable_() && !apiPaused_()) {
    try { // sin abrir el archivo
      const head = Sheets.Spreadsheets.get(getDataSpreadsheetId_(), { fields: 'developerMetadata(metadataKey,metadataValue)' });
      const marker = (head.developerMetadata || []).find(item => item.metadataKey === DATA_VERSION_.metadataKey);
      value = marker ? String(marker.metadataValue || '0') : '0';
    } catch (error) { apiPause_(error); value = null; }
  }
  if (value === null) {
    value = '0';
    try {
      const found = getDataSpreadsheet_().createDeveloperMetadataFinder().withKey(DATA_VERSION_.metadataKey).find();
      if (found.length) value = String(found[0].getValue() || '0');
    } catch (error) { /* sin metadatos: versión 0 */ }
  }
  try { cachePut_(DATA_VERSION_.cacheKey, value, DATA_VERSION_.seconds); } catch (error) { /* sin caché */ }
  return value;
}

function snapshotIsFresh_(snapshot) {
  return !snapshot.incompleta && snapshot.generation === recordsCacheGeneration_() && String(snapshot.dataVersion || '0') === dataVersion_();
}

// Resumen de calidad (tarjetas y listas del tablero) a partir del detalle por proceso.
function summaryFromDetails_(details) {
  const summary = { total: 0, byProcess: {}, byClassification: {}, fieldsByProcess: {} };
  Object.keys(details || {}).forEach(id => {
    const items = (details[id] && details[id].items) || [];
    if (!items.length) return;
    summary.total += items.length;
    summary.byProcess[id] = items.length;
    summary.byClassification['REQUIERE REVISIÓN JURÍDICA'] = (summary.byClassification['REQUIERE REVISIÓN JURÍDICA'] || 0) + items.length;
    summary.fieldsByProcess[id] = [...new Set(items.map(item => item.key || item.header).filter(Boolean))];
  });
  return summary;
}

function qualityDetailsAll_(spreadsheet) {
  return qualityDetailsFromItems_(esqPuntosAGrupos_(readTable_(spreadsheet, 'pendientes')));
}
function qualityDetailsFromItems_(items) {
  const details = {};
  items.forEach(item => {
    if (item.status !== 'PENDIENTE' || !item.processId) return;
    details[item.processId] = { items: qualityItems_(item) };
  });
  return details;
}

// Lee TODA la base con la API de Sheets en dos llamadas (versión + reglas, y luego todas las tablas a la vez),
// sin abrir el archivo. Devuelve null si no se puede (servicio sin activar, encabezados distintos): entonces se
// lee con SpreadsheetApp como siempre.
function readBaseApi_() {
  if (!sheetsApiAvailable_()) return null;
  const id = getDataSpreadsheetId_();
  const ruleColumns = ['DESPACHO_INICIAL', 'ESTADO', 'FECHA_NOTIFICACION'].map(header => esqIndice_('procesos', header) + 1).filter(column => column > 0);
  const head = Sheets.Spreadsheets.get(id, {
    ranges: ruleColumns.map(column => apiRange_('procesos', 2, 2, column, column)),
    fields: 'developerMetadata(metadataKey,metadataValue),sheets(properties(title),data(rowData(values(dataValidation(strict)))))'
  });
  const marker = (head.developerMetadata || []).find(item => item.metadataKey === DATA_VERSION_.metadataKey);
  const version = marker ? String(marker.metadataValue || '0') : '0';
  let lenient = true;
  (head.sheets || []).forEach(sheet => (sheet.data || []).forEach(grid => (grid.rowData || []).forEach(row => (row.values || []).forEach(cell => {
    if (cell && cell.dataValidation && cell.dataValidation.strict === true) lenient = false;
  }))));
  const tables = STORE_TABLES.concat(['catalogos']);
  // Las tablas pequeñas juntas; 01, 02 y 07 cada una en su llamada (con 10.000–20.000 procesos una sola respuesta
  // con todo sería demasiado grande).
  const rangeOf = tabla => "'" + ESQUEMA[tabla].hoja.replace(/'/g, "''") + "'!A1:" + columnLetter_(esqEncabezados_(tabla).length);
  const big = ['procesos', 'actuaciones', 'auditoria'];
  const groups = big.map(tabla => [tabla]).concat([tables.filter(tabla => big.indexOf(tabla) < 0)]);
  const byTable = {};
  groups.forEach(group => {
    const result = Sheets.Spreadsheets.Values.batchGet(id, { ranges: group.map(rangeOf), valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' });
    (result.valueRanges || []).forEach((range, index) => { byTable[group[index]] = range; });
  });
  if (tables.some(tabla => !byTable[tabla])) return null;
  const ranges = tables.map(tabla => byTable[tabla]);
  const rowsOf = {};
  for (let t = 0; t < tables.length; t++) {
    const tabla = tables[t];
    const headers = esqEncabezados_(tabla);
    const tipos = ESQUEMA[tabla].columnas.map(col => col[2]);
    const values = ranges[t].values || [];
    const first = values[0] || [];
    if (headers.some((header, index) => String(first[index] === undefined ? '' : first[index]) !== header)) return null; // el guardado normal avisa o convierte
    rowsOf[tabla] = values.slice(1).map(row => headers.map((unused, index) => {
      const value = row[index];
      if (value === undefined || value === null) return '';
      if (tipos[index] === 'date' && typeof value === 'number') return new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000)).toISOString().slice(0, 10);
      return value;
    }));
  }
  const store = newStore_();
  STORE_TABLES.forEach(tabla => {
    store.sheets[tabla] = null;
    store.rows[tabla] = rowsOf[tabla];
    store.byId[tabla] = new Map(rowsOf[tabla].map((row, index) => [String(row[0]), index + 2]));
    store.pending[tabla] = [];
  });
  assembleStore_(store);
  const catalogItems = rowsOf.catalogos.filter(row => String(row[0] || '').trim()).map(row => esqFilaAObjeto_('catalogos', row));
  return { store: store, catalogItems: catalogItems, version: version, lenient: lenient };
}

function buildSnapshot_() {
  const generation = recordsCacheGeneration_();
  const startedAt = Date.now();
  const cache = CacheService.getScriptCache();
  persistJournalAtStart_ = String(PropertiesService.getScriptProperties().getProperty(PERSIST_.journalProperty) || '[]');
  ensureTrigger_();
  let base = null;
  try { base = readBaseApi_(); } catch (error) { console.warn('Lectura por API no disponible; se lee la hoja: ' + error.message); base = null; }
  let version, store, catalogItems, spreadsheet = null;
  if (base) {
    version = base.version; // se leyó antes que los datos: un cambio durante la lectura deja la foto como desactualizada
    store = base.store;
    catalogItems = base.catalogItems;
    try { cache.put(DATA_VERSION_.cacheKey, version, DATA_VERSION_.seconds); } catch (error) { /* sin caché */ }
  } else {
    cache.remove(DATA_VERSION_.cacheKey);
    version = dataVersion_(); // antes de leer: un cambio durante la lectura deja la foto como desactualizada
    spreadsheet = getDataSpreadsheet_();
    store = loadStore_(spreadsheet);
    catalogItems = readTable_(spreadsheet, 'catalogos');
  }
  const details = qualityDetailsFromItems_(esqPuntosAGrupos_((store.rows.pendientes || []).filter(row => String(row[0] || '').trim()).map(row => esqFilaAObjeto_('pendientes', row))));
  const snapshot = {
    version: 2, builtAt: new Date().toISOString(), dataVersion: version, generation: generation,
    compactedSeq: Number(PropertiesService.getScriptProperties().getProperty(DELTA_.compactedProperty) || 0),
    __records: buildVisibleRecords_({ rol: ROLES.admin }, store).map(withoutAudit_),
    catalogs: catalogsFromItems_(catalogItems),
    quality: summaryFromDetails_(details),
    qualityGz: packRecords_(details)
  };
  writeSnapshot_(snapshot);
  rowHintsWriteAll_(store, version, startedAt); // posiciones de las filas para los guardados
  // Lo que usa el guardado rápido queda listo: catálogos de validación, reglas y encabezados confirmados.
  try {
    const plain = {};
    catalogItems.filter(item => item.active).forEach(item => { plain[item.category] = plain[item.category] || []; plain[item.category].push(item.value); });
    const warm = {};
    warm[catalogSetsKey_()] = JSON.stringify(plain);
    if (base) {
      warm[rulesLenientKey_()] = base.lenient ? '1' : '0';
      STORE_TABLES.forEach(tabla => { warm[schemaKey_(tabla)] = '1'; }); // encabezados verificados en la lectura
    }
    cache.putAll(warm, 21600);
    if (!base) rulesLenient_(spreadsheet);
  } catch (error) { /* se consultan en el próximo guardado */ }
  const persisted = persistSnapshot_(snapshot); // copia durable dentro del libro (99_PRECARGA)
  pruneDelta_(startedAt, persisted); // lo publicado antes de empezar a leer ya está en la foto
  return snapshot;
}

// Rearma la foto una sola vez aunque muchos usuarios la pidan al mismo tiempo. Devuelve null si otro la está armando.
function buildSnapshotOnce_() {
  const cache = CacheService.getScriptCache();
  if (cache.get(SNAPSHOT_.buildingKey)) return null;
  cache.put(SNAPSHOT_.buildingKey, String(Date.now()), SNAPSHOT_.buildingSeconds);
  try {
    return buildSnapshot_();
  } finally {
    cache.remove(SNAPSHOT_.buildingKey);
  }
}

function putChunks_(prefix, manifestKey, text, manifest) {
  const values = {};
  let chunks = 0;
  for (let start = 0; start < text.length; start += SNAPSHOT_.chunkSize) {
    values[prefix + chunks] = text.slice(start, start + SNAPSHOT_.chunkSize);
    chunks++;
  }
  values[manifestKey] = JSON.stringify(Object.assign({ chunks: chunks }, manifest));
  CacheService.getScriptCache().putAll(values, SNAPSHOT_.seconds);
}

function getChunks_(prefix, manifestKey) {
  const cache = CacheService.getScriptCache();
  const manifest = JSON.parse(cacheGet_(manifestKey) || 'null');
  if (!manifest) return null;
  const keys = [];
  for (let index = 0; index < manifest.chunks; index++) keys.push(prefix + index);
  const parts = keys.length ? cache.getAll(keys) : {};
  if (!keys.every(key => parts[key])) return null;
  return { manifest: manifest, text: keys.map(key => parts[key]).join('') };
}

// ==== Copia durable de la precarga dentro del libro (hoja oculta 99_PRECARGA) ====
// La memoria de Apps Script (CacheService) se puede vaciar: por tiempo o porque Google la desaloja. Antes, cuando
// eso pasaba, la primera persona que entraba esperaba a que se leyera TODA la base. Ahora la precarga ya armada
// (comprimida) queda además guardada como texto en una hoja oculta del mismo libro; si la memoria está vacía, se
// recupera con UNA lectura de esa hoja (segundos, sin importar cuántos procesos haya) en vez de releer y rearmar todo.
// Un «diario» (propiedad del script, se escribe junto con el consecutivo de cambios) dice qué procesos se guardaron
// después de la última copia: si está vacío, la copia está completa; si no, se muestra y se rearma en segundo plano.
const PERSIST_ = { sheet: '99_PRECARGA', cell: 45000, perRequest: 30, maxCells: 990, journalProperty: 'APP_DIARIO_CAMBIOS', journalMax: 8000,
  triggerProperty: 'APP_ACTIVADOR_PRECARGA' };
let persistJournalAtStart_ = '[]';

function persistRange_(fromRow, toRow) { return "'" + PERSIST_.sheet + "'!A" + fromRow + ':A' + toRow; }

function persistSnapshot_(snapshot) {
  if (!sheetsApiAvailable_() || !snapshot || typeof snapshot.lightGz !== 'string' || typeof snapshot.detailGz !== 'string') return false;
  try {
    const id = getDataSpreadsheetId_();
    const body = JSON.stringify({ version: snapshot.version, builtAt: snapshot.builtAt, dataVersion: snapshot.dataVersion, generation: snapshot.generation,
      compactedSeq: snapshot.compactedSeq, lightGz: snapshot.lightGz, detailGz: snapshot.detailGz, catalogs: snapshot.catalogs, quality: snapshot.quality, qualityGz: snapshot.qualityGz, lw: snapshot.lw || {} });
    const token = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    const cells = [];
    for (let index = 0; index < body.length; index += PERSIST_.cell) cells.push(token + '|' + body.slice(index, index + PERSIST_.cell));
    if (cells.length > PERSIST_.maxCells) return false;
    const header = JSON.stringify({ token: token, cells: cells.length, builtAt: snapshot.builtAt, savedAt: new Date().toISOString() });
    const write = (fromRow, values) => Sheets.Spreadsheets.Values.update({ values: values.map(value => [value]) }, id,
      persistRange_(fromRow, fromRow + values.length - 1), { valueInputOption: 'RAW' });
    ensurePersistSheet_(id);
    try { write(1, ['']); } // mientras se escribe, la copia anterior deja de ser válida
    catch (error) { // la borraron después de la última revisión: se crea de nuevo
      CacheService.getScriptCache().remove('APP_PRECARGA_REVISADA');
      ensurePersistSheet_(id);
      write(1, ['']);
    }
    for (let index = 0; index < cells.length; index += PERSIST_.perRequest) write(index + 2, cells.slice(index, index + PERSIST_.perRequest));
    write(1, [header]); // el encabezado al final: solo entonces la copia cuenta
    return true;
  } catch (error) {
    console.error('No se pudo guardar la copia durable de la precarga (se usa solo la memoria).', error);
    return false;
  }
}

// Deja 99_PRECARGA creada, oculta y protegida (solo la cuenta que ejecuta la app la modifica). Si alguien la
// borra, la muestra o le quita la protección, se repara sola en la siguiente actualización de la copia.
// Se revisa como mucho una vez cada 6 horas (o cuando hay que crearla).
function ensurePersistSheet_(id) {
  const flag = 'APP_PRECARGA_REVISADA';
  const cache = CacheService.getScriptCache();
  if (cache.get(flag)) return;
  const info = Sheets.Spreadsheets.get(id, { fields: 'sheets(properties(sheetId,title,hidden),protectedRanges(protectedRangeId,editors,warningOnly))' });
  let sheet = (info.sheets || []).find(item => item.properties && item.properties.title === PERSIST_.sheet);
  const requests = [];
  let sheetId;
  if (!sheet) {
    const reply = Sheets.Spreadsheets.batchUpdate({ requests: [{ addSheet: { properties: { title: PERSIST_.sheet, hidden: true,
      gridProperties: { rowCount: PERSIST_.maxCells + 10, columnCount: 1 } } } }] }, id);
    sheetId = reply.replies[0].addSheet.properties.sheetId;
  } else {
    sheetId = sheet.properties.sheetId;
    if (!sheet.properties.hidden) requests.push({ updateSheetProperties: { properties: { sheetId: sheetId, hidden: true }, fields: 'hidden' } });
  }
  const owner = Session.getEffectiveUser().getEmail();
  const protections = sheet ? sheet.protectedRanges || [] : [];
  const good = protections.some(item => !item.warningOnly && item.editors && (item.editors.users || []).length <= 1);
  if (!good) {
    protections.forEach(item => requests.push({ deleteProtectedRange: { protectedRangeId: item.protectedRangeId } }));
    requests.push({ addProtectedRange: { protectedRange: { range: { sheetId: sheetId },
      description: 'Copia automática de la precarga de VIGIA. No editar: la aplicación la mantiene sola.', warningOnly: false,
      editors: { users: owner ? [owner] : [] } } } });
  }
  if (requests.length) {
    try { Sheets.Spreadsheets.batchUpdate({ requests: requests }, id); }
    catch (error) { console.warn('No se pudo proteger u ocultar 99_PRECARGA: ' + error.message); return; }
  }
  cache.put(flag, '1', 21600);
}

// Diario de cambios: ids guardados desde la última copia durable ('*' = demasiados para listarlos).
function journalText_(add, remove, clearAll) {
  if (clearAll && !add.length) return '[]';
  const current = String(propGet_(PERSIST_.journalProperty) || '[]');
  if (current === '*') return '*';
  let ids = null;
  try { ids = JSON.parse(current); } catch (error) { ids = null; }
  if (!Array.isArray(ids)) return '*';
  const set = new Set(ids.map(String));
  remove.forEach(id => set.delete(String(id)));
  add.forEach(id => set.add(String(id)));
  const text = JSON.stringify([...set]);
  return text.length > PERSIST_.journalMax ? '*' : text;
}

// Memoria vacía: recupera la precarga desde 99_PRECARGA con una sola lectura. Devuelve null si no hay copia válida.
function restoreSnapshot_() {
  if (!sheetsApiAvailable_()) return null;
  let snapshot = null;
  try {
    const values = Sheets.Spreadsheets.Values.get(getDataSpreadsheetId_(), "'" + PERSIST_.sheet + "'!A1:A", { valueRenderOption: 'UNFORMATTED_VALUE' }).values || [];
    const header = JSON.parse(String((values[0] || [])[0] || 'null'));
    if (!header || !header.token || !header.cells) return null;
    const prefix = header.token + '|';
    const parts = [];
    for (let index = 1; index <= header.cells; index++) {
      const cell = String((values[index] || [])[0] || '');
      if (cell.slice(0, prefix.length) !== prefix) return null; // copia a medio escribir
      parts.push(cell.slice(prefix.length));
    }
    snapshot = JSON.parse(parts.join(''));
    if (!snapshot || !(snapshot.recordsGz || (snapshot.lightGz && typeof snapshot.detailGz === 'string'))) return null;
  } catch (error) {
    return null; // no existe la hoja o no se pudo leer: se arma desde la base
  }
  // ¿La copia tiene todo? Sí, cuando cada proceso guardado después de ella sigue en el delta de la memoria
  // (o no hubo ninguno). Si no, se entrega igual (al instante) y queda marcada para rearmarse en segundo plano.
  const lock = LockService.getScriptLock();
  let complete = false;
  if (lock.tryLock(10000)) {
    try {
      const again = readSnapshot_(); // completa (procesos y actuaciones): con solo una parte no sirve
      if (again) return again; // otra persona ya la recuperó mientras tanto
      let journal = null;
      try { journal = JSON.parse(String(PropertiesService.getScriptProperties().getProperty(PERSIST_.journalProperty) || '[]')); } catch (error) { journal = null; }
      const index = readDeltaIndex_();
      if (Array.isArray(journal)) {
        if (index) complete = journal.every(id => index.ids[id]);
        else if (!journal.length) { writeDeltaIndex_({ seq: deltaSeq_() + 1, ids: {} }); complete = true; }
      }
      if (!complete) snapshot.incompleta = true;
      writeSnapshot_(snapshot);
    } finally {
      lock.releaseLock();
    }
  } else {
    snapshot.incompleta = true; // sin turno para comprobarlo: se entrega y se revisa en segundo plano
  }
  ensureTrigger_();
  return snapshot;
}

// El activador que mantiene la precarga en memoria (cada 10 minutos) se instala solo si falta.
function ensureTrigger_() {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props.getProperty(PERSIST_.triggerProperty) === '1') return;
    if (!ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'precargarAplicacion')) {
      ScriptApp.newTrigger('precargarAplicacion').timeBased().everyMinutes(10).create();
    }
    props.setProperty(PERSIST_.triggerProperty, '1');
  } catch (error) {
    console.warn('No se pudo instalar el activador de la precarga; ejecuta programarPrecarga desde el editor. ' + error.message);
  }
}

// Posiciones de filas y tamaño de tablas a partir de SOLO las columnas de identificador (tras recuperar la copia).
function rowHintsRebuildApi_() {
  if (!sheetsApiAvailable_()) return false;
  const startedAt = Date.now();
  const version = dataVersion_(true);
  const ranges = STORE_TABLES.map(tabla => {
    const column = columnLetter_(tabla === 'procesos' || tabla === 'auditoria' ? 1 : 2);
    return "'" + ESQUEMA[tabla].hoja.replace(/'/g, "''") + "'!" + column + '2:' + column;
  });
  const statusColumn = columnLetter_(esqIndice_('procesos', 'ESTADO_REGISTRO') + 1);
  const radicadoColumn = columnLetter_(esqIndice_('procesos', 'RADICADO') + 1);
  const result = Sheets.Spreadsheets.Values.batchGet(getDataSpreadsheetId_(), { ranges: ranges.concat(["'" + ESQUEMA.procesos.hoja + "'!" + statusColumn + '2:' + statusColumn,
    "'" + ESQUEMA.procesos.hoja + "'!" + radicadoColumn + '2:' + radicadoColumn]), valueRenderOption: 'UNFORMATTED_VALUE' });
  const columns = (result.valueRanges || []).map(range => (range.values || []).map(row => String(row[0] === undefined ? '' : row[0])));
  const store = newStore_();
  STORE_TABLES.forEach((tabla, t) => {
    const at = tabla === 'procesos' || tabla === 'auditoria' ? 0 : 1;
    store.rows[tabla] = (columns[t] || []).map(value => { const row = []; row[at] = value; return row; });
  });
  (columns[0] || []).forEach(id => { if (id) store.existing.set(id, true); });
  const status = columns[STORE_TABLES.length] || [], radicados = columns[STORE_TABLES.length + 1] || [];
  store.radicadoPairs = (columns[0] || []).map((id, index) => [String(radicados[index] || '').trim(), id, status[index] === 'ELIMINADO']);
  return rowHintsWriteAll_(store, version, startedAt);
}

// La foto se guarda en dos partes: los datos pequeños (catálogos, calidad, versión) y, aparte, los procesos
// comprimidos en tramos de 90 KB bajo un identificador de versión (rid). Así:
//   · el navegador descarga los procesos en varias llamadas EN PARALELO (cargarParte) y no en una sola muy grande;
//   · quien solo necesita los datos pequeños no trae el megabyte de procesos;
//   · cada escritura usa llaves nuevas: nadie lee una mezcla de dos versiones. La anterior se conserva una vuelta.
const RECORD_PARTS_ = { prefix: 'APP_RGZ_', detailPrefix: 'APP_RGZD_', pointerKey: 'APP_RGZ_ACTUAL' };

// CARGA LIVIANA: la precarga se guarda en dos partes. La «liviana» (lo que muestran listas, filtros y tablero, más
// cuántas actuaciones tiene cada proceso y la fecha de la última) es lo que el navegador descarga primero para mostrar
// la base; el «detalle» (actuaciones y asignaciones de cada proceso) llega justo después, en segundo plano.
function splitSnapshotRecords_(records) {
  const light = [], detail = {};
  records.forEach(record => {
    const actions = record.actions || [], assignments = record.assignments || [];
    const copy = Object.assign({}, record);
    delete copy.actions; delete copy.assignments;
    copy._ligero = 1;
    copy.actionsCount = actions.length;
    copy.lastActionDate = actions.reduce((max, action) => String(action.date || '') > max ? String(action.date || '') : max, '');
    light.push(copy);
    if (actions.length || assignments.length) detail[record.id] = { a: actions, s: assignments };
  });
  return { light: light, detail: detail };
}
function mergeSnapshotRecords_(light, detail) {
  return light.map(record => {
    const copy = Object.assign({}, record);
    const extra = detail[record.id] || {};
    delete copy._ligero; delete copy.actionsCount; delete copy.lastActionDate;
    copy.actions = extra.a || [];
    copy.assignments = extra.s || [];
    return copy;
  });
}
// Procesos completos de la precarga (se arman una vez por ejecución).
function snapshotRecords_(snapshot) {
  // null (nunca una lista vacía) cuando no hay precarga completa: antes devolvía [] y quien lo llamaba lo tomaba como
  // «la base no tiene procesos» y entregaba procesos sin actuaciones.
  if (!snapshot) return null;
  if (snapshot.__records) return snapshot.__records;
  if (snapshot.recordsGz) snapshot.__records = unpackRecords_(snapshot.recordsGz); // copia durable del formato anterior
  else if (typeof snapshot.lightGz === 'string' && typeof snapshot.detailGz === 'string') snapshot.__records = mergeSnapshotRecords_(unpackRecords_(snapshot.lightGz), unpackRecords_(snapshot.detailGz));
  else return null;
  return snapshot.__records;
}

function recordSliceKeys_(rid, count, prefix) {
  const keys = [];
  for (let index = 0; index < count; index++) keys.push((prefix || RECORD_PARTS_.prefix) + rid + '_' + index);
  return keys;
}

function writeSnapshot_(snapshot) {
  const cache = CacheService.getScriptCache();
  try {
    let previous = null;
    try { previous = JSON.parse(cache.get(RECORD_PARTS_.pointerKey) || 'null'); } catch (error) { previous = null; }
    const rid = Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
    if (typeof snapshot.lightGz !== 'string' || typeof snapshot.detailGz !== 'string' || snapshot.__records || snapshot.recordsGz) {
      const parts = splitSnapshotRecords_(snapshotRecords_(snapshot) || []);
      snapshot.lightGz = packRecords_(parts.light);
      snapshot.detailGz = packRecords_(parts.detail);
    }
    const writeSlices = (prefix, text) => {
      const count = Math.max(1, Math.ceil(text.length / SNAPSHOT_.chunkSize));
      const keys = recordSliceKeys_(rid, count, prefix);
      for (let index = 0; index < count; index += 8) { // primero los tramos; el puntero solo cuando ya están todos
        const part = {};
        for (let n = index; n < Math.min(index + 8, count); n++) part[keys[n]] = text.slice(n * SNAPSHOT_.chunkSize, (n + 1) * SNAPSHOT_.chunkSize);
        cache.putAll(part, SNAPSHOT_.seconds);
      }
      return count;
    };
    const slices = writeSlices(RECORD_PARTS_.prefix, snapshot.lightGz);
    const dslices = writeSlices(RECORD_PARTS_.detailPrefix, snapshot.detailGz);
    snapshot.rid = rid;
    snapshot.slices = slices;
    snapshot.dslices = dslices;
    delete snapshot.recordsGz;
    const meta = Object.assign({}, snapshot);
    delete meta.lightGz; delete meta.detailGz; delete meta.__records;
    putChunks_(SNAPSHOT_.chunkPrefix, SNAPSHOT_.manifestKey, JSON.stringify(meta), { builtAt: snapshot.builtAt, rid: rid, slices: slices });
    cache.put(RECORD_PARTS_.pointerKey, JSON.stringify({ rid: rid, slices: slices, dslices: dslices,
      previous: previous ? { rid: previous.rid, slices: previous.slices, dslices: previous.dslices || 0 } : null }), SNAPSHOT_.seconds);
    // Se borra la versión de hace dos escrituras (la inmediatamente anterior queda para quien la esté descargando).
    if (previous && previous.previous && previous.previous.rid) {
      cache.removeAll(recordSliceKeys_(previous.previous.rid, previous.previous.slices)
        .concat(recordSliceKeys_(previous.previous.rid, previous.previous.dslices || 0, RECORD_PARTS_.detailPrefix)));
    }
  } catch (error) {
    console.error('No se pudo guardar la precarga en caché.', error);
  }
  try { PropertiesService.getScriptProperties().setProperty(SNAPSHOT_.builtProperty, snapshot.builtAt); } catch (error) { /* opcional */ }
}

// soloDatos = true: sin los procesos (recordsGz), para respuestas livianas.
function readSnapshot_(soloDatos) {
  try {
    const hit = getChunks_(SNAPSHOT_.chunkPrefix, SNAPSHOT_.manifestKey);
    if (!hit) return null;
    const snapshot = JSON.parse(hit.text);
    if (!snapshot.rid || !snapshot.slices || !snapshot.dslices) return null; // formato anterior (sin carga liviana): se recupera de la copia o se rearma
    if (soloDatos) return snapshot;
    const light = readRecordSlices_(snapshot.rid, 0, snapshot.slices);
    const detail = readRecordSlices_(snapshot.rid, 0, snapshot.dslices, RECORD_PARTS_.detailPrefix);
    if (light === null || detail === null) return null;
    snapshot.lightGz = light;
    snapshot.detailGz = detail;
    return snapshot;
  } catch (error) {
    return null;
  }
}

// ¿Están en la memoria todos los tramos de la precarga (procesos y actuaciones)? Una sola lectura.
function snapshotPartsPresent_(snapshot) {
  if (!snapshot || !snapshot.rid || !snapshot.dslices) return false;
  const keys = recordSliceKeys_(snapshot.rid, snapshot.slices).concat(recordSliceKeys_(snapshot.rid, snapshot.dslices, RECORD_PARTS_.detailPrefix));
  const found = CacheService.getScriptCache().getAll(keys) || {};
  return keys.every(key => typeof found[key] === 'string');
}

function readRecordSlices_(rid, from, to, prefix) {
  const keys = recordSliceKeys_(rid, to, prefix).slice(from);
  if (!keys.length) return '';
  const found = CacheService.getScriptCache().getAll(keys) || {};
  if (!keys.every(key => typeof found[key] === 'string')) return null;
  return keys.map(key => found[key]).join('');
}

// Renueva la vigencia de la foto en memoria sin cambiarla (activador).
function renewSnapshot_() {
  const snapshot = readSnapshot_(true);
  if (!snapshot) return false;
  const cache = CacheService.getScriptCache();
  // Los procesos (liviana) Y las actuaciones/asignaciones (detalle): antes solo se renovaba la liviana y, pasadas
  // 6 horas sin cambios, el detalle vencía en la memoria y los procesos se mostraban sin actuaciones.
  const keys = recordSliceKeys_(snapshot.rid, snapshot.slices).concat(recordSliceKeys_(snapshot.rid, snapshot.dslices || 0, RECORD_PARTS_.detailPrefix));
  for (let index = 0; index < keys.length; index += 8) {
    const found = cache.getAll(keys.slice(index, index + 8)) || {};
    if (Object.keys(found).length !== Math.min(8, keys.length - index)) return false;
    cache.putAll(found, SNAPSHOT_.seconds);
  }
  putChunks_(SNAPSHOT_.chunkPrefix, SNAPSHOT_.manifestKey, JSON.stringify(snapshot), { builtAt: snapshot.builtAt, rid: snapshot.rid, slices: snapshot.slices });
  try { const pointer = cache.get(RECORD_PARTS_.pointerKey); if (pointer) cache.put(RECORD_PARTS_.pointerKey, pointer, SNAPSHOT_.seconds); } catch (error) { /* */ }
  return true;
}

// El navegador pide los procesos en varias llamadas a la vez: tramo k de K (de la versión rid, o de la actual).
// Solo administrador e intermediario (el abogado recibe únicamente sus procesos, en cargarInicial).
// tipo 'detalle': actuaciones y asignaciones (se descargan después de mostrar la base).
function cargarParte(sessionToken, rid, k, K, tipo) {
  cacheMemo_ = {};
  let user, pointer = null;
  try {
    user = requireApplicationUser_(sessionToken, [RECORD_PARTS_.pointerKey]); // sesión + puntero: una llamada
    try { pointer = JSON.parse(cacheGet_(RECORD_PARTS_.pointerKey) || 'null'); } catch (error) { pointer = null; }
  } finally { cacheMemo_ = null; }
  if (user.rol === ROLES.lawyer) return { omitir: true };
  if (!pointer) return { perdida: true };
  let target = pointer;
  if (rid && rid !== pointer.rid) target = pointer.previous && pointer.previous.rid === rid ? pointer.previous : null;
  if (!target) return { perdida: true };
  const detail = tipo === 'detalle';
  const count = detail ? Number(target.dslices || 0) : target.slices;
  if (!count) return { perdida: true };
  const total = Math.min(12, Math.max(1, Number(K) || 1));
  const part = Math.min(total - 1, Math.max(0, Number(k) || 0));
  const from = Math.floor(part * count / total);
  const to = Math.floor((part + 1) * count / total);
  const text = readRecordSlices_(target.rid, from, to, detail ? RECORD_PARTS_.detailPrefix : RECORD_PARTS_.prefix);
  if (text === null) return { perdida: true };
  return { rid: target.rid, k: part, K: total, texto: text, tipo: detail ? 'detalle' : 'liviana' };
}

// ---- Delta: lo que cambió desde la foto ----
// Cada proceso cambiado se guarda en SU PROPIA llave de memoria (APP_DELTA_E2_<id>); un índice pequeño dice qué
// procesos hay y en qué número de cambio (seq) se publicó cada uno. Así un guardado escribe solo su proceso
// (rápido aunque haya cientos de cambios acumulados) y cada navegador descarga solo lo que no tiene.
// El activador integra el delta a la foto cada 10 minutos (fuera de los guardados).
// graceMs: tras integrarse a la precarga, cada cambio se queda unos minutos más en el delta. Así los navegadores
// abiertos (consultan cada 30 s a 3 min) lo reciben como un cambio pequeño en vez de tener que descargar toda la base
// de nuevo cada vez que el activador integra. Solo quien estuvo más tiempo sin consultar recarga completo.
const DELTA_ = { seqProperty: 'APP_DELTA_SEQ', compactedProperty: 'APP_DELTA_COMPACTED', indexKey: 'APP_DELTA_INDEX_V2',
  entryPrefix: 'APP_DELTA_E2_', graceMs: 8 * 60 * 1000, partChars: 90000 };

function deltaSeq_() {
  return Number(propGet_(DELTA_.seqProperty) || 0);
}

// Índice { seq, ids: { id: { s: seq, t: ms } } } o null si se perdió de la memoria.
// El índice de cambios se guarda dos veces (principal y copia) en la misma escritura: si la memoria de Google pierde
// uno, se usa el otro. Perderlo obligaría a rearmar la precarga y a que TODOS los navegadores descarguen la base.
function readDeltaIndex_() {
  const seq = deltaSeq_();
  const index = readDeltaIndexFrom_(DELTA_.indexKey, seq) || readDeltaIndexFrom_(DELTA_.indexKey + 'B', seq);
  if (index) return index;
  return seq ? null : { seq: 0, ids: {} };
}
function readDeltaIndexFrom_(baseKey, seq) {
  let index = null;
  try { index = JSON.parse(cacheGet_(baseKey) || 'null'); } catch (error) { index = null; }
  if (!index || Number(index.seq) !== seq) return null;
  // Índice grande (muchos guardados entre integraciones): va en varias llaves, porque cada una admite 100 KB.
  if (Number(index.parts) > 1) {
    const keys = Array.from({ length: Number(index.parts) - 1 }, (u, k) => baseKey + '_' + (k + 1));
    cachePreload_(keys);
    for (let k = 0; k < keys.length; k++) {
      let part = null;
      try { part = JSON.parse(cacheGet_(keys[k]) || 'null'); } catch (error) { part = null; }
      if (!part || Number(part.seq) !== seq) return null;
      Object.assign(index.ids, part.ids);
    }
    delete index.parts;
  }
  return index;
}
function deltaIndexValues_(index) {
  const values = {};
  const text = JSON.stringify(index);
  const both = (key, value) => { values[key] = value; values[key.replace(DELTA_.indexKey, DELTA_.indexKey + 'B')] = value; };
  if (text.length < DELTA_.partChars) { both(DELTA_.indexKey, text); return values; }
  const ids = Object.keys(index.ids);
  const per = Math.max(1, Math.floor(ids.length * DELTA_.partChars / text.length * 0.9));
  const parts = [];
  for (let start = 0; start < ids.length; start += per) parts.push(ids.slice(start, start + per));
  parts.forEach((group, k) => {
    const subset = {};
    group.forEach(id => { subset[id] = index.ids[id]; });
    const head = k === 0 ? Object.assign({}, index, { ids: subset, parts: parts.length }) : { seq: index.seq, ids: subset };
    both(k === 0 ? DELTA_.indexKey : DELTA_.indexKey + '_' + k, JSON.stringify(head));
  });
  return values;
}

function readDeltaEntries_(ids) {
  const entries = {};
  if (!ids.length) return entries;
  const cache = CacheService.getScriptCache();
  for (let start = 0; start < ids.length; start += 200) {
    const keys = ids.slice(start, start + 200).map(id => DELTA_.entryPrefix + id);
    const found = cache.getAll(keys);
    for (let index = 0; index < keys.length; index++) {
      const text = found[keys[index]];
      if (!text) return null; // una entrada se perdió de la memoria
      entries[ids[start + index]] = unpackRecords_(text);
    }
  }
  return entries;
}

// Delta completo { seq, entries } (o solo lo publicado después de `afterSeq`); null = se perdió.
function readDelta_(afterSeq) {
  const index = readDeltaIndex_();
  if (!index) return null;
  const ids = Object.keys(index.ids).filter(id => !afterSeq || Number(index.ids[id].s) > Number(afterSeq));
  const entries = readDeltaEntries_(ids);
  return entries ? { seq: index.seq, entries: entries, index: index } : null;
}

// journal (opcional): texto nuevo del diario de cambios; se guarda en la MISMA escritura que el consecutivo.
function writeDeltaIndex_(index, journal) {
  cachePutAll_(deltaIndexValues_(index), SNAPSHOT_.seconds);
  if (journal === undefined) { propSet_(DELTA_.seqProperty, String(index.seq)); return; }
  const values = {};
  values[DELTA_.seqProperty] = String(index.seq);
  values[PERSIST_.journalProperty] = journal;
  PropertiesService.getScriptProperties().setProperties(values);
  if (propsMemo_) Object.assign(propsMemo_, values);
}

function resetDelta_() {
  const old = readDeltaIndex_();
  if (old && Object.keys(old.ids).length) CacheService.getScriptCache().removeAll(Object.keys(old.ids).map(id => DELTA_.entryPrefix + id));
  writeDeltaIndex_({ seq: deltaSeq_() + 1, ids: {} });
}

// Quita del delta lo que ya está incluido en una foto armada a partir de `since` (ms).
function pruneDelta_(since, persisted) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const index = readDeltaIndex_();
    if (!index) {
      // Sin índice no se sabe si hubo guardados durante la lectura: el diario solo se limpia si no cambió.
      const before = String(propGet_(PERSIST_.journalProperty) || '[]');
      resetDelta_();
      if (persisted && before === persistJournalAtStart_) PropertiesService.getScriptProperties().setProperty(PERSIST_.journalProperty, '[]');
      return;
    }
    const gone = Object.keys(index.ids).filter(id => Number(index.ids[id].t || 0) < since);
    if (gone.length) CacheService.getScriptCache().removeAll(gone.map(id => DELTA_.entryPrefix + id));
    gone.forEach(id => delete index.ids[id]);
    index.seq += 1;
    writeDeltaIndex_(index, persisted ? journalText_([], gone, !Object.keys(index.ids).length) : undefined);
  } finally {
    lock.releaseLock();
  }
}

// Publica lo que acaba de guardarse (con el bloqueo de escritura tomado): solo se escriben las llaves de esos procesos.
// changes = [{ id, r: proceso, q: [puntos de 06] }] o [{ id, d: true }].
function publishChanges_(changes) {
  if (!changes || !changes.length) return;
  try {
    const index = readDeltaIndex_();
    if (!index) { invalidateRecordsCache_(); resetDelta_(); return; }
    const partial = changes.filter(change => !change.d && (!change.r || !change.q)).map(change => change.id).filter(id => index.ids[id]);
    const previous = partial.length ? (readDeltaEntries_(partial) || {}) : {};
    const seq = index.seq + 1;
    const now = Date.now();
    const values = {};
    changes.forEach(change => {
      const entry = Object.assign({}, previous[change.id] || {});
      if (change.d) { entry.d = true; entry.r = null; entry.q = []; }
      if (change.r) { entry.r = cleanRecord_(change.r); entry.d = false; }
      if (change.q) entry.q = change.q;
      values[DELTA_.entryPrefix + change.id] = packRecords_(entry);
      index.ids[change.id] = { s: seq, t: now };
    });
    index.seq = seq;
    cachePutAll_(values, SNAPSHOT_.seconds);
    writeDeltaIndex_(index, journalText_(changes.map(change => String(change.id)), []));
  } catch (error) {
    console.error('No se pudo publicar el cambio; se rearmará la precarga.', error);
    invalidateRecordsCache_();
  }
}

function cleanRecord_(record) {
  const copy = JSON.parse(JSON.stringify(record));
  delete copy.revision06;
  delete copy.baseValues;
  delete copy.baseUpdatedAt;
  Object.keys(copy).forEach(key => { if (copy[key] === '' || copy[key] === null) delete copy[key]; });
  (copy.actions || []).forEach(action => { delete action.processId; Object.keys(action).forEach(key => { if (action[key] === '') delete action[key]; }); });
  return copy;
}

// Aplica un delta a una foto (servidor) — el navegador hace lo mismo con applyDelta.
// El historial de modificaciones NO viaja en la carga inicial: con el uso, cada proceso acumula cambios en 07 y
// eso llegaba a multiplicar por 3 o 4 lo que descarga cada navegador. Se consulta al abrir un proceso
// (cargarHistorialProceso), directo de 07_AUDITORIA, así que siempre está completo.
function withoutAudit_(record) {
  if (!record || !('audit' in record)) return record;
  const copy = Object.assign({}, record);
  delete copy.audit;
  return copy;
}
let compactedMemo_ = null; // base descomprimida de la última integración (para las partes de los abogados)
function applyDeltaToSnapshot_(snapshot, entries) {
  const all = snapshotRecords_(snapshot);
  if (!all) throw new Error('La precarga no está completa en memoria: no se integra (se recupera de la copia o se rearma).');
  const records = all.slice();
  const index = new Map(records.map((record, position) => [record.id, position]));
  const details = snapshot.qualityGz ? unpackRecords_(snapshot.qualityGz) : {};
  // Abogados con algún proceso cambiado (el anterior y el nuevo responsable): su parte en memoria se renueva.
  const token = Date.now().toString(36);
  snapshot.lw = snapshot.lw || {};
  const touch = record => { const name = record && esqNormalizar_(record.lawyer); if (name) snapshot.lw[name] = token; };
  Object.keys(entries).forEach(id => {
    const entry = entries[id];
    if (index.has(id)) touch(records[index.get(id)]);
    if (entry.r) touch(entry.r);
    if (entry.d) { if (index.has(id)) records[index.get(id)] = null; delete details[id]; return; }
    if (entry.r) { const record = withoutAudit_(entry.r); if (index.has(id)) records[index.get(id)] = record; else { index.set(id, records.length); records.push(record); } }
    if (entry.q) { if (entry.q.length) details[id] = { items: entry.q }; else delete details[id]; }
  });
  const kept = records.filter(Boolean);
  snapshot.__records = kept; delete snapshot.lightGz; delete snapshot.detailGz; delete snapshot.recordsGz; // writeSnapshot_ arma liviana y detalle
  snapshot.qualityGz = packRecords_(details);
  compactedMemo_ = { builtAt: snapshot.builtAt, records: kept, details: details, seq: -1 };
  snapshot.quality = summaryFromDetails_(details);
  return snapshot;
}

// Integra el delta a la foto. El trabajo pesado se hace SIN bloquear los guardados; al final, con el bloqueo un
// instante, se quitan del índice solo las entradas integradas (las que cambiaron mientras tanto se quedan).
// La foto conserva su builtAt: los navegadores que ya tenían esos cambios no necesitan recargar.
function compactSnapshot_() {
  const snapshot = readSnapshot_();
  if (!snapshot) return false;
  const delta = readDelta_(Number(snapshot.compactedSeq || 0)); // solo lo que la precarga aún no tiene
  if (!delta) return false;
  const now = Date.now();
  const fresh = Object.keys(delta.entries).length > 0;
  let persisted = false;
  if (fresh) {
    applyDeltaToSnapshot_(snapshot, delta.entries);
    snapshot.compactedSeq = delta.seq;
    writeSnapshot_(snapshot);
    if (compactedMemo_) compactedMemo_.seq = delta.seq;
    persisted = persistSnapshot_(snapshot); // copia durable dentro del libro (99_PRECARGA)
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return true; // las entradas quedan en el delta (se aplican de nuevo sin problema)
  try {
    const index = readDeltaIndex_();
    if (!index) return true;
    const covered = Number(snapshot.compactedSeq || 0);
    const integrated = Object.keys(index.ids).filter(id => Number(index.ids[id].s) <= covered);
    // Se quitan solo las integradas que ya pasaron el margen: los navegadores abiertos las recibieron como cambio pequeño.
    const gone = integrated.filter(id => now - Number(index.ids[id].t || 0) > DELTA_.graceMs);
    const removedUpTo = gone.reduce((max, id) => Math.max(max, Number(index.ids[id].s)), 0);
    if (gone.length) CacheService.getScriptCache().removeAll(gone.map(id => DELTA_.entryPrefix + id));
    gone.forEach(id => delete index.ids[id]);
    if (!fresh && !gone.length && Number(index.integrated || 0) === covered) return true;
    index.integrated = covered;
    index.seq += 1;
    writeDeltaIndex_(index, persisted ? journalText_([], integrated, !Object.keys(index.ids).length) : undefined);
    const props = PropertiesService.getScriptProperties();
    if (removedUpTo > Number(props.getProperty(DELTA_.compactedProperty) || 0)) props.setProperty(DELTA_.compactedProperty, String(removedUpTo));
  } finally {
    lock.releaseLock();
  }
  return true;
}
// Cambios guardados que la precarga aún no tiene (los integrados que siguen en el margen no cuentan).
function pendingDeltaCount_(index) {
  if (!index) return 0;
  const covered = Number(index.integrated || 0);
  return Object.keys(index.ids).filter(id => Number(index.ids[id].s) > covered).length;
}

function deltaFor_(user, entries) {
  if (user.rol !== ROLES.lawyer) return entries;
  const visible = {};
  Object.keys(entries).forEach(id => { const entry = entries[id]; if (entry.d || (entry.r && lawyerCanSee_(entry.r, user))) visible[id] = entry; });
  return visible;
}

// Cambios publicados desde la última consulta del navegador (se consulta cada pocos segundos). Solo viajan los
// procesos que cambiaron después del número de cambio que ya tiene. { sinCambios } | { seq, deltaGz } | { recargar }.
// Esta consulta la hace cada navegador cada 30 s: todas las propiedades se leen en UNA sola llamada.
function cargarCambios(sessionToken, seqConocido, fotoConocida) {
  beginReadMemo_();
  try { return cargarCambiosInterno_(sessionToken, seqConocido, fotoConocida); } finally { endReadMemo_(); }
}
function cargarCambiosInterno_(sessionToken, seqConocido, fotoConocida) {
  const user = requireApplicationUser_(sessionToken, [DATA_VERSION_.cacheKey, DELTA_.indexKey]); // sesión + versión + índice: una llamada
  const props = { getProperty: propGet_ };
  const built = props.getProperty(SNAPSHOT_.builtProperty) || '';
  const generation = recordsCacheGeneration_();
  const version = dataVersion_();
  const known = fotoConocida || {};
  if (known.builtAt !== built || known.generation !== generation || String(known.dataVersion || '0') !== version) return { recargar: true };
  const seq = deltaSeq_();
  const knownSeq = Number(seqConocido || 0);
  if (seq === knownSeq) return { seq: seq, sinCambios: true };
  // Si una integración quitó del delta cambios que este navegador aún no tenía, recarga completa.
  if (knownSeq < Number(props.getProperty(DELTA_.compactedProperty) || 0)) return { recargar: true };
  const delta = readDelta_(knownSeq);
  if (!delta) return { recargar: true };
  const entries = deltaFor_(user, delta.entries);
  return { seq: delta.seq, deltaGz: Object.keys(entries).length ? packRecords_(entries) : '' };
}

// Arma la precarga de inmediato. Ejecútala después de migrar, depurar o validar desde BaseProcesos.gs.
function refrescarCacheAplicacion() {
  const start = Date.now();
  try { getDirectory_(true); } catch (error) { /* se lee en la próxima carga */ }
  PropertiesService.getScriptProperties().deleteProperty('APP_SNAPSHOT_FILE_ID'); // versiones anteriores usaban un archivo en Drive
  invalidateRecordsCache_();
  const snapshot = buildSnapshot_();
  const message = 'Precarga lista: ' + (snapshotRecords_(snapshot) || []).length + ' procesos en ' + Math.round((Date.now() - start) / 1000) + ' s.';
  console.log(message);
  return message;
}

// Activador: integra los cambios recientes a la foto y la rearma solo si la base cambió fuera de la app.
// Reglas de formato condicional con COUNTIF/COUNTIFS en 01_PROCESOS (versiones anteriores marcaban así los radicados
// repetidos): cada escritura obligaba a Sheets a comparar cada fila con todas. Se quitan solas (una vez al día se revisa).
function removeHeavyConditionalRules_() {
  const props = PropertiesService.getScriptProperties();
  const day = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  if (props.getProperty('APP_REGLAS_REVISADAS') === day) return 0;
  const sheet = getDataSpreadsheet_().getSheetByName(ESQUEMA.procesos.hoja);
  let removed = 0;
  if (sheet) {
    const rules = sheet.getConditionalFormatRules();
    const keep = rules.filter(rule => {
      const condition = rule.getBooleanCondition && rule.getBooleanCondition();
      const values = condition ? (condition.getCriteriaValues() || []).map(String) : [];
      const heavy = values.some(value => /COUNTIFS?\s*\(|CONTAR\.SI/i.test(value));
      if (heavy) removed++;
      return !heavy;
    });
    if (removed) { sheet.setConditionalFormatRules(keep); console.log('Se quitaron ' + removed + ' regla(s) condicional(es) con COUNTIF de 01_PROCESOS (frenaban los guardados).'); }
  }
  props.setProperty('APP_REGLAS_REVISADAS', day);
  return removed;
}

function fastSaveMemoryComplete_(cache, version) {
  const keys = Array.from({ length: ROW_HINTS_.buckets }, (u, b) => rowHintKey_(version, b))
    .concat(Array.from({ length: RADIC_.buckets }, (u, b) => RADIC_.prefix + version + '_' + b), [geometryKey_(version)]);
  const found = {};
  for (let index = 0; index < keys.length; index += 100) Object.assign(found, cache.getAll(keys.slice(index, index + 100)) || {});
  return keys.every(key => { if (!found[key]) return false; if (key === geometryKey_(version)) return true; try { return JSON.parse(found[key]).full === true; } catch (error) { return false; } });
}

// Activador cada 10 minutos, liviano:
//   · Fuera de la jornada (noches y fines de semana) y sin cambios pendientes no hace nada. Al empezar la jornada
//     recupera la memoria de la copia durable (99_PRECARGA) y deja todo listo antes de que entre la gente.
//   · Lo pesado de mantener la memoria (usuarios, catálogos, posiciones de filas, filas libres) se renueva una vez
//     por hora, no en cada pasada (la memoria de Google dura 6 horas).
//   · Los cambios guardados se integran a la precarga cuando ya son bastantes (150) o han pasado 30 minutos.
// Así el tiempo diario del activador queda muy por debajo del límite de Google (90 min/día en cuentas personales).
const ACTIVADOR_ = { inicio: 6, fin: 20, renovarMs: 55 * 60 * 1000, nocheRenovarMs: 270 * 60 * 1000, renovadoProp: 'APP_ACTIVADOR_RENOVADO', minimoIntegrar: 150,
  integrarCadaMs: 30 * 60 * 1000, integradoProp: 'APP_ULTIMA_INTEGRACION' };
function workingHours_(date) {
  const now = date || new Date();
  const tz = 'America/Bogota'; // fija: no depende de la zona horaria configurada en el proyecto de Apps Script
  const hour = Number(Utilities.formatDate(now, tz, 'HH'));
  const weekday = Number(Utilities.formatDate(now, tz, 'u')); // 1 = lunes … 7 = domingo
  return weekday <= 5 && hour >= ACTIVADOR_.inicio && hour < ACTIVADOR_.fin;
}
function precargarAplicacion(evento) {
  const forced = !!(evento && evento.forzar === true); // desde el editor o pruebas: hace todo, a cualquier hora
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  const now = Date.now();
  const working = forced || workingHours_();
  const hasSnapshot = !!cache.get(SNAPSHOT_.manifestKey);
  const pendingIndex = readDeltaIndex_();
  const pending = pendingDeltaCount_(pendingIndex);
  const retained = pendingIndex ? Object.keys(pendingIndex.ids).length - pending : 0;
  const lastRenew = Number(props.getProperty(ACTIVADOR_.renovadoProp) || 0);
  // Fuera de la jornada y sin cambios casi no hace nada; solo renueva la memoria cada ~4,5 horas (dura 6), para que
  // quien entre temprano o de noche no la encuentre vacía.
  if (!working && !pending && hasSnapshot && now - lastRenew < ACTIVADOR_.nocheRenovarMs) return 'Fuera de la jornada y sin cambios: nada que hacer.';

  const renew = forced || !hasSnapshot || now - lastRenew > (working ? ACTIVADOR_.renovarMs : ACTIVADOR_.nocheRenovarMs);
  if (renew) {
    // Memoria caliente: usuarios y roles, versión de datos y catálogos de validación; lo que necesita el guardado
    // rápido por la API (encabezados, listas que solo advierten, posiciones de filas) y filas libres en las tablas.
    try { getDirectory_(true); } catch (error) { console.error('No se pudo renovar el directorio de usuarios.', error); }
    try { dataVersion_(true); } catch (error) { /* se consulta en la próxima carga */ }
    try { catalogSets_(getDataSpreadsheet_(), true); } catch (error) { /* se lee en el próximo guardado */ }
    try { STORE_TABLES.forEach(tabla => requireDataSheet_(getDataSpreadsheet_(), tabla)); rulesLenient_(getDataSpreadsheet_()); } catch (error) { /* */ }
    try { rowHintsRenew_(); } catch (error) { /* se rearman con la precarga */ }
    try { ensureFreeRows_(); } catch (error) { console.warn('No se pudieron dejar filas libres en las tablas: ' + error.message); }
    try { removeHeavyConditionalRules_(); } catch (error) { console.warn('No se pudieron revisar las reglas condicionales de 01: ' + error.message); }
  }
  let snapshot = readSnapshot_(true) || restoreSnapshot_(); // memoria vacía: primero la copia durable
  // Google borra llaves de la memoria sin avisar cuando está llena: si falta algún tramo de procesos o de
  // actuaciones, la precarga se recupera de la copia durable (una lectura) o se rearma.
  if (snapshot && !snapshotPartsPresent_(snapshot)) { endReadMemo_(); snapshot = restoreSnapshot_(); }
  const index = readDeltaIndex_();
  if (!snapshot || !snapshotIsFresh_(snapshot) || !index) {
    const built = buildSnapshotOnce_();
    try { prebuildLawyerPacks_(built || readSnapshot_(), 90000); } catch (error) { console.warn('No se pudieron preparar las partes de los abogados: ' + error.message); }
    props.setProperties({ [ACTIVADOR_.renovadoProp]: String(now), [ACTIVADOR_.integradoProp]: String(now) });
    return 'Precarga rearmada.';
  }
  // Posiciones de filas, tamaño de tablas e índice de radicados: si la memoria de Google perdió alguna llave (lo hace
  // sin avisar cuando está llena), los guardados de esos procesos irían por el camino lento hasta rearmarlas.
  try { if (!fastSaveMemoryComplete_(cache, dataVersion_())) rowHintsRebuildApi_(); } catch (error) { console.error('No se pudieron rearmar las posiciones de filas.', error); }
  const count = pendingDeltaCount_(index);
  const lastIntegration = Number(props.getProperty(ACTIVADOR_.integradoProp) || 0);
  let integrated = false;
  if (count && (forced || count >= ACTIVADOR_.minimoIntegrar || now - lastIntegration >= ACTIVADOR_.integrarCadaMs || !working)) {
    compactSnapshot_(); // integra los cambios (sin bloquear los guardados)
    props.setProperty(ACTIVADOR_.integradoProp, String(now));
    integrated = true;
  } else if (renew && !renewSnapshot_()) { // renueva su vigencia en memoria; si faltaba algún tramo, se recupera
    endReadMemo_();
    if (!restoreSnapshot_() || !readSnapshot_()) buildSnapshotOnce_();
  }
  if (!integrated && Object.keys(index.ids).length > count) { compactSnapshot_(); } // quita del delta lo integrado que ya pasó el margen
  if (integrated || renew) {
    try { prebuildLawyerPacks_(readSnapshot_(true), 120000); } catch (error) { console.warn('No se pudieron preparar las partes de los abogados: ' + error.message); }
  }
  if (renew) {
    try { const current = readDeltaIndex_(); if (current) cache.putAll(deltaIndexValues_(current), SNAPSHOT_.seconds); } catch (error) { /* se rearma si se pierde */ }
    props.setProperty(ACTIVADOR_.renovadoProp, String(now));
  }
  // De noche, una vez al día: si 07_AUDITORIA ya es grande, lo antiguo pasa al archivo histórico (ver archivarAuditoria).
  if (!working && !forced) {
    try {
      const lastArchive = Number(props.getProperty(ARCHIVO_.lastProperty) || 0);
      const geometry = readGeometry_(dataVersion_());
      const auditRows = geometry && geometry.tables && geometry.tables.auditoria ? Number(geometry.tables.auditoria.last) || 0 : 0;
      if (now - lastArchive > 20 * 3600000 && auditRows > ARCHIVO_.minRows) {
        props.setProperty(ARCHIVO_.lastProperty, String(now));
        console.log(archivarAuditoria());
      }
    } catch (error) { console.warn('No se pudo archivar 07_AUDITORIA: ' + error.message); }
  }
  return integrated ? 'Cambios integrados a la precarga.' : 'La precarga está al día.';
}

// ==== Archivo de 07_AUDITORIA ====
// 07 crece con cada guardado (una fila por campo cambiado). Con 200 personas son decenas de miles de filas por
// semana: el archivo se vuelve más pesado, Sheets escribe cada vez más lento y, sin control, llegaría al límite de
// 10 millones de celdas (ahí ya no se puede guardar). Cada noche se pasan a un archivo aparte («VIGIA · Auditoría
// histórica») las filas de más de ARCHIVO_.keepDays días. Las de calidad (TIPO_REGISTRO = CALIDAD) se quedan
// siempre en 07: con ellas se sabe qué puntos se cerraron y qué obligatorios no aplican.
// Nada se pierde: primero se copia al archivo histórico y solo después se quita de 07. El historial de un proceso
// sigue completo: si en 07 hay pocas filas, se completa con el archivo histórico.
const ARCHIVO_ = { property: 'VIGIA_ARCHIVO_07', keepDays: 120, minRows: 40000, minMove: 2000, maxRowsPerFile: 600000, chunk: 20000,
  sheetName: '07_AUDITORIA_HISTORICA', progressProperty: 'VIGIA_ARCHIVO_07_EN_CURSO', lastProperty: 'VIGIA_ARCHIVO_07_ULTIMO' };

function archiveIds_() {
  try { const ids = JSON.parse(propGet_(ARCHIVO_.property) || '[]'); return Array.isArray(ids) ? ids.filter(Boolean).map(String) : []; } catch (error) { return []; }
}

function archiveTarget_(needed) {
  const ids = archiveIds_();
  const width = esqEncabezados_('auditoria').length;
  if (ids.length) {
    try {
      const file = SpreadsheetApp.openById(ids[ids.length - 1]);
      const sheet = file.getSheetByName(ARCHIVO_.sheetName);
      if (sheet && sheet.getLastRow() + needed <= ARCHIVO_.maxRowsPerFile) return sheet;
    } catch (error) { console.error('No se pudo abrir el archivo histórico; se crea uno nuevo.', error); }
  }
  const file = SpreadsheetApp.create('VIGIA · Auditoría histórica (07) · ' + fechaLocal_(new Date().toISOString()));
  const sheet = file.getSheets()[0];
  sheet.setName(ARCHIVO_.sheetName);
  sheet.getRange(1, 1, 1, width).setValues([esqEncabezados_('auditoria')]);
  sheet.setFrozenRows(1);
  ids.push(file.getId());
  PropertiesService.getScriptProperties().setProperty(ARCHIVO_.property, JSON.stringify(ids));
  return sheet;
}

// Ejecútala a mano o deja que el activador nocturno la corra (programarArchivoAuditoria).
// opciones.forzar: archiva aunque 07 todavía sea pequeña (pruebas). opciones.dias: días que se quedan en 07.
function archivarAuditoria(opciones) {
  const options = opciones && typeof opciones === 'object' && !opciones.triggerUid ? opciones : {};
  const keepDays = Math.max(7, Number(options.dias) || ARCHIVO_.keepDays);
  const spreadsheet = getDataSpreadsheet_();
  const sheet = requireDataSheet_(spreadsheet, 'auditoria');
  const width = esqEncabezados_('auditoria').length;
  const last = sheet.getLastRow();
  if (last - 1 < (options.forzar ? 1 : ARCHIVO_.minRows)) return '07_AUDITORIA tiene ' + Math.max(0, last - 1) + ' filas: aún no hace falta archivar.';
  const lock = writeLock_(); // los guardados esperan (de noche, unos segundos)
  try {
    const rowsNow = sheet.getLastRow() - 1;
    const values = sheet.getRange(2, 1, rowsNow, width).getValues();
    const at = esqIndice_('auditoria', 'FECHA_CAMBIO'), type = esqIndice_('auditoria', 'TIPO_REGISTRO');
    const cutoff = Date.now() - keepDays * 86400000;
    const timeOf = value => value instanceof Date ? value.getTime() : Date.parse(String(value || ''));
    const move = [], keep = [];
    values.forEach(row => {
      if (!String(row[0] || '').trim()) return; // filas vacías sueltas: se descartan al reescribir
      const time = timeOf(row[at]);
      if (String(row[type]) !== 'CALIDAD' && isFinite(time) && time < cutoff) move.push(row); else keep.push(row);
    });
    if (move.length < (options.forzar ? 1 : ARCHIVO_.minMove)) return 'Solo ' + move.length + ' fila(s) con más de ' + keepDays + ' días: no se archiva todavía.';
    // 1) Copia al archivo histórico (si algo falla aquí, 07 queda intacta).
    PropertiesService.getScriptProperties().setProperty(ARCHIVO_.progressProperty, JSON.stringify({ t: Date.now(), filas: move.length }));
    const target = archiveTarget_(move.length);
    let next = target.getLastRow() + 1;
    if (target.getMaxRows() < next + move.length - 1) target.insertRowsAfter(target.getMaxRows(), next + move.length - 1 - target.getMaxRows());
    const formats = esqFormatosFila_('auditoria'); // texto como texto: un valor que empieza con «=» no se vuelve fórmula
    for (let start = 0; start < move.length; start += ARCHIVO_.chunk) {
      const block = move.slice(start, start + ARCHIVO_.chunk);
      target.getRange(next, 1, block.length, width).setNumberFormats(block.map(() => formats));
      target.getRange(next, 1, block.length, width).setValues(block);
      next += block.length;
    }
    SpreadsheetApp.flush();
    // 2) 07 queda solo con lo reciente (mismo orden) y sin filas sobrantes (menos celdas = escrituras más rápidas).
    if (keep.length) sheet.getRange(2, 1, keep.length, width).setValues(keep);
    const extra = rowsNow - keep.length;
    if (extra > 0) sheet.getRange(2 + keep.length, 1, extra, width).clearContent();
    const spare = sheet.getMaxRows() - (1 + keep.length) - 1000; // se dejan 1.000 filas libres para los guardados
    if (spare > 0) sheet.deleteRows(1 + keep.length + 1000 + 1, spare);
    SpreadsheetApp.flush();
    // Las posiciones de 07 cambiaron: el guardado vuelve a medir la tabla en su siguiente escritura.
    try { CacheService.getScriptCache().remove(geometryKey_(dataVersion_())); } catch (error) { /* se mide de nuevo */ }
    PropertiesService.getScriptProperties().deleteProperty(ARCHIVO_.progressProperty);
    return 'Archivadas ' + move.length + ' filas de 07_AUDITORIA (más de ' + keepDays + ' días). Quedan ' + keep.length + ' en 07.';
  } finally {
    lock.releaseLock();
  }
}

// Historial de un proceso en el archivo histórico (solo cuando 07 no alcanza para mostrar los últimos cambios).
function archivedAuditFor_(id, limit) {
  const ids = archiveIds_().slice(-2).reverse();
  const found = [];
  ids.forEach(fileId => {
    if (found.length >= limit) return;
    try {
      const sheet = SpreadsheetApp.openById(fileId).getSheetByName(ARCHIVO_.sheetName);
      if (!sheet) return;
      const rows = sheet.getRange('B:B').createTextFinder(id).matchEntireCell(true).findAll().map(cell => cell.getRow()).filter(row => row > 1).sort((a, b) => a - b);
      readRowGroups_(sheet, rows.slice(-limit), esqEncabezados_('auditoria').length).forEach(row => found.push(esqFilaAObjeto_('auditoria', row)));
    } catch (error) { console.error('No se pudo leer el archivo histórico.', error); }
  });
  return found;
}

// Ejecútala una vez: archiva 07 cada noche (2 a. m.).
function programarArchivoAuditoria() {
  ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'archivarAuditoria').forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('archivarAuditoria').timeBased().atHour(2).everyDays(1).inTimezone(ZONA_HORARIA_).create();
  return 'Archivo de 07_AUDITORIA programado cada noche a las 2 a. m. ' + archivarAuditoria();
}

// Ejecútala una vez: programa precargarAplicacion cada 10 minutos.
function programarPrecarga() {
  ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'precargarAplicacion').forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('precargarAplicacion').timeBased().everyMinutes(10).create();
  PropertiesService.getScriptProperties().setProperty(PERSIST_.triggerProperty, '1');
  return 'Precarga programada cada 10 minutos. ' + refrescarCacheAplicacion();
}