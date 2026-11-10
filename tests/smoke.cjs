// Run with an installed Playwright package: node tests/smoke.cjs
// Optional: PLAYWRIGHT_MODULE, BROWSER_EXECUTABLE, SCREENSHOT_DIR.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep) || !types[path.extname(file)]) {
      response.writeHead(404).end();
      return;
    }
    const content = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});

async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({
    headless: true,
    args: [`--log-file=${path.join(os.tmpdir(), 'mbvac-browser.log')}`],
    ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}),
  });
  const errors = [];
  const failedAssets = [];
  try {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    // External maps are not part of this local app's regression checks.
    await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith(base) && response.status() >= 400) failedAssets.push(response.url());
    });
    const sections = ['home', 'services', 'pricelist', 'gallery', 'about', 'contacts'];
    let layouts = 0;
    if (!process.argv.includes('--targeted')) {
    for (const width of [320, 390, 640, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const lang of ['en', 'lv']) {
        for (const section of sections) {
          await page.goto(`${base}/#${section}`, { waitUntil: 'domcontentloaded' });
          await page.locator(`.language-button[data-lang="${lang}"]`).click();
          assert.equal(await page.locator('html').getAttribute('lang'), lang);
          assert.equal(await page.locator('.menu-item[aria-current="page"]').getAttribute('data-section'), section);
          assert.equal(await page.locator('main').innerText().then(text => text.includes('67271384')), false);
          const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
          assert.ok(dimensions.document <= width + 1 && dimensions.body <= width + 1, `${width}px ${lang} #${section} overflows: ${JSON.stringify(dimensions)}`);
          layouts++;
        }
      }
    }

    // Navigation must survive refresh, direct links, and browser history.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${base}/#contacts`);
    await page.locator('a.menu-item[href="#pricelist"]').click();
    await page.waitForURL('**/#pricelist');
    await page.reload();
    assert.equal(await page.locator('.menu-item[aria-current="page"]').getAttribute('data-section'), 'pricelist');
    await page.goBack();
    await page.waitForURL('**/#contacts');
    assert.equal(await page.locator('.menu-item[aria-current="page"]').getAttribute('data-section'), 'contacts');
    await page.goForward();
    await page.waitForURL('**/#pricelist');
    assert.equal(await page.locator('.menu-item[aria-current="page"]').getAttribute('data-section'), 'pricelist');
    await page.goto(`${base}/#unknown-section`);
    await page.waitForURL('**/#home');
    assert.equal(new URL(page.url()).hash, '#home');
    assert.equal(await page.locator('.menu-item[aria-current="page"]').getAttribute('data-section'), 'home');
    await page.evaluate(() => localStorage.setItem('currentLanguage', 'not-a-language'));
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.ok((await page.locator('main').innerText()).trim().length > 0);

    // Contact actions keep the single current number and a working email URI.
    await page.goto(`${base}/#contacts`);
    assert.ok(await page.locator('main a[href="tel:+37129456983"]').count());
    assert.ok(await page.locator('main a[href="mailto:medcentrs@gmail.com"]').count());
    await page.goto(`${base}/#home`);
    assert.ok(await page.locator('.hero a[href="tel:+37129456983"]').count());

    // Compact mobile navigation remains operable and closes after selection.
    await page.setViewportSize({ width: 390, height: 844 });
    const menu = page.locator('#menu-toggle');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    await menu.click();
    await page.keyboard.press('Escape');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');
    assert.equal(await menu.evaluate(button => button === document.activeElement), true);
    await menu.click();
    assert.equal(await menu.getAttribute('aria-expanded'), 'true');
    await page.locator('a.menu-item[href="#gallery"]').click();
    await page.waitForURL('**/#gallery');
    assert.equal(await menu.getAttribute('aria-expanded'), 'false');

    // Native dialog: keyboard image navigation, Escape, and focus restoration.
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}/#gallery`);
      const first = page.locator('.gallery-trigger').first();
      await first.focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('#lightbox').evaluate(dialog => dialog.open), true);
      const original = await page.locator('.lightbox-img').getAttribute('src');
      await page.keyboard.press('ArrowRight');
      const next = await page.locator('.lightbox-img').getAttribute('src');
      assert.notEqual(next, original);
      await page.keyboard.press('ArrowLeft');
      assert.equal(await page.locator('.lightbox-img').getAttribute('src'), original);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#lightbox').evaluate(dialog => dialog.open), false);
      assert.equal(await first.evaluate(button => button === document.activeElement), true);
      await first.click();
      await page.locator('.lightbox-next').click();
      assert.equal(await page.locator('.lightbox-img').getAttribute('src'), next);
      await page.locator('.lightbox-close').click();
      await page.evaluate(() => { location.hash = '#home'; });
      await page.waitForSelector('.hero');
      await page.evaluate(() => { location.hash = '#gallery'; });
      await page.waitForSelector('.gallery-trigger');
      await page.locator('.gallery-trigger').first().click();
      await page.locator('.lightbox-next').click();
      assert.equal(await page.locator('.lightbox-img').getAttribute('src'), next, 'One click advances once after gallery re-entry');
      const dialogButtons = page.locator('#lightbox button');
      await dialogButtons.first().focus();
      await page.keyboard.press('Shift+Tab');
      assert.equal(await dialogButtons.last().evaluate(button => button === document.activeElement), true);
      await page.keyboard.press('Tab');
      assert.equal(await dialogButtons.first().evaluate(button => button === document.activeElement), true);
      await page.keyboard.press('Escape');
    }

    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`${base}/#gallery`);
    await page.locator('.gallery-trigger').first().click();
    for (const selector of ['.lightbox-close', '.lightbox-prev', '.lightbox-next', '.lightbox-img', '#lightbox-caption']) {
      const bounds = await page.locator(selector).boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 845 && bounds.y + bounds.height <= 391, `Landscape dialog element outside viewport: ${selector} ${JSON.stringify(bounds)}`);
    }
    await page.keyboard.press('Escape');

    }

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await touch.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const phone = await touch.newPage();
    phone.on('pageerror', error => errors.push(error.message));
    await phone.goto(`${base}/#home`);
    await phone.locator('#menu-toggle').tap();
    await phone.locator('a.menu-item[href="#gallery"]').tap();
    await phone.waitForSelector('.gallery-trigger');
    await phone.locator('.gallery-trigger').first().tap();
    assert.equal(await phone.locator('#lightbox').evaluate(dialog => dialog.open), true);
    await phone.locator('.lightbox-next').tap();
    assert.ok((await phone.locator('#lightbox-caption').innerText()).startsWith('2 / 10'));
    await phone.locator('.lightbox-close').tap();
    await phone.setViewportSize({ width: 320, height: 568 });
    await phone.locator('.gallery-trigger').nth(8).tap();
    await phone.locator('.lightbox-img').evaluate(image => image.decode());
    for (const selector of ['.lightbox-close', '.lightbox-prev', '.lightbox-next', '.lightbox-img', '#lightbox-caption']) {
      const bounds = await phone.locator(selector).boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= 321 && bounds.y + bounds.height <= 569, `Narrow portrait dialog element outside viewport: ${selector} ${JSON.stringify(bounds)}`);
    }

    if (process.env.SCREENSHOT_DIR) {
      await fs.mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      await phone.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'gallery-portrait-320.png') });
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
        for (const section of ['home', 'pricelist', 'contacts', 'gallery']) {
          await page.goto(`${base}/#${section}`);
          await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode().catch(() => {}); })));
          await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `${section}-${width}.png`), fullPage: true });
          if (section === 'home') await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, `home-viewport-${width}.png`) });
        }
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${base}/#home`);
      await page.locator('#menu-toggle').click();
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'menu-390.png') });
      await page.goto(`${base}/#gallery`);
      await page.locator('.gallery-trigger').first().click();
      await page.locator('.lightbox-img').evaluate(image => image.decode());
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'gallery-open-390.png') });
      await page.setViewportSize({ width: 844, height: 390 });
      await page.screenshot({ path: path.join(process.env.SCREENSHOT_DIR, 'gallery-open-landscape.png') });
    }
    assert.deepEqual(errors, [], 'No uncaught JavaScript errors');
    assert.deepEqual(failedAssets, [], 'No missing local assets');
    console.log(process.argv.includes('--targeted')
      ? 'PASS: targeted mobile touch and narrow portrait dialog checks; refreshed screenshots; no JavaScript errors or missing local assets.'
      : `PASS: ${layouts} responsive bilingual section layouts; contact links; routes/history; mobile menu; gallery keyboard/focus; mobile touch and narrow portrait dialog; no JavaScript errors or missing local assets.`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
