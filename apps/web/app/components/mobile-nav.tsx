import Link from 'next/link';

export function MobileNav() {
  return <nav className="mobile-nav"><Link href="/dashboard">Inicio</Link><Link href="/sales">Vender</Link><Link href="/products">Productos</Link><Link href="/inventory">Stock</Link><Link href="/reports">Reportes</Link><Link href="/imports">Importar</Link></nav>;
}
