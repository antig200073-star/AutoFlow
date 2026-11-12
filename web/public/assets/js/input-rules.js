// Regras compartilhadas pelo site e pelo aplicativo. Máscaras nunca truncam
// uma entrada inválida para transformá-la silenciosamente em outro dado.
const DDDS = new Set('11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' '));

export function textValue(value, label, max, min = 0, multiline = false) {
  const text = String(value ?? '').trim();
  const normalized = multiline ? text : text.replace(/\s+/g, ' ');
  if (normalized.length < min || normalized.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(normalized)) {
    throw Error(`${label}: use de ${min} a ${max} caracteres.`);
  }
  return normalized;
}

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase();
  if (email.length > 254 || /[\u0000-\u001f\u007f]/.test(email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Informe um e-mail válido, como nome@exemplo.com.');
  return email;
}

function phoneDigits(value) {
  const text = String(value ?? '').trim();
  if (!/^[+0-9().\s-]*$/.test(text)) return null;
  let digits = text.replace(/[().\s-]/g, '');
  if (digits.startsWith('+55')) digits = digits.slice(3);
  else if (/^55[0-9]{10,11}$/.test(digits)) digits = digits.slice(2);
  return /^[0-9]*$/.test(digits) ? digits : null;
}

export function normalizePhone(value) {
  if (!String(value ?? '').trim()) return '';
  const digits = phoneDigits(value);
  if (!digits || !DDDS.has(digits.slice(0, 2)) || !/^[0-9]{2}(?:[2-57][0-9]{7}|9[0-9]{8})$/.test(digits)) {
    throw Error('Informe o telefone com DDD: (11) 91234-5678 ou (11) 3456-7890.');
  }
  return digits;
}

export function formatPhone(value) {
  const digits = phoneDigits(value);
  if (digits === null || digits.length > 11) return String(value ?? '');
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  const local = digits.slice(2), split = digits.length > 10 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${local.slice(0, split)}${local.length > split ? '-' + local.slice(split) : ''}`;
}

export function normalizePlate(value) {
  const source = String(value ?? '').trim();
  if (!/^[A-Za-z0-9 -]*$/.test(source)) throw Error('Informe uma placa válida, como ABC1D23 ou ABC-1234.');
  const plate = source.toUpperCase().replace(/[ -]/g, '');
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) throw Error('Informe uma placa válida, como ABC1D23 ou ABC-1234.');
  return plate;
}

export function formatPlate(value) {
  if (!/^[A-Za-z0-9 -]*$/.test(String(value ?? ''))) return String(value ?? '');
  const upper = String(value ?? '').toUpperCase();
  const plain = upper.replace(/[ -]/g, '');
  return /^[A-Z]{3}[0-9]{4}$/.test(plain) ? `${plain.slice(0, 3)}-${plain.slice(3)}` : upper;
}

export function parseYear(value, currentYear = new Date().getFullYear()) {
  const text = String(value ?? '').trim();
  const year = Number(text);
  if (!/^[0-9]{4}$/.test(text) || year < 1900 || year > currentYear + 1) throw Error(`Informe um ano entre 1900 e ${currentYear + 1}.`);
  return year;
}

export function parseKilometers(value) {
  const text = String(value ?? '').trim();
  if (!/^(?:[0-9]{1,9}|[0-9]{1,3}(?:\.[0-9]{3}){1,2})$/.test(text)) {
    throw Error('Informe a quilometragem inteira, de 0 a 999.999.999 km (ex.: 45.000).');
  }
  return Number(text.replace(/\./g, ''));
}

export function formatKilometers(value) {
  const text = String(value ?? '');
  if (!text) return '';
  try { return parseKilometers(text).toLocaleString('pt-BR'); } catch { return text; }
}

export function validateProfile(profile) {
  return {
    nome: textValue(profile.nome, 'Nome', 150, 2),
    email: normalizeEmail(profile.email),
    telefone: normalizePhone(profile.telefone),
  };
}

export function validateRegistration(profile) {
  const normalized = validateProfile(profile);
  if (typeof profile.senha !== 'string' || profile.senha.length < 6) throw Error('Use uma senha com pelo menos 6 caracteres.');
  return { ...normalized, senha: profile.senha };
}
