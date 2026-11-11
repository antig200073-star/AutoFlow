import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockApi, seedSession } from './fixtures';

for (const platform of ['web', 'mobile']) {
  async function openLink(page) {
    await mockApi(page);
    await seedSession(page);
    if (platform === 'web') {
      const supabase = await readFile(new URL('../../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url), 'utf8');
      await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@**', route => route.fulfill({ contentType: 'text/javascript', body: supabase }));
      await page.goto('http://127.0.0.1:4174/veiculos.html');
    } else {
      await page.goto('/');
      await page.getByRole('button', { name: 'Veículos', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Vincular à oficina', exact: true }).click();
  }

  test(`${platform}: gera, copia e renova os seis números sem perder zeros`, async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.setViewportSize({ width: 320, height: 844 });
    await openLink(page);
    await page.getByRole('button', { name: 'Gerar código', exact: true }).click();
    const input = page.getByLabel('Código de vínculo');
    await expect(input).toHaveValue('012345');
    await expect(input).toHaveAttribute('readonly', '');
    await expect(page.getByRole('dialog')).toContainText('6 números');
    expect(await input.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Copiar código', exact: true }).click();
    await expect(page.getByText('Código copiado.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('012345');

    await page.route('**/rest/v1/rpc/issue_vehicle_workshop_link', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ code: '987654', expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }),
    }));
    await page.getByRole('button', { name: 'Gerar código', exact: true }).click();
    await expect(input).toHaveValue('987654');
    await page.getByRole('button', { name: 'Copiar código', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('987654');
    await page.screenshot({ path: `test-results/vehicle-link-${platform}.png` });
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Vincular à oficina', exact: true }).click();
    await expect(input).toHaveValue('');
    await expect(input).toBeHidden();
  });

  test(`${platform}: resposta inválida não é truncada nem oferecida para copiar`, async ({ page }) => {
    await openLink(page);
    await page.route('**/rest/v1/rpc/issue_vehicle_workshop_link', route => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ code: '12345678-1234-4abc-8def-123456789abc', expires_at: new Date().toISOString() }),
    }));
    await page.getByRole('button', { name: 'Gerar código', exact: true }).click();
    await expect(page.getByText('Não foi possível gerar o código de 6 números. Tente novamente.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copiar código', exact: true })).toBeHidden();
    await expect(page.getByLabel('Código de vínculo')).toHaveValue('');
  });
}
