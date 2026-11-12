import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('banco recusa dados inválidos mesmo sem as máscaras e preserva registros antigos', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create schema private; create schema auth;
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create table tb_cli(id_cliente bigint generated always as identity primary key,nome text,email text,num_tel text,cep text,auth_user_id uuid unique references auth.users);
    create table tb_veiculo(id_veiculo bigint generated always as identity primary key,placa text,marca text,modelo text,ano_do_modelo numeric,km_atual numeric,excluido_em timestamptz);
    create table avaliacoes(id bigint generated always as identity primary key,comentario text);
    create table ordens_servico(id bigint generated always as identity primary key,descricao_problema text,status text);
    insert into tb_cli(nome,email,num_tel) values('Legado','antigo','11999');
    insert into tb_veiculo(placa,ano_do_modelo,km_atual) values('antiga',1800,-10);
    insert into ordens_servico(descricao_problema,status) values(repeat('x',4100),'em_analise');
    grant usage on schema public,private to authenticated;
    grant select,insert,update on tb_cli to authenticated;
    grant usage on all sequences in schema public to authenticated;
  `);
  const folder = new URL('../supabase/migrations/', import.meta.url);
  const file = (await readdir(folder)).find(name => name.endsWith('_input_validation_and_order_values.sql'));
  await db.exec(await readFile(new URL(file, folder), 'utf8'));
  await t.test('telefone, email e CEP são normalizados, inclusive sob o papel authenticated', async () => {
    await db.exec('set role authenticated');
    try {
      const result = await db.query("insert into tb_cli(nome,email,num_tel,cep) values('  João   D’Ávila ',' TESTE@EXAMPLE.COM ','+55 (11) 91234-5678','01234-567') returning nome,email,num_tel,cep");
      assert.deepEqual(result.rows[0], { nome: 'João D’Ávila', email: 'teste@example.com', num_tel: '11912345678', cep: '01234567' });
      for (const phone of ['123', '20912345678', '119123456789', '11abc912345678', '11812345678']) {
        await assert.rejects(db.query("insert into tb_cli(nome,num_tel) values('Cliente',$1)", [phone]), /Telefone/);
      }
      await assert.rejects(db.query("insert into tb_cli(nome,email) values('Cliente','a@b')"), /e-mail/);
      await assert.rejects(db.query("insert into tb_cli(nome,cep) values('Cliente','0123456')"), /CEP/);
      await assert.rejects(db.query("insert into tb_cli(nome) values(' ' )"), /Nome/);
    } finally { await db.exec('reset role'); }
  });
  await t.test('placa, ano e km são conferidos também em gravações diretas', async () => {
    const valid = await db.query("insert into tb_veiculo(placa,ano_do_modelo,km_atual) values('abc-1234',2020,0) returning placa");
    assert.equal(valid.rows[0].placa, 'ABC1234');
    for (const [year, km] of [[1899,0],[3000,0],[2020.5,0],[2020,-1],[2020,1.5],[2020,1e9],[2020,'NaN']]) {
      await assert.rejects(db.query("insert into tb_veiculo(placa,ano_do_modelo,km_atual) values('DEF4G56',$1,$2)", [year,km]), /ano|quilometragem/);
    }
    await assert.rejects(db.query("insert into tb_veiculo(placa) values('ABC!1234')"), /placa/);
  });
  await t.test('limites de texto e dinheiro não aceitam excesso nem valores especiais', async () => {
    await assert.rejects(db.query("insert into avaliacoes(comentario) values(repeat('x',2001))"), /Comentário/);
    await assert.rejects(db.query("insert into ordens_servico(descricao_problema) values(repeat('x',4001))"), /problema/);
    for (const value of [-1, 100000, 1.234, 'NaN', 'Infinity']) {
      await assert.rejects(db.query('insert into ordens_servico(valor_mao_obra) values($1)', [value]), /autoflow_labor_value_check/);
    }
    await db.query("insert into ordens_servico(pecas_servicos,valor_mao_obra,valor_pecas) values(' Troca de óleo ',120.50,0)");
    await assert.rejects(db.query('select public.create_workshop_order_validated(\'ABC1234\',\'Uno\',\'Cliente\',\'Revisão\',\'aguardando\',null,null,0,0)'), /Autenticação/);
  });
  await t.test('atualizações sem alteração no dado legado continuam disponíveis', async () => {
    await db.query("update tb_cli set nome='Nome corrigido',num_tel=num_tel where id_cliente=1");
    await db.query("update tb_veiculo set excluido_em=now() where id_veiculo=1");
    await db.query("update ordens_servico set status='pronto' where id=1");
    assert.equal((await db.query('select num_tel from tb_cli where id_cliente=1')).rows[0].num_tel, '11999');
    await assert.rejects(db.query("update tb_cli set num_tel='11998' where id_cliente=1"), /Telefone/);
  });
  await t.test('Auth cria apenas um cliente e a troca de email não desfaz edições no perfil', async () => {
    const uid='00000000-0000-0000-0000-000000000001';
    const before=(await db.query('select count(*)::int as total from tb_cli')).rows[0].total;
    await db.query("insert into auth.users values($1,'a@example.com',$2)",[uid,{nome:'Nome original',telefone:'(11) 91234-5678'}]);
    assert.equal((await db.query('select count(*)::int as total from tb_cli')).rows[0].total,before+1);
    await db.query("update tb_cli set nome='Nome editado',num_tel='1134567890' where auth_user_id=$1",[uid]);
    await db.query("update auth.users set email='novo@example.com' where id=$1",[uid]);
    assert.deepEqual((await db.query('select nome,email,num_tel from tb_cli where auth_user_id=$1',[uid])).rows[0],
      {nome:'Nome editado',email:'novo@example.com',num_tel:'1134567890'});
    await db.query("update auth.users set raw_user_meta_data=raw_user_meta_data || '{\"avatar_url\":\"new\"}' where id=$1",[uid]);
    assert.equal((await db.query('select nome from tb_cli where auth_user_id=$1',[uid])).rows[0].nome,'Nome editado');
    await assert.rejects(db.query("update auth.users set raw_user_meta_data=raw_user_meta_data || '{\"telefone\":\"123\"}' where id=$1",[uid]),/Telefone/);
    // Cadastro da oficina não solicita nome e deve aceitar um e-mail curto.
    await db.query("insert into auth.users values('00000000-0000-0000-0000-000000000002','b@example.com','{}')");
  });
});
