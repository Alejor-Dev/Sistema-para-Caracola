# Fase 5 — Dashboard, reportes y control

## Estado

Completada y validada con PostgreSQL nativo. El dashboard, los reportes, las exportaciones, la importación y la auditoría leen y escriben información real de la base central. No utilizan datos simulados ni `localStorage`.

## Dashboard

- Ventas y ganancia del día, semana y mes.
- Productos, unidades, stock bajo y variantes agotadas.
- Valor del inventario a costo, a precio de venta y ganancia potencial, respetando permisos.
- Tendencia de los últimos siete días.
- Productos más vendidos, últimas ventas y últimos movimientos de stock.
- Cálculos netos: excluyen ventas anuladas y descuentan devoluciones confirmadas.

## Reportes

La pantalla `/reports` permite seleccionar un rango de fechas y muestra:

- venta neta, ganancia, margen y ticket promedio;
- compras a proveedores;
- ventas por método de pago y por usuario;
- productos más vendidos con unidades, ingresos y ganancia.

El backend mantiene el cálculo monetario en `numeric(19,4)` y `Prisma.Decimal`. Los importes sensibles se ocultan cuando faltan `costs.read` o `profits.read`.

## Exportaciones

Se pueden descargar stock, ventas, compras y auditoría en:

- CSV UTF-8 con separador compatible con configuraciones regionales de Excel;
- XLSX real, con encabezado fijo, autofiltro y formato de cabecera;
- PDF A4 paginado y listo para imprimir.

Cada exportación exige `reports.read` y `exports.create`, y genera un evento `report.exported` con usuario, rango, formato y cantidad de filas. El archivo de Excel se genera sin dependencias pesadas y fue reabierto con `openpyxl`; el PDF fue validado con Poppler y revisión visual.

## Importación de productos

Flujo implementado en `/imports`:

1. Descargar plantilla CSV o seleccionar CSV/XLSX.
2. Previsualizar hasta 5.000 filas y 5 MB.
3. Validar columnas obligatorias, números, SKU, códigos de barras y duplicados internos o existentes.
4. Mostrar errores por fila sin insertar información.
5. Confirmar solamente una previsualización sin errores.
6. Crear productos, variantes, catálogos configurables, precios, saldo y movimiento inicial dentro de una transacción serializable.

Las previsualizaciones persisten 24 horas en `product_imports`. Al confirmar se vuelve a comprobar la unicidad para evitar una carrera entre la validación y la escritura.

Columnas disponibles: `nombre`, `sku`, `codigo_barras`, `categoria`, `marca`, `genero`, `color`, `talle`, `material`, `stock`, `stock_minimo`, `costo` y `precio`.

## Auditoría

La pantalla `/audit` incorpora búsqueda, fechas, grupo de acción, paginación y detalle expandible. Muestra actor, entidad, fecha, IP, request ID y estados anterior/posterior cuando existen. El endpoint conserva el permiso `audit.read`.

## API agregada

| Método | Ruta | Permisos |
|---|---|---|
| `GET` | `/api/v1/reports/dashboard` | `reports.read` |
| `GET` | `/api/v1/reports/summary` | `reports.read` |
| `GET` | `/api/v1/reports/inventory` | `reports.read` |
| `GET` | `/api/v1/reports/export` | `reports.read`, `exports.create` |
| `GET` | `/api/v1/imports/products/template` | `imports.create` |
| `POST` | `/api/v1/imports/products/preview` | `imports.create` |
| `POST` | `/api/v1/imports/products/confirm` | `imports.create` |
| `GET` | `/api/v1/audit` | `audit.read` |

## Migración

`20260916132000_phase5_reporting_imports` crea la cola segura de importaciones, sus restricciones, índices y relación con usuarios. Las tablas comerciales existentes se consultan mediante índices ya disponibles; no se duplican agregados que puedan quedar desactualizados.

## Pruebas realizadas

- Las cuatro migraciones se aplicaron desde una base vacía.
- Importación CSV previsualizada y confirmada contra PostgreSQL real.
- Confirmación bloqueada cuando existe un SKU duplicado.
- Generación real de CSV, XLSX y PDF.
- XLSX reabierto y verificado; PDF analizado y renderizado a PNG para revisión visual.
- Dashboard, resumen, inventario y auditoría consultados con sesión y permisos reales.
- 14 pruebas estándar aprobadas y 3 pruebas de integración específicas de la Fase 5 aprobadas.
- Typecheck y build de producción aprobados en API, contratos y web.
- Las cuatro nuevas páginas respondieron HTTP 200.

No se utilizó Docker.
