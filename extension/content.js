/**
 * content.js — Togetter Freeze Comment Hider
 *
 * Togetterのコメント欄で、凍結・鍵アカウントのコメントを折りたたみ表示する
 * Chrome拡張機能のコンテンツスクリプト。
 *
 * frozen_users.json は GitHub Pages または raw.githubusercontent.com から取得する。
 */

const FROZEN_USERS_URL =
  'https://raw.githubusercontent.com/yamada1221/togetter-freeze-hidden/main/frozen_users.json';

/**
 * 凍結・鍵ユーザーリストを取得して Set にして返す
 * @returns {Promise<Set<string>>} screenName の小文字 Set
 */
async function fetchFrozenUserSet() {
  try {
    const res = await fetch(FROZEN_USERS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const list = await res.json();
    // screenName を小文字で格納（大文字小文字を問わずマッチさせるため）
    return new Set(list.map(u => u.screenName.toLowerCase()));
  } catch (e) {
    console.warn('[togetter-freeze-hidden] リスト取得失敗:', e);
    return new Set();
  }
}

/**
 * コメント要素からXのscreenNameを抽出する
 * @param {Element} el
 * @returns {string|null}
 */
function extractScreenName(el) {
  // Togetterのコメント欄の構造:
  // <a href="https://twitter.com/{screenName}"> または
  // <a href="https://x.com/{screenName}">
  const link = el.querySelector('a[href*="twitter.com/"], a[href*="x.com/"]');
  if (!link) return null;

  const m = link.href.match(/(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})(?:[/?#]|$)/);
  return m ? m[1].toLowerCase() : null;
}

/**
 * 対象コメント要素を折りたたみ表示にする
 * @param {Element} el コメント要素
 * @param {string} screenName
 */
function collapseComment(el, screenName) {
  if (el.dataset.freezeHidden) return; // 二重処理防止
  el.dataset.freezeHidden = '1';

  // 折りたたみラッパーを作成
  const wrapper = document.createElement('details');
  wrapper.style.cssText = 'border-left: 3px solid #aaa; padding-left: 8px; margin: 4px 0; opacity: 0.6;';

  const summary = document.createElement('summary');
  summary.style.cssText = 'cursor: pointer; color: #888; font-size: 0.85em; user-select: none;';
  summary.textContent = `⚠ @${screenName} のコメント（凍結・鍵アカウント）`;

  wrapper.appendChild(summary);

  // 元のコメントをラッパーの中に移動
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
}

/**
 * ページ内のコメントをスキャンして折りたたみ処理を適用
 * @param {Set<string>} frozenSet
 */
function processComments(frozenSet) {
  // Togetterのコメント要素セレクター（2024年現在の構造に対応）
  // クラス名は変更される可能性があるため複数パターンを試す
  const selectors = [
    'li.comment',
    'div.comment',
    '[class*="comment_item"]',
    '[class*="CommentItem"]',
    'article[class*="comment"]',
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const screenName = extractScreenName(el);
      if (screenName && frozenSet.has(screenName)) {
        collapseComment(el, screenName);
      }
    }
  }
}

/**
 * MutationObserverで動的に追加されるコメントにも対応
 */
async function init() {
  const frozenSet = await fetchFrozenUserSet();
  if (frozenSet.size === 0) return;

  // 初回スキャン
  processComments(frozenSet);

  // 動的ロード（スクロール等）にも対応
  const observer = new MutationObserver(() => {
    processComments(frozenSet);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

init();
