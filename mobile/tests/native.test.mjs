import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeSessionStorage, parseAuthCallback, createAuthCallbackHandler, NATIVE_AUTH_REDIRECT } from '../src/native/auth.js';
import { createPageHistory, dismissOpenDialog } from '../src/native/navigation.js';

test('sessão nativa sobrevive à recriação do adaptador e logout remove os dados', async () => {
  const values = new Map();
  const preferences = {
    get: async ({ key }) => ({ value: values.get(key) ?? null }),
    set: async ({ key, value }) => { values.set(key, value); },
    remove: async ({ key }) => { values.delete(key); },
  };
  const first = createNativeSessionStorage(preferences);
  assert.equal(await first.getItem('session'), null);
  await first.setItem('session', '{"access_token":"test-only"}');
  const restarted = createNativeSessionStorage(preferences);
  assert.equal(await restarted.getItem('session'), '{"access_token":"test-only"}');
  await restarted.removeItem('session');
  assert.equal(await first.getItem('session'), null);
});

test('callback aceita somente o endereço exato, com código PKCE', () => {
  assert.deepEqual(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?code=abc`), { code: 'abc' });
  for (const url of ['bad url', 'https://auth/callback?code=abc', 'br.com.autoflow.app://other/callback?code=abc',
    'br.com.autoflow.app://auth/other?code=abc', 'br.com.autoflow.app://attacker@auth/callback?code=abc']) {
    assert.equal(parseAuthCallback(url), null);
  }
  assert.ok(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}#access_token=untrusted&refresh_token=untrusted`).error);
  assert.ok(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?error=access_denied&error_description=private`).error);
});

test('callback duplicado no arranque e no appUrlOpen troca o código apenas uma vez', async () => {
  const calls = [];
  const handle = createAuthCallbackHandler({ exchangeCodeForSession: async code => {
    calls.push(code); await new Promise(resolve => setTimeout(resolve, 5)); return { error: null };
  } });
  const url = `${NATIVE_AUTH_REDIRECT}?code=one-use`;
  assert.deepEqual(await Promise.all([handle(url), handle(url)]), [true, true]);
  assert.equal(await handle(url), true);
  assert.deepEqual(calls, ['one-use']);
  assert.equal(await handle('https://example.test'), false);
});

test('falha de troca do código não é tratada como sessão válida e permite tentar de novo', async () => {
  let attempts = 0;
  const handle = createAuthCallbackHandler({ exchangeCodeForSession: async () => {
    attempts++; return { error: attempts === 1 ? Error('private token details') : null };
  } });
  await assert.rejects(handle(`${NATIVE_AUTH_REDIRECT}?code=retry`), /Não foi possível concluir/);
  assert.equal(await handle(`${NATIVE_AUTH_REDIRECT}?code=retry`), true);
  assert.equal(attempts, 2);
});

test('Voltar respeita telas visitadas e não volta para uma sessão encerrada', () => {
  const history = createPageHistory();
  history.visit('cadastro');
  assert.equal(history.back(), 'login');
  history.reset('dash'); history.visit('veiculos'); history.visit('perfil'); history.visit('perfil');
  assert.equal(history.back(), 'veiculos');
  assert.equal(history.back(), 'dash');
  assert.equal(history.back(), null);
  history.visit('oficinas'); history.reset('login');
  assert.equal(history.back(), null);
});

test('Voltar fecha modal dentro de shadow DOM e respeita cancelamento de operação pendente', () => {
  let closed = 0;
  const dialog = { matches: selector => selector === 'dialog[open]', dispatchEvent: () => true, close: () => { closed++; } };
  const host = { matches: () => false, shadowRoot: { querySelectorAll: () => [dialog] } };
  const doc = { querySelectorAll: () => [host] };
  assert.equal(dismissOpenDialog(doc), true);
  assert.equal(closed, 1);
  dialog.dispatchEvent = () => false;
  assert.equal(dismissOpenDialog(doc), true);
  assert.equal(closed, 1);
  assert.equal(dismissOpenDialog({ querySelectorAll: () => [] }), false);
});
