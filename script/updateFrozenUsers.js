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
  const id = '2689501';
  const data = await fetchJson(`https://api.togetter.com/v2/matomes/${id}/comments`);

  // hinogegyo30856 のコメントを探す
  const target = data.comments.find(c => c.user?.profileUrl?.includes('hinogegyo30856'));
  console.log('[DEBUG] hinogegyo30856 comment:', JSON.stringify(target));

  // iconがデフォルト画像かどうかも確認（凍結アカウントはデフォルトアイコンになることがある）
  for (const c of data.comments) {
    const icon = c.user?.icon ?? '';
    if (icon.includes('default') || icon === '') {
      console.log('[DEBUG] default/empty icon user:', JSON.stringify(c.user));
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
