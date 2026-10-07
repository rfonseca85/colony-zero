import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });

// WebGPU often renders a blank canvas in headless Chromium; set PLAYWRIGHT_HEADED=1 for captures.
const browser = await chromium.launch({
  headless: process.env.PLAYWRIGHT_HEADED !== '1',
  args: ['--enable-unsafe-webgpu'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('pageerror', (err) => console.error('pageerror:', err.message));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 120_000 });
await page.waitForFunction(
  () => {
    const app = document.getElementById('app');
    if (!app) return false;
    const t = app.textContent ?? '';
    if (t.includes('Loading assets')) return false;
    if (t.includes('Failed to start')) throw new Error(t);
    return document.querySelector('canvas') !== null;
  },
  { timeout: 120_000 },
);
await page.waitForTimeout(2500);

await page.screenshot({ path: path.join(outDir, 'hub.png') });
await page.getByRole('button', { name: 'OPEN MAP' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(outDir, 'planning.png') });
await page.getByRole('button', { name: 'BEGIN WAVE' }).click();
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(outDir, 'combat.png') });

await browser.close();
console.log('Wrote screenshots to', outDir);
