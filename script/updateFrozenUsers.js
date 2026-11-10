import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');
const FX_BASE_URL = 'https://api.fxtwitter.com/2/profile/';
const USER_AGENT = 'togetter-freeze-hidden/1.1 (+https://github.com/yamada1221/togetter-freeze-hidden)';
const HISTORY_STATUSES = new Set(['previously_listed', 'suspended', 'not_found_pending', 'not_found', 'active']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    if (httpStatus !== 404) return unknown(detail);
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
    try {
      const url = new URL(comment.user?.profileUrl);
      const match = url.pathname.match(/^\/id\/([A-Za-z0-9_]{1,15})\/?$/);
      if (url.protocol !== 'https:' || !['togetter.com', 'www.togetter.com'].includes(url.hostname) ||
          url.username || url.password || url.port || !match) continue;
      if (comment.user.name && String(comment.user.name).toLowerCase() !== match[1].toLowerCase()) continue;
      users.add(match[1]);
    } catch {
      // Invalid profile URLs are not evidence of an X account.
    }
  }
  return [...users];
}

export function normalizePreviousFrozen(payload) {
  const list = Array.isArray(payload) ? payload : payload?.frozen_users;
  if (!Array.isArray(list)) throw new Error('前回の凍結リストの形式が不正です');
  const names = list.map(item => typeof item === 'string' ? item : item?.screenName);
  if (names.some(name => typeof name !== 'string' || !isValidXScreenName(name))) {
    throw new Error('前回の凍結リストに不正なユーザー名があります');
  }
  return new Set(names.map(name => name.toLowerCase()));
}

function japanDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(now);
}

// The public list remains the authority for what the extension hides. History is
// kept in the same atomically replaced file so list and history cannot diverge.
export function readPreviousState(payload) {
  if (payload === undefined) return { hidden: new Map(), history: new Map() };
  normalizePreviousFrozen(payload); // Reject malformed old and current lists.
  const list = Array.isArray(payload) ? payload : payload.frozen_users;
  const hidden = new Map(list.map(item => {
    const name = typeof item === 'string' ? item : item.screenName;
    return [name.toLowerCase(), name];
  }));
  const history = new Map();
  if (!Array.isArray(payload) && payload.account_history !== undefined) {
    if (!Array.isArray(payload.account_history)) throw new Error('アカウント履歴の形式が不正です');
    for (const record of payload.account_history) {
      if (!record || typeof record !== 'object' || !isValidXScreenName(record.screen_name) ||
          !HISTORY_STATUSES.has(record.status) || !Array.isArray(record.events) ||
          record.events.some(event => !event || !DATE_PATTERN.test(event.date) || !HISTORY_STATUSES.has(event.status)) ||
          (record.last_checked != null && !DATE_PATTERN.test(record.last_checked)) ||
          (record.not_found_since != null && !DATE_PATTERN.test(record.not_found_since)) ||
          (record.last_listed_before_migration != null && !DATE_PATTERN.test(record.last_listed_before_migration)) ||
          (record.status === 'not_found_pending' && !DATE_PATTERN.test(record.not_found_since || ''))) {
        throw new Error('アカウント履歴に不正な記録があります');
      }
      const key = record.screen_name.toLowerCase();
      if (history.has(key)) throw new Error('アカウント履歴が重複しています');
      history.set(key, { ...record, events: record.events.map(event => ({ ...event })) });
    }
  }
  const previousDate = !Array.isArray(payload) && DATE_PATTERN.test(payload.updated || '') ? payload.updated : null;
  for (const [key, screenName] of hidden) {
    if (!history.has(key)) history.set(key, {
      screen_name: screenName, status: 'previously_listed', last_checked: null,
      events: previousDate ? [{ date: previousDate, status: 'previously_listed' }] : []
    });
  }
  return { hidden, history };
}

function recordStatus(record, status, today) {
  if (record.status !== status || record.events.length === 0) {
    record.events.push({ date: today, status });
  }
  record.status = status;
  record.last_checked = today;
}

