# Fase 1 — Seguridad y operación

## 1. Autenticación

Se usarán sesiones opacas:

1. El usuario envía credenciales por HTTPS.
2. El backend normaliza el nombre, aplica rate limiting y verifica Argon2id.
3. Al autenticar, crea un token aleatorio de alta entropía; solo guarda su hash.
4. El navegador recibe una cookie `HttpOnly`, `Secure` y `SameSite=Lax`.
5. Operaciones mutables validan origen y token CSRF cuando corresponda.
6. Logout, cambio de contraseña, bloqueo o desactivación revocan sesiones.

Controles:

- Bloqueo temporal progresivo por usuario e IP, sin permitir enumeración de cuentas.
- Timeout por inactividad configurable y expiración absoluta.
- Reautenticación para cambios de contraseña, usuarios, permisos y restauraciones.
- Recuperación local mediante código de un solo uso y procedimiento administrativo; correo podrá incorporarse cuando exista proveedor configurado.
- Primer inicio mediante asistente local que crea exactamente un administrador y se deshabilita después.

## 2. Autorización

RBAC con permisos granulares. Los roles `Administrador` y `Empleado` son plantillas iniciales, no lógica codificada en controladores.

Permisos iniciales:

- `products.read`, `products.create`, `products.update`, `products.archive`
- `costs.read`, `profits.read`, `prices.update`
- `inventory.read`, `inventory.adjust`, `inventory.view_history`
- `sales.create`, `sales.void`, `returns.create`
- `customers.manage`, `suppliers.manage`, `purchases.manage`
- `reports.read`, `exports.create`, `imports.create`
- `users.manage`, `roles.manage`, `audit.read`, `settings.manage`, `backups.manage`

Cada endpoint declara permisos requeridos y un guard los valida. Las consultas también limitan campos sensibles: poder ver productos no implica ver costos o ganancias.

## 3. Protección de la aplicación

- Validación de DTOs en backend con rechazo de campos desconocidos.
- ORM parametrizado; SQL manual solo con parámetros y revisión.
- CSP estricta, HSTS en el dominio remoto, headers seguros y CORS con orígenes explícitos.
- Cookies seguras y CSRF para acciones con sesión.
- Límites de tamaño/tipo en uploads, nombres generados y archivos fuera del directorio público.
- Imágenes decodificadas y regeneradas para eliminar contenido no deseado; thumbnails y límites de resolución.
- Rate limiting diferenciado para login, búsqueda, exportación y endpoints costosos.
- Secretos fuera de Git, permisos ACL mínimos y rotación documentada.
- Dependencias fijadas, auditoría en CI y SBOM para releases.
- Cuenta de servicio Windows sin privilegios administrativos cuando sea viable.
- Base de datos con rol de aplicación sin permisos de superusuario.

## 4. Auditoría y privacidad

Se auditan logins, logouts, cambios de producto/precio/stock, ventas/anulaciones, clientes, usuarios, permisos, importaciones, exportaciones, backup y restauración.

No se registran contraseñas, hashes, tokens, cookies, secretos, datos completos de pago ni cuerpos indiscriminados. Los valores sensibles se redactan antes de persistir logs.

Los registros de auditoría son append-only para la aplicación. El acceso requiere permiso específico y también queda auditado.

## 5. Backups

### Esquema 3-2-1

- Base activa en PostgreSQL.
- Copia local en otro directorio/disco, protegida por ACL.
- Copia externa cifrada mediante restic.

Plan inicial:

- Backup lógico diario de PostgreSQL con `pg_dump --format=custom`.
- Copia coordinada de imágenes y configuración no secreta.
- 7 copias diarias, 4 semanales y 6 mensuales.
- Cifrado autenticado antes de abandonar la PC.
- Checksums, verificación automática y alerta cuando no exista backup exitoso en 26 horas.
- Las claves de cifrado no se guardan dentro del mismo backup; se entrega procedimiento de custodia.

No se considerará que existe backup hasta probar una restauración.

## 6. Restauración

Procedimiento de recuperación:

1. Poner API en modo mantenimiento.
2. Seleccionar copia y verificar checksum/estado.
3. Crear una base nueva; no sobrescribir primero la única base existente.
4. Restaurar esquema/datos e imágenes.
5. Aplicar únicamente migraciones posteriores compatibles.
6. Ejecutar chequeos: integridad referencial, conteos, usuario, producto, stock y venta de prueba controlada.
7. Cambiar la conexión, reiniciar servicios y verificar health checks.
8. Conservar la base anterior hasta confirmar la recuperación.
9. Registrar operador, causa, copia usada y resultado.

Frecuencia de simulacro: mensual durante puesta en marcha y trimestral después, con RPO objetivo de 24 horas y RTO inicial de 4 horas. Estos objetivos se revisarán según el costo real de interrupción.

## 7. Servicios Windows

Servicios con inicio automático retrasado y recuperación ante fallo:

- PostgreSQL.
- Backend NestJS.
- Proxy local.
- Cloudflare Tunnel.
- Scheduler/worker de backups.
- Monitor liviano de salud.

Orden: DB saludable → migraciones compatibles → API → proxy/túnel → tareas auxiliares. El escritorio muestra estado y diagnóstico comprensible si el backend local no está listo.

## 8. Observabilidad

Endpoint local `/health` con:

- estado y versión del backend;
- conexión y latencia de PostgreSQL;
- espacio libre;
- último backup exitoso;
- estado de migraciones;
- estado del túnel sin exponer credenciales.

Logs JSON con `requestId`, usuario cuando corresponda, módulo, duración y resultado. Rotación por tamaño/fecha y retención configurable. Métricas agregadas no contienen PII.

Alertas visibles en el dashboard para stock, backup vencido, poco espacio, servicio degradado y actualización pendiente.

## 9. Modelo de amenazas resumido

| Riesgo | Control principal |
|---|---|
| Robo de contraseña | Argon2id, rate limiting, bloqueo, sesiones revocables. |
| Acceso remoto a DB | PostgreSQL no publicado, firewall y binding local. |
| Venta doble de última unidad | Transacción y bloqueo/actualización condicional en DB. |
| Usuario sin permiso modifica precio | Guard backend, permiso granular y auditoría. |
| Reenvío duplica una venta | Clave de idempotencia ligada al usuario y payload. |
| Malware/ransomware cifra copia local | Copia externa cifrada con retención/versionado y credenciales limitadas. |
| Archivo importado malicioso | Límites, parser seguro, staging, validación y confirmación explícita. |
| XSS/CSRF | Escape por defecto, CSP, cookies seguras, token/origin checks. |
| Pérdida de PC | Backup externo y restauración documentada/probada. |

## 10. Entornos y secretos

- `development`: DB descartable, datos de prueba y logs detallados.
- `test`: DB aislada creada por suite; nada depende de producción.
- `staging`: configuración equivalente a producción y datos anonimizados/sintéticos.
- `production`: secretos generados en instalación, logs restringidos y migraciones controladas.

`.env.example` documentará nombres y formatos sin valores reales. En Windows, los secretos efectivos residirán fuera del directorio de código con ACL restringidas; DPAPI protegerá valores adecuados.
