'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [setupState, setSetupState] = useState<'checking' | 'setup' | 'login' | 'error'>('checking');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function checkSetup() {
    setSetupState('checking');
    setError('');
    try {
      const status = await api<{ initialized: boolean }>('/setup/status');
      setSetupState(status.initialized ? 'login' : 'setup');
    } catch (cause) {
      setSetupState('error');
      setError(cause instanceof Error ? cause.message : 'No se pudo comprobar la configuración inicial.');
    }
  }

  useEffect(() => {
    void checkSetup();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      if (setupState === 'setup') {
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
          <div><p className="eyebrow dark">{setupState === 'setup' ? 'PRIMERA CONFIGURACIÓN' : setupState === 'checking' ? 'CARGANDO' : setupState === 'error' ? 'CONFIGURACIÓN' : 'BIENVENIDO'}</p><h2>{setupState === 'setup' ? 'Crear cuenta supervisora' : setupState === 'error' ? 'No se pudo comprobar el sistema' : setupState === 'checking' ? 'Comprobando configuración…' : 'Ingresar al sistema'}</h2><p className="muted">{setupState === 'setup' ? 'Esta cuenta tendrá control total del sistema y podrá crear otros usuarios.' : setupState === 'error' ? 'La aplicación no puede confirmar si ya existe un supervisor. Reintentá cuando los servicios estén iniciados.' : setupState === 'checking' ? 'Esperá un momento mientras verificamos la instalación.' : 'Usá las credenciales configuradas para tu cuenta.'}</p></div>
          {setupState === 'setup' && <label>Nombre completo<input name="displayName" autoComplete="name" minLength={2} maxLength={120} required autoFocus /></label>}
          {setupState !== 'checking' && setupState !== 'error' && <label>Usuario<input name="username" autoComplete="username" minLength={3} required autoFocus /></label>}
          {setupState !== 'checking' && setupState !== 'error' && <label>Contraseña<input name="password" type="password" autoComplete={setupState === 'setup' ? 'new-password' : 'current-password'} minLength={setupState === 'setup' ? 12 : 10} required /></label>}
          {setupState === 'setup' && <label>Repetir contraseña<input name="passwordConfirmation" type="password" autoComplete="new-password" minLength={12} required /></label>}
          {error && <p className="error" role="alert">{error}</p>}
          {setupState === 'error' ? <button type="button" onClick={() => void checkSetup()}>Reintentar conexión</button> : <button type="submit" disabled={loading || setupState === 'checking'}>{loading ? (setupState === 'setup' ? 'Creando cuenta…' : 'Ingresando…') : (setupState === 'setup' ? 'Crear cuenta y entrar' : 'Ingresar')}</button>}
          <p className="security-note">La sesión se protege y expira automáticamente por inactividad.</p>
        </form>
      </section>
    </main>
  );
}
