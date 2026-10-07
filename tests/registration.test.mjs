import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from '../supabase/functions/_shared/registration.mjs';

function fixture({ user = { id: 'real-user', email: 'owner@example.test', email_confirmed_at: '2026-10-07' },
  company = { cnpj: '11222333000181', nome: 'Oficina Real', situacao_cadastral: 2 }, role = false,
  quota = true, duplicate = false, exists = false } = {}) {
  const writes = []; const calls = [];
  const userClient = {
    auth: { getUser: async token => { calls.push(token); return { data: { user }, error: user ? null : Error() }; } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: role ? {user_id:user.id} : null }) }) }) }),
  };
  const adminClient = {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: exists ? { id: 1 } : null }), single: async () => ({ data: {id:1,cnpj:company.cnpj,revisao:0} }) }) }),
      insert: payload => { writes.push(payload); return { select: () => ({ single: async () => ({ data: { id:1,status:'pendente' }, error: duplicate ? {code:'23505'} : null }) }) }; },
    }),
    rpc: async name => ({ data: name === 'consume_workshop_lookup' ? quota : null }),
  };
  return { writes, calls, handler: createHandler({
    createClient: (_, key) => key === 'secret' ? adminClient : userClient,
    getEnv: name => ({ SUPABASE_URL:'https://example.test', SUPABASE_PUBLISHABLE_KEYS:'{"default":"public"}',SUPABASE_SECRET_KEYS:'{"default":"secret"}' })[name],
    lookup: async () => company,
  }) };
}
const request = (body, token='valid-token') => new Request('https://example.test/register-workshop', {
  method:'POST', headers:token ? { Authorization:`Bearer ${token}` } : {},body:JSON.stringify(body),
});

test('cadastro ignora privilégios enviados pelo cliente e usa identidade Auth',async () => {
  const f = fixture();
  const response = await f.handler(request({cnpj:'11222333000181',status:'aprovada',user_id:'attacker',email:'fake@example.test',aprovado_por:'attacker',situacao_cadastral:2}));
  assert.equal(response.status,201); assert.deepEqual(f.calls,['valid-token']);
  assert.equal(f.writes[0].status,'pendente'); assert.equal(f.writes[0].user_id,'real-user');
  assert.equal(f.writes[0].email,'owner@example.test'); assert.equal(f.writes[0].aprovado_por,undefined);
});

test('sem JWT, JWT inválido ou e-mail não confirmado não cadastra',async () => {
  const cases = [ [fixture(),null,401], [fixture({user:null}),'bad-token',401],
    [fixture({user:{id:'real-user',email:'owner@example.test'}}),'valid-token',403] ];
  for(const [f,token,status] of cases) {
    assert.equal((await f.handler(request({cnpj:'11222333000181'},token))).status,status);
    assert.equal(f.writes.length,0);
  }
});

test('CNPJ não ativo, duplicidade e limite excedido falham sem aprovação',async () => {
  for(const [options,status] of [ [{company:{cnpj:'11222333000181',situacao_cadastral:8}},422],
    [{duplicate:true},409],[{quota:false},429],[{exists:true},409] ]) {
    const f=fixture(options);
    assert.equal((await f.handler(request({cnpj:'11222333000181'}))).status,status);
    assert.ok(f.writes.every(w=>w.status==='pendente'));
  }
});

test('reconsulta exige administrador atual e falha interna não vaza segredos',async () => {
  assert.equal((await fixture().handler(request({action:'refresh',oficina_id:1}))).status,403);
  assert.equal((await fixture({role:true}).handler(request({action:'refresh',oficina_id:1}))).status,200);
  const handler=createHandler({createClient:()=>{throw new Error('secret-internal');},getEnv:()=>''});
  const response=await handler(request({}));
  assert.equal(response.status,500); assert.ok(!(await response.text()).includes('secret-internal'));
});
