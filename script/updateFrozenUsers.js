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

async function main() {
  const users = [
    { screenName: 'brahmsnocturne', label: '生存' },
    { screenName: 'hinogegyo',      label: '凍結' },
    { screenName: 'nullpo_yarou',   label: '生存(デフォルトアイコン)' },
  ];

  for (const { screenName, label } of users) {
    const { text } = await fetchHtml(`https://x.com/${screenName}`);

    const m = text.match(/window\.__INITIAL_STATE__=({.+?});<\/script>/s);
    if (!m) { console.log(`${label}(${screenName}): __INITIAL_STATE__ not found`); continue; }

    let state;
    try { state = JSON.parse(m[1]); } catch(e) { console.log(`${label}(${screenName}): parse error ${e.message}`); continue; }

    // usersエンティティを探す
    const usersEntity = state?.entities?.users?.entities ?? {};
    const userKeys = Object.keys(usersEntity);
    console.log(`\n=== ${label}(${screenName}) ===`);
    console.log(`  users entities keys: ${userKeys.slice(0,5)}`);
    if (userKeys.length > 0) {
      const u = usersEntity[userKeys[0]];
      console.log(`  first user: ${JSON.stringify(u).slice(0, 300)}`);
    }

    // suspended関連フィールドを直接探す
    const raw = m[1];
    const suspIdx = raw.indexOf('"suspended"');
    if (suspIdx !== -1) console.log(`  "suspended" context: ${raw.slice(suspIdx, suspIdx+100)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
