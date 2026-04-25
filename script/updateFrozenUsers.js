import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
    redirect: 'follow',
  });
  return { status: res.status, text: await res.text() };
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

async function main() {
  const users = [
    { screenName: 'brahmsnocturne', label: '生存' },
    { screenName: 'hinogegyo',      label: '凍結' },
    { screenName: 'nullpo_yarou',   label: '生存(デフォルトアイコン)' },
  ];

  for (const { screenName, label } of users) {
    const { text } = await fetchHtml(`https://x.com/${screenName}`);

    const raw = extractJson(text, 'window.__INITIAL_STATE__=');
    if (!raw) { console.log(`${label}(${screenName}): not found`); continue; }

    let state;
    try { state = JSON.parse(raw); } catch(e) { console.log(`${label}(${screenName}): parse error ${e.message}`); continue; }

    console.log(`\n=== ${label}(${screenName}) ===`);
    console.log(`  top-level keys: ${Object.keys(state)}`);

    // usersを探す
    const usersEntity = state?.entities?.users?.entities ?? {};
    const userKeys = Object.keys(usersEntity);
    console.log(`  user count: ${userKeys.length}`);
    if (userKeys.length > 0) {
      const u = usersEntity[userKeys[0]];
      console.log(`  user fields: ${Object.keys(u)}`);
      console.log(`  suspended: ${u.suspended}`);
      console.log(`  screen_name: ${u.screen_name}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
