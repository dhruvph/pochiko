const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4173';
const RESULTS_FILE = path.join(__dirname, 'navigation-test-results.json');

async function runTests() {
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    tests: [],
    errors: [],
    consoleMessages: [],
    networkErrors: [],
    screenshots: []
  };

  console.log('🚀 Starting navigation tests...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), location: msg.location() };
    results.consoleMessages.push(entry);
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[Console ${msg.type()}] ${msg.text().substring(0, 200)}`);
    }
  });

  page.on('pageerror', err => {
    results.errors.push({ type: 'pageerror', message: err.message, stack: err.stack });
    console.log(`[Page Error] ${err.message}`);
  });

  page.on('requestfailed', req => {
    results.networkErrors.push({ url: req.url(), method: req.method(), error: req.failure()?.errorText });
  });

  try {
    // Test Home load
    console.log('\n📄 Test: Home page load');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.site-header', { timeout: 15000 });
    const title = await page.title();
    results.tests.push({ name: 'Home page load', status: 'passed', title });
    console.log(`  ✓ Home page loaded: ${title}`);

    // Test Header navigation
    console.log('\n🔗 Test: Header navigation');
    const headerLinks = ['about', 'writing', 'feedback', 'memory'];
    for (const name of headerLinks) {
      try {
        // Use the nav.site-nav container
        const link = page.locator('nav.site-nav').get_by_role('link', { name: name });
        await link.click({ timeout: 5000 });
        // For hash router, the URL changes to #/...
        await page.waitForURL((url) => {
          const path = url.hash.replace('#', '') || '/';
          return path === `/${name}` || (name === 'writing' && path === '/');
        }, { timeout: 10000 });
        const hash = page.url().split('#')[1] || '/';
        const expected = name === 'writing' ? '/' : `/${name}`;
        const passed = hash === expected;
        results.tests.push({
          name: `Header: ${name}`,
          status: passed ? 'passed' : 'failed',
          expected,
          actual: hash
        });
        console.log(`  ${passed ? '✓' : '✗'} Header ${name} -> ${expected} (got ${hash})`);
        // Wait for content to appear on target page to ensure navigation completed
        await page.waitForSelector('.page-content', { timeout: 5000 }).catch(() => {});
      } catch (err) {
        results.tests.push({ name: `Header: ${name}`, status: 'error', error: err.message });
        console.log(`  ✗ Header ${name} error: ${err.message}`);
      }
    }

    // Test Footer feedback link
    console.log('\n🔗 Test: Footer feedback link');
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.site-header', { timeout: 5000 });
      const footerFeedback = page.locator('footer').get_by_role('link', { name: 'feedback' });
      await footerFeedback.click({ timeout: 5000 });
      await page.waitForURL((url) => url.hash === '#/feedback', { timeout: 10000 });
      const hash = page.url().split('#')[1];
      results.tests.push({
        name: 'Footer feedback',
        status: hash === '/feedback' ? 'passed' : 'failed',
        actual: hash
      });
      console.log(`  ${hash === '/feedback' ? '✓' : '✗'} Footer feedback -> /feedback (got ${hash})`);
    } catch (err) {
      results.tests.push({ name: 'Footer feedback', status: 'error', error: err.message });
      console.log(`  ✗ Footer feedback error: ${err.message}`);
    }

    // Test Memory graph node navigation
    console.log('\n🗺️  Test: Memory graph node click navigation');
    try {
      await page.goto(BASE_URL + '/#/memory', { waitUntil: 'domcontentloaded' });
      const canvas = await page.waitForSelector('.sitemap-graph canvas', { timeout: 15000 });
      console.log('  ✓ Memory page loaded, canvas found');
      await page.waitForTimeout(2000); // let simulation settle

      // Get canvas bounding box
      const box = await canvas.boundingBox();
      const width = box.width, height = box.height;
      console.log(`  Canvas size: ${width}x${height} at (${box.x}, ${box.y})`);

      // Find a point where cursor is 'pointer' (hovering a post node)
      let clicked = false;
      const step = 40;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          const cx = box.x + x;
          const cy = box.y + y;
          await page.mouse.move(cx, cy);
          await page.waitForTimeout(100); // allow hover state to update
          const cursor = await canvas.evaluate(el => el.style.cursor);
          if (cursor === 'pointer') {
            console.log(`  → Found pointer at (${Math.round(cx)}, ${Math.round(cy)}), clicking`);
            await page.mouse.click(cx, cy);
            // Wait for navigation
            try {
              await page.waitForURL((url) => url.hash.includes('/post/'), { timeout: 5000 });
            } catch (e) {
              // Some navigation might not change hash if already on a post? Accept if URL changed
            }
            await page.waitForTimeout(1000);
            const newHash = page.url().split('#')[1] || '';
            const isPost = newHash.includes('/post/');
            results.tests.push({
              name: 'Memory node click',
              status: isPost ? 'passed' : 'failed',
              clicked: { x: cx, y: cy },
              hashAfter: newHash
            });
            console.log(`  ${isPost ? '✓' : '✗'} Node click navigated to hash: #${newHash}`);
            clicked = true;
            break;
          }
        }
        if (clicked) break;
      }
      if (!clicked) {
        results.tests.push({ name: 'Memory node click', status: 'failed', reason: 'No pointer cursor detected' });
        console.log('  ✗ No navigatable node found (cursor never turned to pointer)');
      }
    } catch (err) {
      results.tests.push({ name: 'Memory graph navigation', status: 'error', error: err.message });
      console.log(`  ✗ Memory graph test error: ${err.message}`);
    }

    // Test Direct post link from home
    console.log('\n📝 Test: Home post link click');
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.site-header', { timeout: 5000 });
      const firstPost = page.locator('.post-entry').first();
      await firstPost.click({ timeout: 5000 });
      await page.waitForURL((url) => url.hash.includes('/post/'), { timeout: 10000 });
      const hash = page.url().split('#')[1];
      results.tests.push({
        name: 'Home post link',
        status: hash.includes('/post/') ? 'passed' : 'failed',
        hash
      });
      console.log(`  ${hash.includes('/post/') ? '✓' : '✗'} Post link -> #${hash}`);
    } catch (err) {
      results.tests.push({ name: 'Home post link', status: 'error', error: err.message });
      console.log(`  ✗ Post link error: ${err.message}`);
    }

  } catch (fatal) {
    results.errors.push({ type: 'fatal', message: fatal.message, stack: fatal.stack });
    console.error('Fatal error:', fatal);
  } finally {
    const finalScreenshot = await page.screenshot({ fullPage: true });
    const finalPath = path.join(__dirname, `screenshot-final-${Date.now()}.png`);
    fs.writeFileSync(finalPath, finalScreenshot);
    results.screenshots.push(finalPath);
    await browser.close();
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log('\n📊 Results saved to', RESULTS_FILE);
    console.log('\n📈 Summary:');
    const passed = results.tests.filter(t => t.status === 'passed').length;
    const failed = results.tests.filter(t => t.status === 'failed').length;
    const errs = results.tests.filter(t => t.status === 'error').length;
    console.log(`  Passed: ${passed}, Failed: ${failed}, Errors: ${errs}`);
    if (results.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning').length > 0) {
      console.log(`  Console issues: ${results.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning').length}`);
    }
    if (results.networkErrors.length > 0) {
      console.log(`  Network errors: ${results.networkErrors.length}`);
    }
    process.exit((failed + errs + results.errors.length) > 0 ? 1 : 0);
  }
}

runTests().catch(console.error);
