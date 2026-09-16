# Fase 2 — Plataforma e identidad

## Estado

Completada. Esta fase entrega un núcleo real sobre PostgreSQL, sin datos de negocio simulados y sin dependencia de Docker o WSL.

## Incluido

- API NestJS versionada con validación estricta, request IDs, CORS explícito, Helmet y errores normalizados.
- PostgreSQL nativo, Prisma, migración reproducible, seed idempotente de permisos y pool de conexiones limitado.
- Asistente de primer administrador ejecutable una sola vez y protegido contra carreras concurrentes.
- Login y logout con Argon2id, tokens opacos, cookies HttpOnly, expiración absoluta e inactividad.
- Bloqueo temporal tras cinco fallos y limitación por IP/usuario para ataques repetidos.
- Cambio de contraseña con reautenticación y revocación de las demás sesiones.
- Recuperación administrativa mediante contraseña temporal, revocando todas las sesiones existentes.
- CRUD con baja lógica para usuarios y roles, permisos granulares validados siempre en backend.
- Protección para impedir desactivar la cuenta propia o eliminar el último administrador activo.
- Auditoría de inicialización, sesiones, usuarios, roles y contraseñas sin almacenar secretos.
- Login, dashboard y administración responsive de usuarios y roles.
- Scripts de diagnóstico, inicialización y optimización para PostgreSQL nativo en Windows.

## Validación ejecutada

Se creó un clúster PostgreSQL 16 aislado en `127.0.0.1:55432`, sin tocar el servicio existente de la PC. Desde una base vacía se comprobó:

1. aplicación de la migración y seed de 25 permisos;
2. inicialización única del administrador;
3. login y lectura de sesión;
4. creación de un rol personalizado y un empleado;
5. denegación `403` al empleado al intentar consultar auditoría;
6. reset administrativo y revocación inmediata de la sesión antigua;
7. nuevo login, cambio de contraseña y registro de auditoría;
8. protección contra auto-desactivación del administrador;
9. typecheck, pruebas automatizadas y build de producción de API y web.

El clúster aislado es solo evidencia de desarrollo y está excluido del control de versiones mediante `.gitignore`.

## Límites intencionales

- Los datos de productos, stock y proveedores comienzan en Fase 3.
- El proveedor de correo para recuperación autónoma no se incorpora hasta definir infraestructura externa; el procedimiento administrativo ya es operativo.
- El instalador y los servicios automáticos de Windows pertenecen a Fase 7. Los scripts actuales permiten validar compatibilidad y preparar PostgreSQL nativo.
