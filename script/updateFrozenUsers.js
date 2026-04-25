import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_FILE = path.resolve(__dirname, '../frozen_users.json');

async function main() {
  const targets = [
    'https://x.com/brahmsnocturne',
    'https://x.com/hinogegyo',
    'https://x.com/774rider',
    'https://twitter.com/brahmsnocturne',
    'https://twitter.com/hinogegyo',
  ];

  for (const url of targets) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        },
        redirect: 'follow',
      });
      const text = await res.text();
      const suspended = text.includes('suspended') || text.includes('凍結');
      console.log(`[DEBUG] ${url} → HTTP ${res.status} suspended=${suspended} bodyLen=${text.length} snippet=${text.slice(0,100)}`);
    } catch(e) {
      console.log(`[DEBUG] ${url} → ERROR: ${e.message}`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
