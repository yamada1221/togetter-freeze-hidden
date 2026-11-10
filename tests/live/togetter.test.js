import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const targetUrl = 'https://togetter.com/li/2639595';
const listUrl = 'https://raw.githubusercontent.com/yamada1221/togetter-freeze-hidden/main/frozen_users.json';
const authorSelector = '.comment_box header a.screen-name[href]';

// Only the JSON list is substituted in this isolated browser. The page and
// comment DOM are served by Togetter, and no test data is published.
test('installed extension folds and opens a real Togetter comment', { timeout: 120000 }, async () => {
  const extension = path.join(root, 'extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  try {
    let selectedName = null;
    await context.route(listUrl, route => route.fulfill({
      contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ frozen_users: selectedName ? [selectedName] : [] })
    }));
    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // Togetter loads the comments lazily when the reader reaches this section.
    await page.locator('#comment-box-portal').scrollIntoViewIfNeeded({ timeout: 30000 });
    await page.locator(authorSelector).first().waitFor({ state: 'attached', timeout: 45000 });
    const href = await page.locator(authorSelector).first().getAttribute('href');
    selectedName = new URL(href, targetUrl).pathname.match(/^\/id\/([A-Za-z0-9_]{1,15})\/?$/)?.[1];
    assert.ok(selectedName, `コメント投稿者URLが不正です: ${href}`);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.locator('#comment-box-portal').scrollIntoViewIfNeeded({ timeout: 30000 });
    // Identify the author's own card by its exact profile path, not body links.
    await page.waitForFunction(name => [...document.querySelectorAll('.comment_box header a.screen-name[href]')]
      .some(link => new URL(link.href).pathname.toLowerCase() === `/id/${name.toLowerCase()}` &&
        link.closest('header')?.parentElement?.dataset.freezeHidden === '1'), selectedName, { timeout: 45000 });
    const card = page.locator('[data-freeze-hidden="1"]').first();
    const actualHref = await card.locator(':scope > header a.screen-name[href]').first().getAttribute('href');
    assert.equal(new URL(actualHref, targetUrl).pathname.toLowerCase().replace(/\/$/, ''), `/id/${selectedName.toLowerCase()}`);
    const control = card.locator('xpath=preceding-sibling::*[1]');
    assert.equal(await card.isVisible(), false);
    await control.locator('summary').click();
    assert.equal(await card.isVisible(), true);
    await control.locator('summary').click();
    assert.equal(await card.isVisible(), false);
    console.log('Verified an installed extension against real Togetter HTML using an isolated test-only list.');
  } finally { await context.close(); }
});
