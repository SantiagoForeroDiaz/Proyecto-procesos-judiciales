# Publicar la aplicación en Google Apps Script

La aplicación publicada usa Google Apps Script y Google Sheets para persistir los procesos y sus historiales. Cada operación de lectura o escritura de datos vuelve a validar la sesión y el rol en el servidor. La versión abierta directamente desde `index.html` es una demostración independiente y guarda datos únicamente en el navegador; no debe usarse como almacenamiento compartido.

Al primer acceso autenticado, la aplicación crea las hojas `PROCESOS`, `AUDIENCIAS`, `ACTUACIONES`, `AUDITORIA_PROCESOS` y `CATALOGOS` en el archivo indicado por `AUTH_SPREADSHEET_ID`. Las diligencias y actuaciones se guardan como filas relacionadas por `ID_PROCESO`; el historial existente no se reemplaza. Si la hoja `ACTUACIONES` ya existe, la aplicación agrega la columna `FECHA_VENCIMIENTO` cuando detecta que sus encabezados actuales son compatibles. El radicado se guarda como texto y el servidor valida que contenga exactamente 23 dígitos. Los administradores gestionan abogados, tipos de vinculación, tipos de proceso, causas, etapas, estados, áreas generadoras, tipos de diligencia y formas de terminación desde **Catálogos**.

Los administradores pueden consultar y gestionar todos los procesos. Los colaboradores pueden buscar todos los procesos, ver en primer lugar los que tienen asignados en primera instancia y modificar procesos existentes, pero no crear ni eliminar procesos, cambiar la asignación administrativa ni reemplazar historiales. La asignación existente por correo se conserva; también se reconoce la asignación por coincidencia entre el nombre del abogado y el nombre del usuario autenticado.

La interfaz y el servidor exigen a los administradores No. corto, radicado judicial, radicado actual, cédulas/identificadores, demandante, demandados/entidades, abogado, calidad activa/pasiva, calidad de representación, tipo e instancia del proceso, despacho judicial inicial, medida cautelar y fecha de notificación de la demanda. Para colaboradores se exigen los campos aplicables del formulario, excepto los relativos a segunda instancia; por ejemplo, la fecha de terminación solo es obligatoria cuando el proceso está terminado y las fechas de medida cautelar no aplican cuando se indica que no existe. No se calcula automáticamente ningún término judicial: las fechas máximas se ingresan manualmente hasta que el equipo jurídico defina y apruebe los días hábiles y las reglas por tipo de proceso. La vista general de un proceso y los reportes de actuaciones pueden imprimirse o guardarse como PDF desde el diálogo de impresión del navegador.

## Preparar las hojas de autorización

En el mismo archivo de Google Sheets, crea estas pestañas con estos encabezados en la primera fila:

- `COLABORADORES`: `CORREO` | `NOMBRE` | `ACTIVO`
- `ADMINISTRADORES`: `CORREO` | `NOMBRE` | `ACTIVO`

Agrega una fila por persona. `ACTIVO` debe ser `SI` para permitir el acceso; cualquier otro valor desactiva la cuenta. Si un correo aparece en ambas pestañas, prevalece el rol `ADMINISTRADOR`.

## Crear y configurar el proyecto

1. Ejecuta `.\apps-script\build.ps1` desde la raíz de este repositorio en PowerShell. Esto genera `apps-script\Index.html` con los estilos, el JavaScript y la autenticación ya incrustados.
2. Crea un proyecto en [script.google.com](https://script.google.com) y agrega `Code.gs` y `Index.html` desde `apps-script`. Copia `appsscript.json` también si configuras el manifiesto para mostrar archivos de manifiesto en el editor; el alcance `script.send_mail` es necesario para enviar los códigos.
3. En **Configuración del proyecto > Propiedades de secuencia de comandos**, agrega:
   - `AUTH_SPREADSHEET_ID`: ID del Google Sheets (la parte entre `/d/` y `/edit` de su URL).
4. Guarda el proyecto y despliega como **Aplicación web**. Selecciona **Ejecutar como: yo** para que el servidor pueda consultar la hoja y enviar los códigos desde la cuenta propietaria. En **Quién tiene acceso**, elige la opción más restrictiva que cubra a tus usuarios.
5. Autoriza los permisos solicitados por Apps Script, incluido el envío de correo. Solo se envían códigos a direcciones que aparecen activas (`ACTIVO` = `SI`) en `ADMINISTRADORES` o `COLABORADORES`; los correos que no estén en esas hojas se rechazan. Los códigos vencen en 10 minutos, permiten cinco intentos y se permite pedir otro después de 1 minuto.
6. Abre la URL del despliegue. Tras validar el código se mostrará la aplicación y el rol; la sesión se conserva al recargar durante un máximo de 6 horas y se puede cerrar desde el botón **Cerrar sesión**. Si el correo se desactiva en la hoja, la sesión guardada deja de ser válida. Los correos no autorizados no recibirán un código. Después de cambiar archivos locales, vuelve a ejecutar `.\apps-script\build.ps1`, reemplaza `Index.html` y `Code.gs` en Apps Script y crea una nueva versión del despliegue.

La verificación limita los intentos de cada código a cinco y falla cerrada si Apps Script, el correo o la hoja de autorización no están disponibles. La sesión usa la caché de Apps Script, por lo que Google puede invalidarla antes de las 6 horas; en ese caso la persona debe volver a ingresar.
