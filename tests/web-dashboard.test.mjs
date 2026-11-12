import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../web/public/assets/js/integration.js', import.meta.url), 'utf8');

function dashboard(orders, error = null) {
  const queries = [];
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'client-auth' } }, error: null }) },
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      return {
        select(fields) { query.fields = fields; return this; },
        eq(key, value) { query.filters.push([key, value]); return this; },
        is(key, value) { query.filters.push([key, value]); return this; },
        maybeSingle() { return this; },
        order() { return this; },
        then(resolve, reject) {
          const result = table === 'tb_cli' ? { data: { id_cliente: 7 } }
            : table === 'tb_veiculo' ? { count: 2 }
            : { data: orders, error };
          return Promise.resolve(result).then(resolve, reject);
        }
      };
    }
  };
  const window = { supabase: { createClient: () => db } };
  runInNewContext(source, { window, document: { addEventListener() {} }, console });
  return { integration: window.AutoFlowIntegration, queries };
}

test('web: detalhamento vem da O.S. do cliente, sem misturar custos entre veículos', async () => {
  const { integration, queries } = dashboard([
    { id: 93, status: 'aguardando', pecas_servicos: 'Velas novas', valor_mao_obra: '180.00', valor_pecas: '350.00' },
    { id: 94, status: 'em_analise', pecas_servicos: 'Troca de óleo', valor_mao_obra: 90.5, valor_pecas: 125.25 },
    { id: 95, status: 'entregue', valor_mao_obra: 999, valor_pecas: 999 }
  ]);
  const result = JSON.parse(JSON.stringify(await integration.loadDashboard()));
  assert.deepEqual(result.maintenances.map(({ id, serviceDescription, laborCost, partsCost }) =>
    ({ id, serviceDescription, laborCost, partsCost })), [
    { id: 93, serviceDescription: 'Velas novas', laborCost: '180.00', partsCost: '350.00' },
    { id: 94, serviceDescription: 'Troca de óleo', laborCost: 90.5, partsCost: 125.25 }
  ]);
  assert.deepEqual(result.dashboard, { totalVehicles: 2, totalServices: 2, totalFinished: 1 });
  const query = queries.find(item => item.table === 'ordens_servico');
  assert.deepEqual(query.filters, [['cliente_id', 7]]);
  for (const column of ['pecas_servicos', 'valor_mao_obra', 'valor_pecas']) assert.ok(query.fields.includes(column));
});

test('web: valores zero são preservados e custos ausentes não viram zero', async () => {
  const { integration } = dashboard([
    { id: 1, status: 'aguardando', valor_mao_obra: 0, valor_pecas: 0 },
    { id: 2, status: 'aguardando', valor_mao_obra: null }
  ]);
  const { maintenances } = await integration.loadDashboard();
  assert.equal(maintenances[0].laborCost, 0);
  assert.equal(maintenances[0].partsCost, 0);
  assert.equal(maintenances[1].laborCost, null);
  assert.equal(maintenances[1].partsCost, null);
});

test('web: erro na consulta do orçamento é propagado para o painel', async () => {
  const { integration } = dashboard(null, new Error('Falha na consulta'));
  await assert.rejects(() => integration.loadDashboard(), /Falha na consulta/);
});
