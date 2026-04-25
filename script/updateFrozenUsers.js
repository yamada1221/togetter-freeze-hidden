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

  // まとめ本体（ツイート引用）のAPIを確認
  const url = `https://api.togetter.com/v2/matomes/${matomeIds[0]}`;
  const data = await fetchJson(url);

  console.log('[DEBUG] matome keys:', Object.keys(data));
  console.log('[DEBUG] matome.items[0]:', JSON.stringify(data.items?.[0]).slice(0, 400));
  console.log('[DEBUG] matome.items[1]:', JSON.stringify(data.items?.[1]).slice(0, 400));
}

main().catch(err => { console.error(err); process.exit(1); });
