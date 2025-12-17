import fs from "fs";
import path from "path";

const OUTPUT = path.resolve("extension/frozenUsers.json");
const RANKING_URL = "https://togetter.com/ranking";

const SUSPENDED_PATTERNS = [
  /account\/suspended/i,
  /このアカウントは凍結されています/,
  /Account suspended/i
];

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  if (!res.ok) throw new Error(res.status);
  return await res.text();
}

/** ランキング上位5件のまとめURL取得 */
function extractTopSummaryUrls(html) {
  const urls = [];
  const regex = /href="(\/li\/\d+)"/g;

  let m;
  while ((m = regex.exec(html)) !== null) {
    const fullUrl = "https://togetter.com" + m[1];
    if (!urls.includes(fullUrl)) {
      urls.push(fullUrl);
    }
    if (urls.length >= 5) break;
  }

  return urls;
}

/** コメント欄ユーザー抽出 */
function extractCommentUsers(html) {
  const set = new Set();
  const regex = /@([a-zA-Z0-9_]{1,15})/g;

  let m;
  while ((m = regex.exec(html)) !== null) {
    set.add(m[1]);
  }
  return [...set];
}

/** X凍結判定 */
async function isSuspended(username) {
  try {
    const html = await fetchHtml(`https://x.com/${username}`);
    return SUSPENDED_PATTERNS.some(r => r.test(html));
  } catch {
    return false;
  }
}

async function main() {
  console.log("Fetch ranking");
  const rankingHtml = await fetchHtml(RANKING_URL);

  const summaryUrls = extractTopSummaryUrls(rankingHtml);
  console.log("Top summaries:", summaryUrls.length);

  const candidates = new Set();

  for (const url of summaryUrls) {
    console.log("Fetch summary:", url);
    const html = await fetchHtml(url);
    extractCommentUsers(html).forEach(u => candidates.add(u));
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("Candidate users:", candidates.size);

  const frozen = [];

  for (const user of candidates) {
    console.log("Check:", user);
    if (await isSuspended(user)) {
      frozen.push(user);
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  const result = {
    updatedAt: new Date().toISOString(),
    source: "Togetter ranking top5 comments",
    count: frozen.length,
    users: frozen
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 2), "utf-8");
  console.log("Frozen users saved:", frozen.length);
}

main();
