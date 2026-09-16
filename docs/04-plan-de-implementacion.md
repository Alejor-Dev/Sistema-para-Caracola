# Fase 1 — Plan de implementación

## 1. Estrategia de entrega

Cada fase produce un incremento ejecutable y verificable. No se aceptan pantallas desconectadas de persistencia ni datos mock como resultado final. Los mocks solo podrán existir dentro de tests o Storybook claramente aislado.

Reglas de calidad por fase:

- migraciones reproducibles y rollback operativo definido;
- pruebas unitarias e integración de reglas críticas;
- API documentada;
- errores de usuario claros y logs internos seguros;
- revisión de permisos y auditoría;
- comprobación responsive cuando haya UI;
- documentación actualizada en el mismo cambio.

## 2. Fase 1 — Arquitectura y diseño

Entregables actuales:

- arquitectura lógica y de despliegue;
- stack y justificación;
- estructura del monorepo;
- modelo de datos y reglas de integridad;
- autenticación y permisos;
- estrategia Windows, acceso móvil, seguridad, backup y restauración;
- roadmap y criterios de aceptación.

Criterio de salida: decisiones revisadas y preguntas de negocio críticas resueltas.

## 3. Fase 2 — Plataforma, backend e identidad

Entregables:

- monorepo, CI, configuración y entornos;
- PostgreSQL nativo de desarrollo/producción, Prisma y migraciones base;
- NestJS con health check, errores normalizados y OpenAPI;
- bootstrap seguro del primer administrador;
- login/logout, sesiones, bloqueo y cambio de contraseña;
- usuarios, roles y permisos granulares;
- auditoría base;
- frontend shell con login y navegación autorizada.

Pruebas mínimas:

- hash/verificación de contraseña;
- login válido/inválido, bloqueo y expiración;
- revocación de sesión;
- matriz de permisos en API;
- migración desde DB vacía;
- ausencia de secretos en logs.

## 4. Fase 3 — Productos, variantes, proveedores y stock

Estado: **completada y validada sobre PostgreSQL nativo**.

Entregables:

- catálogos configurables;
- productos, variantes, imágenes y búsqueda;
- cálculo de ganancia, margen, markup y precio sugerido;
- historial de precios;
- proveedores y relación con productos;
- inventario, movimientos, ajustes, stock mínimo y alertas;
- vistas responsive con paginación, filtros y orden;
- soporte de lector USB como entrada de teclado.

Pruebas mínimas:

- unicidad SKU/barcode;
- cálculos monetarios sin punto flotante;
- cada cambio de stock genera movimiento;
- archivo lógico conserva referencias;
- búsqueda y filtros con dataset de al menos 10.000 variantes;
- permisos para costos, precios y ajustes.

## 5. Fase 4 — Ventas, pagos, clientes y compras

Entregables:

- POS, carrito, descuentos y pago combinado;
- transacción de venta e idempotencia;
- clientes y métricas CRM;
- compras a proveedores e ingreso de stock;
- devoluciones, cambios y anulaciones compensatorias;
- comprobante imprimible inicial;
- eventos SSE para actualización de vistas.

Pruebas mínimas:

- venta completa y rollback ante cada punto de fallo;
- dos compradores compiten por la última unidad: solo uno confirma;
- pagos combinados suman exactamente el total;
- reintento con misma clave no duplica venta;
- compra incrementa stock una sola vez;
- devolución parcial/total y cambio mantienen trazabilidad;
- snapshots históricos no cambian al editar catálogo.

## 6. Fase 5 — Dashboard, reportes e intercambio de datos

Entregables:

- dashboard con indicadores del prompt;
- reportes por período, usuario, pago y dimensiones de producto;
- exportación CSV/XLSX/PDF con permisos;
- importación con staging, previsualización, validación y confirmación;
- auditoría consultable;
- trabajos largos en background con estado y descarga temporal.

Pruebas mínimas:

