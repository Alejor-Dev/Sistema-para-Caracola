'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@crm/contracts';
import { API_URL, api } from '../../lib/api';
import { MobileNav } from '../components/mobile-nav';
import { AppNav } from '../components/app-nav';

interface CatalogItem { id: string; name: string; code: string }
interface Variant { id: string; sku: string; barcode: string | null; salePriceAmount: string; costAmount?: string; profitAmount?: string; inventory: { quantity: number } | null; color: CatalogItem | null; size: CatalogItem | null }
interface Product { id: string; name: string; minStock: number; totalStock: number; category: CatalogItem | null; brand: CatalogItem | null; variants: Variant[]; images: Array<{ id: string }> }
interface ProductResponse { data: Product[]; pagination: { total: number } }

export default function ProductsPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, CatalogItem[]>>({});
  const [suppliers, setSuppliers] = useState<CatalogItem[]>([]);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<{ error?: string; message?: string }>({});

  const load = useCallback(async (term = '') => {
    try {
      const session = await api<SessionUser>('/auth/me');
      if (!session.permissions.includes('products.read')) return router.replace('/dashboard');
      const [response, categories, brands, colors, sizes, supplierRows] = await Promise.all([
        api<ProductResponse>(`/products?pageSize=50${term ? `&search=${encodeURIComponent(term)}` : ''}`),
        api<CatalogItem[]>('/catalogs/categories'), api<CatalogItem[]>('/catalogs/brands'), api<CatalogItem[]>('/catalogs/colors'), api<CatalogItem[]>('/catalogs/sizes'), api<CatalogItem[]>('/suppliers'),
      ]);
      setMe(session); setProducts(response.data); setTotal(response.pagination.total); setCatalogs({ categories, brands, colors, sizes }); setSuppliers(supplierRows);
    } catch { router.replace('/login'); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback({}); const form = event.currentTarget; const data = new FormData(form);
    const optional = (name: string) => data.get(name) || undefined;
    try {
      const product = await api<{ id: string }>('/products', { method: 'POST', body: JSON.stringify({
        name: data.get('name'), categoryId: optional('categoryId'), brandId: optional('brandId'), defaultSupplierId: optional('supplierId'), minStock: Number(data.get('minStock')),
        variants: [{ sku: data.get('sku'), barcode: optional('barcode'), colorId: optional('colorId'), sizeId: optional('sizeId'), costAmount: data.get('costAmount'), salePriceAmount: data.get('salePriceAmount'), initialStock: Number(data.get('initialStock')) }],
      }) });
      const image = data.get('image');
      if (image instanceof File && image.size > 0) { const upload = new FormData(); upload.append('image', image); await api(`/products/${product.id}/images`, { method: 'POST', body: upload }); }
      form.reset(); setFeedback({ message: 'Producto y stock inicial guardados.' }); await load(search);
    } catch (cause) { setFeedback({ error: cause instanceof Error ? cause.message : 'No se pudo crear el producto.' }); }
  }

  async function createCatalog(type: string) {
    const name = window.prompt(`Nombre para ${type}`)?.trim(); if (!name) return;
    const code = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try { await api(`/catalogs/${type}`, { method: 'POST', body: JSON.stringify({ name, code }) }); setFeedback({ message: 'Opción agregada.' }); await load(search); }
    catch (cause) { setFeedback({ error: cause instanceof Error ? cause.message : 'No se pudo agregar.' }); }
  }

  if (!me) return <main className="loading-screen">Cargando productos…</main>;
  const canCreate = me.permissions.includes('products.create');
  return <main className="app-shell">
    <AppNav active="/products" />
    <section className="workspace admin-workspace">
      <header><div><p className="eyebrow dark">CATÁLOGO</p><h1>Productos y variantes</h1><p className="muted">Buscá por nombre, SKU o código de barras.</p></div><span className="status"><i /> {total} productos</span></header>
      {(feedback.error || feedback.message) && <p className={feedback.error ? 'error' : 'success'}>{feedback.error || feedback.message}</p>}
      <form className="search-bar" onSubmit={(event) => { event.preventDefault(); void load(search); }}><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, SKU o escanear código…" autoFocus /><button>Buscar</button></form>
      {canCreate && <details className="admin-card create-panel"><summary>Agregar producto</summary><form className="product-form" onSubmit={createProduct}>
        <label>Nombre<input name="name" minLength={2} required /></label><label>SKU<input name="sku" required /></label><label>Código de barras<input name="barcode" /></label><label>Foto<input name="image" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        <label>Categoría<select name="categoryId"><option value="">Sin categoría</option>{catalogs.categories?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Marca<select name="brandId"><option value="">Sin marca</option>{catalogs.brands?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Color<select name="colorId"><option value="">Sin color</option>{catalogs.colors?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Talle<select name="sizeId"><option value="">Sin talle</option>{catalogs.sizes?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Proveedor<select name="supplierId"><option value="">Sin proveedor</option>{suppliers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label>Costo<input name="costAmount" inputMode="decimal" pattern="\d+(\.\d{1,4})?" required /></label><label>Precio<input name="salePriceAmount" inputMode="decimal" pattern="\d+(\.\d{1,4})?" required /></label>
        <label>Stock inicial<input name="initialStock" type="number" min="0" defaultValue="0" required /></label><label>Stock mínimo<input name="minStock" type="number" min="0" defaultValue="0" required /></label>
        <button type="submit">Guardar producto</button>
      </form><div className="quick-catalog"><span>Agregar opción:</span>{[['categories','Categoría'],['brands','Marca'],['colors','Color'],['sizes','Talle']].map(([type,label]) => <button key={type} type="button" onClick={() => void createCatalog(type)}>+ {label}</button>)}</div></details>}
      <section className="product-grid">{products.map((product) => <article className="product-card" key={product.id}>{product.images[0] && <img className="product-image" src={`${API_URL}/products/images/${product.images[0].id}/content`} alt={product.name} />}<div className="product-heading"><div><small>{product.category?.name ?? 'Sin categoría'} · {product.brand?.name ?? 'Sin marca'}</small><h2>{product.name}</h2></div><span className={`stock-pill ${product.totalStock <= product.minStock ? 'warning' : ''}`}>{product.totalStock} u.</span></div><div className="variant-list">{product.variants.map((variant) => <div key={variant.id}><span><strong>{variant.sku}</strong><small>{[variant.color?.name, variant.size?.name].filter(Boolean).join(' · ') || 'Única'}</small></span><span><strong>$ {Number(variant.salePriceAmount).toLocaleString('es-AR')}</strong><small>Stock {variant.inventory?.quantity ?? 0}</small></span></div>)}</div></article>)}</section>
      {!products.length && <section className="empty-module"><h2>No hay productos</h2><p>Cargá el primero o cambiá la búsqueda.</p></section>}
    </section><MobileNav />
  </main>;
}
