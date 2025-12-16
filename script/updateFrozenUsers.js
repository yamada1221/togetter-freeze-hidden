import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import fs from "fs";

const RANKING_URL = "https://togetter.com/li/hot";
const LIMIT = 5;
const KEYWORD = "凍結";

async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return res.text();
}

async function getTopEntries() {
  const html = await fetchHTML(RANKING_URL);
  const dom = new JSDOM(html);
  const links = [...dom.window.document.querySelectorAll("a")];

  return links
    .map(a => a.href)
    .filter(h => h && h.startsWith("/li/"))
    .slice(0, LIMIT)
    .map(h => `https://togetter.com${h}`);
}

async function extractFrozenUsers(entryUrl) {
  const html = await fetchHTML(entryUrl);
  const dom = new JSDOM(html);
  const frozen = new Set();

  dom.window.document.querySelectorAll(".comment").forEach(c => {
    if (c.textContent.includes(KEYWORD)) {
      const user = c.querySelector(".comment_user");
      if (user) frozen.add(user.textContent.trim());
    }
  });

  return frozen;
}

async function main() {
  const users = new Set();

  const entries = await getTopEntries();
  for (const url of entries) {
    const frozen = await extractFrozenUsers(url);
    frozen.forEach(u => users.add(u));
  }

  const output = {
    updated: new Date().toISOString().slice(0, 10),
    source: "togetter-ranking-top5",
    frozen_users: [...users].sort()
  };

  fs.writeFileSync(
    "frozen_users.json",
    JSON.stringify(output, null, 2)
  );
}

main();
