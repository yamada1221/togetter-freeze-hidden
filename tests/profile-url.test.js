import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  URL, console,
  document: { baseURI: 'https://togetter.com/li/100001' },
  fetch: async () => ({ ok: true, json: async () => ({ frozen_users: [] }) })
});
vm.runInContext(fs.readFileSync(new URL('../extension/content.js', import.meta.url), 'utf8'), context);
const parse = context.screenNameFromProfileUrl;

test('Togetter and X profile URLs identify the same account', () => {
  for (const url of [
    '/id/Frozen_Test', 'https://togetter.com/id/FROZEN_TEST/',
    'https://x.com/Frozen_Test', 'https://twitter.com/Frozen_Test?lang=ja',
    'https://mobile.twitter.com/Frozen_Test', 'https://www.x.com/Frozen_Test#profile'
  ]) assert.equal(parse(url), 'frozen_test', url);
});

test('status links and lookalike domains are not profile identity', () => {
  for (const url of [
    'https://x.com/Frozen_Test/status/123', 'https://twitter.com/intent/tweet',
    'https://notx.com/Frozen_Test', 'https://x.com.example.org/Frozen_Test',
    'https://example.org/x.com/Frozen_Test', 'https://x.com@evil.test/Frozen_Test',
    'https://evil.test/?url=https://x.com/Frozen_Test',
    'https://togetter.com.example.org/id/Frozen_Test',
    'https://togetter.com/id/Frozen_Test/extra', 'https://togetter.com/li/100001',
    'javascript:alert(1)', 'https://x.com:1234/Frozen_Test',
    'https://x.com/a-name', 'https://x.com/abcdefghijklmnop', 'https://x.com/'
  ]) assert.equal(parse(url), null, url);
});

test('screen names must be complete valid identifiers', () => {
  assert.equal(parse('https://x.com/abcdefghijklmno'), 'abcdefghijklmno');
  assert.equal(parse('/id/a'), 'a');
  assert.equal(parse('/id/a.b'), null);
});
