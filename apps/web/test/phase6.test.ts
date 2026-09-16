import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../app/manifest';

const read = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 6 delivery', () => {
  it('publishes an installable standalone manifest', () => {
    const value = manifest();
    expect(value.display).toBe('standalone');
    expect(value.start_url).toContain('/dashboard');
    expect(value.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
      expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      expect.objectContaining({ purpose: 'maskable' }),
    ]));
  });

  it('never caches API calls or mutations in the service worker', () => {
    const worker = read('../public/sw.js');
    expect(worker).toContain("request.method !== 'GET'");
    expect(worker).toContain("url.pathname.startsWith('/api/')");
    expect(worker).toContain("caches.match('/offline')");
  });

  it('subscribes to authenticated same-origin SSE updates', () => {
    const bootstrap = read('../app/components/pwa-bootstrap.tsx');
    expect(bootstrap).toContain("new EventSource('/api/v1/events'");
    expect(bootstrap).toContain('sale.confirmed');
    expect(bootstrap).toContain('purchase.confirmed');
    expect(bootstrap).toContain("new CustomEvent('crm:data-changed'");
  });

  it('routes Cloudflare only to the web tier and closes unmatched hostnames', () => {
    const config = read('../../../infrastructure/windows/cloudflare/config.yml.example');
    expect(config).toContain('service: http://127.0.0.1:3000');
    expect(config).not.toContain('127.0.0.1:4000');
    expect(config).toContain('service: http_status:404');
  });

  it('keeps the desktop shell pointed at the local web service', () => {
    const config = JSON.parse(read('../../desktop/src-tauri/tauri.conf.json')) as {
      build: { frontendDist: string };
      bundle: { targets: string[] };
    };
    expect(config.build.frontendDist).toBe('http://127.0.0.1:3000');
    expect(config.bundle.targets).toContain('nsis');
  });
});
