import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchRaw(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.9',
    },
    redirect: 'follow',
  });
  return { status: res.status, text: await res.text() };
}

async function main() {
  const users = [
    { name: 'hinogegyo', label: '凍結' },   // screenNameで試す
    { name: '774rider',  label: '凍結' },    // profileId(=name)で試す
    { name: 'nullpo_yarou', label: '生存' },
    { name: 'brahmsnocturne', label: '生存' },
  ];

  for (const { name, label } of users) {
    const { status, text } = await fetchRaw(`https://nitter.net/${name}`);
    // nitterのHTML内のキーワードを確認
    const isSuspended = text.includes('Account suspended') || text.includes('凍結') || text.includes('suspended');
    const isProtected = text.includes('protected') || text.includes('This account') || text.includes('鍵');
    const hasTimeline = text.includes('timeline') || text.includes('tweet-content');
    const hasError = text.includes('error') || text.includes('Error') || status >= 400;
    console.log(`[${label}] ${name}: HTTP=${status} suspended=${isSuspended} protected=${isProtected} timeline=${hasTimeline} error=${hasError}`);
    console.log(`  body snippet: ${text.slice(0, 200)}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
