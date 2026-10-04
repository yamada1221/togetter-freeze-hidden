import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = '<!doctype html><html lang="ja"><body><ul>' +
  '<li class="comment" id="frozen"><a href="https://x.com/Frozen_Test">凍結テスト</a><p>対象コメント</p></li>' +
  '<li class="comment" id="active"><a href="https://x.com/Active_Test">通常テスト</a><p>残すコメント</p></li>' +
  '</ul></body></html>';

for (const legacy of [false, true]) {
  test(`installed extension folds only listed users: ${legacy ? 'legacy' : 'current'} schema`, async () => {
    const extension = path.join(root, 'extension');
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      ignoreDefaultArgs: ['--disable-extensions'],
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    try {
      const payload = legacy ? [{ screenName: 'Frozen_Test' }]
        : { updated: '2026-10-04', source: 'togetter-ranking-top5', frozen_users: ['Frozen_Test'] };
      await context.route('https://raw.githubusercontent.com/yamada1221/togetter-freeze-hidden/main/frozen_users.json', route =>
        route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(payload) }));
      await context.route('https://togetter.com/li/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('https://togetter.com/li/100001');
      await page.waitForFunction(() => document.querySelectorAll('details').length === 1);
      assert.equal(await page.locator('#active').evaluate(el => el.closest('details') === null), true);
      assert.equal(await page.locator('#frozen').isVisible(), false);
      await page.locator('summary').click();
      assert.equal(await page.locator('#frozen').isVisible(), true);
      await page.evaluate(() => {
        const comment = document.createElement('li');
        comment.id = 'late'; comment.className = 'comment';
        comment.innerHTML = '<a href="https://twitter.com/FROZEN_TEST">追加ユーザー</a>追加コメント';
        document.querySelector('ul').append(comment);
      });
      await page.waitForFunction(() => document.querySelectorAll('details').length === 2);
      assert.equal(await page.locator('#late').isVisible(), false);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
