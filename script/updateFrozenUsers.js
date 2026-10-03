import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');
const FX_BASE_URL = 'https://api.fxtwitter.com/2/profile/';
const USER_AGENT = 'togetter-freeze-hidden/1.1 (+https://github.com/yamada1221/togetter-freeze-hidden)';

export function isValidXScreenName(name) {
  return /^[A-Za-z0-9_]{1,15}$/.test(String(name || ''));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

export function classifyFxPayload(payload, httpStatus, expectedName) {
  const unknown = detail => ({ status: 'unknown', reason: '', detail });
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return unknown(`FxTwitter HTTP ${httpStatus}; invalid response`);
  }
  const message = String(payload.message || '').slice(0, 160).replace(/\s+/g, ' ');
  const detail = `FxTwitter HTTP ${httpStatus}; code=${payload.code}; message=${message}`;
  if (![200, 404].includes(httpStatus)) return unknown(detail);
  if (payload.code === 404) {
    if (payload.reason === 'suspended') return { status: 'suspended', reason: 'suspended', detail };
    if (!payload.reason && message === 'User not found') return { status: 'not_found', reason: 'not_found', detail };
    return unknown(detail);
  }
  if (httpStatus !== 200 || payload.code !== 200 || payload.reason) return unknown(detail);
  const user = payload.user;
  if (!user || typeof user !== 'object' || !isValidXScreenName(user.screen_name)) {
    return unknown(detail + '; missing profile identity');
  }
  if (user.screen_name.toLowerCase() !== expectedName.toLowerCase()) {
    return unknown(detail + '; profile identity mismatch');
  }
  return { status: 'active', reason: '', detail, protected: user.protected === true };
}

export async function probeXUser(screenName) {
  if (!isValidXScreenName(screenName)) return { status: 'unknown', reason: '', detail: 'invalid username' };
  const url = FX_BASE_URL + encodeURIComponent(screenName);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    let payload;
    try {
      payload = await res.json();
    } catch {
      return { status: 'unknown', reason: '', detail: `FxTwitter HTTP ${res.status}; non-JSON response` };
    }
    return classifyFxPayload(payload, res.status, screenName);
  } catch (error) {
    return { status: 'unknown', reason: '', detail: `FxTwitter temporary failure: ${error?.name || 'Error'}` };
  }
}

async function fetchRankingTop5() {
  const res = await fetch('https://togetter.com/ranking', { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`ランキング取得失敗: HTTP ${res.status}`);
  const html = await res.text();
  const ids = [...html.matchAll(/\/li\/(\d+)/g)]
    .map(match => match[1])
    .filter((value, index, all) => all.indexOf(value) === index)
    .slice(0, 5);
  if (ids.length !== 5) throw new Error(`ランキング上位5件を取得できませんでした（${ids.length}件）`);
  return ids;
}

async function fetchCommentUsers(matomeId) {
  const data = await fetchJson(`https://api.togetter.com/v2/matomes/${matomeId}/comments`);
  if (!Array.isArray(data.comments)) throw new Error(`まとめ ${matomeId} のコメント形式が不正です`);
  const users = new Set();
  for (const comment of data.comments) {
    const match = String(comment.user?.profileUrl || '').match(/\/id\/([^/?#]+)/);
    if (match && isValidXScreenName(match[1])) users.add(match[1]);
  }
  return [...users];
}

export function normalizePreviousFrozen(payload) {
  const list = Array.isArray(payload) ? payload : payload?.frozen_users;
  if (!Array.isArray(list)) return new Set();
  return new Set(list.map(item => typeof item === 'string' ? item : item?.screenName)
    .filter(isValidXScreenName).map(name => name.toLowerCase()));
}

export function buildOutput(frozenUsers, now = new Date()) {
  const updated = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
  return {
    updated,
    source: 'togetter-ranking-top5',
    frozen_users: [...new Set(frozenUsers.map(String).filter(isValidXScreenName))]
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  };
}

async function main() {
  const control = await probeXUser('X');
  if (control.status !== 'active') {
    throw new Error(`FxTwitterの正常性確認に失敗しました: ${control.detail}`);
  }

  let previous = new Set();
  try {
    previous = normalizePreviousFrozen(JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')));
  } catch {
    // 初回作成時は前回データなしで続行する。
  }

  const matomeIds = await fetchRankingTop5();
  console.log('対象まとめID:', matomeIds);
  const users = new Set();
  for (const id of matomeIds) {
    for (const screenName of await fetchCommentUsers(id)) users.add(screenName);
  }
  if (!users.size) throw new Error('対象コメントのXユーザーを1人も取得できませんでした');

  const frozen = [];
  let known = 0;
  for (const screenName of users) {
    const result = await probeXUser(screenName);
    console.log(`  ${screenName}: ${result.status}`);
    if (result.status !== 'unknown') known++;
    if (result.status === 'suspended' ||
        (result.status === 'unknown' && previous.has(screenName.toLowerCase()))) {
      frozen.push(screenName);
    }
  }
  if (!known) throw new Error('全ユーザーが判定不能だったため、前回ファイルを保持します');

  const output = buildOutput(frozen);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`保存完了: 凍結 ${output.frozen_users.length}件 / 確認 ${users.size}件`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
