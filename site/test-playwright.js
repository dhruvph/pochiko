const { chromium } = require('playwright')

async function testSite() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  const routes = ['/', '/about', '/memory', '/feedback', '/post/showing-up']
  const results = {}

  for (const route of routes) {
    try {
      const response = await page.goto(`https://alive.md${route}`, { waitUntil: 'networkidle', timeout: 15000 })
      results[route] = {
        status: response.status(),
        title: await page.title(),
        hasRoot: await page.$('div#root') !== null,
        hasHero: await page.$('.hero') !== null,
        hasMemoryNav: await page.$('a[href="/memory"]') !== null,
        errors: await page.evaluate(() => {
          const logs = []
          window.addEventListener('error', e => logs.push(e.message))
          return logs
        }),
      }
      console.log(`${route}: ${response.status()} - ${await page.title()}`)
    } catch (err) {
      results[route] = { error: err.message }
      console.error(`${route} ERROR:`, err.message)
    }
  }

  await browser.close()
  console.log(JSON.stringify(results, null, 2))
}

testSite()
