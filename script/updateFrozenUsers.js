import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

// XのscreenNameとして有効か
function isValidXScreenName(name) {
  return /^[A-Za-z0-9_]{1,15}$/.test(name);
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * X oEmbed による生存チェック
 * false = 生存
 * true  = 凍結 / 削除 / 存在しない
 */
async function isUnavailableXUser(screenName) {
  const url = `https://publish.twitter.com/oembed?url=https://x.com/${screenName}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!res.ok) return true;

    const json = await res.json();
    return !!json.errors;
  } catch {
    return true;
  }
}

async function fetchRankingTop5() {
  const html = await (await fetch('https://togetter.com/ranking')).text();
  return [...html.matchAll(/\/li\/(\d+)/g)]
    .map(m => m[1])
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);
}

async function fetchCommentUsers(matomeId) {
  const url = `https://api.togetter.com/v2/matomes/${matomeId}/comments`;
  const data = await fetchJson(url);

  const users = new Set();

  for (const c of data.comments) {
    const profileUrl = c.user?.profileUrl;
    if (!profileUrl) continue;

    const m = profileUrl.match(/\/id\/([^/]+)/);
    if (!m) continue;

    const candidate = m[1];

    // ★ ここが決定的に重要
    if (!isValidXScreenName(candidate)) continue;

    users.add(candidate);
  }

  return [...users];
}

async function main() {
  const frozenUsers = new Set();
  const checkedUsers = new Set();

  const matomeIds = await fetchRankingTop5();

  for (const id of matomeIds) {
    const users = await fetchCommentUsers(id);

    for (const screenName of users) {
      if (checkedUsers.has(screenName)) continue;
      checkedUsers.add(screenName);

      console.log('Check:', screenName);

      const unavailable = await isUnavailableXUser(screenName);
      if (unavailable) {
        frozenUsers.add(screenName);
      }
    }
  }

  const output = [...frozenUsers].sort().map(name => ({
    screenName: name,
    xUnavailable: true
  }));

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(output, null, 2),
    'utf-8'
  );

  console.log('Frozen / deleted users saved:', output.length);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
