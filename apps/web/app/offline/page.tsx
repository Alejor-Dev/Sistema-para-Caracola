export default function OfflinePage() {
  return (
    <main className="offline-shell">
      <img className="brand-logo" src="/brand/caracola-logo.png" alt="" aria-hidden="true" />
      <p className="eyebrow dark">CONEXIÓN INTERRUMPIDA</p>
      <h1>La PC principal no está disponible</h1>
      <p>
        El sistema no guarda ventas sin conexión para evitar diferencias de stock. Revisá la red y volvé a intentar.
      </p>
      <a href="/dashboard">Volver a intentar</a>
    </main>
  );
}
