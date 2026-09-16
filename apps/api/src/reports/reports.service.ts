import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../common/request-user';
import { moneyText } from '../common/money';
import { jsonSafe } from '../common/json-safe';
import { TableRow, toCsv, toPdf, toXlsx } from '../common/tabular';
import type { ActionContext } from '../iam/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { ExportReportDto, ReportRangeDto } from './report.dto';

type Numeric = bigint | number | Prisma.Decimal | null;
const number = (value: Numeric) => Number(value ?? 0);
const amount = (value: Numeric) => moneyText(new Prisma.Decimal(value?.toString() ?? '0'));

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(user: RequestUser) {
    const { today, week, month } = this.periods();
    const [inventory, sales, topProducts, recentSales, recentMovements, trend] = await Promise.all([
      this.prisma.$queryRaw<Array<{ products: bigint; units: bigint; low_stock: bigint; out_stock: bigint; cost_value: Prisma.Decimal; sale_value: Prisma.Decimal }>>`
        SELECT COUNT(DISTINCT p.id)::bigint AS products, COALESCE(SUM(b.quantity),0)::bigint AS units,
          COUNT(*) FILTER (WHERE b.quantity > 0 AND b.quantity <= COALESCE(v.min_stock_override,p.min_stock))::bigint AS low_stock,
          COUNT(*) FILTER (WHERE b.quantity = 0)::bigint AS out_stock,
          COALESCE(SUM(b.quantity * v.cost_amount),0) AS cost_value,
          COALESCE(SUM(b.quantity * v.sale_price_amount),0) AS sale_value
        FROM products p JOIN product_variants v ON v.product_id=p.id AND v.archived_at IS NULL
        JOIN inventory_balances b ON b.variant_id=v.id WHERE p.archived_at IS NULL`,
      this.prisma.$queryRaw<Array<{ today_sales: bigint; today_revenue: Prisma.Decimal; today_profit: Prisma.Decimal; week_sales: bigint; week_revenue: Prisma.Decimal; month_sales: bigint; month_revenue: Prisma.Decimal; month_profit: Prisma.Decimal }>>(Prisma.sql`
        SELECT COUNT(*) FILTER (WHERE s.confirmed_at>=${today})::bigint AS today_sales,
          COALESCE(SUM(s.total_amount) FILTER (WHERE s.confirmed_at>=${today}),0)-COALESCE(SUM(r.refund) FILTER (WHERE s.confirmed_at>=${today}),0) AS today_revenue,
          COALESCE(SUM(s.profit_amount) FILTER (WHERE s.confirmed_at>=${today}),0)-COALESCE(SUM(r.returned_profit) FILTER (WHERE s.confirmed_at>=${today}),0) AS today_profit,
          COUNT(*) FILTER (WHERE s.confirmed_at>=${week})::bigint AS week_sales,
          COALESCE(SUM(s.total_amount) FILTER (WHERE s.confirmed_at>=${week}),0)-COALESCE(SUM(r.refund) FILTER (WHERE s.confirmed_at>=${week}),0) AS week_revenue,
          COUNT(*) FILTER (WHERE s.confirmed_at>=${month})::bigint AS month_sales,
          COALESCE(SUM(s.total_amount) FILTER (WHERE s.confirmed_at>=${month}),0)-COALESCE(SUM(r.refund) FILTER (WHERE s.confirmed_at>=${month}),0) AS month_revenue,
          COALESCE(SUM(s.profit_amount) FILTER (WHERE s.confirmed_at>=${month}),0)-COALESCE(SUM(r.returned_profit) FILTER (WHERE s.confirmed_at>=${month}),0) AS month_profit
        FROM sales s LEFT JOIN LATERAL (
          SELECT COALESCE(SUM(ri.refund_amount),0) refund, COALESCE(SUM(ri.refund_amount-ri.quantity*si.unit_cost_amount),0) returned_profit
          FROM return_transactions rt JOIN return_items ri ON ri.return_transaction_id=rt.id JOIN sale_items si ON si.id=ri.sale_item_id WHERE rt.sale_id=s.id
        ) r ON true WHERE s.status<>'VOIDED'`),
      this.prisma.$queryRaw<Array<{ product_name: string; sku: string; quantity: bigint; revenue: Prisma.Decimal }>>(Prisma.sql`
        SELECT si.product_name,si.sku,SUM(si.quantity-si.returned_quantity)::bigint quantity,
          COALESCE(SUM(si.line_total_amount),0)-COALESCE(SUM(ri.refund),0) revenue
        FROM sale_items si JOIN sales s ON s.id=si.sale_id
        LEFT JOIN LATERAL (SELECT SUM(refund_amount) refund FROM return_items WHERE sale_item_id=si.id) ri ON true
        WHERE s.status<>'VOIDED' AND s.confirmed_at>=${month} GROUP BY si.product_name,si.sku ORDER BY quantity DESC,revenue DESC LIMIT 5`),
      this.prisma.sale.findMany({ where: { status: { not: 'VOIDED' } }, take: 6, orderBy: { confirmedAt: 'desc' }, select: { id: true, number: true, totalAmount: true, confirmedAt: true, customer: { select: { firstName: true, lastName: true } }, user: { select: { displayName: true } } } }),
      this.prisma.inventoryMovement.findMany({ take: 6, orderBy: { occurredAt: 'desc' }, select: { id: true, type: true, quantityDelta: true, occurredAt: true, variant: { select: { sku: true, product: { select: { name: true } } } }, user: { select: { displayName: true } } } }),
      this.prisma.$queryRaw<Array<{ day: Date; sales: bigint; revenue: Prisma.Decimal }>>(Prisma.sql`
        SELECT date_trunc('day',confirmed_at AT TIME ZONE 'America/Argentina/Buenos_Aires') AS "day",COUNT(*)::bigint sales,COALESCE(SUM(total_amount),0) revenue
        FROM sales WHERE status<>'VOIDED' AND confirmed_at>=${new Date(Date.now()-6*86400000)} GROUP BY "day" ORDER BY "day"`),
    ]);
    const inv = inventory[0]; const sale = sales[0]; const seeCost = user.permissions.includes('costs.read'); const seeProfit = user.permissions.includes('profits.read');
    return jsonSafe({
      inventory: { products: number(inv.products), units: number(inv.units), lowStock: number(inv.low_stock), outStock: number(inv.out_stock), ...(seeCost ? { costValue: amount(inv.cost_value) } : {}), saleValue: amount(inv.sale_value), ...(seeProfit ? { potentialProfit: amount(inv.sale_value.minus(inv.cost_value)) } : {}) },
      sales: { today: { count: number(sale.today_sales), revenue: amount(sale.today_revenue), ...(seeProfit ? { profit: amount(sale.today_profit) } : {}) }, week: { count: number(sale.week_sales), revenue: amount(sale.week_revenue) }, month: { count: number(sale.month_sales), revenue: amount(sale.month_revenue), ...(seeProfit ? { profit: amount(sale.month_profit) } : {}) } },
      topProducts: topProducts.map((row) => ({ name: row.product_name, sku: row.sku, quantity: number(row.quantity), revenue: amount(row.revenue) })),
      recentSales: recentSales.map((row) => ({ ...row, number: row.number.toString(), totalAmount: moneyText(row.totalAmount) })), recentMovements,
      trend: this.fillTrend(trend),
      alerts: [{ type: 'low', count: number(inv.low_stock) }, { type: 'out', count: number(inv.out_stock) }],
    });
  }

  async summary(query: ReportRangeDto, user: RequestUser) {
    const { from, to } = this.range(query);
    const [sales, purchases, methods, users, products] = await Promise.all([
      this.salesRows(from, to, 10000),
      this.prisma.supplierPurchase.findMany({ where: { status: 'CONFIRMED', confirmedAt: { gte: from, lt: to } }, select: { totalAmount: true } }),
      this.prisma.$queryRaw<Array<{ name: string; amount: Prisma.Decimal; operations: bigint }>>(Prisma.sql`SELECT pm.name,COALESCE(SUM(sp.amount),0) amount,COUNT(DISTINCT sp.sale_id)::bigint operations FROM sale_payments sp JOIN payment_methods pm ON pm.id=sp.payment_method_id JOIN sales s ON s.id=sp.sale_id WHERE s.status<>'VOIDED' AND s.confirmed_at>=${from} AND s.confirmed_at<${to} GROUP BY pm.name ORDER BY amount DESC`),
      this.prisma.$queryRaw<Array<{ name: string; amount: Prisma.Decimal; operations: bigint }>>(Prisma.sql`SELECT u.display_name name,COALESCE(SUM(s.total_amount),0) amount,COUNT(*)::bigint operations FROM sales s JOIN users u ON u.id=s.user_id WHERE s.status<>'VOIDED' AND s.confirmed_at>=${from} AND s.confirmed_at<${to} GROUP BY u.display_name ORDER BY amount DESC`),
      this.productPerformance(from, to, query.limit),
    ]);
    const revenue = sales.reduce((sum, row) => sum.plus(row.net), new Prisma.Decimal(0)); const profit = sales.reduce((sum, row) => sum.plus(row.profit), new Prisma.Decimal(0)); const purchaseTotal = purchases.reduce((sum, row) => sum.plus(row.totalAmount), new Prisma.Decimal(0));
    return jsonSafe({ range: { from, to }, totals: { sales: sales.length, revenue: moneyText(revenue), purchases: purchases.length, purchaseTotal: moneyText(purchaseTotal), ...(user.permissions.includes('profits.read') ? { profit: moneyText(profit), marginPercent: revenue.isZero() ? '0.00' : profit.div(revenue).mul(100).toFixed(2) } : {}) }, byPaymentMethod: methods.map((row) => ({ name: row.name, amount: amount(row.amount), operations: number(row.operations) })), byUser: users.map((row) => ({ name: row.name, amount: amount(row.amount), operations: number(row.operations) })), products });
  }

  async inventory(user: RequestUser) {
    const rows = await this.stockRows(); const seeCost = user.permissions.includes('costs.read'); const seeProfit = user.permissions.includes('profits.read');
    return rows.map((row) => ({ ...row, ...(!seeCost ? { Costo: undefined, 'Valor costo': undefined } : {}), ...(!seeProfit ? { Ganancia: undefined } : {}) }));
  }

  async export(query: ExportReportDto, context: ActionContext) {
    const { from, to } = this.range(query); let title = ''; let rows: TableRow[] = [];
    if (query.dataset === 'stock') { title = 'Stock completo'; rows = await this.inventory(context.actor); }
    if (query.dataset === 'sales') { title = 'Ventas'; rows = (await this.salesRows(from, to, 100000)).map((row) => ({ Numero: row.number.toString(), Fecha: row.date.toISOString(), Cliente: row.customer, Usuario: row.user, Estado: row.status, Total: moneyText(row.total), Devoluciones: moneyText(row.refund), Neto: moneyText(row.net), ...(context.actor.permissions.includes('profits.read') ? { Ganancia: moneyText(row.profit) } : {}) })); }
    if (query.dataset === 'purchases') { title = 'Compras a proveedores'; rows = (await this.prisma.supplierPurchase.findMany({ where: { confirmedAt: { gte: from, lt: to } }, orderBy: { confirmedAt: 'desc' }, include: { supplier: { select: { name: true } }, user: { select: { displayName: true } } } })).map((row) => ({ Numero: row.number.toString(), Fecha: row.confirmedAt.toISOString(), Proveedor: row.supplier.name, Usuario: row.user.displayName, Estado: row.status, Total: moneyText(row.totalAmount) })); }
    if (query.dataset === 'audit') { title = 'Auditoria'; rows = (await this.prisma.auditLog.findMany({ where: { occurredAt: { gte: from, lt: to } }, take: 100000, orderBy: { occurredAt: 'desc' }, include: { actor: { select: { displayName: true } } } })).map((row) => ({ Fecha: row.occurredAt.toISOString(), Usuario: row.actor?.displayName ?? 'Sistema', Accion: row.action, Entidad: row.entityType, ID: row.entityId ?? '', Solicitud: row.requestId ?? '' })); }
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => row[key] !== undefined)))];
    const buffer = query.format === 'csv' ? toCsv(headers, rows) : query.format === 'xlsx' ? toXlsx(headers, rows, title) : toPdf(title, headers, rows);
    await this.prisma.auditLog.create({ data: { actorUserId: context.actor.id, action: 'report.exported', entityType: 'report', afterData: { dataset: query.dataset, format: query.format, rows: rows.length, from: from.toISOString(), to: to.toISOString() }, ip: context.ip, userAgent: context.userAgent?.slice(0, 512), requestId: context.requestId } });
    return { title, rows: rows.length, buffer, contentType: query.format === 'csv' ? 'text/csv; charset=utf-8' : query.format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/pdf', extension: query.format };
  }

  private async salesRows(from: Date, to: Date, limit: number) {
    return this.prisma.$queryRaw<Array<{ id: string; number: bigint; date: Date; status: string; customer: string; user: string; total: Prisma.Decimal; refund: Prisma.Decimal; net: Prisma.Decimal; profit: Prisma.Decimal }>>(Prisma.sql`
      SELECT s.id,s.number,s.confirmed_at date,s.status::text,COALESCE(NULLIF(TRIM(CONCAT(c.first_name,' ',c.last_name)),''),'Consumidor final') customer,u.display_name "user",s.total_amount total,
        COALESCE(r.refund,0) refund,s.total_amount-COALESCE(r.refund,0) net,s.profit_amount-COALESCE(r.returned_profit,0) profit
      FROM sales s LEFT JOIN customers c ON c.id=s.customer_id JOIN users u ON u.id=s.user_id
      LEFT JOIN LATERAL (SELECT COALESCE(SUM(ri.refund_amount),0) refund,COALESCE(SUM(ri.refund_amount-ri.quantity*si.unit_cost_amount),0) returned_profit FROM return_transactions rt JOIN return_items ri ON ri.return_transaction_id=rt.id JOIN sale_items si ON si.id=ri.sale_item_id WHERE rt.sale_id=s.id) r ON true
      WHERE s.status<>'VOIDED' AND s.confirmed_at>=${from} AND s.confirmed_at<${to} ORDER BY s.confirmed_at DESC LIMIT ${limit}`);
  }

  private async productPerformance(from: Date, to: Date, limit: number) {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; sku: string; units: bigint; revenue: Prisma.Decimal; profit: Prisma.Decimal }>>(Prisma.sql`SELECT si.product_name name,si.sku,SUM(si.quantity-si.returned_quantity)::bigint units,SUM(si.line_total_amount)-COALESCE(SUM(r.refund),0) revenue,SUM(si.line_total_amount-si.quantity*si.unit_cost_amount)-COALESCE(SUM(r.returned_profit),0) profit FROM sale_items si JOIN sales s ON s.id=si.sale_id LEFT JOIN LATERAL (SELECT SUM(refund_amount) refund,SUM(refund_amount-ri.quantity*si.unit_cost_amount) returned_profit FROM return_items ri WHERE ri.sale_item_id=si.id) r ON true WHERE s.status<>'VOIDED' AND s.confirmed_at>=${from} AND s.confirmed_at<${to} GROUP BY si.product_name,si.sku ORDER BY units DESC LIMIT ${limit}`);
    return rows.map((row) => ({ name: row.name, sku: row.sku, units: number(row.units), revenue: amount(row.revenue), profit: amount(row.profit) }));
  }

  private async stockRows(): Promise<TableRow[]> {
    const rows = await this.prisma.productVariant.findMany({ where: { archivedAt: null, product: { archivedAt: null } }, orderBy: [{ product: { name: 'asc' } }, { sku: 'asc' }], include: { product: { include: { category: true, brand: true, gender: true } }, color: true, size: true, inventory: true } });
    return rows.map((row) => { const stock = row.inventory?.quantity ?? 0; return { Nombre: row.product.name, SKU: row.sku, Categoria: row.product.category?.name ?? '', Marca: row.product.brand?.name ?? '', Genero: row.product.gender?.name ?? '', Color: row.color?.name ?? '', Talle: row.size?.name ?? '', Stock: stock, Minimo: row.minStockOverride ?? row.product.minStock, Costo: moneyText(row.costAmount), Precio: moneyText(row.salePriceAmount), Ganancia: moneyText(row.salePriceAmount.minus(row.costAmount)), 'Valor costo': moneyText(row.costAmount.mul(stock)), 'Valor venta': moneyText(row.salePriceAmount.mul(stock)) }; });
  }

  private range(query: ReportRangeDto) { const to = query.to ? new Date(`${query.to}T23:59:59.999-03:00`) : new Date(); const from = query.from ? new Date(`${query.from}T00:00:00-03:00`) : new Date(to.getTime()-29*86400000); if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from>to) throw new BadRequestException('El rango de fechas no es válido.'); return { from, to: new Date(to.getTime()+1) }; }
  private periods() { const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()); const today = new Date(`${parts}T00:00:00-03:00`); const week = new Date(today); week.setDate(week.getDate()-((week.getDay()+6)%7)); const month = new Date(`${parts.slice(0,7)}-01T00:00:00-03:00`); return { today, week, month }; }
  private fillTrend(rows:Array<{day:Date;sales:bigint;revenue:Prisma.Decimal}>){const byDay=new Map(rows.map((row)=>[row.day.toISOString().slice(0,10),row]));return Array.from({length:7},(_,index)=>{const date=new Date(Date.now()-(6-index)*86400000);const key=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);const row=byDay.get(key);return{day:`${key}T12:00:00-03:00`,sales:number(row?.sales??0),revenue:amount(row?.revenue??null)};});}
}
