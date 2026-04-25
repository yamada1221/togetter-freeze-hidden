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

async function fetchRankingTop5() {
  const res = await fetch('https://togetter.com/ranking', { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  return [...html.matchAll(/\/li\/(\d+)/g)]
    .map(m => m[1])
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5);
}

async function main() {
  const matomeIds = await fetchRankingTop5();
  console.log('対象まとめID:', matomeIds);

  // まず1件だけコメントデータの生の構造を確認する
  const url = `https://api.togetter.com/v2/matomes/${matomeIds[0]}/comments`;
  const data = await fetchJson(url);

  console.log('[DEBUG] comments[0] keys:', Object.keys(data.comments[0] ?? {}));
  console.log('[DEBUG] comments[0].user keys:', Object.keys(data.comments[0]?.user ?? {}));
  console.log('[DEBUG] comments[0] raw:', JSON.stringify(data.comments[0]).slice(0, 500));
  console.log('[DEBUG] comments[1] raw:', JSON.stringify(data.comments[1]).slice(0, 500));
}

main().catch(err => { console.error(err); process.exit(1); });
