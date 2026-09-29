# Instalador Caracola 0.2.1

## Causa del fallo de 0.2.0

La versión publicada contenía dos bloques NSIS con este orden:
IfFileExists, Goto +3, MessageBox, SetErrorLevel, Abort.
Al existir el archivo, Goto +3 saltaba directamente a Abort. Esto explica la
cancelación inmediatamente después de crear el desinstalador, sin llegar a
extraer el servidor ni crear C:\ProgramData\Caracola. No era un problema de UAC
ni de la ubicación elegida por el usuario.

Además, New-CrmRandomSecret llamaba a RandomNumberGenerator.Fill, que no existe
en .NET Framework/Windows PowerShell 5.1. La llamada se sustituyó por
RandomNumberGenerator.Create().GetBytes(). La prueba Test-WindowsRuntime.ps1
se ejecuta expresamente con powershell.exe, el mismo motor que usa el instalador.
La prueba limpia también detectó que DPAPI necesitaba cargar explícitamente
System.Security. El módulo ahora carga esa biblioteca y la prueba de regresión
guarda y recupera un secreto real antes de compilar.

## Resultado verificado — 29 de septiembre de 2026

- Código probado: `75d995606245054d26ee7f04cab9e2d9a2d7fba8`.
- Ejecución: https://github.com/Alejor-Dev/Sistema-para-Caracola/actions/runs/36615176019
- Archivo: `Caracola-Setup-0.2.1.exe`, 461.512.933 bytes. La versión anterior
  tenía 1.093.760.112 bytes: reducción del 57,8 %.
- SHA-256: `422a4e095612be210c31e3d3bd8e0b9f428b39d1c683bcacc8e9389186f4c2f7`.
- Windows Server 2022 limpio, 8 GB de RAM: instalación y prueba funcional
  completas en 372,2 segundos (6 minutos y 12 segundos). El tiempo depende del
  equipo; la instalación de PostgreSQL consumió aproximadamente cuatro minutos.
- Comprobados: servicios activos, web, API a través de la web, base migrada,
  creación del primer administrador, inicio de sesión y persistencia después
  de reiniciar servicios.
- El entorno de prueba ya tenía WebView2. La descarga automática cuando falta
  no quedó cubierta por esta ejecución. Tampoco se certificó una instalación
  interactiva en Windows 10/11 ni una sesión visual de la ventana de escritorio.
- El EXE no tiene firma digital de editor. Su integridad se comprobó contra la
  huella generada en la compilación.

## Distribución

- NSIS comprime el runtime y lo extrae directamente en
  C:\Program Files\Caracola\versions\<version>, sin ZIP intermedio ni copia duplicada.
- Next.js standalone conserva los archivos necesarios para servir la web.
- El servidor incluye únicamente sus dependencias de producción y Prisma CLI
  para aplicar las migraciones. No requiere Node, Docker, npm ni PostgreSQL previo.
- El instalador de PostgreSQL se utiliza desde una carpeta temporal. No se
  conserva otra copia en la instalación de Caracola.
- PostgreSQL usa su propio servicio y puerto 5433, sin reutilizar bases ajenas.
- Las contraseñas se generan automáticamente y se protegen con DPAPI y ACL por
  identificadores de Windows, independientes del idioma.
- Se crean accesos directos y la entrada de desinstalación después de comprobar
  que la API y la web responden.

## Verificación exigida antes de publicar

La compilación detiene el proceso si falla un comando nativo. Genera Prisma
antes de revisar tipos; ejecuta pruebas y builds; valida los scripts con
Windows PowerShell 5.1. En otro Windows limpio ejecuta el EXE real, comprueba
servicios, abre la web, crea el primer administrador, inicia sesión y reinicia
los servicios comprobando la persistencia. La cuenta de prueba se crea únicamente
en esa máquina desechable, nunca en el paquete descargable.

## Instalación para el usuario

1. Descargar el EXE de la publicación de GitHub.
2. Abrirlo y aceptar el permiso de administrador de Windows.
3. Esperar el mensaje de finalización y abrir Caracola.
4. Crear el primer usuario administrador desde el asistente.

Requisitos: Windows 10/11 x64, 4 GB de RAM y 10 GB libres. La instalación usa
una ubicación fija coherente con los servicios. Si ya hay datos/configuración,
el instalador los conserva y solicita usar el procedimiento de actualización.
Si falta WebView2, su instalación requiere Internet.

Los registros están en C:\ProgramData\Caracola: install-progress.log, setup.log,
install-error.log (si falla), install-success.json (si termina correctamente).
El registro de progreso se abre antes de extraer archivos.
