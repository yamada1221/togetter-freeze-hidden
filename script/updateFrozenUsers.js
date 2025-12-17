import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = path.resolve('./frozen_users.json');

// === テスト用固定まとめID ===
const TEST_MATOME_IDS = ['2639595'];

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * X oEmbed による生存チェック
 * true  = 凍結 / 削除 / 存在しない
 * false = 生存
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

async function fetchCommentUsers(matomeId) {
  const url = `https://api.togetter.com/v2/matomes/${matomeId}/comments`;
  const data = await fetchJson(url);

  const users = new Set();
  for (const c of data.comments ?? []) {
    if (c.user?.screenName) {
      users.add(c.user.screenName);
    }
  }
  return [...users];
}

async function main() {
  const results = [];

  for (const matomeId of TEST_MATOME_IDS) {
    console.log('Fetch comments:', matomeId);
    const users = await fetchCommentUsers(matomeId);

    for (const screenName of users) {
      console.log('Check:', screenName);
      const unavailable = await isUnavailableXUser(screenName);

      results.push({
        screenName,
        unavailable
      });
    }
  }

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(results, null, 2),
    'utf-8'
  );

  console.log(
    'Checked:',
    results.length,
    'Unavailable:',
    results.filter(r => r.unavailable).length
  );
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
