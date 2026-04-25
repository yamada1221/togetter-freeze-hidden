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

const DEFAULT_ICON = 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png';

// profileUrlの末尾IDを取得
function getProfileId(profileUrl) {
  return profileUrl?.split('/id/')[1] ?? '';
}

// 凍結アカウントの判定:
// デフォルトアイコン かつ name == profileUrlの末尾ID
function isSuspended(user) {
  if (user.icon !== DEFAULT_ICON) return false;
  return user.name === getProfileId(user.profileUrl);
}

async function main() {
  const id = '2689501';
  const data = await fetchJson(`https://api.togetter.com/v2/matomes/${id}/comments`);

  console.log('=== 凍結判定結果 ===');
  const seen = new Set();
  for (const c of data.comments) {
    const u = c.user;
    if (seen.has(u.id)) continue;
    seen.add(u.id);

    const suspended = isSuspended(u);
    const profileId = getProfileId(u.profileUrl);
    if (u.icon === DEFAULT_ICON) {
      console.log(`[${suspended ? '凍結' : 'デフォルトアイコン生存'}] name="${u.name}" profileId="${profileId}" screenName="${u.screenName}"`);
    }
  }
}

main().catch(err => { console.error(err); process.exit(1); });
