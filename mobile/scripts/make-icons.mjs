/** Generates the AniChain logo and every app icon from one SVG definition. */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BG = '#0B0E11', GOLD = '#F0B90B', GOLD2 = '#FFD54A';
// Mark in a 100x100 box: a leaf whose midrib is a rising stepped price line (cut out of the leaf).
const mark = (fill, { scale = 1, id = 'm' } = {}) => {
  const t = `translate(${50 - 50 * scale} ${50 - 50 * scale}) scale(${scale})`;
  return `
  <defs>
    <linearGradient id="${id}g" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="${fill === 'gold' ? GOLD : fill}"/>
      <stop offset="1" stop-color="${fill === 'gold' ? GOLD2 : fill}"/>
    </linearGradient>
    <mask id="${id}k" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect width="100" height="100" fill="white"/>
      <path d="M27 73 L38 73 L38 62 L49 62 L49 51 L60 51 L60 40 L71 40 L71 29" fill="none" stroke="black" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>
  <g transform="${t}">
    <path mask="url(#${id}k)" fill="url(#${id}g)"
      d="M18 82 C 16 46, 40 20, 84 16 C 86 58, 60 84, 18 82 Z"/>
    <path d="M20 80 L11 89" stroke="url(#${id}g)" stroke-width="5" stroke-linecap="round"/>
    <circle cx="71" cy="29" r="4.5" fill="${fill === 'gold' ? BG : 'none'}"/>
  </g>`;
};
const svg = (inner, size, bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${bg ? `<rect width="100" height="100" fill="${bg}"/>` : ''}${inner}</svg>`;
const png = (s, size) => new Resvg(s, { fitTo: { mode: 'width', value: size } }).render().asPng();

// Usage: npm run icons   (writes into assets/images and assets/brand)
const out = process.argv[2] ?? fileURLToPath(new URL("../assets/images", import.meta.url));
mkdirSync(out, { recursive: true });
const full = svg(mark('gold', { scale: 0.8 }), 100, BG);
writeFileSync(`${out}/icon.png`, png(full, 1024));
writeFileSync(`${out}/favicon.png`, png(full, 48));
// Android adaptive: content must sit in the inner ~66% safe zone.
writeFileSync(`${out}/android-icon-foreground.png`, png(svg(mark('gold', { scale: 0.56 }), 100), 1024));
writeFileSync(`${out}/android-icon-background.png`, png(svg('', 100, BG), 1024));
writeFileSync(`${out}/android-icon-monochrome.png`, png(svg(mark('#FFFFFF', { scale: 0.56, id: 'w' }), 100), 1024));
writeFileSync(`${out}/splash-icon.png`, png(svg(mark('gold'), 100), 1024));
writeFileSync(`${out}/logo.png`, png(svg(mark('gold'), 100), 512));
writeFileSync(fileURLToPath(new URL('../assets/brand/logo.svg', import.meta.url)), svg(mark('gold'), 100));
console.log('ok');
