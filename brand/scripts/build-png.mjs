/**
 * Rasterise the brand SVGs into the PNGs Expo and the stores need.
 *
 * Uses the Chromium that ships with Playwright rather than a native rasteriser,
 * so this runs anywhere Node runs with no system libraries to install.
 *
 *   node brand/scripts/build-png.mjs
 *
 * Outputs into apps/mobile/assets/, which is what app.json points at.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const brandDir = path.resolve(here, '..');
const iconDir = path.join(brandDir, 'icons');
const outDir = path.resolve(brandDir, '../apps/mobile/assets');

/** Playwright may be installed locally or globally; accept either. */
function loadChromium() {
  const require = createRequire(import.meta.url);
  for (const spec of ['playwright', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(spec).chromium;
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    'Playwright not found. Run `npm i -D playwright` or install it globally, then re-run.',
  );
}

/**
 * What each store actually wants.
 *
 * `transparent` matters: adaptive-icon layers and the monochrome icon must keep
 * their alpha, while the main store icon must be fully opaque — Apple rejects
 * an App Store icon that contains any transparency.
 */
const TARGETS = [
  { svg: 'icon-hi.svg', out: 'icon.png', size: 1024, transparent: false },
  { svg: 'icon-hi.svg', out: 'favicon.png', size: 96, transparent: false },
  { svg: 'splash.svg', out: 'splash.png', size: 1024, transparent: false },
  { svg: 'adaptive-foreground.svg', out: 'android-icon-foreground.png', size: 1024, transparent: true },
  { svg: 'adaptive-background.svg', out: 'android-icon-background.png', size: 1024, transparent: false },
  { svg: 'icon-monochrome.svg', out: 'android-icon-monochrome.png', size: 1024, transparent: true },
  // Regional variants, ready to swap in when a city launches.
  ...['mr', 'te', 'ta', 'kn'].map((code) => ({
    svg: `icon-${code}.svg`,
    out: `regional/icon-${code}.png`,
    size: 1024,
    transparent: false,
  })),
];

const chromium = loadChromium();
const browser = await chromium.launch();

for (const target of TARGETS) {
  const svgPath = path.join(iconDir, target.svg);
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Missing ${svgPath}. Run build-icons.py first.`);
  }

  const svg = fs
    .readFileSync(svgPath, 'utf8')
    .replace(/width="\d+"\s+height="\d+"/, `width="${target.size}" height="${target.size}"`);

  const page = await browser.newPage({
    viewport: { width: target.size, height: target.size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;overflow:hidden">
       <div style="width:${target.size}px;height:${target.size}px">${svg}</div>
     </body></html>`,
  );

  const outPath = path.join(outDir, target.out);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, omitBackground: target.transparent });
  await page.close();

  console.log(`  ${target.out.padEnd(34)} ${target.size}×${target.size}`);
}

await browser.close();
console.log(`\nWrote ${TARGETS.length} PNGs to ${path.relative(process.cwd(), outDir)}`);
