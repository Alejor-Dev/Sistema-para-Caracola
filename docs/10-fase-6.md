# Fase 6 — PWA, escritorio y acceso remoto

## Estado

La implementación local está completa. La aplicación web es instalable como PWA, tiene una pantalla segura para cortes de conexión, funciona en la red local y dispone de una carcasa Windows Tauri preparada para NSIS. Cloudflare Tunnel queda listo para vincularse cuando se disponga del dominio, UUID y credencial reales del cliente.

No se instala Docker, WSL ni una segunda base de datos. PostgreSQL y la API continúan en la PC principal.

## Arquitectura de acceso

```text
Tauri (PC principal) ─┐
PWA / navegador LAN ─┼─> Next.js :3000 ─> /api (proxy interno) ─> NestJS 127.0.0.1:4000 ─> PostgreSQL local
Cloudflare HTTPS ─────┘
```

Solo Next.js escucha en la red. NestJS sigue enlazado a `127.0.0.1` y PostgreSQL no se publica. El navegador usa siempre `/api/v1`, por lo que no intenta resolver `localhost` en el celular.

## PWA

- manifiesto `standalone`, accesos rápidos e iconos de 192, 512, máscara y Apple;
- service worker con caché limitada a la carcasa y recursos estáticos;
- navegación sin conexión hacia `/offline`;
- ninguna llamada `/api`, mutación, sesión o exportación se almacena en caché;
- aviso visible cuando el dispositivo pierde conectividad;
- actualización inmediata de vistas de consulta mediante SSE autenticado, con heartbeat cada 25 segundos;
- no existe sincronización offline deliberadamente: una venta sin conexión podría desalinear el stock.

La instalación PWA desde otro dispositivo requiere HTTPS. El dominio publicado por Cloudflare es la ruta recomendada para celulares, incluso dentro del local.

## Aplicación Windows

El proyecto Tauri está en `apps/desktop`. Es una carcasa liviana que usa WebView2 y abre el servicio local `http://127.0.0.1:3000`; no duplica frontend, API ni datos.

Requisitos de compilación del instalador:

1. Windows 10/11 x64 compatible;
2. WebView2;
3. Visual Studio Build Tools 2022 con desarrollo de escritorio C++;
4. Rust estable mediante `rustup`;
5. Node.js 22 LTS o 24 LTS.

Comandos:

```powershell
npm install
npm run build --workspace=@crm/web
npm run build --workspace=@crm/desktop
```

El resultado NSIS se genera debajo de `apps/desktop/src-tauri/target/release/bundle/nsis`. La instalación, firma y arranque de servicios pertenecen a la Fase 7.

## Red local

El servidor web se inicia escuchando en todas las interfaces:

```powershell
npm run start:lan --workspace=@crm/web
```

Para ver las direcciones disponibles:

```powershell
infrastructure\windows\network\Get-CrmAccessUrls.ps1
```

La regla de firewall se prepara sin aplicarla con:

```powershell
infrastructure\windows\network\Enable-CrmPrivateNetwork.ps1 -WhatIf
```

En instalación se ejecutará como administrador sin `-WhatIf`. La regla abre TCP 3000 únicamente en perfiles de red `Private`; nunca abre la API 4000 ni PostgreSQL 5432.

## Cloudflare Tunnel

La plantilla está en `infrastructure/windows/cloudflare/config.yml.example`. Antes de activar:

1. crear el túnel y el hostname en la cuenta del cliente;
2. copiar la credencial JSON al perfil de sistema indicado por Cloudflare;
3. reemplazar el UUID y `crm.ejemplo.com` en una copia de la plantilla;
4. validar con `Test-CrmTunnelConfig.ps1`;
5. instalar `cloudflared` como servicio Windows siguiendo la guía oficial;
6. comprobar `/healthz` desde el dominio HTTPS.

La regla final `http_status:404` es obligatoria. El origen es HTTP loopback porque el tramo público ya termina en Cloudflare; no se desactiva validación TLS con `noTLSVerify`.

## Seguridad validada

- API y PostgreSQL permanecen en loopback;
- cookies `HttpOnly`, `SameSite=Lax` y `Secure` en producción;
- CORS limitado al origen configurado;
- CSP, `frame-ancestors 'none'`, `X-Frame-Options: DENY`, HSTS y `nosniff`;
- API y service worker con política explícita de no-cache;
- túnel saliente, sin redirección de puertos en el router;
- hostnames no coincidentes reciben `404`.

## Validación realizada

- `next build`: correcto, 18 rutas generadas;
- TypeScript web: correcto;
- 5 pruebas automatizadas específicas de PWA, caché, SSE, túnel y Tauri;
- `/healthz`, `/manifest.webmanifest`, `/sw.js` y `/offline`: HTTP 200;
- manifiesto servido como `application/manifest+json`;
- scripts PowerShell: análisis sintáctico sin errores;
- Tauri CLI 2.11.4 detectó WebView2 y Visual Studio Build Tools;
- la compilación binaria Tauri no se ejecutó en esta PC porque Rust no está instalado.

La activación del dominio HTTPS no puede verificarse sin las credenciales de Cloudflare del cliente. No se guardan tokens ni secretos en el repositorio.
