import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchRaw(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return { status: res.status, text: await res.text() };
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
  const id = matomeIds[0];
  console.log('対象まとめID:', id);

  // 候補エンドポイントを順番に試す
  const endpoints = [
    `https://api.togetter.com/v2/matomes/${id}/items`,
    `https://api.togetter.com/v2/matomes/${id}/tweets`,
    `https://api.togetter.com/v2/matomes/${id}/elements`,
    `https://api.togetter.com/v1/matomes/${id}/items`,
    `https://api.togetter.com/v1/matome/${id}`,
  ];

  for (const ep of endpoints) {
    const { status, text } = await fetchRaw(ep);
    console.log(`[DEBUG] ${ep} → HTTP ${status} | ${text.slice(0, 120)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
