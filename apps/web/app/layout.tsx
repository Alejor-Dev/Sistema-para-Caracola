import type { Metadata, Viewport } from 'next';
import { PwaBootstrap } from './components/pwa-bootstrap';
import './styles.css';

export const metadata: Metadata = {
  title: { default: 'Caracola', template: '%s · Caracola' },
  description: 'Gestión comercial, ventas e inventario.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Caracola',
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, title: 'Caracola', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = { themeColor: '#17211c', colorScheme: 'light' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><PwaBootstrap />{children}</body></html>;
}
