'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@crm/contracts';
import { api } from '../../lib/api';
import { MobileNav } from '../components/mobile-nav';
import { AppNav } from '../components/app-nav';

interface Supplier { id:string; name:string; companyName:string|null; taxId:string|null; phone:string|null; email:string|null }
export default function SuppliersPage(){
  const router=useRouter(); const [me,setMe]=useState<SessionUser|null>(null); const [rows,setRows]=useState<Supplier[]>([]); const [feedback,setFeedback]=useState<{error?:string;message?:string}>({});
  const load=useCallback(async()=>{try{const [session,data]=await Promise.all([api<SessionUser>('/auth/me'),api<Supplier[]>('/suppliers')]);if(!session.permissions.includes('products.read'))return router.replace('/dashboard');setMe(session);setRows(data);}catch{router.replace('/login');}},[router]); useEffect(()=>{void load();},[load]);
  async function create(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;const data=new FormData(form);setFeedback({});try{await api('/suppliers',{method:'POST',body:JSON.stringify({name:data.get('name'),companyName:data.get('companyName')||undefined,taxId:data.get('taxId')||undefined,phone:data.get('phone')||undefined,email:data.get('email')||undefined})});form.reset();setFeedback({message:'Proveedor guardado.'});await load();}catch(cause){setFeedback({error:cause instanceof Error?cause.message:'No se pudo guardar.'});}}
  if(!me)return <main className="loading-screen">Cargando proveedores…</main>; const canManage=me.permissions.includes('suppliers.manage');
  return <main className="app-shell"><AppNav active="/suppliers"/><section className="workspace admin-workspace"><header><div><p className="eyebrow dark">ABASTECIMIENTO</p><h1>Proveedores</h1><p className="muted">Contactos y origen principal de los productos.</p></div><span className="status"><i /> {rows.length} activos</span></header>{(feedback.error||feedback.message)&&<p className={feedback.error?'error':'success'}>{feedback.error||feedback.message}</p>}
  {canManage&&<form className="admin-card supplier-form" onSubmit={create}><h2>Nuevo proveedor</h2><label>Nombre<input name="name" minLength={2} required/></label><label>Empresa<input name="companyName"/></label><label>CUIT<input name="taxId"/></label><label>Teléfono<input name="phone"/></label><label>Correo<input name="email" type="email"/></label><button>Guardar proveedor</button></form>}
  <section className="table-card"><div className="responsive-table"><table><thead><tr><th>Proveedor</th><th>CUIT</th><th>Teléfono</th><th>Correo</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.name}</strong><small>{row.companyName}</small></td><td>{row.taxId||'—'}</td><td>{row.phone||'—'}</td><td>{row.email||'—'}</td></tr>)}</tbody></table></div></section></section><MobileNav /></main>;
}
