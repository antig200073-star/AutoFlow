import { test, expect } from '@playwright/test';
import { mockApi, seedSession, mockNative, storageKey } from './fixtures';

test('login, navegação, O.S., histórico, oficinas, avaliações e saída', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await mockApi(page); await page.goto('/');
  await page.getByLabel('E-mail', { exact: true }).fill('cliente@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
  await expect(page.locator('.maintenance-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Veículos', exact: true }).click();
  await expect(page.getByText('ABC1D23', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Ver histórico/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Troca de óleo');
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await page.getByRole('button', { name: 'Cadastrar veículo', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Vincular à oficina', exact: true }).click();
  await page.getByRole('button', { name: 'Gerar código', exact: true }).click();
  await expect(page.getByLabel('Código de vínculo')).toHaveValue('TESTE-CODIGO');
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Oficinas', exact: true }).click();
  await page.getByRole('button', { name: 'Ver detalhes e avaliações' }).click();
  await expect(page.getByRole('dialog')).toContainText('Atendimento de teste');
  await page.getByRole('button', { name: 'Fechar janela' }).click();
  await page.getByRole('button', { name: 'Serviços', exact: true }).click();
  await page.getByRole('button', { name: 'Avaliar serviços', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Avaliações', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Perfil', exact: true }).click();
  await expect(page.locator('#profile-email')).toHaveValue('cliente@example.test');
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao AutoFlow' })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBeNull();
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 768]) {
  test(`layout ${width}px e restauração de sessão`, async ({ page }) => {
    await mockApi(page); await seedSession(page); await page.setViewportSize({ width, height: 844 });
    await page.goto('/'); await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
    await page.reload(); await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Veículos', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Meus veículos' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test('cadastro exige senhas iguais e envia confirmação sem criar perfil duplicado', async ({ page }) => {
  const requests = await mockApi(page); await page.goto('/');
  await page.getByRole('link', { name: 'Cadastre-se' }).click();
  await page.getByLabel('Nome completo').fill('Cliente de teste');
  await page.getByLabel('E-mail', { exact: true }).fill('cliente@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByLabel('Confirmar senha', { exact: true }).fill('senha-diferente');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByText('As senhas não coincidem.')).toBeVisible();
  expect(requests.filter(r => r.path.endsWith('signup'))).toHaveLength(0);
  await page.getByLabel('Confirmar senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await expect(page.getByText(/Confira seu e-mail/)).toBeVisible();
  expect(requests.filter(r => r.path.endsWith('signup'))).toHaveLength(1);
  expect(requests.some(r => r.path.endsWith('tb_cli') && r.method === 'POST')).toBe(false);
});

test('ponte Android: Voltar, modais, teclado, sessão persistente e conexão', async ({ page }) => {
  await mockApi(page); await mockNative(page); await page.goto('/');
  await page.getByRole('link', { name: 'Cadastre-se' }).click();
  await page.evaluate(() => window.emitNative('backButton'));
  await expect(page.getByRole('heading', { name: 'Bem-vindo ao AutoFlow' })).toBeVisible();
  await page.getByLabel('E-mail', { exact: true }).fill('cliente@example.test');
  await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
  expect(await page.evaluate(key => !!localStorage.getItem(`native:${key}`), storageKey)).toBe(true);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Veículos', exact: true }).click();
  await page.getByRole('button', { name: 'Cadastrar veículo', exact: true }).click();
  await page.evaluate(() => window.emitNative('backButton'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Meus veículos' })).toBeVisible();
  await page.evaluate(() => window.emitNative('keyboardWillShow'));
  await expect(page.getByRole('navigation')).toBeHidden();
  await page.evaluate(() => window.emitNative('backButton'));
  expect(await page.evaluate(() => window.nativeCalls.some(c => c.plugin === 'Keyboard' && c.method === 'hide'))).toBe(true);
  await page.evaluate(() => window.emitNative('keyboardWillHide'));
  await expect(page.getByRole('navigation')).toBeVisible();
  await page.evaluate(() => window.emitNative('backButton'));
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
  await page.evaluate(() => window.emitNative('backButton'));
  expect(await page.evaluate(() => window.nativeCalls.some(c => c.method === 'minimizeApp'))).toBe(true);
  await page.context().setOffline(true);
  await expect(page.getByText(/Sem conexão/)).toBeVisible();
  await page.context().setOffline(false);
});

test('Google no Android usa navegador e PKCE, callback externo é ignorado', async ({ page }) => {
  const requests = await mockApi(page); await mockNative(page); await page.goto('/');
  await page.getByRole('button', { name: 'Entrar com o Google' }).click();
  await expect.poll(async () => page.evaluate(() => window.nativeCalls.filter(c => c.plugin === 'Browser' && c.method === 'open').length)).toBe(1);
  const opened = await page.evaluate(() => window.nativeCalls.find(c => c.plugin === 'Browser' && c.method === 'open').options.url);
  const url = new URL(opened);
  expect(url.searchParams.get('redirect_to')).toBe('br.com.autoflow.app://auth/callback');
  expect(url.searchParams.get('code_challenge_method')).toBe('s256');
  await page.evaluate(() => window.emitNative('appUrlOpen', { url: 'https://attacker.test/?code=bad' }));
  expect(requests.filter(r => r.path.endsWith('/token'))).toHaveLength(0);
  await page.evaluate(() => window.emitNative('appUrlOpen', { url: 'br.com.autoflow.app://auth/callback?code=test-code' }));
  await expect(page.getByRole('heading', { name: 'Início', exact: true })).toBeVisible();
  expect(requests.find(r => r.path.endsWith('/token')).body.auth_code).toBe('test-code');
});
