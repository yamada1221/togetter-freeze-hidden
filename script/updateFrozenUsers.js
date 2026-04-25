import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchRaw(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  });
  return { status: res.status, text: await res.text() };
}

async function main() {
  const users = [
    'brahmsnocturne',  // 生存
    'realDonaldTrump', // 凍結→復活済みなので参考程度
    'mzsm',            // 有名な凍結アカウント例（違ったらすみません）
  ];

  for (const user of users) {
    const url = `https://cdn.syndication.twimg.com/timeline/profile?screen_name=${user}&suppress_response_codes=true`;
    const { status, text } = await fetchRaw(url);
    console.log(`[DEBUG] ${user} HTTP=${status} body=${text.slice(0, 200)}`);
  }

  // nitter.net のレスポンス内容も確認
  const nRes = await fetchRaw(`https://nitter.net/brahmsnocturne`);
  console.log(`[DEBUG] nitter brahmsnocturne HTTP=${nRes.status} body=${nRes.text.slice(0, 300)}`);

  const nRes2 = await fetchRaw(`https://nitter.net/mzsm`);
  console.log(`[DEBUG] nitter mzsm HTTP=${nRes2.status} body=${nRes2.text.slice(0, 300)}`);
}

main().catch(err => { console.error(err); process.exit(1); });
