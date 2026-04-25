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
  ];

  for (const { screenName, label } of users) {
    const { status, text } = await fetchHtml(`https://x.com/${screenName}`);

    // "suspended"前後50文字を全部抽出
    const contexts = [];
    let idx = 0;
    while ((idx = text.indexOf('suspended', idx)) !== -1) {
      contexts.push(text.slice(Math.max(0, idx - 50), idx + 60));
      idx += 9;
    }
    console.log(`\n=== ${label}(${screenName}) HTTP=${status} ===`);
    contexts.forEach((c, i) => console.log(`  [${i}] ...${c}...`));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
