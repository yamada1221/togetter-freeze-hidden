import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 出力はリポジトリ直下
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
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
  const ids = [...html.matchAll(/\/li\/(\d+)/g)]
    .map(m => m[1])
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);

  console.log('Top summaries:', ids.length);
  return ids;
}

async function fetchCommentUsers(matomeId) {
  const url = `https://api.togetter.com/v2/matomes/${matomeId}/comments`;
  const data = await fetchJson(url);

  const users = new Set();
  for (const c of data.comments) {
    if (c.user?.screenName) {
      users.add(c.user.screenName);
    }
  }
  return [...users];
}

async function main() {
  const frozenUsers = new Set();
  const matomeIds = await fetchRankingTop5();

  for (const id of matomeIds) {
    console.log('Fetch comments:', id);
    const users = await fetchCommentUsers(id);

    for (const user of users) {
      console.log('Check:', user);
      const unavailable = await isUnavailableXUser(user);
      if (unavailable) {
        frozenUsers.add(user);
      }
    }
  }

  const result = [...frozenUsers].sort();

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(result, null, 2),
    'utf-8'
  );

  console.log('Frozen / deleted users saved:', result.length);
  console.log('Output:', OUTPUT_FILE);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
