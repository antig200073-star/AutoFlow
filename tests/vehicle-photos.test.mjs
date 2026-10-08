import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validateVehicle, createVehicleService } from '../web/public/assets/js/vehicle-service.js';

test('campos e foto obrigatórios antes de acessar o servidor', async () => {
  const input={placa:'abc-1234',marca:'Fiat',modelo:'Uno',ano:2020,km_atual:0};
  assert.equal(validateVehicle(input).placa,'ABC1234');
  assert.throws(()=>validateVehicle({...input,km_atual:''}),/quilometragem/);
  assert.throws(()=>validateVehicle({...input,ano:3000}),/ano/);
  await assert.rejects(createVehicleService({}).create(input,null),/foto/);
});

test('foto privada, cadastro autenticado e repetição idempotente no PostgreSQL', async t => {
  const db=new PGlite(); t.after(()=>db.close());
  const uid='00000000-0000-0000-0000-000000000001';
  const other='00000000-0000-0000-0000-000000000002';
  const photo=`${uid}/11111111-1111-1111-1111-111111111111.jpg`;
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema private; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,private,storage,public to anon,authenticated;
    create table tb_cli(id_cliente bigint primary key,auth_user_id uuid unique);
    insert into tb_cli values(1,'${uid}'),(2,'${other}');
    create table tb_veiculo(id_veiculo bigint generated always as identity primary key,placa text,marca text,modelo text,ano_do_modelo numeric,km_atual numeric,cliente_id bigint references tb_cli);
    insert into tb_veiculo(placa,cliente_id) values('OLD1234',1);
    alter table tb_veiculo enable row level security;
    create policy own_vehicle on tb_veiculo for all to authenticated using(cliente_id=(select id_cliente from tb_cli where auth_user_id=auth.uid()));
    grant select on tb_cli to authenticated;
    grant select,insert on tb_veiculo to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
    create policy broad_existing_policy on storage.objects for all to authenticated,anon using(true) with check(true);
  `);
  const sql=await readFile(new URL('../supabase/migrations/20261008173002_vehicle_photos.sql',import.meta.url),'utf8');
  await db.exec(sql); await db.exec(sql);
  assert.equal((await db.query('select foto_path from tb_veiculo')).rows[0].foto_path,null);
  async function asUser(id,fn,role='authenticated') {
    await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${id}',false)`);
    try {return await fn();}finally{await db.exec('reset role');}
  }
  const register=()=>db.query("select register_vehicle_with_photo('abc1234','Fiat','Uno',2020,500,$1) as v",[photo]);
  await asUser(uid,async()=>{
    await assert.rejects(register(),/foto/);
    await assert.rejects(db.query("insert into tb_veiculo(placa,cliente_id) values('ABC1234',1)"),/permission denied/);
    await db.query("insert into storage.objects values('vehicle-photos',$1)",[photo]);
    const first=(await register()).rows[0].v;
    assert.equal(first.cliente_id,1); assert.equal(first.placa,'ABC1234');
    assert.equal((await register()).rows[0].v.id_veiculo,first.id_veiculo);
    assert.equal((await db.query('delete from storage.objects returning name')).rows.length,0);
    assert.equal((await db.query("update storage.objects set name='changed' returning name")).rows.length,0);
  });
  await asUser(other,async()=>{
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await assert.rejects(register(),/Confira/);
    await assert.rejects(db.query("insert into storage.objects values('vehicle-photos',$1)",[photo.replace('11111111.jpg','22222222.jpg')]),/row-level security/);
  });
  await asUser('',async()=>{
    assert.equal((await db.query('select * from storage.objects')).rows.length,0);
    await assert.rejects(register(),/permission denied/);
  },'anon');
});
