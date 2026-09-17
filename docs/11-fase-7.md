# Fase 7 — instalación, continuidad y actualización

## Estado

La fase 7 está implementada en el repositorio. El sistema dispone de instalación reproducible para Windows, servicios con recuperación automática, backups cifrados, restauración segura, actualización con rollback de binarios y una compilación automatizada en GitHub Actions. No requiere Docker ni WSL en la PC del cliente.

El instalador final firmado se obtiene desde el flujo **Windows release**. La firma Authenticode se activa únicamente al cargar el certificado real del cliente en los secretos de GitHub; el repositorio nunca almacena la clave privada.

## Estructura de producción

- código inmutable y versiones: `C:\Program Files\Caracola`;
- configuración, secretos, imágenes, estado, logs y backups: `C:\ProgramData\Caracola`;
- enlace `current` hacia la versión activa para actualizaciones atómicas;
- servicios `CrmApi` y `CrmWeb` administrados por WinSW;
- PostgreSQL nativo, API en loopback y frontend en el puerto 3000;
- tarea programada diaria y al iniciar Windows para backups.

La desinstalación conserva por defecto todo `ProgramData`. El borrado de datos requiere el parámetro explícito `-RemoveData` y una confirmación elevada.

## Secretos

Las contraseñas de PostgreSQL y restic se guardan cifradas con DPAPI en alcance de máquina y ACL limitada a `SYSTEM` y administradores. No se escriben contraseñas en archivos `.env`, manifiestos, logs ni repositorio.

## Backups y restauración

Cada ejecución:

1. evita dos backups simultáneos;
2. crea un `pg_dump` en formato custom;
3. registra manifiesto y SHA-256;
4. envía base e imágenes a restic con cifrado;
5. verifica el repositorio;
6. aplica retención de 7 diarios, 4 semanales y 6 mensuales;
7. actualiza un estado atómico visible en el dashboard para usuarios con `backups.manage`.

Se admite un segundo repositorio externo. Una falla conserva la fecha del último backup exitoso para diagnosticar antigüedad real.

La restauración funciona primero en modo plan. Con `-Execute`, valida el snapshot y su hash, y restaura exclusivamente a una base nueva. El script rechaza el nombre de la base activa y nunca cambia automáticamente la aplicación hacia la restaurada.

## Actualización y rollback

La actualización valida todos los SHA-256 del manifiesto, ejecuta un backup previo, instala una nueva carpeta versionada, aplica migraciones, conmuta el enlace `current` y exige que `/health` responda. Si falla, vuelve a la versión anterior y reinicia los servicios.

Las migraciones de base son *forward-only*: deben mantener compatibilidad con la versión anterior porque el rollback automático cubre binarios, no deshace datos.

## Compilación y firma

`.github/workflows/windows-release.yml` verifica tipos, pruebas, builds y scripts PowerShell en un runner limpio de Windows. Luego compila Tauri/NSIS, prepara el paquete de servidor con Node, WinSW y restic, genera manifiesto de integridad y publica ambos artefactos.

Para firma opcional:

- `WINDOWS_CERTIFICATE_BASE64`: PFX codificado en Base64;
- `WINDOWS_CERTIFICATE_PASSWORD`: contraseña del PFX.

Sin esos secretos el flujo genera artefactos sin firma, útiles para validación interna pero no para entrega definitiva.

## Uso operativo

Abrir PowerShell como administrador:

```powershell
.\infrastructure\windows\installer\Install-Crm.ps1 -ReleasePath C:\Ruta\Paquete
.\infrastructure\windows\backup\Backup-Crm.ps1
.\infrastructure\windows\backup\Restore-Crm.ps1 -SnapshotId latest -TargetDatabase crm_restore_test
.\infrastructure\windows\update\Update-Crm.ps1 -ReleasePath C:\Ruta\NuevaVersion
.\infrastructure\windows\installer\Uninstall-Crm.ps1
```

La primera restauración sin `-Execute` solo imprime el plan. Esto permite verificar destino, snapshot y pasos antes de crear una base.
