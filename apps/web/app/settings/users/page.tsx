'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SessionUser } from '@crm/contracts';
import { api } from '../../../lib/api';
import { MobileNav } from '../../components/mobile-nav';

interface Role { id: string; code: string; name: string; isSystem: boolean; _count: { users: number }; permissions: Array<{ permission: { code: string } }> }
interface User { id: string; username: string; displayName: string; email: string | null; status: 'ACTIVE' | 'DISABLED'; lastLoginAt: string | null; roles: Array<{ role: { id: string; code: string; name: string } }> }

export default function UsersPage() {
  const router = useRouter();
  const [me, setMe] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canManage = me?.permissions.includes('users.manage') ?? false;

  const load = useCallback(async () => {
    try {
      const [session, userRows, roleRows] = await Promise.all([api<SessionUser>('/auth/me'), api<User[]>('/users'), api<Role[]>('/roles')]);
      if (!session.permissions.includes('users.read')) return router.replace('/dashboard');
      setMe(session); setUsers(userRows); setRoles(roleRows);
    } catch { router.replace('/login'); }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = event.currentTarget; const data = new FormData(form);
    try {
      await api('/users', { method: 'POST', body: JSON.stringify({
        username: data.get('username'), displayName: data.get('displayName'), email: data.get('email') || undefined,
        password: data.get('password'), roleIds: [data.get('roleId')],
      }) });
      form.reset(); setMessage('Usuario creado correctamente.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el usuario.'); }
  }

  async function toggleUser(user: User) {
    setError(''); setMessage('');
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ status: user.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' }) });
      setMessage(user.status === 'ACTIVE' ? 'Usuario desactivado.' : 'Usuario activado.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el usuario.'); }
  }

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const form = event.currentTarget; const data = new FormData(form);
    try {
      await api('/roles', { method: 'POST', body: JSON.stringify({ code: data.get('code'), name: data.get('name'), description: data.get('description') || undefined, permissionCodes: ['users.read'] }) });
      form.reset(); setMessage('Rol creado con acceso de lectura.'); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear el rol.'); }
  }

  if (!me) return <main className="loading-screen">Cargando administración…</main>;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><span className="mini-mark">LR</span><strong>Local de Ropa</strong></div>
        <nav><Link href="/dashboard">Inicio<span>›</span></Link><Link href="/products">Productos<span>›</span></Link><Link href="/inventory">Stock<span>›</span></Link><Link href="/suppliers">Proveedores<span>›</span></Link><Link className="nav-active" href="/settings/users">Usuarios y roles<span>›</span></Link></nav>
      </aside>
      <section className="workspace admin-workspace">
        <header><div><p className="eyebrow dark">SEGURIDAD</p><h1>Usuarios y roles</h1><p className="muted">Controlá quién entra al sistema y qué puede hacer.</p></div><span className="status"><i /> Sesión protegida</span></header>
        {(error || message) && <p className={error ? 'error' : 'success'} role="status">{error || message}</p>}
        {canManage && <section className="admin-forms">
          <form className="admin-card" onSubmit={createUser}>
            <h2>Nuevo usuario</h2>
            <label>Nombre visible<input name="displayName" minLength={2} required /></label>
            <label>Usuario<input name="username" minLength={3} pattern="[a-zA-Z0-9._-]+" required /></label>
            <label>Correo opcional<input name="email" type="email" /></label>
            <label>Contraseña temporal<input name="password" type="password" minLength={12} required /></label>
            <label>Rol<select name="roleId" required>{roles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
            <button type="submit">Crear usuario</button>
          </form>
          {me.permissions.includes('roles.manage') && <form className="admin-card" onSubmit={createRole}>
            <h2>Nuevo rol básico</h2>
            <label>Nombre<input name="name" minLength={2} required /></label>
            <label>Código<input name="code" minLength={3} pattern="[a-z0-9._-]+" required /></label>
            <label>Descripción<textarea name="description" rows={3} /></label>
            <p className="muted small-copy">Se crea con permiso de consulta. Los permisos avanzados están disponibles por API.</p>
            <button type="submit">Crear rol</button>
          </form>}
        </section>}
        <section className="table-card">
          <div className="table-title"><h2>Equipo</h2><span>{users.length} usuarios</span></div>
          <div className="responsive-table"><table><thead><tr><th>Persona</th><th>Roles</th><th>Estado</th><th>Último acceso</th><th /></tr></thead><tbody>
            {users.map((user) => <tr key={user.id}><td><strong>{user.displayName}</strong><small>@{user.username}{user.email ? ` · ${user.email}` : ''}</small></td><td>{user.roles.map(({ role }) => role.name).join(', ')}</td><td><span className={`badge ${user.status === 'ACTIVE' ? 'active' : ''}`}>{user.status === 'ACTIVE' ? 'Activo' : 'Desactivado'}</span></td><td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('es-AR') : 'Nunca'}</td><td>{canManage && user.id !== me.id && <button className="secondary" onClick={() => void toggleUser(user)}>{user.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>}</td></tr>)}
          </tbody></table></div>
        </section>
      </section><MobileNav />
    </main>
  );
}
