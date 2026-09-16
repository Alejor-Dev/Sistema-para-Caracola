// Same-origin by default: Next proxies this path to the loopback-only API.
// This keeps the browser configuration identical on desktop, LAN and HTTPS.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

export async function api<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { ...(typeof FormData !== 'undefined' && init.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...init.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? 'No se pudo completar la operación.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
