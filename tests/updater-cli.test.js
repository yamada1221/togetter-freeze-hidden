import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const previous = JSON.stringify({ updated: '2026-10-01', source: 'togetter-ranking-top5', frozen_users: ['old'] });
// Each command runs in an isolated repository copy; no real HTTP requests or data writes.
function run(entry, scenario, before = previous) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'togetter-cli-'));
  try {
    fs.mkdirSync(path.join(dir, 'script'));
    fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"module"}');
    for (const name of ['update.js', 'updateFrozenUsers.js']) {
      fs.copyFileSync(path.join(root, 'script', name), path.join(dir, 'script', name));
    }
    const output = path.join(dir, 'frozen_users.json');
    if (before !== null) fs.writeFileSync(output, before);
    fs.writeFileSync(path.join(dir, 'mock.mjs'), String.raw`
      import fs from 'node:fs';
      const scenario = ${JSON.stringify(scenario)}, requests = [];
      const write = fs.writeFileSync;
      process.on('exit', () => write('requests.json', JSON.stringify(requests)));
      if (scenario === 'write-failure') fs.writeFileSync = (file, text, ...args) => {
        write(file, String(text).slice(0, 10), ...args);
        throw Object.assign(new Error('simulated disk full'), { code: 'ENOSPC' });
      };
      globalThis.fetch = async input => {
        const url = String(input); requests.push(url);
        const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
        if (url === 'https://api.fxtwitter.com/2/profile/X') {
          return scenario === 'control-failure' ? json({}, 503) : json({ code: 200, user: { screen_name: 'X' } });
        }
        if (url === 'https://togetter.com/ranking' || url === 'https://togetter.com/hot') {
          return new Response(Array.from({ length: 6 }, (_, i) => '<a href="/li/' + (100 + i) + '">ranking</a>').join(''),
            { status: scenario === 'ranking-failure' ? 503 : 200 });
        }
        if (/^https:\/\/api\.togetter\.com\/v2\/matomes\/10[0-4]\/comments$/.test(url)) {
          return json(scenario === 'invalid-comments' ? {} : { comments: ['old', 'fresh', 'suspended', 'active'].map(name => ({ user: { profileUrl: 'https://togetter.com/id/' + name } })) });
        }
        if (url.startsWith('https://api.fxtwitter.com/2/profile/')) {
          const name = url.split('/').pop();
          if (scenario === 'all-unknown' || name === 'old' || name === 'fresh') return json({ code: 429 }, 429);
          if (name === 'suspended') return json({ code: 404, reason: 'suspended' }, 404);
          return json({ code: 200, user: { screen_name: name } });
        }
        // Legacy HTML path: a temporary error is not evidence of an active account.
        if (/^https:\/\/(togetter|x)\.com\//.test(url)) return new Response('Unavailable', { status: 503 });
        throw new Error('Unexpected request: ' + url);
      };
    `);
    const result = spawnSync(process.execPath, ['--import', './mock.mjs', `script/${entry}`], {
      cwd: dir, encoding: 'utf8', timeout: 10000
    });
    assert.equal(result.error, undefined);
    assert.ok(fs.existsSync(path.join(dir, 'requests.json')), result.stderr);
    return { ...result, output: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : null,
      requests: JSON.parse(fs.readFileSync(path.join(dir, 'requests.json'), 'utf8')),
      files: fs.readdirSync(dir) };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

for (const entry of ['updateFrozenUsers.js', 'update.js']) {
  for (const scenario of ['control-failure', 'ranking-failure', 'invalid-comments', 'all-unknown', 'write-failure']) {
    test(`${entry}: ${scenario} preserves the previous file byte for byte`, () => {
      const result = run(entry, scenario);
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.equal(result.output, previous);
      assert.ok(!result.files.some(name => name.startsWith('.frozen-users-')));
    });
  }
  for (const before of ['{broken', '{"frozen_users":null}', '{"frozen_users":[null]}']) {
    test(`${entry}: refuses to replace unreadable previous data ${before}`, () => {
      const result = run(entry, 'normal', before);
      assert.notEqual(result.status, 0, result.stdout + result.stderr);
      assert.equal(result.output, before);
    });
  }
  test(`${entry}: keeps previously frozen unknown users but does not add new unknown users`, () => {
    const result = run(entry, 'normal');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.output).frozen_users, ['old', 'suspended']);
    assert.equal(JSON.parse(result.output).source, 'togetter-ranking-top5');
    assert.equal(result.requests.filter(url => url.includes('/comments')).length, 5);
    assert.ok(!result.requests.includes('https://togetter.com/hot'));
    assert.ok(!result.requests.some(url => url.includes('/105/')));
  });
  test(`${entry}: a genuinely missing file can be created on first run`, () => {
    const result = run(entry, 'normal', null);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.output).frozen_users, ['suspended']);
  });
}
