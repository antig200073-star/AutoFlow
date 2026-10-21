// Mesmas tabelas e regras do web; o cliente é injetado para permitir testes sem dados reais.
export const maintenanceStatuses = ['Recebido', 'Diagnóstico', 'Aguardando Peça', 'Em Reparo', 'Pronto para Retirada'];
export const statusLabels = {
  recebido: 'Recebido', em_analise: 'Diagnóstico', aguardando: 'Aguardando Peça',
  em_manutencao: 'Em Reparo', pronto: 'Pronto para Retirada', entregue: 'Entregue',
};
export const statusLabel = status => statusLabels[status] || 'Status não informado';
export function displayDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
    : 'Não informada';
}

export function friendlyError(error, fallback = 'Não foi possível concluir a operação.') {
  const message = String(error?.message || error || '');
  if (/Invalid login credentials/i.test(message)) return 'E-mail ou senha inválidos.';
  if (/User already registered/i.test(message)) return 'Este e-mail já está cadastrado.';
  if (/Password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/Email not confirmed/i.test(message)) return 'Confirme seu e-mail antes de entrar.';
  if (/duplicate key/i.test(message)) return 'Já existe um registro com esses dados.';
  if (/row-level security|permission denied/i.test(message)) return 'Seu usuário não tem permissão para esta operação.';
  if (/fetch|network/i.test(message)) return 'Falha de conexão. Tente novamente.';
  return message || fallback;
}

