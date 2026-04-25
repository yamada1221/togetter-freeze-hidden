import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

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

  // まとめページのHTMLを取得してNext.jsのJSONデータを探す
  const res = await fetch(`https://togetter.com/li/${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const html = await res.text();

  // __NEXT_DATA__ を探す
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/s);
  if (nextDataMatch) {
    const json = JSON.parse(nextDataMatch[1]);
    const props = json?.props?.pageProps;
    console.log('[DEBUG] pageProps keys:', Object.keys(props ?? {}));

    // itemsを探す
    const matome = props?.matome ?? props?.initialData?.matome;
    console.log('[DEBUG] matome keys:', Object.keys(matome ?? {}));
    console.log('[DEBUG] items[0]:', JSON.stringify((matome?.items ?? props?.items)?.[0]).slice(0, 300));
  } else {
    console.log('[DEBUG] __NEXT_DATA__ not found');
    // Nuxt等の場合
    const nuxtMatch = html.match(/window\.__NUXT__\s*=\s*(.+?);<\/script>/s);
    console.log('[DEBUG] __NUXT__ found:', !!nuxtMatch);

    // JSONっぽいscriptタグを全部列挙
    const scripts = [...html.matchAll(/<script[^>]*>(\{.{0,50})<\/script>/g)];
    console.log('[DEBUG] inline JSON scripts:', scripts.map(m => m[1]));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
