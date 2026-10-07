/* Administração usa a mesma chave pública; a permissão é conferida no banco. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  if (!window.supabase) { $('message').textContent = 'Não foi possível carregar a conexão. Atualize a página.'; return; }
  const db = window.supabase.createClient('https://tohlfwbzmkjlivcpssbe.supabase.co', 'sb_publishable_mhjRE7bumaGkOBsmv9TpBw_TwC49j6D');
  const labels = { pendente: 'Pendente', em_verificacao: 'Em verificação', aprovada: 'Aprovada', rejeitada: 'Rejeitada', bloqueada: 'Bloqueada' };
  const transitions = { pendente: ['em_verificacao','aprovada','rejeitada','bloqueada'], em_verificacao: ['aprovada','rejeitada','bloqueada'], aprovada: ['em_verificacao','bloqueada'], rejeitada: ['em_verificacao','bloqueada'], bloqueada: ['em_verificacao'] };
  let selected = null;
  let generation = 0;
  const message = (text = '') => { $('message').textContent = text; };
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  const date = value => value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não consultado';

  function clearReview() {
    generation++;
    selected = null;
    $('workshops').replaceChildren();
    $('detail').replaceChildren(node('p', 'Selecione uma oficina para iniciar a revisão.'));
  }

  async function load() {
    message(); clearReview();
    const requestGeneration = generation;
    $('reload').disabled = true;
    let query = db.from('oficinas').select('id,nome,razao_social,cnpj,email,telefone,logradouro,numero,bairro,cidade,estado,user_id,status,cnaes,situacao_cadastral,verificado_em,revisao,created_at').order('created_at', { ascending: true }).limit(100);
    if ($('filter').value) query = query.eq('status', $('filter').value);
    const { data, error } = await query;
    $('reload').disabled = false;
    if (requestGeneration !== generation) return;
    if (error) { message('Não foi possível carregar a fila. Confira sua sessão e a instalação do banco.'); return; }
    $('count').textContent = `${data.length} cadastro(s) · até 100 por consulta`;
    if (!data.length) $('workshops').append(node('p', 'Nenhuma oficina neste status.'));
    data.forEach(workshop => {
      const button = node('button', workshop.nome, 'workshop-option');
      button.type = 'button'; button.setAttribute('aria-pressed', 'false');
      button.append(node('small', `${workshop.cnpj} • ${labels[workshop.status]}`));
      button.addEventListener('click', () => {
        for (const entry of $('workshops').children) entry.setAttribute('aria-pressed', String(entry === button));
        selected = workshop.id;
        renderDetail(workshop);
      });
      $('workshops').append(button);
    });
  }

  async function renderDetail(workshop) {
    const detail = $('detail');
    detail.replaceChildren(node('span', labels[workshop.status], 'badge'), node('h2', workshop.nome));
    const fields = node('dl');
    const values = { 'Razão social': workshop.razao_social || 'Cadastro legado — reconsulte o CNPJ', CNPJ: workshop.cnpj,
      'E-mail da conta': workshop.email, Endereço: [workshop.logradouro,workshop.numero,workshop.bairro,workshop.cidade,workshop.estado].filter(Boolean).join(', '),
      'Situação na Receita': workshop.situacao_cadastral === 2 ? 'Ativa' : `Não ativa / não verificada (${workshop.situacao_cadastral ?? '—'})`,
      'Última consulta': date(workshop.verificado_em), 'Conta vinculada': workshop.user_id ? 'Sim' : 'Não — requer vínculo administrativo de cadastro legado' };
    Object.entries(values).forEach(([key,value]) => fields.append(node('dt',key),node('dd',value || 'Não informado')));
    detail.append(fields, node('h3', 'Atividades cadastradas (CNAE)'));
    const cnaes = node('ul');
    (workshop.cnaes || []).forEach(c => cnaes.append(node('li', `${c.codigo} — ${c.descricao}`)));
    detail.append(cnaes, node('p','Confirme a atividade de oficina e o vínculo do solicitante por um canal independente. Ter acesso ao e-mail e informar um CNPJ válido não comprovam representação.','hint'));
    const refresh = node('button','Reconsultar CNPJ','secondary');
    refresh.type = 'button';
    refresh.addEventListener('click', async () => {
      if (workshop.status === 'aprovada' && !confirm('Reconsultar uma oficina aprovada suspende o acesso até uma nova revisão. Continuar?')) return;
      refresh.disabled = true; message();
      try {
        const { error } = await db.functions.invoke('register-workshop', { body: { action: 'refresh', oficina_id: workshop.id } });
        if (error) throw error;
        await load(); message('Consulta atualizada. Selecione a oficina para revisar os novos dados.');
      } catch { message('Não foi possível reconsultar o CNPJ. Confira sua sessão e tente novamente mais tarde.'); }
      finally { refresh.disabled = false; }
    });
    detail.append(refresh);
    const form = node('form');
    const decisionLabel = node('label','Decisão'); decisionLabel.htmlFor = 'decision';
    const decision = node('select'); decision.id = 'decision';
    transitions[workshop.status].forEach(status => { const option = node('option',labels[status]); option.value = status; decision.append(option); });
    const checkbox = (id,text) => {
      const label = node('label',null,'check'); const input = node('input'); input.type = 'checkbox'; input.id = id;
      label.append(input,node('span',text)); return { label,input };
    };
    const ownership = checkbox('ownership','Confirmei que o solicitante representa esta empresa, usando evidência e contato independentes.');
    const activity = checkbox('activity','Confirmei que a empresa exerce atividade compatível com oficina mecânica.');
    const reasonLabel = node('label','Justificativa e referência da verificação'); reasonLabel.htmlFor = 'reason';
    const reason = node('textarea'); reason.id = 'reason'; reason.rows = 4; reason.required = true; reason.minLength = 20; reason.maxLength = 2000;
    reason.placeholder = 'Descreva como a verificação foi realizada. Não inclua senhas, CPF ou cópias de documentos pessoais.';
    const submit = node('button','Salvar decisão'); submit.type = 'submit';
    const updateChecks = () => { ownership.input.required = activity.input.required = decision.value === 'aprovada'; };
    decision.addEventListener('change',updateChecks); updateChecks();
    form.append(decisionLabel,decision,ownership.label,activity.label,reasonLabel,reason,submit);
    form.addEventListener('submit',async event => {
      event.preventDefault(); submit.disabled = true; message();
      try {
        const { error } = await db.rpc('review_workshop', { p_id: workshop.id, p_revision: workshop.revisao,
          p_status: decision.value, p_reason: reason.value.trim(), p_ownership: ownership.input.checked, p_activity: activity.input.checked });
        if (error) throw error;
        await load(); message('Decisão registrada. A regra de acesso já foi atualizada no banco.');
      } catch (error) { message(error.message || 'Não foi possível salvar. Atualize a fila e tente novamente.'); }
      finally { submit.disabled = false; }
    });
    detail.append(form);
    const history = node('section',null,'history'); history.append(node('h3','Histórico de revisão')); detail.append(history);
    const { data, error } = await db.from('oficina_revisoes').select('status_anterior,status_novo,justificativa,created_at').eq('oficina_id',workshop.id).order('created_at',{ ascending: false }).limit(20);
    if (selected !== workshop.id) return;
    if (error) history.append(node('p','Não foi possível carregar o histórico.'));
    else if (!data.length) history.append(node('p','Nenhuma revisão registrada.'));
    else data.forEach(entry => history.append(node('p',`${date(entry.created_at)} • ${labels[entry.status_anterior]} → ${labels[entry.status_novo]}: ${entry.justificativa}`)));
  }

  async function session() {
    clearReview();
    $('review-panel').hidden = true;
    const { data: { user }, error } = await db.auth.getUser();
    $('logout').hidden = !user;
    $('login-panel').hidden = !!user;
    if (error || !user) return;
    const { data: role, error: roleError } = await db.from('autoflow_admins').select('user_id').eq('user_id',user.id).maybeSingle();
    if (roleError || !role) { message('Esta conta não tem permissão administrativa. Use Sair para trocar de conta.'); return; }
    $('review-panel').hidden = false;
    await load();
  }
  $('admin-login').addEventListener('submit', async event => {
    event.preventDefault(); message(); const button = event.target.querySelector('button'); button.disabled = true;
    try {
      const { error } = await db.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
      if (error) throw error;
      $('password').value = ''; await session();
    } catch { message('Não foi possível entrar. Confira e-mail, senha e confirmação de e-mail.'); }
    finally { button.disabled = false; }
  });
  $('logout').addEventListener('click', async () => { await db.auth.signOut(); clearReview(); $('review-panel').hidden = true; $('login-panel').hidden = false; $('logout').hidden = true; message(); });
  $('reload').addEventListener('click',load);
  $('filter').addEventListener('change',load);
  session().catch(() => message('Não foi possível conectar. Atualize a página.'));
})();
