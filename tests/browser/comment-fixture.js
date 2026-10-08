// Structure observed on Togetter's expanded comments on 2026-10-08.
// Account names, text and CSS hashes are synthetic; no X account is probed by tests.
export const modernFixture = `<!doctype html><html lang="ja"><body>
<div id="comment-box-portal" class="comment_box"><ul id="comment-list">
  <li id="modern-row"><div id="modern-frozen" tabindex="-1" class="css-generated">
    <a href="https://togetter.com/id/Frozen_Test">アイコン</a>
    <header><a class="screen-name css-generated-name" href="https://togetter.com/id/Frozen_Test">対象ユーザー<span>@Frozen_Test</span></a></header>
    <main><p>対象コメント</p></main><footer>返信</footer>
  </div></li>
  <li><div id="modern-active" tabindex="-1">
    <header><a class="screen-name" href="/id/Active_Test">通常ユーザー</a></header>
    <main><a href="https://x.com/Frozen_Test">本文中の引用プロフィール</a></main>
  </div></li>
  <li class="comment" id="quoted-status">
    <header><a class="screen-name" href="/id/Active_Test">通常ユーザー</a></header>
    <main><a href="https://x.com/Frozen_Test/status/123">引用投稿</a></main>
  </li>
  <li class="comment" id="lookalike-host"><a href="https://notx.com/Frozen_Test">別サイト</a></li>
  <li class="comment" id="post-only"><a href="https://x.com/Frozen_Test/status/123">投稿リンクのみ</a></li>
  <li class="comment" id="ambiguous"><a href="https://x.com/Active_Test">一人目</a><a href="https://x.com/Frozen_Test">二人目</a></li>
</ul></div></body></html>`;
