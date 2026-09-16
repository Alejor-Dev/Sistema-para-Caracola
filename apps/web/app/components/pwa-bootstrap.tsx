'use client';

import { useEffect, useState } from 'react';

export function PwaBootstrap() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateStatus = () => setOffline(!navigator.onLine);
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // The application remains fully usable if registration is unavailable.
      });
    }

    const eventSource = new EventSource('/api/v1/events', { withCredentials: true });
    const eventNames = ['sale.confirmed', 'sale.voided', 'sale.returned', 'purchase.confirmed'];
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const refreshData = (event: Event) => {
      window.dispatchEvent(new CustomEvent('crm:data-changed', { detail: { type: event.type } }));
      const liveViews = ['/dashboard', '/inventory', '/products', '/reports', '/customers', '/suppliers'];
      const editing = document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement;
      if (!editing && liveViews.some((path) => window.location.pathname.startsWith(path))) {
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => window.location.reload(), 500);
      }
    };
    eventNames.forEach((name) => eventSource.addEventListener(name, refreshData));

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      clearTimeout(refreshTimer);
      eventNames.forEach((name) => eventSource.removeEventListener(name, refreshData));
      eventSource.close();
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="connectivity-banner" role="status">
      Sin conexión a la PC principal. Podés consultar esta pantalla, pero las operaciones quedan pausadas.
    </div>
  );
}
