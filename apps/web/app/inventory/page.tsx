'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@crm/contracts';
import { api } from '../../lib/api';
import { MobileNav } from '../components/mobile-nav';
import { AppNav } from '../components/app-nav';

interface StockRow { variantId: string; quantity: number; reservedQuantity: number; available: number; minimum: number; variant: { sku: string; product: { name: string }; color: { name: string } | null; size: { name: string } | null } }
interface StockResponse { data: StockRow[]; pagination: { total: number } }

export default function InventoryPage() {
  const router = useRouter(); const [me, setMe] = useState<SessionUser | null>(null); const [rows, setRows] = useState<StockRow[]>([]); const [selected, setSelected] = useState<StockRow | null>(null); const [status, setStatus] = useState('all'); const [search, setSearch] = useState(''); const [feedback, setFeedback] = useState<{error?:string;message?:string}>({});
  const load = useCallback(async (term: string, filter: string) => { try { const [session, response] = await Promise.all([api<SessionUser>('/auth/me'), api<StockResponse>(`/inventory?pageSize=100&status=${filter}${term ? `&search=${encodeURIComponent(term)}` : ''}`)]); if (!session.permissions.includes('inventory.read')) return router.replace('/dashboard'); setMe(session); setRows(response.data); } catch { router.replace('/login'); } }, [router]);
  useEffect(() => { void load('', 'all'); }, [load]);
  async function adjust(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!selected) return; const form = event.currentTarget; const data = new FormData(form); setFeedback({}); try { await api('/inventory/adjustments', { method:'POST', body: JSON.stringify({ variantId:selected.variantId, quantityDelta:Number(data.get('quantityDelta')), type:data.get('type'), reasonCode:data.get('reasonCode'), notes:data.get('notes') || undefined }) }); form.reset(); setSelected(null); setFeedback({message:'Movimiento registrado y stock actualizado.'}); await load(search,status); } catch(cause) { setFeedback({error:cause instanceof Error ? cause.message : 'No se pudo ajustar.'}); } }
  if (!me) return <main className="loading-screen">Cargando inventario…</main>;
  return <main className="app-shell"><AppNav active="/inventory"/><section className="workspace admin-workspace">
    <header><div><p className="eyebrow dark">INVENTARIO</p><h1>Stock</h1><p className="muted">Todo cambio queda registrado con usuario, fecha y motivo.</p></div><span className="status"><i /> {rows.length} variantes</span></header>
    {(feedback.error || feedback.message) && <p className={feedback.error?'error':'success'}>{feedback.error||feedback.message}</p>}
    <form className="search-bar" onSubmit={(e)=>{e.preventDefault();void load(search,status);}}><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Producto, SKU o código…"/><select value={status} onChange={(e)=>{setStatus(e.target.value);void load(search,e.target.value);}}><option value="all">Todo</option><option value="low">Stock bajo</option><option value="out">Sin stock</option></select><button>Buscar</button></form>
    {selected && me.permissions.includes('inventory.adjust') && <form className="admin-card adjustment-form" onSubmit={adjust}><div><h2>Ajustar {selected.variant.product.name}</h2><p className="muted">{selected.variant.sku} · stock actual {selected.quantity}</p></div><label>Movimiento<select name="type" required><option value="ADJUSTMENT">Ajuste</option><option value="PURCHASE">Entrada</option><option value="LOSS">Pérdida</option><option value="DAMAGED">Dañado</option><option value="CORRECTION">Corrección</option></select></label><label>Cantidad (+/-)<input name="quantityDelta" type="number" required /></label><label>Motivo<input name="reasonCode" minLength={2} required /></label><label>Observación<input name="notes" /></label><button>Confirmar movimiento</button><button type="button" className="secondary" onClick={()=>setSelected(null)}>Cancelar</button></form>}
    <section className="table-card"><div className="responsive-table"><table><thead><tr><th>Producto</th><th>Variante</th><th>Disponible</th><th>Mínimo</th><th>Estado</th><th/></tr></thead><tbody>{rows.map((row)=><tr key={row.variantId}><td><strong>{row.variant.product.name}</strong><small>{row.variant.sku}</small></td><td>{[row.variant.color?.name,row.variant.size?.name].filter(Boolean).join(' · ')||'Única'}</td><td><strong>{row.available}</strong></td><td>{row.minimum}</td><td><span className={`badge ${row.quantity>row.minimum?'active':''}`}>{row.quantity===0?'Sin stock':row.quantity<=row.minimum?'Bajo':'Normal'}</span></td><td>{me.permissions.includes('inventory.adjust')&&<button className="secondary" onClick={()=>setSelected(row)}>Ajustar</button>}</td></tr>)}</tbody></table></div></section>
  </section><MobileNav /></main>;
}