export function createClientService(db) {
  async function currentUser() {
    const { data, error } = await db.auth.getUser();
    if (error) throw error;
    if (!data.user) throw Error('Entre na sua conta para continuar.');
    return data.user;
  }
  async function currentClient() {
    const user = await currentUser();
    const { data, error } = await db.from('tb_cli')
      .select('id_cliente,auth_user_id,nome,email,num_tel,cep').eq('auth_user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) throw Error('Perfil do cliente não encontrado. Conclua seu cadastro.');
    return { ...data, email: user.email || data.email };
  }
  async function loadDashboard() {
    const client = await currentClient();
    const [vehicles, orders] = await Promise.all([
      db.from('tb_veiculo').select('id_veiculo', { count: 'exact', head: true })
        .eq('cliente_id', client.id_cliente).is('excluido_em', null),
      db.from('ordens_servico').select('id,status,data_entrada,veiculo_id,tb_veiculo(marca,modelo,placa)')
        .eq('cliente_id', client.id_cliente).order('data_entrada', { ascending: false }),
    ]);
    if (vehicles.error) throw vehicles.error;
    if (orders.error) throw orders.error;
    const all = orders.data || [];
    const active = all.filter(order => order.status !== 'entregue');
    return {
      dashboard: { totalVehicles: vehicles.count || 0, totalServices: active.length,
        totalFinished: all.filter(order => order.status === 'entregue').length },
      maintenances: active.map(order => ({
        id: order.id, vehicleId: order.veiculo_id,
        vehicleName: [order.tb_veiculo?.marca, order.tb_veiculo?.modelo].filter(Boolean).join(' ') || 'Veículo',
        plate: order.tb_veiculo?.placa || '', status: statusLabel(order.status),
      })),
    };
  }
  async function loadWorkshopReviews(workshopId) {
    const id = Number(workshopId);
    if (!Number.isSafeInteger(id) || id <= 0) throw Error('Oficina inválida.');
    // RPC existente no web: disponibiliza comentários sem expor dados pessoais dos clientes.
    const { data, error } = await db.rpc('workshop_public_reviews', { p_workshop_id: id });
    if (error) throw error;
    const reviews = (data || []).map(item => ({ id: item.id, nota: Number(item.nota),
      comentario: item.comentario || '', data: item.created_at }));
    return { reviews, total: reviews.length,
      average: reviews.length ? (reviews.reduce((sum, item) => sum + item.nota, 0) / reviews.length).toFixed(1) : null };
  }
  async function loadWorkshops() {
    const { data, error } = await db.from('oficinas')
      .select('id,nome,telefone,cep,logradouro,numero,bairro,cidade,estado')
      .eq('status', 'aprovada').order('nome');
    if (error) throw error;
    const result = [];
    // Limita consultas simultâneas; uma falha nas notas não oculta as oficinas.
    for (let offset = 0; offset < (data || []).length; offset += 4) {
      result.push(...await Promise.all(data.slice(offset, offset + 4).map(async row => {
        let ratings = null;
        try { ratings = await loadWorkshopReviews(row.id); } catch { /* Exibe opção de tentar novamente nos detalhes. */ }
        return { id: row.id, nome: row.nome, telefone: row.telefone,
          endereco: [row.logradouro, row.numero, row.bairro, row.cidade, row.estado].filter(Boolean).join(', '),
          cidade: row.cidade, ratings };
      })));
    }
    return result;
  }
  async function loadEvaluationData() {
    const client = await currentClient();
    const { data: orders, error } = await db.from('ordens_servico')
      .select('id,status,oficina_id,veiculo_id,oficinas!ordens_servico_oficina_id_fkey(nome),tb_veiculo(marca,modelo,placa)')
      .eq('cliente_id', client.id_cliente).order('data_entrada', { ascending: false });
    if (error) throw error;
    if (!orders?.length) return { orders: [], evaluations: [] };
    const { data, error: evaluationError } = await db.from('avaliacoes')
      .select('id,os_id,nota,comentario,created_at').in('os_id', orders.map(order => order.id))
      .order('created_at', { ascending: false });
    if (evaluationError) throw evaluationError;
    const evaluated = new Set((data || []).map(item => String(item.os_id)));
    const orderMap = new Map(orders.map(order => [String(order.id), order]));
    return {
      orders: orders.filter(order => order.status === 'entregue' && !evaluated.has(String(order.id)))
        .map(order => ({ id: order.id,
          descricao: `${order.oficinas?.nome || 'Oficina'} — ${[order.tb_veiculo?.marca, order.tb_veiculo?.modelo, order.tb_veiculo?.placa].filter(Boolean).join(' ') || 'Veículo'} (O.S. nº ${order.id})` })),
      evaluations: (data || []).map(item => ({ id: item.id, osId: item.os_id,
        oficina: orderMap.get(String(item.os_id))?.oficinas?.nome || 'Oficina',
        nota: Number(item.nota), comentario: item.comentario || '', data: item.created_at })),
    };
  }
  async function createEvaluation({ osId, nota, comentario }) {
    const id = Number(osId), rating = Number(nota);
    if (!Number.isSafeInteger(id) || id <= 0) throw Error('Selecione uma ordem de serviço válida.');
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw Error('Selecione uma nota de 1 a 5.');
    const client = await currentClient();
    const { data: order, error: orderError } = await db.from('ordens_servico')
      .select('id,status,oficinas!ordens_servico_oficina_id_fkey(nome)')
      .eq('id', id).eq('cliente_id', client.id_cliente).maybeSingle();
    if (orderError) throw orderError;
    if (!order) throw Error('Essa ordem de serviço não pertence ao usuário atual.');
    if (order.status !== 'entregue') throw Error('A avaliação só pode ser enviada após a retirada do veículo.');
    const existing = await db.from('avaliacoes').select('id').eq('os_id', id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) throw Error('Essa ordem de serviço já foi avaliada.');
    const { data, error } = await db.from('avaliacoes')
      .insert({ os_id: id, nota: rating, comentario: String(comentario || '').trim() || null })
      .select('id,os_id,nota,comentario,created_at').single();
    if (error) throw error;
    return { id: data.id, osId: data.os_id, oficina: order.oficinas?.nome || 'Oficina',
      nota: Number(data.nota), comentario: data.comentario || '', data: data.created_at };
  }
  async function loadProfile() {
    const client = await currentClient();
    return { nome: client.nome || '', email: client.email || '', telefone: client.num_tel || '' };
  }
  async function updateProfile(profile) {
    const user = await currentUser();
    const nome = String(profile.nome || '').trim();
    const email = String(profile.email || '').trim().toLowerCase();
    const telefone = String(profile.telefone || '').trim();
    if (!nome || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Informe nome e e-mail válidos.');
    const { data, error } = await db.from('tb_cli')
      .update({ nome, email: user.email, num_tel: telefone || null }).eq('auth_user_id', user.id)
      .select('nome,email,num_tel').single();
    if (error) throw error;
    const saved = { nome: data.nome, email: user.email || data.email, telefone: data.num_tel || '' };
    const changedEmail = email !== (user.email || '').toLowerCase();
    if (changedEmail) {
      const { error: authError } = await db.auth.updateUser({ email });
      if (authError) return { profile: saved, warning: true,
        message: `Nome e telefone salvos. Não foi possível solicitar a troca do e-mail: ${friendlyError(authError)}` };
    }
    return { profile: saved, warning: false, message: changedEmail
      ? 'Nome e telefone salvos. Confirme a alteração do e-mail pelo link recebido antes de usar o novo endereço.'
      : 'Perfil atualizado com sucesso!' };
  }
  return { currentClient, loadDashboard, loadWorkshops, loadWorkshopReviews, loadEvaluationData,
    createEvaluation, loadProfile, updateProfile };
}
