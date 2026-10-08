/**
 * content.js — Togetter Freeze Comment Hider
 *
 * Togetterのコメント欄で、凍結アカウントのコメントを折りたたみ表示する
 * Chrome拡張機能のコンテンツスクリプト。
 *
 * frozen_users.json は GitHub Pages または raw.githubusercontent.com から取得する。
 */

const FROZEN_USERS_URL =
  'https://raw.githubusercontent.com/yamada1221/togetter-freeze-hidden/main/frozen_users.json';
const foldedComments = new Map();

/**
 * 凍結ユーザーリストを取得して Set にして返す
 * @returns {Promise<Set<string>>} screenName の小文字 Set
 */
async function fetchFrozenUserSet() {
  try {
    const res = await fetch(FROZEN_USERS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    // 新形式を優先し、更新前の配列形式も読み込めるようにする。
    const list = Array.isArray(payload) ? payload : payload?.frozen_users;
    if (!Array.isArray(list)) throw new Error('不正な凍結ユーザーリスト');
    return new Set(list
      .map(item => typeof item === 'string' ? item : item?.screenName)
      .filter(name => /^[A-Za-z0-9_]{1,15}$/.test(String(name || '')))
      .map(name => name.toLowerCase()));
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
function screenNameFromProfileUrl(value) {
  try {
    const url = new URL(value, document.baseURI);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    let match;
    if (['togetter.com', 'www.togetter.com'].includes(url.hostname)) {
      match = url.pathname.match(/^\/id\/([A-Za-z0-9_]{1,15})\/?$/);
    } else if (['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'].includes(url.hostname)) {
      match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/?$/);
    }
    return match ? match[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

function extractScreenName(el) {
  // Current Togetter uses a profile link in the comment's own header.
  // Never search the comment body for quoted profiles or status links.
  const authorLinks = el.querySelectorAll(
    ':scope > header a.screen-name[href], :scope > .status a.twttrname[href], :scope > a.screen-name[href]'
  );
  const links = authorLinks.length ? authorLinks : el.querySelectorAll(':scope > a[href]');
  const names = new Set([...links].map(link => screenNameFromProfileUrl(link.href)).filter(Boolean));
  return names.size === 1 ? [...names][0] : null;
}

function restoreComment(el) {
  const record = foldedComments.get(el);
  if (!record) return;
  record.details.removeEventListener('toggle', record.onToggle);
  record.control.remove();
  delete el.dataset.freezeHidden;
  foldedComments.delete(el);
}

/**
 * 対象コメント要素を折りたたみ表示にする
 * @param {Element} el コメント要素
 * @param {string} screenName
 */
function collapseComment(el, screenName) {
  const existing = foldedComments.get(el);
  if (existing?.screenName === screenName && existing.control.parentElement === el.parentElement) return;
  restoreComment(el);

  // 折りたたみラッパーを作成
  const wrapper = document.createElement('details');
  wrapper.style.cssText = 'border-left: 3px solid #aaa; padding-left: 8px; margin: 4px 0; opacity: 0.6;';

  const summary = document.createElement('summary');
  summary.style.cssText = 'cursor: pointer; color: #888; font-size: 0.85em; user-select: none;';
  summary.textContent = `@${screenName} のコメント（凍結アカウント）`;

  wrapper.appendChild(summary);

  // React must keep ownership of the original node and its original parent.
  // Add a sibling toggle and hide the comment in place instead of moving it.
  const control = el.parentElement.matches('ul, ol') ? document.createElement('li') : wrapper;
  if (control !== wrapper) control.appendChild(wrapper);
  control.dataset.freezeControl = '1';
  const onToggle = () => {
    if (wrapper.open) delete el.dataset.freezeHidden;
    else el.dataset.freezeHidden = '1';
  };
  wrapper.addEventListener('toggle', onToggle);
  foldedComments.set(el, { screenName, control, details: wrapper, onToggle });
  el.before(control);
  onToggle();
}

/**
 * ページ内のコメントをスキャンして折りたたみ処理を適用
 * @param {Set<string>} frozenSet
 */
function processComments(frozenSet) {
  const modernCards = new Set();
  for (const link of document.querySelectorAll('.comment_box header a.screen-name[href]')) {
    const card = link.closest('header')?.parentElement;
    if (card && (card.matches('li') || card.parentElement?.matches('li'))) modernCards.add(card);
  }
  const candidates = new Set(modernCards);
  // Older layouts still use comment classes and direct profile links.
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
      if ([...modernCards].some(card => card !== el && el.contains(card))) continue;
      candidates.add(el);
    }
  }
  for (const el of foldedComments.keys()) {
    if (!el.isConnected || !candidates.has(el)) restoreComment(el);
  }
  for (const el of candidates) {
    const screenName = extractScreenName(el);
    if (screenName && frozenSet.has(screenName)) collapseComment(el, screenName);
    else restoreComment(el);
  }
}

/**
 * MutationObserverで動的に追加されるコメントにも対応
 */
async function init() {
  const frozenSet = await fetchFrozenUserSet();
  if (frozenSet.size === 0) return;

  const style = document.createElement('style');
  style.textContent = '[data-freeze-hidden="1"] { display: none !important; }';
  (document.head || document.documentElement).appendChild(style);

  // 初回スキャン
  processComments(frozenSet);

  // 動的ロード（スクロール等）にも対応
  const observer = new MutationObserver(() => {
    processComments(frozenSet);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['href'],
  });
}

init();
