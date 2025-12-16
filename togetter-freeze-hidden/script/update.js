import fs from 'fs';

const RANKING_URL = 'https://togetter.com/hot';
const FREEZE_TEXT = 'このアカウントは凍結されています';

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }});
  return await res.text();
}

function extractTop5Matome(html) {
  const matches = [...html.matchAll(/href="(\/li\/\d+)"/g)];
  return [...new Set(matches.map(m => 'https://togetter.com' + m[1]))].slice(0, 5);
}

function extractUsernames(html) {
  const matches = [...html.matchAll(/https?:\/\/(x|twitter)\.com\/([A-Za-z0-9_]+)/g)];
  return [...new Set(matches.map(m => m[2].toLowerCase()))];
}

async function isFrozen(username) {
  const html = await fetchText(`https://x.com/${username}`);
  return html.includes(FREEZE_TEXT);
}

(async () => {
  const rankingHtml = await fetchText(RANKING_URL);
  const matomes = extractTop5Matome(rankingHtml);
  const users = new Set();

  for (const url of matomes) {
    const html = await fetchText(url);
    extractUsernames(html).forEach(u => users.add(u));
  }

  const frozen = [];
  for (const u of users) if (await isFrozen(u)) frozen.push(u);

  fs.writeFileSync('frozen_users.json', JSON.stringify({
    updated: new Date().toISOString().slice(0,10),
    source: 'togetter-ranking-top5',
    frozen_users: frozen
  }, null, 2));
})();
