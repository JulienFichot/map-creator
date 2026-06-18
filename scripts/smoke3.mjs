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

// Generate map for Sens
await page.locator('input[type="text"]').first().fill('Sens');
await page.locator('button:has-text("Générer")').click();
await page.waitForSelector('.leaflet-container', { timeout: 20000 });
await page.waitForTimeout(3000);

// Add extra zone: Troyes
await page.locator('button:has-text("Zones supplémentaires")').click();
await page.waitForTimeout(300);
const zoneInput = page.locator('input[placeholder*="Chartres"]');
await zoneInput.waitFor({ state: 'visible' });
await zoneInput.fill('Troyes');
await page.locator('div:has(> input[placeholder*="Chartres"]) > button').click();
await page.waitForTimeout(3000);

await page.screenshot({ path: `${OUT}/05-extra-zone-label.png`, fullPage: false });
console.log('done');
await browser.close();
