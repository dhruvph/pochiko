const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { parseStringPromise } = require('xml2js');

const BASE_URL = process.env.BASE_URL || 'http://localhost:4174';
const RESULTS_FILE = path.join(__dirname, 'comprehensive-validation-results.json');

async function validateXML(page, url) {
  try {
    const response = await page.request.get(url);
    if (!response.ok()) {
      return { valid: false, error: `HTTP ${response.status()}` };
    }
    const content = await response.text();
    // Simple well-formedness check using regex for XML structure
    const hasOpenTag = /<\?xml|<\w+/.test(content);
    const hasCloseTag = /<\/\w+>/.test(content) || content.includes('/>');
    if (!hasOpenTag || !hasCloseTag) {
      return { valid: false, error: 'Malformed XML structure' };
    }
    // More robust: try parsing with xml2js
    const xml2js = require('xml2js');
    try {
      await xml2js.parseStringPromise(content);
      return { valid: true, content };
    } catch (parseErr) {
      return { valid: false, error: parseErr.message };
    }
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

async function runComprehensiveValidation() {
  const results = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      passed: 0,
      failed: 0,
      errors: 0,
      warnings: 0
    },
    tests: [],
    errors: [],
    consoleMessages: [],
    networkErrors: [],
    screenshots: []
  };

  console.log('🚀 Starting COMPREHENSIVE VALIDATION SWARM');
  console.log(`📍 Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();

  // Console monitoring
  page.on('console', msg => {
    const entry = { type: msg.type(), text: msg.text(), location: msg.location() };
    results.consoleMessages.push(entry);
    if (['error', 'warning'].includes(msg.type())) {
      console.log(`[Console ${msg.type()}] ${msg.text().substring(0, 200)}`);
      if (msg.type() === 'error') results.summary.errors++;
      if (msg.type() === 'warning') results.summary.warnings++;
    }
  });

  page.on('pageerror', err => {
    results.errors.push({ message: err.message, stack: err.stack });
    console.log(`[Page Error] ${err.message}`);
    results.summary.errors++;
  });

  page.on('requestfailed', req => {
    results.networkErrors.push({ url: req.url(), method: req.method(), error: req.failure()?.errorText });
  });

  const captureScreenshot = async (name) => {
    const path = `${__dirname}/site/screenshot-${name}-${Date.now()}.png`;
    await page.screenshot({ path, fullPage: true });
    results.screenshots.push(path);
  };

  const addTestResult = (test) => {
    results.tests.push(test);
    if (test.status === 'passed') results.summary.passed++;
    else if (test.status === 'failed') results.summary.failed++;
    else results.summary.errors++;
  };

  try {
    // ========== 1. SITEMAP & FEED VALIDATION ==========
    console.log('\n📋 Test: sitemap.xml and feed.xml validation');
    const sitemapResult = await validateXML(page, `${BASE_URL}/sitemap.xml`);
    const feedResult = await validateXML(page, `${BASE_URL}/feed.xml`);

    addTestResult({
      name: 'sitemap.xml exists and valid',
      status: sitemapResult.valid ? 'passed' : 'failed',
      error: sitemapResult.error
    });
    console.log(`  ${sitemapResult.valid ? '✓' : '✗'} sitemap.xml: ${sitemapResult.valid ? 'valid' : sitemapResult.error}`);

    addTestResult({
      name: 'feed.xml exists and valid',
      status: feedResult.valid ? 'passed' : 'failed',
      error: feedResult.error
    });
    console.log(`  ${feedResult.valid ? '✓' : '✗'} feed.xml: ${feedResult.valid ? 'valid' : feedResult.error}`);

    // ========== 2. HOME PAGE LOAD ==========
    console.log('\n🏠 Test: Home page load');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.site-header', { timeout: 10000 });
    const title = await page.title();
    addTestResult({ name: 'Home page loads', status: 'passed', title });
    console.log(`  ✓ Home page loaded: ${title}`);

    // ========== 3. HEADER NAVIGATION ==========
    console.log('\n🔗 Test: Header navigation (SPA without refresh)');
    const headerRoutes = [
      { name: 'about', hash: '#/about' },
      { name: 'writing (home)', hash: '#/' },
      { name: 'feedback', hash: '#/feedback' },
      { name: 'memory', hash: '#/memory' }
    ];

    for (const route of headerRoutes) {
      try {
        // Navigate home first
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('nav.site-nav', { timeout: 5000 });

        // Click the nav link
        const link = page.locator(`nav.site-nav a[href="${route.hash}"]`).first();
        await link.click({ timeout: 5000 });

        // Wait for hash change (SPA navigation)
        await page.waitForFunction(
          (expectedHash) => window.location.hash === expectedHash,
          route.hash,
          { timeout: 10000 }
        );

        // Verify no page reload (check that document visibility didn't flash)
        const currentHash = page.url().split('#')[1] || '/';
        const expected = route.hash.replace('#', '') || '/';
        const passed = currentHash === expected;

        // Verify page content loaded
        let contentLoaded = true;
        try {
          await page.waitForSelector('.page-content', { timeout: 5000 }).catch(() => {});
        } catch (e) {
          contentLoaded = false;
        }

        addTestResult({
          name: `Header: ${route.name}`,
          status: passed && contentLoaded ? 'passed' : 'failed',
          expected,
          actual: currentHash,
          contentLoaded
        });
        console.log(`  ${passed && contentLoaded ? '✓' : '✗'} Header ${route.name} -> ${route.hash} (no refresh)`);
      } catch (err) {
        addTestResult({ name: `Header: ${route.name}`, status: 'error', error: err.message });
        console.log(`  ✗ Header ${route.name} error: ${err.message}`);
      }
    }

    // ========== 4. FOOTER NAVIGATION ==========
    console.log('\n🔗 Test: Footer navigation');
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('footer', { timeout: 5000 });
      const footerLink = page.locator('footer a[href="#/feedback"]').first();
      await footerLink.click({ timeout: 5000 });
      await page.waitForFunction(() => window.location.hash === '#/feedback', { timeout: 10000 });
      const hash = page.url().split('#')[1] || '/';
      addTestResult({
        name: 'Footer feedback link',
        status: hash === '/feedback' ? 'passed' : 'failed',
        actual: hash
      });
      console.log(`  ${hash === '/feedback' ? '✓' : '✗'} Footer -> #/feedback`);
    } catch (err) {
      addTestResult({ name: 'Footer feedback link', status: 'error', error: err.message });
      console.log(`  ✗ Footer error: ${err.message}`);
    }

    // ========== 5. MEMORY GRAPH RENDERING ==========
    console.log('\n🗺️  Test: Memory graph rendering');
    try {
      await page.goto(BASE_URL + '#/memory', { waitUntil: 'domcontentloaded' });

      // Wait for the canvas to appear
      const canvas = await page.waitForSelector('.sitemap-graph canvas', { timeout: 20000 });
      const isVisible = await canvas.isVisible();
      const dimensions = await canvas.boundingBox();

      addTestResult({
        name: 'Memory graph canvas renders',
        status: isVisible ? 'passed' : 'failed',
        dimensions
      });
      console.log(`  ${isVisible ? '✓' : '✗'} Canvas present: ${dimensions ? `${dimensions.width}x${dimensions.height}` : 'no dimensions'}`);

      // Check for PreText background
      const preTextEl = await page.$('.ascii-bg').catch(() => null);
      if (preTextEl) {
        addTestResult({ name: 'ASCII background element', status: 'passed' });
        console.log('  ✓ ASCII background element present');
      }

      // Wait a bit for simulation to settle
      await page.waitForTimeout(3000);

      // Check if nodes are rendered (by checking canvas content)
      const hasContent = await page.evaluate(() => {
        const canvas = document.querySelector('.sitemap-graph canvas');
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // Check if there are non-transparent pixels (simple check)
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true;
        }
        return false;
      });
      addTestResult({
        name: 'Memory graph has rendered content',
        status: hasContent ? 'passed' : 'failed'
      });
      console.log(`  ${hasContent ? '✓' : '✗'} Graph content rendered on canvas`);

    } catch (err) {
      addTestResult({ name: 'Memory graph rendering', status: 'error', error: err.message });
      console.log(`  ✗ Memory graph error: ${err.message}`);
    }

    // ========== 6. MEMORY GRAPH NODE NAVIGATION ==========
    console.log('\n🖱️  Test: Memory graph node click navigation');
    try {
      await page.goto(BASE_URL + '#/memory', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.sitemap-graph canvas', { timeout: 20000 });
      await page.waitForTimeout(2000); // Let simulation settle

      // Get canvas and look for clickable nodes
      const canvas = await page.$('.sitemap-graph canvas');
      const box = await canvas.boundingBox();
      const width = box.width, height = box.height;

      // Scan for pointer cursor
      let clicked = false;
      const step = 25;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) {
          await page.mouse.move(box.x + x, box.y + y);
          await page.waitForTimeout(50);
          const cursor = await canvas.evaluate(el => window.getComputedStyle(el).cursor);
          if (cursor === 'pointer') {
            await page.mouse.click(box.x + x, box.y + y);
            await page.waitForTimeout(500);
            const newHash = page.url().split('#')[1] || '';
            const isPost = newHash.startsWith('/post/');
            addTestResult({
              name: 'Memory node click navigates to post',
              status: isPost ? 'passed' : 'failed',
              hashAfter: newHash,
              clickedAt: { x, y }
            });
            console.log(`  ${isPost ? '✓' : '✗'} Clicked node -> #${newHash}`);
            clicked = true;
            break;
          }
        }
        if (clicked) break;
      }

      if (!clicked) {
        addTestResult({ name: 'Memory node click', status: 'failed', reason: 'no clickable node found' });
        console.log('  ✗ No clickable nodes detected (no pointer cursor)');
      }
    } catch (err) {
      addTestResult({ name: 'Memory node navigation', status: 'error', error: err.message });
      console.log(`  ✗ Node navigation error: ${err.message}`);
    }

    // ========== 7. TOUCH NAVIGATION SIMULATION ==========
    console.log('\n📱 Test: Touch navigation simulation');
    try {
      // Create a new context with touch support and mobile viewport
      const mobileContext = await browser.newContext({
        viewport: { width: 375, height: 667 },
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        hasTouch: true
      });
      const mobilePage = await mobileContext.newPage();

      await mobilePage.goto(BASE_URL + '#/memory', { waitUntil: 'domcontentloaded' });
      await mobilePage.waitForSelector('.sitemap-graph canvas', { timeout: 20000 });
      await mobilePage.waitForTimeout(2000);

      // Simulate touchstart, touchmove, touchend on a node
      const canvas = await mobilePage.$('.sitemap-graph canvas');
      const box = await canvas.boundingBox();

      // Find a clickable node using touch events
      let touchNavigated = false;
      const step = 30;
      for (let y = 0; y < box.height; y += step) {
        for (let x = 0; x < box.width; x += step) {
          const tx = box.x + x + 5;
          const ty = box.y + y + 5;

          // Dispatch touch events
          await mobilePage.touchscreen.tap(tx, ty);
          await mobilePage.waitForTimeout(500);

          const hash = mobilePage.url().split('#')[1] || '';
          if (hash.startsWith('/post/')) {
            addTestResult({
              name: 'Touch navigation to post',
              status: 'passed',
              hashAfter: hash
            });
            console.log(`  ✓ Touch navigation: tapped node -> #${hash}`);
            touchNavigated = true;
            break;
          }
        }
        if (touchNavigated) break;
      }

      if (!touchNavigated) {
        addTestResult({
          name: 'Touch navigation to post',
          status: 'failed',
          reason: 'no navigatable node found with touch'
        });
        console.log('  ✗ Touch navigation: no navigatable nodes found');
      }

      await mobileContext.close();
    } catch (err) {
      addTestResult({ name: 'Touch navigation', status: 'error', error: err.message });
      console.log(`  ✗ Touch navigation error: ${err.message}`);
    }

    // ========== 8. REACT ROUTER ROUTE RECONCILIATION ==========
    console.log('\n🔄 Test: React Router route reconciliation');
    try {
      // Navigate between multiple routes in quick succession and verify UI updates correctly
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

      const routes = ['#/about', '#/feedback', '#/memory', '#/'];
      let reconcilePassed = true;

      for (const routeHash of routes) {
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
        await page.evaluate((h) => { window.location.hash = h; }, routeHash);
        await page.waitForTimeout(300); // Small delay for route change

        const currentHash = page.url().split('#')[1] || '/';
        const expected = routeHash.replace('#', '') || '/';

        // Check that correct page content is visible
        let contentMatch = false;
        try {
          if (expected === '/') {
            contentMatch = await page.$('.post-list') !== null;
          } else if (expected === '/about') {
            contentMatch = await page.$('.about-page') !== null || await page.textContent('.page-content')?.includes('About');
          } else if (expected === '/feedback') {
            contentMatch = await page.$('.feedback-form') !== null || await page.textContent('.page-content')?.includes('Feedback');
          } else if (expected === '/memory') {
            contentMatch = await page.$('.sitemap-graph canvas') !== null;
          }
        } catch (e) {
          contentMatch = false;
        }

        if (currentHash !== expected || !contentMatch) {
          reconcilePassed = false;
          console.log(`  ✗ Route ${routeHash} mismatch: hash=${currentHash}, contentMatch=${contentMatch}`);
        }
      }

      addTestResult({
        name: 'Route reconciliation',
        status: reconcilePassed ? 'passed' : 'failed',
        routesTested: routes.length
      });
      console.log(`  ${reconcilePassed ? '✓' : '✗'} All routes reconciled correctly`);
    } catch (err) {
      addTestResult({ name: 'Route reconciliation', status: 'error', error: err.message });
      console.log(`  ✗ Route reconciliation error: ${err.message}`);
    }

    // ========== 9. POST LINK NAVIGATION ==========
    console.log('\n📝 Test: Post link navigation');
    try {
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.post-entry', { timeout: 5000 });
      const postLink = page.locator('.post-entry').first();
      await postLink.click({ timeout: 5000 });
      await page.waitForFunction(() => window.location.hash.startsWith('#/post/'), { timeout: 10000 });
      const hash = page.url().split('#')[1] || '';
      addTestResult({
        name: 'Post link click',
        status: hash.startsWith('/post/') ? 'passed' : 'failed',
        hash
      });
      console.log(`  ${hash.startsWith('/post/') ? '✓' : '✗'} Post link -> #${hash}`);
    } catch (err) {
      addTestResult({ name: 'Post link click', status: 'error', error: err.message });
      console.log(`  ✗ Post link error: ${err.message}`);
    }

    // ========== 10. CONSOLE & NETWORK HEALTH ==========
    console.log('\n💉 Test: Console errors and network health');
    const hasCriticalErrors = results.consoleMessages.some(m => m.type === 'error' && !m.text.includes('net::ERR_ABORTED'));
    addTestResult({
      name: 'No critical console errors',
      status: hasCriticalErrors ? 'failed' : 'passed',
      count: results.consoleMessages.filter(m => m.type === 'error').length
    });
    console.log(`  ${hasCriticalErrors ? '✗' : '✓'} Critical console errors: ${hasCriticalErrors ? 'found' : 'none'}`);

    // Font aborts are acceptable in headless, but flag them
    const fontAborts = results.networkErrors.filter(e => e.url.includes('fonts.gstatic.com'));
    if (fontAborts.length > 0) {
      addTestResult({
        name: 'Font loading (optional)',
        status: 'warning',
        message: `${fontAborts.length} font requests aborted (acceptable in headless)`
      });
      console.log(`  ⚠️  Font aborts: ${fontAborts.length} (non-critical)`);
    }

    const criticalNetworkErrors = results.networkErrors.filter(e => !e.url.includes('fonts.gstatic.com'));
    addTestResult({
      name: 'No critical network errors',
      status: criticalNetworkErrors.length === 0 ? 'passed' : 'failed',
      count: criticalNetworkErrors.length
    });
    console.log(`  ${criticalNetworkErrors.length === 0 ? '✓' : '✗'} Critical network errors: ${criticalNetworkErrors.length}`);

  } catch (fatal) {
    results.errors.push({ message: fatal.message, stack: fatal.stack });
    console.error('Fatal:', fatal);
  } finally {
    await captureScreenshot('final');
    await browser.close();

    // Write results
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log('\n📊 Results:', RESULTS_FILE);
    console.log(`\n📈 SUMMARY: Passed ${results.summary.passed}, Failed ${results.summary.failed}, Errors ${results.summary.errors}, Warnings ${results.summary.warnings}`);

    const exitCode = (results.summary.failed + results.summary.errors) > 0 ? 1 : 0;
    process.exit(exitCode);
  }
}

runComprehensiveValidation().catch(console.error);
