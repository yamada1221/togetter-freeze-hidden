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

  const targets = ['nullpo_yarou', '774rider', 'hinogegyo30856'];
  for (const target of targets) {
    const comments = data.comments.filter(c => c.user?.profileUrl?.includes(target));
    console.log(`\n=== ${target} (${comments.length}件) ===`);
    // 全フィールドをそのまま出力
    if (comments[0]) console.log(JSON.stringify(comments[0]));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