- totales conciliados contra ventas fuente;
- timezone correcto en cortes diarios/mensuales;
- exportaciones grandes sin agotar memoria;
- archivos inválidos no insertan filas;
- duplicados y errores se informan por fila.

## 7. Fase 6 — PWA, escritorio y acceso remoto

Entregables:

- manifest, service worker y experiencia instalable;
- diseño específico para móvil y PC;
- Tauri con endpoint local y diagnóstico;
- Cloudflare Tunnel con dominio real y HTTPS;
- invalidación inmediata de datos mediante SSE;
- políticas CSP/CORS/cookies verificadas en ambos clientes.

El modo offline no intentará sincronizar dos bases. En la PC principal, la app funciona porque API y DB son locales. Los clientes remotos requieren conectividad con esa PC.

## 8. Fase 7 — Instalador, backups y actualización

Entregables:

- instalador firmado con instalación/desinstalación;
- servicios Windows y recuperación ante fallos;
- configuración inicial, migraciones y creación del administrador;
- backup local/externo cifrado, retención y panel de estado;
- restauración guiada y simulacro documentado;
- actualización versionada con preflight y rollback de binarios.

Pruebas mínimas:

- instalación limpia en Windows soportado sin Docker ni WSL;
- reinicio de PC y arranque automático;
- desinstalación preserva o elimina datos según elección explícita;
- corte de Internet permite operar localmente;
- restauración en otra máquina desde copia cifrada;
- actualización conserva datos y sesiones según política.

## 9. Fase 8 — Validación de producción

- pruebas E2E del flujo completo de 26 pasos;
- carga con 10.000 productos, 100.000 ventas y 500.000 movimientos;
- revisión de índices con planes reales;
- escaneo de dependencias y configuración;
- revisión de permisos y exposición de red;
- prueba de recuperación por pérdida de DB/PC;
- piloto controlado en el local y corrección de incidencias;
- build, instalador, manual de usuario y manual técnico finales.

## 10. Criterio de terminado por historia

Una historia está terminada cuando:

1. la regla de negocio está implementada en backend;
2. persiste en PostgreSQL mediante migraciones versionadas;
3. valida autorización y entradas;
4. registra auditoría cuando corresponde;
5. tiene pruebas proporcionadas al riesgo;
6. funciona en UI desktop y móvil si aplica;
7. sus errores son comprensibles y no filtran detalles internos;
8. la documentación/API fue actualizada;
9. no contiene TODOs que sustituyan el comportamiento prometido.

## 11. Primer backlog ejecutable de Fase 2

Orden recomendado:

1. Crear monorepo, tooling y comandos comunes.
2. Levantar PostgreSQL de desarrollo y definir configuración segura.
3. Implementar esquema inicial de negocio, usuarios, roles, permisos, sesiones y auditoría.
4. Crear migración inicial y seed de permisos, no de usuarios ni ventas falsas.
5. Crear API NestJS, health check, request IDs, validación y manejo de errores.
6. Implementar asistente de primer administrador de un solo uso.
7. Implementar autenticación y sesiones.
8. Implementar RBAC y pruebas de matriz de acceso.
9. Crear shell Next.js, login y navegación según permisos.
10. Añadir pruebas de integración con PostgreSQL real y E2E del login.

## 12. Decisiones de negocio requeridas

Antes de cerrar cada módulo se confirmarán, sin bloquear el scaffolding inicial:

- ¿Se permitirá stock negativo en algún caso extraordinario?
- ¿El costo se actualiza al último costo, promedio ponderado u otra política?
- ¿Qué reglas de redondeo se usarán para precios y descuentos?
- ¿Una venta anulada devuelve siempre stock o puede marcarse mercadería dañada?
- ¿Qué datos debe contener el ticket y qué impresora se usará?
- ¿Cuánto tiempo deben conservarse sesiones, auditoría y archivos exportados?
- ¿Cuál será el dominio y el proveedor de backup externo?
- ¿Se requiere operar desde más de una caja simultánea desde el inicio?

Las respuestas se convertirán en decisiones versionadas antes de implementar la regla afectada.
