'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: data.get('username'), password: data.get('password') }) });
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="brand-panel">
        <img className="brand-logo" src="/brand/caracola-logo.png" alt="Caracola" />
        <p className="eyebrow">GESTIÓN COMERCIAL</p>
        <h1>Caracola, ordenada en un solo lugar.</h1>
        <p className="brand-copy">Ventas, stock y clientes conectados en tiempo real, desde la caja o el celular.</p>
        <div className="trust-row"><span>Datos locales</span><span>Acceso seguro</span><span>Auditoría</span></div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div><p className="eyebrow dark">BIENVENIDO</p><h2>Ingresar al sistema</h2><p className="muted">Usá las credenciales configuradas para tu cuenta.</p></div>
          <label>Usuario<input name="username" autoComplete="username" minLength={3} required autoFocus /></label>
          <label>Contraseña<input name="password" type="password" autoComplete="current-password" minLength={10} required /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? 'Ingresando…' : 'Ingresar'}</button>
          <p className="security-note">La sesión se protege y expira automáticamente por inactividad.</p>
        </form>
      </section>
    </main>
  );
}
