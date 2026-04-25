import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchRaw(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  });
  return { status: res.status, text: await res.text() };
}

async function main() {
  // brahmsnocturne = 生存ユーザー（ログに出ていた）
  const liveUser = 'brahmsnocturne';

  // 様々なエンドポイントを試す
  const endpoints = [
    // Twitter Intent（ログイン不要の公開ページ）
    `https://twitter.com/intent/user?screen_name=${liveUser}`,
    // Twitter cards
    `https://twitter.com/${liveUser}`,
    // nitter公開インスタンス
    `https://nitter.net/${liveUser}`,
    `https://nitter.privacydev.net/${liveUser}`,
    // twimg profileデータ
    `https://cdn.syndication.twimg.com/timeline/profile?screen_name=${liveUser}&suppress_response_codes=true`,
  ];

  for (const ep of endpoints) {
    try {
      const { status, text } = await fetchRaw(ep);
      console.log(`[DEBUG] ${ep}`);
      console.log(`  → HTTP ${status} | ${text.slice(0, 100)}`);
    } catch(e) {
      console.log(`[DEBUG] ${ep} → ERROR: ${e.message}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
