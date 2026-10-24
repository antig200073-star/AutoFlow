export const NATIVE_AUTH_REDIRECT = 'br.com.autoflow.app://auth/callback';

// Preferences guarda a sessão no sandbox do Android, sem depender do cache do WebView.
// Não é um cofre criptografado; os backups do aplicativo são desabilitados no Manifest.
export function createNativeSessionStorage(preferences) {
  return {
    async getItem(key) { return (await preferences.get({ key })).value; },
    async setItem(key, value) { await preferences.set({ key, value }); },
    async removeItem(key) { await preferences.remove({ key }); },
  };
}

export function parseAuthCallback(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'br.com.autoflow.app:' || url.hostname !== 'auth'
      || url.pathname !== '/callback' || url.username || url.password || url.port) return null;
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (url.searchParams.has('error') || fragment.has('error')) {
    return { error: 'A autenticação não foi concluída. Tente entrar novamente.' };
  }
  // Apenas PKCE: tokens recebidos diretamente por URL nunca são aceitos.
  const code = url.searchParams.get('code');
  return code ? { code } : { error: 'Link de autenticação inválido ou expirado. Entre novamente.' };
}

export function createAuthCallbackHandler(auth) {
  const pending = new Map();
  const completed = new Set();
  return async value => {
    const callback = parseAuthCallback(value);
    if (!callback) return false;
    if (callback.error) throw Error(callback.error);
    if (completed.has(callback.code)) return true;
    if (pending.has(callback.code)) return pending.get(callback.code);
    const request = (async () => {
      const { error } = await auth.exchangeCodeForSession(callback.code);
      if (error) throw Error('Não foi possível concluir o login. Abra o link no mesmo celular ou entre novamente.');
      completed.add(callback.code);
      if (completed.size > 20) completed.delete(completed.values().next().value);
      return true;
    })();
    pending.set(callback.code, request);
    try { return await request; } finally { pending.delete(callback.code); }
  };
}
