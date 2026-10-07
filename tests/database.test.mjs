import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const root = new URL('../', import.meta.url);
const admin = '00000000-0000-0000-0000-000000000001';
const owner = '00000000-0000-0000-0000-000000000002';
const other = '00000000-0000-0000-0000-000000000003';
const client = '00000000-0000-0000-0000-000000000004';

test('migração, RLS, aprovação, revogação e auditoria em PostgreSQL (PGlite)', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table public.tb_cli(id_cliente bigint generated always as identity primary key, nome text not null, senha text, email text, num_tel numeric, cep numeric);
    create table public.tb_veiculo(id_veiculo bigint primary key, placa numeric not null, marca text, modelo text, ano_do_modelo numeric, km_atual numeric, cliente_id bigint references public.tb_cli);
    create table public.oficinas(id bigint generated always as identity primary key, nome varchar not null, cnpj varchar not null unique, email varchar unique, telefone varchar not null, cep varchar not null, logradouro varchar not null, numero varchar not null, bairro varchar not null, cidade varchar not null, estado char not null, senha text, created_at timestamptz not null default now());
    create table public.ordens_servico(id bigint generated always as identity primary key, oficina_id bigint not null references public.oficinas, cliente_id bigint not null references public.tb_cli, veiculo_id bigint not null references public.tb_veiculo, status text default 'aguardando' check(status in ('aguardando','em_analise','em_manutencao','pronto','entregue')), descricao_problema text, data_entrada timestamptz not null default now(), data_saida timestamptz);
    create table public.avaliacoes(id bigint generated always as identity primary key, os_id bigint unique not null references public.ordens_servico, nota integer not null check(nota between 1 and 5), comentario text, created_at timestamptz default now());
    insert into public.oficinas(nome,cnpj,telefone,cep,logradouro,numero,bairro,cidade,estado,senha) values('Legada','11.222.333/0001-81','','','','','','','S','senha-antiga');
  `);
  for (const file of ['web/private/database/SUPABASE_SETUP.sql','web/private/database/SECURITY_HARDENING.sql','supabase/migrations/20261007164947_workshop_verification.sql']) {
    await db.exec(await readFile(new URL(file,root),'utf8'));
  }
  assert.equal((await db.query('select status from oficinas where id=1')).rows[0].status,'pendente');
  assert.equal((await db.query("select 1 from information_schema.columns where table_name='oficinas' and column_name='senha'")).rows.length,0);
  await db.exec(`
    insert into auth.users(id,email) values('${admin}','admin@example.test'),('${owner}','owner@example.test'),('${other}','other@example.test'),('${client}','client@example.test');
    insert into public.autoflow_admins(user_id) values('${admin}');
    update public.oficinas set user_id='${owner}', situacao_cadastral=2, verificado_em=now() where id=1;
    insert into public.oficinas(nome,cnpj,telefone,cep,logradouro,numero,bairro,cidade,estado,user_id,situacao_cadastral,verificado_em) values('Outra','12ABC34501DE35','','','','','','','SP','${other}',2,now());
  `);
  async function asUser(user, fn, role='authenticated') {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${user || ''}',false);`);
    try { return await fn(); } finally { await db.exec('reset role'); }
  }
  const review = (status,revision=0,ownership=true,activity=true) => db.query(
    'select public.review_workshop($1,$2,$3,$4,$5,$6)', [1,revision,status,'Verificação por contato independente registrado para o teste.',ownership,activity]);

  await t.test('anônimo não lê oficinas; pendente não cria OS nem altera aprovação', async () => {
    await asUser(null, () => assert.rejects(db.query('select * from oficinas'), /permission denied/),'anon');
    await asUser(owner, async () => {
      assert.equal((await db.query('select id from oficinas')).rows.length,1);
      await assert.rejects(review('aprovada'), /restrito/);
      await assert.rejects(db.query("update oficinas set status='aprovada' where id=1"), /permission denied/);
      await assert.rejects(db.query(`insert into autoflow_admins(user_id) values('${owner}')`), /permission denied/);
      await assert.rejects(db.query("select create_workshop_order('ABC1D23','Teste','Cliente Teste','Teste','aguardando')"), /sem aprovação/);
      await assert.rejects(db.query(`select consume_workshop_lookup('${owner}')`), /permission denied/);
    });
  });
  await t.test('aprovação exige vínculo e atividade, consulta recente e revisão atual', async () => {
    await asUser(admin, async () => {
      await assert.rejects(review('aprovada',0,false,true), /Confirme/);
      await assert.rejects(review('aprovada',0,true,false), /Confirme/);
      await review('aprovada');
      await assert.rejects(review('bloqueada',0), /alterado/);
      const log = (await db.query('select * from oficina_revisoes')).rows;
      assert.equal(log.length,1); assert.equal(log[0].actor_id,admin);
    });
  });
  let orderId;
  await t.test('aprovada cria OS atômica; outra oficina e cliente não veem os registros', async () => {
    await asUser(owner, async () => {
      orderId = (await db.query("select create_workshop_order('ABC1D23','Teste','Cliente Teste','Teste','aguardando') as id")).rows[0].id;
      assert.equal((await db.query('select id from ordens_servico')).rows.length,1);
      assert.equal((await db.query("select id_cliente from tb_cli where nome='Cliente Teste'")).rows.length,1);
      await assert.rejects(db.query("select create_workshop_order('ABC1D23','Teste','Pessoa Diferente','Teste','aguardando')"), /outro cliente/);
      await assert.rejects(db.query('delete from ordens_servico'), /permission denied/);
      await assert.rejects(db.query('select * from oficina_revisoes').then(r=>{if(r.rows.length===0) throw Error('hidden')}), /hidden/);
    });
    for (const uid of [other,client]) await asUser(uid, async () => {
      assert.equal((await db.query('select id from ordens_servico')).rows.length,0);
      assert.equal((await db.query("select id_cliente from tb_cli where nome='Cliente Teste'")).rows.length,0);
    });
  });
  await t.test('bloquear revoga acesso com o mesmo JWT e mantém histórico para o cliente', async () => {
    await db.query(`update tb_cli set auth_user_id=$1 where id_cliente=(select cliente_id from ordens_servico where id=$2)`,[null,orderId]);
    // Usa o perfil Auth do cliente existente, sem assumir a conta pelo nome.
    await db.query(`update ordens_servico set cliente_id=(select id_cliente from tb_cli where auth_user_id=$1) where id=$2`,[client,orderId]);
    await asUser(admin, () => review('bloqueada',1));
    await asUser(owner, async () => {
      assert.equal((await db.query('select id from ordens_servico')).rows.length,0);
      assert.equal((await db.query('select id_veiculo from tb_veiculo')).rows.length,0);
      await assert.rejects(db.query("select create_workshop_order('ABC1D23','Teste','Cliente Teste','Teste','aguardando')"), /sem aprovação/);
    });
    await asUser(client, async () => {
      assert.equal((await db.query('select id from ordens_servico')).rows.length,1);
      assert.equal((await db.query("select id from oficinas where status='aprovada'")).rows.length,0);
    });
  });
  await t.test('bloqueio exige nova revisão e CNPJ inativo/antigo não pode ser aprovado', async () => {
    await asUser(admin, () => assert.rejects(review('aprovada',2), /Transição/));
    await asUser(admin, () => review('em_verificacao',2));
    await db.exec("update oficinas set verificado_em=now()-interval '31 days' where id=1");
    await asUser(admin, () => assert.rejects(review('aprovada',3), /Confirme/));
    await db.exec('update oficinas set verificado_em=now(),situacao_cadastral=8 where id=1');
    await asUser(admin, () => assert.rejects(review('aprovada',3), /Confirme/));
  });
  await t.test('limite de consulta é atômico, e apenas backend reconsulta', async () => {
    await asUser(owner, () => assert.rejects(db.query('select refresh_workshop_verification(1,$1,3,$2)',[admin,{}]),/permission denied/));
    await asUser(null, async () => {
      for(let n=1;n<=11;n++) {
        assert.equal((await db.query('select consume_workshop_lookup($1) as allowed',[owner])).rows[0].allowed,n<=10);
      }
      await db.query('select refresh_workshop_verification(1,$1,3,$2)',[admin,{cnpj:'11222333000181',situacao_cadastral:2,razao_social:'Legada',cnaes:[]}]);
    },'service_role');
    await asUser(admin, () => review('aprovada',4));
    await asUser(null, () => db.query('select refresh_workshop_verification(1,$1,5,$2)',[admin,{cnpj:'11222333000181',situacao_cadastral:8,razao_social:'Legada',cnaes:[]}]),'service_role');
    assert.equal((await db.query('select status from oficinas where id=1')).rows[0].status,'em_verificacao');
  });
});
