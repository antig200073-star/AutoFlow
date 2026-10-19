import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVehicleService } from '../web/public/assets/js/vehicle-service.js';

function fakeClient({ ownsVehicle = true } = {}) {
  const queries = [];
  const responses = {
    tb_cli: { data: { id_cliente: 7 }, error: null },
    tb_veiculo: { data: ownsVehicle ? { id_veiculo: 10 } : null, error: null },
    ordens_servico: { data: [{ id: 1, oficina_id: 3, status: 'entregue', descricao_problema: 'Revisão',
      data_entrada: '2026-10-18T15:00:00Z', data_saida: '2026-10-19T15:00:00Z', oficinas: { nome: 'Oficina teste' } }], error: null },
  };
  return {
    queries,
    db: {
      auth: { getUser: async () => ({ data: { user: { id: 'auth-abc' } }, error: null }) },
      from(table) {
        const call = { table, filters: [], fields: null, sort: null };
        queries.push(call);
        const builder = {
          select(fields) { call.fields = fields; return this; },
          eq(key, value) { call.filters.push([key,value]); return this; },
          async maybeSingle() { return responses[table]; },
          async order(column, options) { call.sort=[column,options]; return responses[table]; }
        };
        return builder;
      }
    }
  };
}

test('histórico mostra O.S. entregues e filtra pelo proprietário e veículo', async () => {
  const { db, queries } = fakeClient();
  const result = await createVehicleService(db).history(10);
  assert.equal(result.length,1);
  assert.equal(result[0].status,'entregue');
  assert.equal(result[0].oficina,'Oficina teste');
  const ordersQuery=queries.find(q=>q.table==='ordens_servico');
  assert.deepEqual(ordersQuery.filters,[['cliente_id',7],['veiculo_id',10]]);
  assert.deepEqual(ordersQuery.sort,['data_entrada',{ascending:false}]);
});

test('histórico não consulta ordens de veículo sem propriedade confirmada', async () => {
  const { db, queries } = fakeClient({ownsVehicle:false});
  await assert.rejects(() => createVehicleService(db).history(10),/não está vinculado/);
  assert.equal(queries.filter(q=>q.table==='ordens_servico').length,0);
});

test('histórico rejeita identificadores inválidos', async () => {
  const { db } = fakeClient();
  await assert.rejects(() => createVehicleService(db).history('outro'),/inválido/);
});
