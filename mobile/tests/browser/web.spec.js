import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockApi, seedSession } from './fixtures';

test('site original carrega login e páginas autenticadas com API simulada', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const supabase = await readFile(new URL('../../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url), 'utf8');
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@**', route => route.fulfill({ contentType: 'text/javascript', body: supabase }));
  await mockApi(page);
  await page.goto('http://127.0.0.1:4174/index.html');
  await expect(page.locator('#login-form')).toBeVisible();
  await seedSession(page);
  for (const file of ['dashboard.html', 'veiculos.html', 'oficinas.html', 'avaliacoes.html', 'perfil.html']) {
    await page.goto(`http://127.0.0.1:4174/${file}`);
    await expect(page.locator('main')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(file.replace('.', '\\.')));
  }
  expect(errors).toEqual([]);
});
