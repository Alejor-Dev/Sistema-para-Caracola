# Fase 3 — Catálogo e inventario

## Estado

Completada. La fase funciona con PostgreSQL real, sin mocks ni almacenamiento en el navegador.

## Funcionalidad entregada

- Catálogos configurables: categorías, subcategorías, marcas, colores, talles, materiales, géneros, tipos de prenda, temporadas y colecciones.
- Valores iniciales de indumentaria cargados mediante un seed idempotente; todos pueden desactivarse o ampliarse.
- Productos con baja lógica, búsqueda, filtros, paginación y orden por nombre, fecha, precio o stock.
- Variantes con SKU único, código de barras único, color, talle, costo, precio, mayorista y stock mínimo propio.
- Dinero en `numeric(19,4)` y cálculos decimales de ganancia, margen, markup y precio sugerido.
- Historial de cambios de costo y precios con usuario, motivo y fecha.
- Proveedores con datos fiscales y contacto, preparados para compras de Fase 4.
- Saldo de inventario por variante y movimientos append-only.
- Ajustes, entradas, pérdidas, daños y correcciones dentro de una transacción con bloqueo de fila.
- Rechazo de stock negativo y explicación obligatoria para pérdidas, daños y correcciones.
- Alertas de stock bajo y sin stock.
- Imágenes JPG, PNG o WebP validadas, regeneradas como WebP, limitadas a 1600 px y guardadas fuera del código.
- API con permisos separados para lectura, costos, ganancias, precios y ajustes.
- Interfaces responsive de productos, inventario y proveedores, con búsqueda compatible con lector de código de barras USB.

## Integridad de base de datos

La migración `20260916024451_catalog_inventory` agrega claves foráneas, índices y restricciones para:

- importes y mínimos no negativos;
- saldo disponible no negativo;
- coherencia matemática de cada movimiento;
- combinación activa de producto, color y talle no repetida;
- dimensiones y tamaño válidos para imágenes;
- búsqueda trigram indexada por producto y proveedor.

Archivar un producto conserva variantes, saldos, movimientos e historial de precios.

## Pruebas realizadas

- 9 pruebas automatizadas aprobadas.
- Migración aplicada desde la base de Fase 2.
- Alta real de marca, proveedor, producto, variante y stock inicial.
- Ajuste de stock `8 → 6` con dos movimientos registrados.
- SKU duplicado rechazado con `409`.
- Ajuste que produciría stock negativo rechazado con `400`.
- Costo y ganancia ocultos para un rol sin esos permisos; ajuste denegado con `403`.
- Imagen de 2400×1800 regenerada como WebP de 1600×1200 y servida correctamente.
- Dataset de 10.001 variantes; búsqueda de un SKU específico resuelta por API en aproximadamente 211 ms en el equipo de desarrollo.
- `EXPLAIN ANALYZE` confirmó uso del índice GIN de búsqueda; ejecución SQL aproximada de 5 ms para el término medido.
- Typecheck y build de producción aprobados.

Los tiempos son evidencia del equipo de desarrollo, no una garantía universal; se volverán a medir en el hardware del cliente durante Fase 8.

## Decisiones vigentes

- No se permite stock negativo.
- ARS usa presentación a dos decimales y almacenamiento a cuatro decimales.
- Las compras de Fase 4 definirán la política de actualización de costo; Fase 3 no modifica costos automáticamente fuera de una edición autorizada.
- Los archivos se almacenan en `PRODUCT_IMAGES_DIR`; la base conserva metadatos y checksum.
