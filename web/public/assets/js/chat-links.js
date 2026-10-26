(() => {
  const target = document.querySelector('#maintenance-list');
  if (!target) return;
  const attach = () => {
    target.querySelectorAll('.maintenance-card, article').forEach(card => {
      if (card.querySelector('.af-chat-link')) return;
      const heading = card.querySelector('h3, h4');
      const match = heading?.textContent?.match(/(?:O\\.S\\.|OS|nº)\\s*(?:nº\\s*)?(\\d+)/i);
      if (!match) return;
      const link = document.createElement('a');
      link.className = 'af-chat-link profile-link';
      link.href = 'chat.html?os=' + encodeURIComponent(match[1]);
      link.textContent = 'Conversar com a oficina';
      card.appendChild(link);
    });
  };
  new MutationObserver(attach).observe(target, {childList:true,subtree:true});
  attach();
})();