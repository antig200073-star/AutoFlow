// Algoritmo da Receita Federal: 12 caracteres alfanuméricos + 2 dígitos.
export function normalizeCnpj(input) {
  if (typeof input !== 'string' || !/^[A-Za-z0-9./\s-]+$/.test(input)) return '';
  return input.replace(/[./\s-]/g, '').toUpperCase();
}

export function validCnpj(input) {
  const cnpj = normalizeCnpj(input);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false;
  const digit = (part) => {
    let sum = 0;
    for (let i = part.length - 1, weight = 2; i >= 0; i--, weight = weight === 9 ? 2 : weight + 1) {
      sum += (part.charCodeAt(i) - 48) * weight;
    }
    return sum % 11 < 2 ? '0' : String(11 - sum % 11);
  };
  const base = cnpj.slice(0, 12);
  const first = digit(base);
  return cnpj === base + first + digit(base + first);
}

export class RegistrationError extends Error {
  constructor(message, status = 422) { super(message); this.status = status; }
}

const field = (value, max = 250) => String(value ?? '').trim().slice(0, max);

// Retém somente dados empresariais; não armazena QSA nem documentos pessoais.
export function companyFromProvider(body, requestedCnpj) {
  if (!body || normalizeCnpj(String(body.cnpj ?? '')) !== requestedCnpj
      || !body.razao_social || !Number.isInteger(body.situacao_cadastral)) {
    throw new RegistrationError('A consulta retornou dados incompletos. Tente novamente mais tarde.', 503);
  }
  const cnaes = [{ codigo: body.cnae_fiscal, descricao: body.cnae_fiscal_descricao },
    ...(Array.isArray(body.cnaes_secundarios) ? body.cnaes_secundarios : [])]
    .filter(c => c && c.codigo).slice(0, 100)
    .map(c => ({ codigo: field(c.codigo, 10), descricao: field(c.descricao) }));
  return {
    cnpj: requestedCnpj,
    nome: field(body.nome_fantasia || body.razao_social),
    razao_social: field(body.razao_social),
    situacao_cadastral: body.situacao_cadastral,
    cnaes,
    telefone: field(body.ddd_telefone_1, 30),
    cep: field(body.cep, 12), logradouro: field(body.logradouro),
    numero: field(body.numero, 30), bairro: field(body.bairro),
    cidade: field(body.municipio), estado: field(body.uf, 2),
  };
}

export async function lookupCompany(input, fetcher = fetch) {
  const cnpj = normalizeCnpj(input);
  if (!validCnpj(cnpj)) throw new RegistrationError('CNPJ inválido. Confira os 14 caracteres e os dígitos verificadores.');
  let response;
  try {
    response = await fetcher(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(10000), redirect: 'error',
    });
  } catch {
    throw new RegistrationError('Consulta de CNPJ indisponível. Nenhum cadastro foi aprovado. Tente novamente.', 503);
  }
  if (response.status === 404) throw new RegistrationError('CNPJ não encontrado na consulta. Confira os dados.');
  if (!response.ok) throw new RegistrationError('O provedor não conseguiu consultar este CNPJ. Tente novamente mais tarde.', 503);
  let body;
  try { body = await response.json(); }
  catch { throw new RegistrationError('Resposta inválida do provedor de CNPJ.', 503); }
  return companyFromProvider(body, cnpj);
}
