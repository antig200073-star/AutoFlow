// Fecha inclusive os dialogs dos componentes de veículos compartilhados com o site.
export function findOpenDialog(root) {
  let result = null;
  for (const element of root.querySelectorAll('*')) {
    if (element.matches('dialog[open]')) result = element;
    if (element.shadowRoot) result = findOpenDialog(element.shadowRoot) || result;
  }
  return result;
}

export function dismissOpenDialog(doc) {
  const dialog = findOpenDialog(doc);
  if (!dialog) return false;
  const event = new Event('cancel', { cancelable: true });
  // Respeita cancelamentos impedidos durante upload/gravação.
  if (dialog.dispatchEvent(event)) dialog.close();
  return true;
}

export function createPageHistory(initialPage = 'login') {
  let pages = [initialPage];
  return {
    visit(page) {
      if (pages.at(-1) !== page) pages.push(page);
      if (pages.length > 50) pages.splice(1, 1);
      return page;
    },
    reset(page) { pages = [page]; return page; },
    back() { if (pages.length < 2) return null; pages.pop(); return pages.at(-1); },
  };
}

export function applyNativeDialogInsets(host) {
  if (!host.shadowRoot || host.shadowRoot.querySelector('[data-android-insets]')) return;
  const style = document.createElement('style');
  style.dataset.androidInsets = '';
  style.textContent = `dialog { max-height: calc(100dvh - var(--af-safe-top) - var(--af-safe-bottom) - 24px);
    max-width: calc(100vw - var(--af-safe-left) - var(--af-safe-right) - 24px);
    margin-top: max(12px, var(--af-safe-top)); margin-bottom: max(12px, var(--af-safe-bottom)); }
    input, select, textarea { scroll-margin-block: 24px; }`;
  host.shadowRoot.append(style);
}
