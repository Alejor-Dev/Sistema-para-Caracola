'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    api<{ initialized: boolean }>('/setup/status')
      .then((status) => { if (active) setNeedsSetup(!status.initialized); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'No se pudo comprobar la configuración inicial.'); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      if (needsSetup) {
        const password = String(data.get('password') ?? '');
        if (password !== String(data.get('passwordConfirmation') ?? '')) throw new Error('Las contraseñas no coinciden.');
        await api('/setup/initialize', { method: 'POST', body: JSON.stringify({ displayName: data.get('displayName'), username: data.get('username'), password }) });
      }
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
          <div><p className="eyebrow dark">{needsSetup ? 'PRIMERA CONFIGURACIÓN' : 'BIENVENIDO'}</p><h2>{needsSetup ? 'Crear cuenta supervisora' : 'Ingresar al sistema'}</h2><p className="muted">{needsSetup ? 'Esta cuenta tendrá control total del sistema y podrá crear otros usuarios.' : 'Usá las credenciales configuradas para tu cuenta.'}</p></div>
          {needsSetup && <label>Nombre completo<input name="displayName" autoComplete="name" minLength={2} maxLength={120} required autoFocus /></label>}
          <label>Usuario<input name="username" autoComplete="username" minLength={3} required autoFocus /></label>
          <label>Contraseña<input name="password" type="password" autoComplete={needsSetup ? 'new-password' : 'current-password'} minLength={needsSetup ? 12 : 10} required /></label>
          {needsSetup && <label>Repetir contraseña<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} required /></label>}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="submit" disabled={loading || needsSetup === null}>{loading ? (needsSetup ? 'Creando cuenta…' : 'Ingresando…') : (needsSetup ? 'Crear cuenta y entrar' : 'Ingresar')}</button>
          <p className="security-note">La sesión se protege y expira automáticamente por inactividad.</p>
        </form>
      </section>
    </main>
  );
}
