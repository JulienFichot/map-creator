import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = path.resolve('scripts/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(30000);
await page.setViewportSize({ width: 1400, height: 900 });

await page.goto('http://localhost:3000');
await page.waitForSelector('input[type="text"]');

// Generate map
await page.locator('input[type="text"]').first().fill('Sens');
await page.locator('button:has-text("Générer")').click();
await page.waitForSelector('.leaflet-container', { timeout: 20000 });
await page.waitForTimeout(3000);

// Check z-index of the overlay container (the hint bar parent div)
const zIndex = await page.evaluate(() => {
  // Find the div containing the hint text
  const el = document.querySelector('[class*="z-\\[1001\\]"]');
  if (!el) return 'NOT FOUND';
  return window.getComputedStyle(el).zIndex;
});
console.log('Overlay z-index:', zIndex);

// Check that no Leaflet pane is above 1001
const leafletZIndices = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.leaflet-pane, .leaflet-control'))
    .map(el => ({ cls: el.className, z: window.getComputedStyle(el).zIndex }))
    .filter(e => parseInt(e.z) > 0)
    .sort((a, b) => parseInt(b.z) - parseInt(a.z))
    .slice(0, 5);
});
console.log('Top Leaflet z-indices:', JSON.stringify(leafletZIndices, null, 2));

await page.screenshot({ path: `${OUT}/04-zindex-check.png`, fullPage: false });
await browser.close();
console.log('Done');
