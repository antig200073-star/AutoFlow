import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClientService } from '../mobile/src/services/client-service.js';
import { startDashboardRefresh } from '../mobile/src/services/dashboard-refresh.js';

const ok = data => ({ data, error: null });
function mock({ tables = {}, authError = null, rpc = ok([]) } = {}) {
  const calls = [];
  const user = { id: 'client-auth', email: 'confirmed@example.test' };
  return { calls, db: {
    auth: { getUser: async () => ({ data: { user }, error: null }),
      updateUser: async input => { calls.push({ authUpdate: input }); return { error: authError }; } },
    rpc: async (name, params) => { calls.push({ rpc: name, params }); return rpc; },
    from(table) {
      const call = { table, filters: [], action: 'select' }; calls.push(call);
      const builder = {
        select(fields, options) { call.fields = fields; call.options = options; return this; },
        eq(key, value) { call.filters.push([key, value]); return this; },
        is(key, value) { call.filters.push([key, value]); return this; },
        in(key, value) { call.filters.push([key, value]); return this; },
        order() { return this; }, maybeSingle() { return this; }, single() { return this; },
        insert(value) { call.action = 'insert'; call.payload = value; return this; },
        update(value) { call.action = 'update'; call.payload = value; return this; },
        then(resolve, reject) {
          const entry = tables[table] ?? (table === 'tb_cli' ? ok({ id_cliente: 7, nome: 'Cliente', email: 'stale@example.test' }) : ok([]));
          return Promise.resolve(typeof entry === 'function' ? entry(call) : entry).then(resolve, reject);
        },
      };
      return builder;
    },
  } };
}

test('mobile: cada O.S. ativa ganha acompanhamento, entregues contam no histórico e excluídos não contam', async () => {
  const { db, calls } = mock({ tables: {
    tb_veiculo: { data: null, count: 2, error: null },
    ordens_servico: ok([
      { id: 1, status: 'em_analise', veiculo_id: 10, tb_veiculo: { marca: 'Chevrolet', modelo: 'Opala' } },
      { id: 2, status: 'pronto', veiculo_id: 10, tb_veiculo: { modelo: 'Opala' } },
      { id: 3, status: 'entregue', veiculo_id: 11 },
    ]),
  } });
  const result = await createClientService(db).loadDashboard();
  assert.deepEqual(result.dashboard, { totalVehicles: 2, totalServices: 2, totalFinished: 1 });
  assert.deepEqual(result.maintenances.map(item => [item.id, item.status]), [[1, 'Diagnóstico'], [2, 'Pronto para Retirada']]);
  assert.deepEqual(calls.find(call => call.table === 'tb_veiculo').filters, [['cliente_id', 7], ['excluido_em', null]]);
  assert.deepEqual(calls.find(call => call.table === 'ordens_servico').filters, [['cliente_id', 7]]);
});

test('mobile: sem O.S. ativa não retorna barras e uma nova O.S. não herda o status da anterior', async () => {
  const tables = { ordens_servico: ok([{ id: 9, status: 'entregue' }]) };
  const { db } = mock({ tables });
  assert.deepEqual((await createClientService(db).loadDashboard()).maintenances, []);
  tables.ordens_servico = ok([{ id: 10, status: 'em_analise' }, { id: 9, status: 'entregue' }]);
  assert.deepEqual((await createClientService(db).loadDashboard()).maintenances.map(x => x.id), [10]);
});

test('mobile: opções de avaliação contêm apenas O.S. entregues e ainda não avaliadas', async () => {
  const { db, calls } = mock({ tables: {
    ordens_servico: ok([{ id: 1, status: 'entregue' }, { id: 2, status: 'entregue' }, { id: 3, status: 'pronto' }]),
    avaliacoes: ok([{ id: 8, os_id: 1, nota: 5 }]),
  } });
  const result = await createClientService(db).loadEvaluationData();
  assert.deepEqual(result.orders.map(x => x.id), [2]);
  assert.equal(result.evaluations.length, 1);
  assert.deepEqual(calls.find(x => x.table === 'ordens_servico').filters, [['cliente_id', 7]]);
});

for (const [name, order, existing, expected] of [
  ['alheia', null, null, /não pertence/],
  ['não entregue', { id: 2, status: 'pronto' }, null, /retirada/],
  ['duplicada', { id: 2, status: 'entregue' }, { id: 6 }, /já foi avaliada/],
]) test(`mobile: não grava avaliação ${name}`, async () => {
  const { db, calls } = mock({ tables: { ordens_servico: ok(order), avaliacoes: ok(existing) } });
  await assert.rejects(() => createClientService(db).createEvaluation({ osId: 2, nota: 5 }), expected);
  assert.equal(calls.some(x => x.action === 'insert'), false);
});

