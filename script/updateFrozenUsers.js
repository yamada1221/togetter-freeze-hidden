import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  // 凍結・鍵アカウントを含むまとめ
  const id = '2689501';
  const data = await fetchJson(`https://api.togetter.com/v2/matomes/${id}/comments`);

  console.log('[DEBUG] 全コメント数:', data.comments.length);

  // 全コメントのuserフィールドを全部出力
  for (const c of data.comments) {
    const u = c.user;
    console.log(`[DEBUG] user: ${JSON.stringify(u)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
