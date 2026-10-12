# Publicar la aplicación en Google Apps Script

La aplicación solo funciona desde su implementación de Google Apps Script. Para entrar, la persona escribe su correo, recibe un código de un solo uso y, al validarlo, se comprueba que esté activa en la hoja de autorización. El proyecto conserva el almacenamiento de procesos en el navegador; esta integración agrega control de acceso, no sincroniza los procesos a Google Sheets. Los cinco registros iniciales configurados en la app se agregan una sola vez por navegador y se fusionan por radicado sin sobrescribir los procesos ya guardados; los datos siguen siendo locales y no se comparten entre usuarios.

## Preparar las hojas de autorización

En el mismo archivo de Google Sheets, crea estas pestañas con estos encabezados en la primera fila:

- `COLABORADORES`: `CORREO` | `NOMBRE` | `ACTIVO`
- `ADMINISTRADORES`: `CORREO` | `NOMBRE` | `ACTIVO`

Agrega una fila por persona. `ACTIVO` debe ser `SI` para permitir el acceso; cualquier otro valor desactiva la cuenta. Si un correo aparece en ambas pestañas, prevalece el rol `ADMINISTRADOR`.

## Crear y configurar el proyecto

1. Ejecuta `.\apps-script\build.ps1` desde la raíz de este repositorio en PowerShell. Esto genera `apps-script\Index.html` con los estilos y el JavaScript ya incrustados.
2. Crea un proyecto en [script.google.com](https://script.google.com) y agrega `Code.gs` y `Index.html` desde `apps-script`. Copia `appsscript.json` también si configuras el manifiesto para mostrar archivos de manifiesto en el editor; el alcance `script.send_mail` es necesario para enviar los códigos.
3. En **Configuración del proyecto > Propiedades de secuencia de comandos**, agrega:
   - `AUTH_SPREADSHEET_ID`: ID del Google Sheets (la parte entre `/d/` y `/edit` de su URL).
4. Guarda el proyecto y despliega como **Aplicación web**. Selecciona **Ejecutar como: yo** para que el servidor pueda consultar la hoja y enviar los códigos desde la cuenta propietaria. En **Quién tiene acceso**, elige la opción más restrictiva que cubra a tus usuarios.
5. Autoriza los permisos solicitados por Apps Script, incluido el envío de correo. Solo se envían códigos a direcciones que aparecen activas (`ACTIVO` = `SI`) en `ADMINISTRADORES` o `COLABORADORES`; los correos que no estén en esas hojas se rechazan. Los códigos vencen en 10 minutos, permiten cinco intentos y se permite pedir otro después de 1 minuto.
6. Abre la URL del despliegue. Tras validar el código se mostrará la aplicación y el rol; la sesión se conserva al recargar durante un máximo de 6 horas y se puede cerrar desde el botón **Cerrar sesión**. Si el correo se desactiva en la hoja, la sesión guardada deja de ser válida. Los correos no autorizados no recibirán un código. Después de cambiar archivos locales, vuelve a ejecutar `.\apps-script\build.ps1`, reemplaza `Index.html` en Apps Script por el generado y crea una nueva versión del despliegue.

La verificación limita los intentos de cada código a cinco y falla cerrada si Apps Script, el correo o la hoja de autorización no están disponibles. La sesión usa la caché de Apps Script, por lo que Google puede invalidarla antes de las 6 horas; en ese caso la persona debe volver a ingresar.