// Two definitive not-found responses on different Japan-time dates are needed
// before hiding a newly discovered account. Unknown responses never count.
export function applyProbeResult(state, screenName, result, today) {
  const key = screenName.toLowerCase();
  let record = state.history.get(key);
  if (result.status === 'unknown') return;
  if (!record && result.status === 'active') return;
  if (!record) {
    record = { screen_name: screenName, status: null, last_checked: null, events: [] };
    state.history.set(key, record);
  }
  record.screen_name = screenName;
  if (result.status === 'active') {
    state.hidden.delete(key);
    delete record.not_found_since;
    recordStatus(record, 'active', today);
  } else if (result.status === 'suspended') {
    state.hidden.set(key, screenName);
    delete record.not_found_since;
    recordStatus(record, 'suspended', today);
  } else if (result.status === 'not_found') {
    if (record.status === 'not_found') {
      state.hidden.set(key, screenName);
      record.last_checked = today;
    } else if (record.not_found_since && record.not_found_since < today) {
      state.hidden.set(key, screenName);
      delete record.not_found_since;
      recordStatus(record, 'not_found', today);
    } else {
      record.not_found_since ||= today;
      recordStatus(record, 'not_found_pending', today);
      // An already hidden account stays hidden during the confirmation period.
    }
  }
}

export function buildOutput(frozenUsers, now = new Date(), history) {
  const output = {
    updated: japanDate(now),
    source: 'togetter-ranking-top5',
    frozen_users: [...new Set(frozenUsers.map(String).filter(isValidXScreenName))]
      .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
  };
  if (history) output.account_history = [...history.values()]
    .sort((a, b) => a.screen_name.localeCompare(b.screen_name, 'en', { sensitivity: 'base' }));
  return output;
}

export async function main() {
  const control = await probeXUser('X');
  if (control.status !== 'active') {
    throw new Error(`FxTwitterの正常性確認に失敗しました: ${control.detail}`);
  }

  let state = { hidden: new Map(), history: new Map() };
  try {
    state = readPreviousState(JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')));
  } catch (error) {
    // Only a genuinely missing file is a first run. Read/parse errors must not erase history.
    if (error.code !== 'ENOENT') throw error;
  }

  const matomeIds = await fetchRankingTop5();
  console.log('対象まとめID:', matomeIds);
  const users = new Set();
  for (const id of matomeIds) {
    for (const screenName of await fetchCommentUsers(id)) users.add(screenName);
  }
  if (!users.size) throw new Error('対象コメントのXユーザーを1人も取得できませんでした');

  const rankingNames = new Set([...users].map(name => name.toLowerCase()));
  const toCheck = new Map([...users].map(name => [name.toLowerCase(), name]));
  // Keep checking hidden, pending, and pre-migration accounts after they leave
  // the ranking. Active historical accounts are checked only when seen again.
  for (const [key, name] of state.hidden) if (!toCheck.has(key)) toCheck.set(key, name);
  for (const [key, record] of state.history) {
    if (['previously_listed', 'not_found_pending'].includes(record.status) && !toCheck.has(key)) {
      toCheck.set(key, record.screen_name);
    }
  }
  const now = new Date();
  const today = japanDate(now);
  let known = 0;
  for (const [key, screenName] of toCheck) {
    const result = await probeXUser(screenName);
    console.log(`  ${screenName}: ${result.status}`);
    if (rankingNames.has(key) && result.status !== 'unknown') known++;
    applyProbeResult(state, screenName, result, today);
  }
  if (!known) throw new Error('ランキング対象者が全員判定不能だったため、前回ファイルを保持します');

  const output = buildOutput([...state.hidden.values()], now, state.history);
  // Write on the same filesystem, replacing the public file only after the full write succeeds.
  const temporaryDirectory = fs.mkdtempSync(path.join(path.dirname(OUTPUT_FILE), '.frozen-users-'));
  try {
    const temporaryFile = path.join(temporaryDirectory, 'frozen_users.json');
    fs.writeFileSync(temporaryFile, JSON.stringify(output, null, 2) + '\n', 'utf8');
    fs.renameSync(temporaryFile, OUTPUT_FILE);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  console.log(`保存完了: 折りたたみ対象 ${output.frozen_users.length}件 / ランキング対象 ${rankingNames.size}件 / 再確認を含む ${toCheck.size}件`);
}

if (path.resolve(process.argv[1] || '') === __filename) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
