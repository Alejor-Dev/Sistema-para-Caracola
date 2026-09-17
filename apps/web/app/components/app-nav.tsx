import Link from 'next/link';

const links = [
  ['/dashboard', 'Inicio'], ['/sales', 'Ventas'], ['/customers', 'Clientes'], ['/products', 'Productos'],
  ['/inventory', 'Stock'], ['/purchases', 'Compras'], ['/returns', 'Devoluciones'], ['/suppliers', 'Proveedores'],
  ['/reports', 'Reportes'], ['/imports', 'Importar'], ['/audit', 'Auditoría'],
  ['/settings/users', 'Usuarios y roles'],
] as const;

export function AppNav({ active }: { active: string }) {
  return <aside className="sidebar"><div className="sidebar-brand"><img className="mini-logo" src="/brand/caracola-logo.png" alt="" /><strong>Caracola</strong></div><nav>{links.map(([href, label]) => <Link className={active === href ? 'nav-active' : undefined} href={href} key={href}>{label}<span>›</span></Link>)}</nav></aside>;
}
