import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validCnpj, normalizeCnpj, companyFromProvider, lookupCompany } from '../supabase/functions/_shared/cnpj.mjs';

test('CNPJ numérico e exemplo alfanumérico oficial da Receita', () => {
  assert.equal(validCnpj('11.222.333/0001-81'), true);
  assert.equal(validCnpj('12.ABC.345/01DE-35'), true);
  assert.equal(normalizeCnpj('12.abc.345/01de-35'), '12ABC34501DE35');
  for (const input of ['', null, '00000000000000', '11.222.333/0001-82', '12ABC34501DE34', '12@ABC34501DE35']) assert.equal(validCnpj(input), false);
});

test('falha de provedor, timeout e resposta divergente não viram empresa válida', async () => {
  await assert.rejects(lookupCompany('11222333000182', () => { throw new Error('não deve consultar'); }), /inválido/);
  await assert.rejects(lookupCompany('11222333000181', async () => { throw new Error('timeout'); }), /indisponível/);
  await assert.rejects(lookupCompany('11222333000181', async () => new Response('',{status:429})), /provedor/);
  await assert.rejects(lookupCompany('11222333000181', async () => new Response('not json')), /inválida/);
  assert.throws(() => companyFromProvider({cnpj:'99999999999999',razao_social:'Teste',situacao_cadastral:2},'11222333000181'), /incompletos/);
});

test('consulta retém dados empresariais, situação real e não retém QSA', async () => {
  const company = await lookupCompany('11222333000181', async url => {
    assert.equal(url, 'https://brasilapi.com.br/api/cnpj/v1/11222333000181');
    return Response.json({cnpj:'11222333000181',razao_social:'Oficina Teste',situacao_cadastral:8,
      cnae_fiscal:4520001,qsa:[{nome_socio:'Não persistir'}],email:'nao-usar@empresa.test',uf:'SP'});
  });
  assert.equal(company.situacao_cadastral,8);
  assert.equal(company.estado,'SP');
  assert.equal(company.qsa,undefined);
  assert.equal(company.email,undefined);
});
