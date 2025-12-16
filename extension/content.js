const FROZEN_LIST_URL = 'https://yamada1221.github.io/togetter-freeze-list/frozen_users.json';

async function loadFrozenUsers() {
  const res = await fetch(FROZEN_LIST_URL);
  const json = await res.json();
  return new Set(json.frozen_users || []);
}

function extractUsername(comment) {
  const link = comment.querySelector('a[href*="x.com"], a[href*="twitter.com"]');
  if (!link) return null;
  return link.href.split('/').pop().toLowerCase();
}

function foldComment(comment) {
  const original = comment.innerHTML;
  const wrapper = document.createElement('div');
  const button = document.createElement('button');
  const body = document.createElement('div');

  button.textContent = '凍結済みアカウントのコメントを表示';
  body.style.display = 'none';
  body.innerHTML = original;

  button.onclick = () => {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  };

  wrapper.appendChild(button);
  wrapper.appendChild(body);
  comment.innerHTML = '';
  comment.appendChild(wrapper);
}

(async () => {
  const frozenUsers = await loadFrozenUsers();
  document.querySelectorAll('.comment').forEach(c => {
    const u = extractUsername(c);
    if (u && frozenUsers.has(u)) foldComment(c);
  });
})();
