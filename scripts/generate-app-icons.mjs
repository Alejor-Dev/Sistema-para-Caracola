import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../apps/web/public/icons/app-icon.svg', import.meta.url));
const targets = [
  ['../apps/web/public/icons/icon-192.png', 192, false],
  ['../apps/web/public/icons/icon-512.png', 512, false],
  ['../apps/web/public/icons/icon-maskable-512.png', 512, true],
  ['../apps/web/public/icons/apple-touch-icon.png', 180, false],
  ['../apps/desktop/src-tauri/icons/32x32.png', 32, false],
  ['../apps/desktop/src-tauri/icons/128x128.png', 128, false],
  ['../apps/desktop/src-tauri/icons/128x128@2x.png', 256, false],
  ['../apps/desktop/src-tauri/icons/icon.png', 512, false],
];

for (const [path, size, maskable] of targets) {
  const output = fileURLToPath(new URL(path, import.meta.url));
  const icon = sharp(source).resize(maskable ? Math.round(size * 0.8) : size, maskable ? Math.round(size * 0.8) : size);
  if (maskable) {
    await sharp({ create: { width: size, height: size, channels: 4, background: '#17211c' } })
      .composite([{ input: await icon.png().toBuffer(), gravity: 'centre' }])
      .png()
      .toFile(output);
  } else {
    await icon.png().toFile(output);
  }
}
