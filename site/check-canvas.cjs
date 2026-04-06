const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:4173/#/memory', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000); // wait for SPA to settle

  // Check if canvas exists
  const canvas = await page.$('.sitemap-graph canvas');
  if (!canvas) {
    console.log('Canvas element not found');
  } else {
    const box = await canvas.boundingBox();
    console.log('Canvas bounding box:', box);
    if (box.width === 0 || box.height === 0) {
      console.log('Canvas has zero size');
    } else {
      console.log('Canvas is visible with size', box.width, 'x', box.height);
    }
    // Also check parent
    const parent = await page.$('.sitemap-graph');
    const parentBox = await parent.boundingBox();
    console.log('Parent .sitemap-graph box:', parentBox);
  }

  // Dump any console errors
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('Console error:', msg.text());
  });
  page.on('pageerror', err => console.error('Page error:', err.message));

  await browser.close();
})();
