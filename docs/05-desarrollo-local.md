# Desarrollo local

## Requisitos

- Node.js 22.12 o 24 LTS. Evitar versiones impares/no LTS en producción.
- npm 11 o superior.
- PostgreSQL 16 o superior x64 instalado de forma nativa. Docker y WSL no son necesarios.

## Inicio rápido

1. Copiar `.env.example` a `.env` y cambiar credenciales.
2. Instalar PostgreSQL desde el instalador oficial para Windows, eligiendo únicamente servidor y herramientas de línea de comandos.
3. Ejecutar `infrastructure/windows/postgresql/Initialize-CrmDatabase.ps1` en PowerShell y escribir las contraseñas cuando se soliciten.
4. Instalar dependencias: `npm install`.
5. Generar cliente: `npm run db:generate`.
6. Aplicar migraciones de desarrollo: `npm run db:migrate`. En una instalación del cliente se utiliza `npm run db:deploy`.
7. Iniciar API y web: `npm run dev`.
8. Abrir `http://localhost:3000`.

La API escucha solo en `127.0.0.1:4000` durante desarrollo. El endpoint de salud es `/api/v1/health`.

## Producción en la PC del cliente

La aplicación no depende de Docker. El instalador final incluirá o descargará el instalador oficial firmado de PostgreSQL y lo ejecutará silenciosamente con privilegios administrativos. Se instalarán únicamente el servidor y las herramientas de consola.

PostgreSQL:

- arranca automáticamente como servicio de Windows;
- escucha solo en `127.0.0.1`;
- utiliza autenticación SCRAM-SHA-256;
- tiene un rol exclusivo para la aplicación, sin privilegios de superusuario;
- recibe una configuración ajustada a la RAM y CPU del equipo mediante `Optimize-Postgres.ps1`;
- no requiere pgAdmin, StackBuilder, Docker Desktop ni WSL.

## Inicialización

Consultar `GET /api/v1/setup/status`. Si `initialized` es falso, enviar una sola vez:

```json
POST /api/v1/setup/initialize
{
  "displayName": "Administrador",
  "username": "admin",
  "password": "UnaClaveSegura123"
}
```

Después, iniciar sesión desde la web. El endpoint queda inutilizable cuando ya existe un usuario.

## Administración de identidad

Un administrador puede usar `/settings/users` para crear cuentas, asignar roles y activar o desactivar usuarios. La API permite además crear y editar roles con permisos granulares, archivar cuentas y roles, y resetear contraseñas. Un usuario cambia su propia contraseña indicando la actual mediante `POST /api/v1/auth/change-password`.

La recuperación inicial es administrativa: una persona con `users.manage` asigna una contraseña temporal mediante `POST /api/v1/users/:id/reset-password`. El cambio invalida todas las sesiones del usuario. No se implementó recuperación por correo porque todavía no hay un proveedor de correo configurado.

## API de identidad

| Método | Ruta | Permiso |
|---|---|---|
| `POST` | `/api/v1/auth/login` | Público |
| `POST` | `/api/v1/auth/logout` | Sesión válida |
| `POST` | `/api/v1/auth/change-password` | Sesión válida y contraseña actual |
| `GET` | `/api/v1/users` | `users.read` |
| `POST`, `PATCH`, `DELETE` | `/api/v1/users` | `users.manage` |
| `POST` | `/api/v1/users/:id/reset-password` | `users.manage` |
| `GET` | `/api/v1/roles` | `users.read` |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/v1/roles` | `roles.manage` para mutaciones y catálogo de permisos |
| `GET` | `/api/v1/audit` | `audit.read` |

## Comprobaciones

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm run db:validate`

La migración inicial crea únicamente identidad, permisos, sesiones y auditoría. Los esquemas de catálogo y ventas se incorporan en sus respectivas fases para evitar migraciones gigantes e imposibles de revisar.
