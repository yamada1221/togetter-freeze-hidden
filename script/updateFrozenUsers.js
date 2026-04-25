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

// ブラケットカウントでJSONの終端を正確に見つける
function extractJson(text, startMarker) {
  const start = text.indexOf(startMarker);
  if (start === -1) return null;
  const jsonStart = text.indexOf('{', start);
  if (jsonStart === -1) return null;
  let depth = 0;
  for (let i = jsonStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(jsonStart, i + 1);
    }
  }
  return null;
}

/**
 * x.com のプロフィールページの __INITIAL_STATE__ を解析して状態を返す
 * - 凍結/削除: usersエンティティが空
 * - 鍵: usersエンティティあり かつ protected === true
 * - 生存: usersエンティティあり かつ protected !== true
 */
async function checkXUserStatus(screenName) {
  try {
    const res = await fetch(`https://x.com/${screenName}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
      redirect: 'follow',
    });

    if (!res.ok) return { frozen: true, protected: false };

    const text = await res.text();
    const raw = extractJson(text, 'window.__INITIAL_STATE__=');
    if (!raw) return { frozen: false, protected: false };

    const state = JSON.parse(raw);
    const usersEntity = state?.entities?.users?.entities ?? {};
    const userKeys = Object.keys(usersEntity);

    // ユーザーデータが存在しない → 凍結/削除
    if (userKeys.length === 0) return { frozen: true, protected: false };

    const user = usersEntity[userKeys[0]];

    // protected フィールドで鍵アカウント判定
    if (user.protected === true) return { frozen: false, protected: true };

    return { frozen: false, protected: false };
  } catch {
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
