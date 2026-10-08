import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { modernFixture } from './comment-fixture.js';

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
      await context.setOffline(true);
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
      assert.equal(await page.locator('#frozen').evaluate(el => el.parentElement.tagName), 'UL');
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

test('modern comments use the author header, keep DOM parents and handle reused or removed rows', { timeout: 60000 }, async () => {
  const extension = path.join(root, 'extension');
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium', headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
  });
  try {
    await context.setOffline(true);
    await context.route('https://raw.githubusercontent.com/yamada1221/togetter-freeze-hidden/main/frozen_users.json', route =>
      route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ frozen_users: ['Frozen_Test'] }) }));
    await context.route('https://togetter.com/li/**', route => route.fulfill({ contentType: 'text/html', body: modernFixture }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('https://togetter.com/li/100001');
    await page.waitForFunction(() => document.getElementById('modern-frozen').dataset.freezeHidden === '1');
    assert.equal(await page.locator('details').count(), 1);
    assert.equal(await page.locator('#modern-frozen').isVisible(), false);
    assert.equal(await page.locator('#modern-frozen').evaluate(el => el.parentElement.id), 'modern-row');
    for (const id of ['modern-active', 'quoted-status', 'lookalike-host', 'post-only', 'ambiguous']) {
      assert.equal(await page.locator('#' + id).isVisible(), true, id);
    }
    await page.locator('summary').click();
    assert.equal(await page.locator('#modern-frozen').isVisible(), true);
    await page.evaluate(() => document.getElementById('modern-active').append(document.createElement('span')));
    assert.equal(await page.locator('details').count(), 1);
    assert.equal(await page.locator('#modern-frozen').isVisible(), true);

    // React can reuse a row and change its author without replacing the element.
    await page.locator('#modern-frozen header a').evaluate(a => { a.href = 'https://togetter.com/id/Active_Test'; });
    await page.waitForFunction(() => document.querySelectorAll('details').length === 0);
    assert.equal(await page.locator('#modern-frozen').isVisible(), true);
    await page.evaluate(() => {
      const row = document.createElement('li');
      row.id = 'late-row';
      row.innerHTML = '<div id="late-modern"><header><a class="screen-name" href="/id/FROZEN_TEST">追加ユーザー</a></header><main>追加コメント</main></div>';
      document.getElementById('comment-list').append(row);
    });
    await page.waitForFunction(() => document.getElementById('late-modern').dataset.freezeHidden === '1');
    assert.equal(await page.locator('#late-modern').isVisible(), false);
    // Removing the original child from its original parent must still work.
    await page.evaluate(() => {
      const row = document.getElementById('late-row');
      row.removeChild(document.getElementById('late-modern'));
    });
    await page.waitForFunction(() => document.querySelectorAll('details').length === 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
