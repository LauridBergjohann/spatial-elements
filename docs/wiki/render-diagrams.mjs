import { chromium } from 'playwright';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('./images/', import.meta.url));
const browser = await chromium.launch({ args: ['--disable-gpu'] });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.svg'))) {
    const svg = await readFile(`${directory}/${name}`, 'utf8');
    await page.setContent(`<style>html,body{margin:0;padding:0}svg{display:block}</style>${svg}`);
    await page.locator('svg').screenshot({ path: `${directory}/${name.replace(/\.svg$/, '.png')}` });
    console.log(`Rendered ${name}`);
  }
} finally { await browser.close(); }
