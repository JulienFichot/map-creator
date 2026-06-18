import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const OUT = path.resolve('scripts/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(30000);
await page.setViewportSize({ width: 1400, height: 900 });

// ── 1. Empty state ────────────────────────────────────────────────────────────
await page.goto('http://localhost:3000');
await page.waitForSelector('input[type="text"]');
await page.screenshot({ path: `${OUT}/01-empty.png`, fullPage: false });
console.log('✓ empty state');

// ── 2. Fill city, set radius, generate ───────────────────────────────────────
// City input (first text input in control panel)
const cityInput = page.locator('input[type="text"]').first();
await cityInput.fill('Sens');

// Radius: type into the large number input
const radiusInput = page.locator('input[type="number"]').first();
await radiusInput.fill('30');

// Click Générer
await page.locator('button:has-text("Générer")').click();

// Wait for the map to render (Leaflet tiles or the dept layer)
await page.waitForSelector('.leaflet-container', { timeout: 20000 });
// Extra pause for tile/layer rendering
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/02-map.png`, fullPage: false });
console.log('✓ map rendered');

// ── 3. Add an extra zone ──────────────────────────────────────────────────────
// Click the "Zones supplémentaires" toggle button to expand the panel
await page.locator('button:has-text("Zones supplémentaires")').click();
await page.waitForTimeout(400);

// Fill the city input (placeholder contains "Chartres")
const zoneInput = page.locator('input[placeholder*="Chartres"]');
await zoneInput.waitFor({ state: 'visible' });
await zoneInput.fill('Troyes');

// Click the orange + button next to the zone input
await page.locator('div:has(> input[placeholder*="Chartres"]) > button').click();
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}/03-extra-zone.png`, fullPage: false });
console.log('✓ extra zone added');

// ── 4. Console errors ─────────────────────────────────────────────────────────
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
if (errors.length) {
  console.warn('Console errors:', errors);
} else {
  console.log('✓ no console errors captured');
}

await browser.close();
console.log(`\nScreenshots → ${OUT}`);
