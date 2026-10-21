// Atualiza somente com a página visível, sem sobrepor consultas nem atualizar uma tela desmontada.
export function startDashboardRefresh({ load, onData, onError, document: doc = document,
  window: win = window, interval = 30000 }) {
  let disposed = false, pending = false;
  async function refresh() {
    if (disposed || pending || doc.visibilityState === 'hidden') return;
    pending = true;
    try { const data = await load(); if (!disposed) onData(data); }
    catch (error) { if (!disposed) onError(error); }
    finally { pending = false; }
  }
  refresh();
  const timer = win.setInterval(refresh, interval);
  doc.addEventListener('visibilitychange', refresh);
  win.addEventListener('focus', refresh);
  return () => {
    disposed = true;
    win.clearInterval(timer);
    doc.removeEventListener('visibilitychange', refresh);
    win.removeEventListener('focus', refresh);
  };
}
