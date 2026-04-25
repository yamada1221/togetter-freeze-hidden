import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

function isValidXScreenName(name) {
  return /^[A-Za-z0-9_]{1,15}$/.test(name);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function checkXUserStatus(screenName) {
  const oembedUrl =
    `https://publish.twitter.com/oembed` +
    `?url=https://twitter.com/${screenName}` +
    `&omit_script=true`;

  try {
    const res = await fetch(oembedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();

    // 最初の3件だけDEBUGログを出す
    if (checkXUserStatus._debugCount === undefined) checkXUserStatus._debugCount = 0;
    if (checkXUserStatus._debugCount < 3) {
      console.log(`  [DEBUG] ${screenName} HTTP=${res.status} body=${text.slice(0, 150)}`);
      checkXUserStatus._debugCount++;
    }

    if (res.status === 401) return { frozen: false, protected: true };
    if (res.status === 404) return { frozen: true, protected: false };
    if (!res.ok) return { frozen: false, protected: false };

    let json;
    try { json = JSON.parse(text); } catch { return { frozen: false, protected: false }; }

    if (json.errors) return { frozen: true, protected: false };

    const html = json.html ?? '';
    if (html.includes('Account suspended')) return { frozen: true, protected: false };
    if (html.includes('protected')) return { frozen: false, protected: true };

    return { frozen: false, protected: false };
  } catch (e) {
    console.log(`  [DEBUG] ${screenName} catch: ${e.message}`);
    return { frozen: false, protected: false };
  }
}

async function fetchRankingTop5() {
  const res = await fetch('https://togetter.com/ranking', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
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
    const m = profileUrl.match(/\/id\/([^/?#]+)/);
    if (!m) continue;
    const candidate = m[1];
    if (!isValidXScreenName(candidate)) continue;
    users.add(candidate);
  }
  return [...users];
}

async function main() {
  const unavailableUsers = [];
  const checkedUsers = new Set();

  const matomeIds = await fetchRankingTop5();
  console.log('対象まとめID:', matomeIds);

  for (const id of matomeIds) {
    let users;
    try {
      users = await fetchCommentUsers(id);
    } catch (e) {
      console.warn(`まとめ ${id} のコメント取得失敗:`, e.message);
      continue;
    }

    for (const screenName of users) {
      if (checkedUsers.has(screenName)) continue;
      checkedUsers.add(screenName);

      const { frozen, protected: isProtected } = await checkXUserStatus(screenName);
      const status = frozen ? '凍結/削除' : isProtected ? '鍵' : '生存';
      console.log(`  ${screenName}: ${status}`);

      if (frozen || isProtected) {
        unavailableUsers.push({
          screenName,
          xUnavailable: true,
          ...(frozen      && { reason: 'suspended' }),
          ...(isProtected && { reason: 'protected' }),
        });
      }
    }
  }

  unavailableUsers.sort((a, b) => a.screenName.localeCompare(b.screenName));
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(unavailableUsers, null, 2), 'utf-8');
  console.log(`\n保存完了: ${unavailableUsers.length} 件`);
}

main().catch(err => { console.error(err); process.exit(1); });