test('mobile: erro de gravação da avaliação é propagado, sem falso sucesso', async () => {
  const { db } = mock({ tables: { ordens_servico: ok({ id: 2, status: 'entregue' }),
    avaliacoes: call => call.action === 'insert' ? { data: null, error: Error('offline') } : ok(null) } });
  await assert.rejects(() => createClientService(db).createEvaluation({ osId: 2, nota: 5 }), /offline/);
});

test('mobile: média e comentários públicos vêm da RPC sem consultar clientes de terceiros', async () => {
  const { db, calls } = mock({ rpc: ok([{ id: 1, nota: 5, comentario: 'Bom' }, { id: 2, nota: 3 }]) });
  const result = await createClientService(db).loadWorkshopReviews(4);
  assert.equal(result.average, '4.0'); assert.equal(result.total, 2);
  assert.deepEqual(calls, [{ rpc: 'workshop_public_reviews', params: { p_workshop_id: 4 } }]);
});

test('mobile: falha nas avaliações não oculta oficinas aprovadas', async () => {
  const { db, calls } = mock({ tables: { oficinas: ok([{ id: 3, nome: 'Oficina' }]) }, rpc: { error: Error('offline') } });
  const result = await createClientService(db).loadWorkshops();
  assert.equal(result.length, 1); assert.equal(result[0].ratings, null);
  assert.deepEqual(calls.find(x => x.table === 'oficinas').filters, [['status', 'aprovada']]);
});

test('mobile: perfil usa email confirmado e mantém o antigo até a confirmação no Auth', async () => {
  const { db, calls } = mock({ tables: { tb_cli: ok({ nome: 'Nome salvo', num_tel: '11999' }) } });
  const service = createClientService(db);
  assert.equal((await service.loadProfile()).email, 'confirmed@example.test');
  const result = await service.updateProfile({ nome: 'Nome salvo', email: 'new@example.test', telefone: '11999' });
  assert.equal(result.profile.email, 'confirmed@example.test'); assert.match(result.message, /Confirme/);
  assert.equal(calls.find(x => x.action === 'update').payload.email, 'confirmed@example.test');
  assert.deepEqual(calls.find(x => x.authUpdate).authUpdate, { email: 'new@example.test' });
});

test('mobile: falha parcial de troca de email informa que nome e telefone já foram salvos', async () => {
  const { db } = mock({ authError: Error('email indisponível'), tables: { tb_cli: ok({ nome: 'Novo nome', num_tel: '11999' }) } });
  const result = await createClientService(db).updateProfile({ nome: 'Novo nome', email: 'new@example.test' });
  assert.equal(result.warning, true); assert.match(result.message, /Nome e telefone salvos/);
  assert.equal(result.profile.email, 'confirmed@example.test');
});

test('mobile: erro de perfil não resulta em sucesso e não solicita troca de email', async () => {
  const { db, calls } = mock({ tables: { tb_cli: { error: Error('Falha ao salvar') } } });
  await assert.rejects(() => createClientService(db).updateProfile({ nome: 'Nome', email: 'new@example.test' }), /Falha/);
  assert.equal(calls.some(x => x.authUpdate), false);
});

test('mobile: atualização a cada 30s evita concorrência, pausa em segundo plano e ignora retorno após desmontagem', async () => {
  let tick, finish, requests = 0, renders = 0;
  const listeners = new Map();
  const doc = { visibilityState: 'visible', addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const win = { ...doc, setInterval: (fn, interval) => { assert.equal(interval, 30000); tick = fn; return 1; }, clearInterval: () => {} };
  const stop = startDashboardRefresh({ document: doc, window: win,
    load: () => { requests++; return new Promise(resolve => { finish = resolve; }); },
    onData: () => { renders++; }, onError: assert.fail });
  await tick(); assert.equal(requests, 1);
  finish({}); await new Promise(resolve => setImmediate(resolve)); assert.equal(renders, 1);
  doc.visibilityState = 'hidden'; await tick(); assert.equal(requests, 1);
  doc.visibilityState = 'visible'; listeners.get('visibilitychange')(); assert.equal(requests, 2);
  stop(); finish({}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(renders, 1); assert.equal(listeners.size, 0);
});
