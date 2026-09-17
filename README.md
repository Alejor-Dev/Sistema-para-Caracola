# Caracola

Sistema integral de gestión comercial para un local de indumentaria, con una única base de datos PostgreSQL alojada en la PC principal, aplicación de escritorio para Windows y acceso web/PWA seguro desde celulares y otras computadoras.

## Estado actual

**Fase 7 implementada: instalación y operación profesional en Windows, servicios recuperables, backups cifrados, restauración segura y actualización con rollback**, sobre la aplicación comercial de las fases anteriores. No depende de Docker ni WSL. La firma final y la activación del dominio quedan condicionadas a las credenciales del cliente.

Documentación del proyecto:

- [Arquitectura y decisiones técnicas](docs/01-arquitectura.md)
- [Modelo de datos](docs/02-modelo-de-datos.md)
- [Seguridad, operación, backups y restauración](docs/03-seguridad-y-operacion.md)
- [Plan de implementación y criterios de aceptación](docs/04-plan-de-implementacion.md)
- [Guía de desarrollo local](docs/05-desarrollo-local.md)
- [Fase 4: operación comercial](docs/08-fase-4.md)
- [Fase 5: dashboard, reportes y control](docs/09-fase-5.md)
- [Fase 6: PWA, escritorio y acceso remoto](docs/10-fase-6.md)
- [Fase 7: instalación, continuidad y actualización](docs/11-fase-7.md)
- Fase 7.5: cambios menores de marca para Caracola

## Decisiones principales

- Monorepo TypeScript con npm workspaces y Turborepo.
- Frontend responsive/PWA con Next.js y React.
- Aplicación Windows con Tauri reutilizando el mismo frontend.
- Backend modular con NestJS y API REST versionada.
- PostgreSQL como única fuente de verdad y Prisma para acceso tipado/migraciones.
- Sesiones opacas seguras, RBAC con permisos validados en backend y auditoría inmutable.
- Cloudflare Tunnel para acceso remoto HTTPS, sin publicar PostgreSQL.
- Backups locales y externos cifrados, con restauraciones probadas periódicamente.

El siguiente incremento es la Fase 7.5: cambios menores de marca para Caracola, incluyendo nombre, logo e iconos antes de la validación final. Luego continúa la Fase 8: validación en una PC limpia del cliente, firma del instalador y despliegue productivo.

## Implementación

La Fase 2 contiene el monorepo, API NestJS, migración PostgreSQL, autenticación con sesiones seguras, bloqueo y limitación de intentos, RBAC, auditoría, inicialización del primer administrador, cambio y reseteo administrativo de contraseñas y administración web responsive de usuarios y roles.

La validación integral se realizó desde una base vacía con PostgreSQL nativo: migración, alta del administrador, login, creación de rol y usuario, denegación por permisos, revocación de sesión al resetear contraseña y auditoría. Consultar [Fase 2](docs/06-fase-2.md) y la [guía de desarrollo local](docs/05-desarrollo-local.md).

La Fase 3 agrega catálogos configurables, productos, variantes, imágenes WebP optimizadas, proveedores, precios con historial y movimientos de stock transaccionales. Fue validada con más de 10.000 variantes reales. Consultar [Fase 3](docs/07-fase-3.md).

La Fase 4 agrega POS, pagos combinados, clientes con métricas, compras a proveedores, devoluciones, cambios, anulaciones compensatorias, ticket imprimible y eventos SSE. Las transacciones críticas fueron validadas contra PostgreSQL real, incluyendo la competencia por la última unidad. Consultar [Fase 4](docs/08-fase-4.md).

La Fase 5 convierte el panel en una vista operativa real, agrega reportes por rango, exportación CSV/XLSX/PDF, importación CSV/XLSX con previsualización transaccional y un visor completo de auditoría. Los archivos y endpoints se validaron contra PostgreSQL nativo. Consultar [Fase 5](docs/09-fase-5.md).

La Fase 6 agrega una PWA instalable sin cachear datos sensibles, proxy web de mismo origen, acceso LAN restringido, carcasa Windows Tauri y configuración de Cloudflare Tunnel. Consultar [Fase 6](docs/10-fase-6.md).

La Fase 7 agrega instalación versionada, servicios Windows autorrecuperables, secretos DPAPI, backups restic cifrados con retención, restauración a una base aislada, estado operativo en el dashboard y actualización con rollback. GitHub Actions genera el paquete de servidor y el instalador Tauri; la firma requiere el certificado del cliente. Consultar [Fase 7](docs/11-fase-7.md).

La Fase 7.5 cubre cambios menores de marca antes del instalador final: reemplazar el nombre genérico por Caracola, integrar el logo provisto, actualizar iconos de app/PWA/instalador y verificar que recibos, títulos y pantallas principales muestren la marca correcta.
