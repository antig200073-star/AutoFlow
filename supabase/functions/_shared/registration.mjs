import { lookupCompany, RegistrationError } from './cnpj.mjs';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
export function createHandler({ createClient, getEnv, lookup = lookupCompany }) {
function envKey(modern, legacy) {
  const value = getEnv(modern);
  return (value ? JSON.parse(value).default : undefined) || getEnv(legacy) || '';
}

return async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  try {
    const token = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) return json({ error: 'Entre na sua conta para continuar.' }, 401);
    const url = getEnv('SUPABASE_URL');
    const userClient = createClient(url, envKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // verify_jwt=false não dispensa autenticação: valida o JWT no Auth em toda chamada.
    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);
    if (!user.email_confirmed_at || !user.email) return json({ error: 'Confirme seu e-mail antes de cadastrar a oficina.' }, 403);
    const raw = await request.text();
    if (raw.length > 4096) return json({ error: 'Solicitação muito grande.' }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: 'JSON inválido.' }, 400); }
    if (!input || typeof input !== 'object') return json({ error: 'Solicitação inválida.' }, 400);
    const admin = createClient(url, envKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    if (input.action === 'refresh') {
      const { data: role, error: roleError } = await userClient.from('autoflow_admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (roleError || !role) return json({ error: 'Acesso restrito à administração.' }, 403);
      const quota = await admin.rpc('consume_workshop_lookup', { p_user: user.id });
      if (quota.error) throw new Error('Falha ao verificar limite');
      if (!quota.data) return json({ error: 'Limite de consultas atingido. Tente novamente em uma hora.' }, 429);
      const { data: workshop, error } = await admin.from('oficinas').select('id, cnpj, revisao').eq('id', input.oficina_id).single();
      if (error || !workshop) return json({ error: 'Oficina não encontrada.' }, 404);
      const company = await lookup(workshop.cnpj);
      const { error: saveError } = await admin.rpc('refresh_workshop_verification', {
        p_id: workshop.id, p_actor: user.id, p_revision: workshop.revisao, p_company: company,
      });
      if (saveError) return json({ error: 'A oficina foi alterada. Atualize a lista e tente novamente.' }, 409);
      return json({ success: true });
    }
    if (input.action && input.action !== 'register') return json({ error: 'Ação inválida.' }, 400);
    const { data: existing, error: existingError } = await admin.from('oficinas').select('id').eq('user_id', user.id).maybeSingle();
    if (existingError) throw new Error('Falha ao verificar cadastro');
    if (existing) return json({ error: 'Sua conta já possui uma oficina. Consulte o status no painel.' }, 409);
    const quota = await admin.rpc('consume_workshop_lookup', { p_user: user.id });
    if (quota.error) throw new Error('Falha ao verificar limite');
    if (!quota.data) return json({ error: 'Limite de consultas atingido. Tente novamente em uma hora.' }, 429);
    const company = await lookup(input.cnpj);
    if (company.situacao_cadastral !== 2) throw new RegistrationError('O CNPJ precisa estar ATIVO na Receita Federal para solicitar cadastro.');
    const { data, error } = await admin.from('oficinas').insert({
      ...company, user_id: user.id, email: user.email,
      status: 'pendente', verificado_em: new Date().toISOString(),
      verificacao_fonte: 'BrasilAPI',
    }).select('id, status').single();
    if (error?.code === '23505') return json({ error: 'CNPJ ou conta já cadastrados. Solicite revisão à administração; não é permitido assumir um cadastro existente.' }, 409);
    if (error) throw new Error('Falha ao gravar cadastro');
    return json({ success: true, oficina: data, message: 'Cadastro aguardando verificação administrativa.' }, 201);
  } catch (error) {
    if (error instanceof RegistrationError) return json({ error: error.message }, error.status);
    // Não retorna detalhes de infraestrutura, JWT, chave secreta ou dados do provedor.
    return json({ error: 'Não foi possível concluir a solicitação. Tente novamente mais tarde.' }, 500);
  }
}

}
