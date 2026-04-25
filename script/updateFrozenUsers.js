import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html',
    },
    redirect: 'follow',
  });
  return { status: res.status, text: await res.text() };
}

async function main() {
  const users = [
    { screenName: 'brahmsnocturne', label: '生存' },
    { screenName: 'hinogegyo',      label: '凍結' },
  ];

  for (const { screenName, label } of users) {
    const { status, text } = await fetchHtml(`https://x.com/${screenName}`);
    console.log(`\n=== ${label}(${screenName}) HTTP=${status} bodyLen=${text.length} ===`);

    // 埋め込みJSONを探す
    const patterns = [
      { key: '__NEXT_DATA__',       re: /<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s },
      { key: '__initialState__',    re: /window\.__initialState__\s*=\s*'(.+?)';/s },
      { key: '__STATE__',           re: /window\.__STATE__\s*=\s*({.+?});<\/script>/s },
      { key: 'initialState',        re: /\\"initialState\\":({.+?})\s*\}/ },
    ];

    for (const { key, re } of patterns) {
      const m = text.match(re);
      console.log(`  ${key}: ${m ? 'found len=' + m[1].length : 'not found'}`);
      if (m) console.log(`    snippet: ${m[1].slice(0, 150)}`);
    }

    // scriptタグを全列挙して怪しいものを探す
    const scripts = [...text.matchAll(/<script[^>]*>([^<]{20,})<\/script>/g)];
    console.log(`  inline scripts count: ${scripts.length}`);
    scripts.slice(0, 3).forEach((s, i) => {
      console.log(`  script[${i}]: ${s[1].slice(0, 100)}`);
    });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
