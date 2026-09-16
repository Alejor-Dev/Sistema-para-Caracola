# Fase 4 — Operación comercial

## Estado

Completada y validada sobre PostgreSQL nativo. Ventas, pagos, clientes, compras y devoluciones comparten la misma base y el mismo inventario; no existen datos operativos en `localStorage` ni flujos simulados.

## Funcionalidad entregada

- POS responsive con búsqueda por nombre, SKU o código de barras, carrito, cantidades y descuento general.
- Pagos combinados configurables; la suma debe coincidir exactamente con el total.
- Confirmación de venta idempotente y completamente transaccional.
- Bloqueo de saldos con `SELECT … FOR UPDATE` y aislamiento serializable para impedir la doble venta de la última unidad.
- Snapshots históricos de producto, variante, precio y costo en cada renglón vendido.
- Anulación compensatoria con permiso específico, reposición de stock, movimiento y auditoría.
- CRM de clientes con búsqueda, baja lógica, historial y métricas de compras, gasto, ticket promedio y última compra.
- Compras a proveedores idempotentes con pago, ingreso de stock, movimiento, historial de costo y actualización al último costo confirmado.
- Devoluciones parciales/totales y cambios de producto con diferencia a cobrar o reintegrar.
- Movimientos compensatorios `RETURN`, `EXCHANGE_IN`, `EXCHANGE_OUT` y `SALE_VOID` sin alterar el historial original.
- Ticket interno imprimible.
- Eventos SSE para notificar ventas, compras, anulaciones y devoluciones confirmadas.
- Interfaces desktop y móvil para ventas, clientes, compras y posventa.

## Integridad y seguridad

- Claves idempotentes únicas para ventas, compras y devoluciones.
- Foreign keys restrictivas para preservar documentos históricos.
- Restricciones SQL para cantidades, importes, totales y cantidades devueltas.
- Importes en `numeric(19,4)`; la aplicación usa `Prisma.Decimal`, nunca punto flotante para decisiones financieras.
- Validación de permisos en backend: lectura/alta/anulación de ventas, lectura/gestión de clientes, lectura/gestión de compras y devoluciones.
- Auditoría de cada operación importante con usuario, fecha, IP/request ID cuando están disponibles.
- Bajas y anulaciones compensatorias; no se borran ventas ni movimientos.

## Política de costos

Una compra confirmada aplica la política de **último costo** por variante. Antes de modificarlo crea un renglón en `price_history`, por lo que el cambio conserva usuario, motivo y valor anterior. Las ventas ya registradas mantienen su costo histórico y nunca se recalculan al cambiar el catálogo.

## Pruebas realizadas

- Migración de Fase 4 aplicada desde una base vacía junto con Fases 2 y 3.
- Índices trigram de búsqueda de productos y proveedores preservados.
- 11 pruebas unitarias aprobadas.
- 3 pruebas de integración con PostgreSQL real aprobadas:
  - dos ventas compiten por la última unidad y solo una se confirma;
  - un pago combinado suma exactamente el total;
  - el reintento de una compra no duplica documento ni stock;
  - la compra actualiza stock y último costo una sola vez;
  - una devolución total repone stock, actualiza el estado y conserva trazabilidad.
- Typecheck y build de producción aprobados.

## Migración

`20260916040845_phase4_commerce` agrega clientes, métodos de pago, ventas, renglones, pagos, compras, devoluciones, cambios y liquidaciones. En producción se aplica con:

```powershell
npm run db:deploy
npm run db:seed
```

El seed es idempotente: agrega métodos de pago iniciales y concede los permisos nuevos al rol de administrador existente.
