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

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const users = [
    { name: 'hinogegyo30856', label: '凍結' },
    { name: 'brahmsnocturne', label: '生存' },
    { name: '774rider',       label: 'デフォルトアイコン・状態不明' },
  ];

  for (const { name, label } of users) {
    // TogetterのユーザーAPIを試す
    const apiUrl = `https://api.togetter.com/v2/users/${name}`;
    const { status, text } = await fetchRaw(apiUrl);
    console.log(`[DEBUG] ${label}(${name}) Togetter API → HTTP ${status} | ${text.slice(0, 200)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
