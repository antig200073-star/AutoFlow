(() => {
  'use strict';
  const db = window.AutoFlowSupabase;
  const id = Number(new URLSearchParams(location.search).get('os'));
  const list = document.getElementById('chat-list');
  const form = document.getElementById('chat-form');
  const field = document.getElementById('chat-text');
  const errorBox = document.getElementById('chat-error');
  const send = document.getElementById('chat-send');
  let conversationId = null, userId = null, channel = null;
  const fail = error => { errorBox.textContent = error?.message || String(error); };
  const load = async () => {
    if (!conversationId) return;
    const {data, error} = await db.from('chat_mensagens').select('id,remetente_id,conteudo,criada_em')
      .eq('conversa_id', conversationId).order('criada_em').limit(200);
    if (error) return fail(error);
    list.replaceChildren();
    if (!data.length) list.textContent = 'Nenhuma mensagem ainda.';
    for (const m of data) {
      const article = document.createElement('article');
      if (m.remetente_id === userId) article.className = 'mine';
      const body = document.createElement('p'); body.textContent = m.conteudo;
      const time = document.createElement('small'); time.textContent = new Date(m.criada_em).toLocaleString('pt-BR');
      article.append(body,time); list.append(article);
    }
    list.scrollTop = list.scrollHeight;
  };
  async function start() {
    if (!Number.isSafeInteger(id) || id <= 0) return fail('Ordem de serviço inválida.');
    document.getElementById('chat-order').textContent = 'O.S. nº ' + id;
    const {data:auth,error:authError} = await db.auth.getUser();
    if (authError || !auth.user) return fail(authError || 'Entre na conta para abrir o chat.');
    userId = auth.user.id;
    let {data:conversation,error} = await db.from('chat_conversas').select('id')
      .eq('ordem_servico_id',id).maybeSingle();
    if (error) return fail(error);
    if (!conversation) {
      const created = await db.from('chat_conversas').insert({ordem_servico_id:id}).select('id').single();
      if (created.error?.code === '23505') {
        const retry = await db.from('chat_conversas').select('id').eq('ordem_servico_id',id).single();
        if (retry.error) return fail(retry.error);
        conversation = retry.data;
      } else if (created.error) return fail(created.error);
      else conversation = created.data;
    }
    conversationId = conversation.id;
    await load();
    channel = db.channel('chat-web-'+conversationId).on('postgres_changes',{
      event:'INSERT',schema:'public',table:'chat_mensagens',filter:'conversa_id=eq.'+conversationId
    },load).subscribe();
    setInterval(() => {if (!document.hidden) load();},10000);
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if (!conversationId || !userId || !field.value.trim()) return;
    send.disabled = true; errorBox.textContent = '';
    const {error} = await db.from('chat_mensagens').insert({
      conversa_id:conversationId,remetente_id:userId,conteudo:field.value.trim()
    });
    if(error) fail(error); else {field.value='';await load();}
    send.disabled = false;
  });
  window.addEventListener('pagehide',()=>{if(channel) db.removeChannel(channel);});
  start().catch(fail);
})();