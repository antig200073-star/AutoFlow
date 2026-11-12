import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, formatPhone, normalizePlate, formatPlate, normalizeEmail, parseYear, parseKilometers, formatKilometers, validateProfile, validateRegistration, textValue } from '../web/public/assets/js/input-rules.js';
import { maskedSelection, maskKeyDown } from '../web/public/assets/js/input-masks.js';

test('telefone aceita fixo, celular e colagem com +55 sem perder o DDD 55', () => {
  for (const value of ['11912345678', '(11) 91234-5678', '+55 (11) 91234-5678', '5511912345678']) {
    assert.equal(normalizePhone(value), '11912345678');
    assert.equal(formatPhone(value), '(11) 91234-5678');
  }
  assert.equal(formatPhone('1134567890'), '(11) 3456-7890');
  assert.equal(normalizePhone('(55) 99123-4567'), '55991234567');
  assert.equal(normalizePhone(''), '');
  for (const value of ['11999', '00123456789', '20912345678', '11812345678', '112345678901', '11abc912345678', '+1 11912345678']) {
    assert.throws(() => normalizePhone(value), /telefone/);
  }
  assert.equal(formatPhone('119123456789'), '119123456789');
  assert.equal(formatPhone('abc11912345678'), 'abc11912345678');
});

test('edição mantém seleção no meio do telefone e permite apagar ao lado do separador', () => {
  assert.deepEqual(maskedSelection('11912345678', 5, 7, formatPhone), { value: '(11) 91234-5678', start: 8, end: 10 });
  const input = { value: '(11) 91234-5678', selectionStart: 11, selectionEnd: 11,
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; } };
  let changed, prevented = false;
  maskKeyDown({ currentTarget: input, key: 'Backspace', preventDefault() { prevented = true; } }, formatPhone, value => { changed = value; });
  assert.equal(prevented, true);
  assert.equal(changed.replace(/\D/g, ''), '1191235678');
});

test('placa antiga e Mercosul; não remove caracteres inválidos para aceitar outro dado', () => {
  assert.equal(formatPlate('abc1234'), 'ABC-1234');
  assert.equal(normalizePlate('abc-1234'), 'ABC1234');
  assert.equal(formatPlate('abc1d23'), 'ABC1D23');
  for (const value of ['AB12345', 'ABC1D234', 'ABC!1234', 'ÁBC1234']) assert.throws(() => normalizePlate(value), /placa/);
});

test('quilometragem inteira e ano: rejeita fração, notação científica, sinais e agrupamentos ambíguos', () => {
  for (const value of ['45000', '45.000', 45000]) assert.equal(parseKilometers(value), 45000);
  assert.equal(formatKilometers('45000'), '45.000');
  assert.equal(parseKilometers(0), 0);
  assert.equal(parseKilometers('999.999.999'), 999999999);
  for (const value of ['', null, false, '1e3', '1,5', '1.5', '-10', '+10', '12.34.567', '1.000.000.000']) assert.throws(() => parseKilometers(value), /quilometragem/);
  assert.equal(parseYear('2027', 2026), 2027);
  for (const value of ['2e3', '2020.0', '', '2028', '1899']) assert.throws(() => parseYear(value, 2026), /ano/);
});

test('textos preservam acentos e senhas; validação acontece no valor normalizado', () => {
  assert.deepEqual(validateProfile({ nome: "  João   D'Ávila  ", email: ' TESTE@Example.COM ', telefone: '(11) 3456-7890' }),
    { nome: "João D'Ávila", email: 'teste@example.com', telefone: '1134567890' });
  assert.equal(validateRegistration({ nome: 'João', email: 'a@b.com', senha: ' secret ' }).senha, ' secret ');
  for (const email of ['ab', 'a b@c.com', 'a@b', 'a'.repeat(250) + '@b.com']) assert.throws(() => normalizeEmail(email), /e-mail/);
  assert.throws(() => validateProfile({ nome: '  ', email: 'a@b.com' }), /Nome/);
  assert.throws(() => validateRegistration({ nome: 'João', email: 'a@b.com', senha: '12345' }), /senha/);
  assert.throws(() => textValue('x'.repeat(2001), 'Comentário', 2000, 0, true), /Comentário/);
  assert.equal(textValue('  A\nB  ', 'Comentário', 2000, 0, true), 'A\nB');
});
