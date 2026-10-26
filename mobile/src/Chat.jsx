import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './chat.css';

export default function Chat({ orderId, onClose }) {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userId, setUserId] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    let channel;
    const start = async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (authError || !auth.user) throw authError || Error('Entre na sua conta.');
        if (!active) return;
        setUserId(auth.user.id);
        let { data: existing, error: readError } = await supabase.from('chat_conversas')
          .select('id').eq('ordem_servico_id', orderId).maybeSingle();
        if (readError) throw readError;
        if (!existing) {
          const created = await supabase.from('chat_conversas')
            .insert({ ordem_servico_id: orderId }).select('id').single();
          if (created.error?.code === '23505') {
            const retry = await supabase.from('chat_conversas').select('id')
              .eq('ordem_servico_id', orderId).single();
            if (retry.error) throw retry.error;
            existing = retry.data;
          } else if (created.error) throw created.error;
          else existing = created.data;
        }
        if (!active) return;
        setConversation(existing.id);
        const refresh = async () => {
          const { data, error: loadError } = await supabase.from('chat_mensagens')
            .select('id, remetente_id, conteudo, criada_em')
            .eq('conversa_id', existing.id).order('criada_em', { ascending: true }).limit(200);
          if (active && !loadError) setMessages(data || []);
        };
        await refresh();
        channel = supabase.channel('chat-os-' + existing.id)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensagens',
            filter: 'conversa_id=eq.' + existing.id }, refresh).subscribe();
        const timer = setInterval(refresh, 10000);
        // A limpeza fica atrelada ao encerramento do componente.
        stop = () => { clearInterval(timer); supabase.removeChannel(channel); };
      } catch (cause) { if (active) setError(cause.message || 'Não foi possível abrir o chat.'); }
    };
    let stop = () => {};
    start();
    return () => { active = false; stop(); };
  }, [orderId]);

  const send = async event => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !conversation || !userId || sending) return;
    setSending(true); setError('');
    const { error: sendError } = await supabase.from('chat_mensagens')
      .insert({ conversa_id: conversation, remetente_id: userId, conteudo: content });
    if (sendError) setError(sendError.message);
    else {
      setDraft('');
      const { data } = await supabase.from('chat_mensagens').select('id,remetente_id,conteudo,criada_em')
        .eq('conversa_id', conversation).order('criada_em').limit(200);
      if (data) setMessages(data);
    }
    setSending(false);
  };
  return <section className="af-chat" aria-label={'Chat da ordem de serviço ' + orderId}>
    <header className="af-chat-header"><h2>Conversa — O.S. nº {orderId}</h2>
      <button type="button" onClick={onClose}>Fechar</button></header>
    {error && <p role="alert" className="message-error">{error}</p>}
    <div className="af-chat-messages" role="log" aria-live="polite">
      {!messages.length && <p>Sem mensagens. Inicie a conversa com a oficina.</p>}
      {messages.map(m => <article key={m.id} className={m.remetente_id === userId ? 'af-chat-self' : 'af-chat-other'}>
        <p>{m.conteudo}</p><small>{new Date(m.criada_em).toLocaleString('pt-BR')}</small>
      </article>)}
    </div>
    <form onSubmit={send} className="af-chat-form">
      <label htmlFor="chat-message">Mensagem</label>
      <textarea id="chat-message" value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)}
        placeholder="Escreva para a oficina..." rows={2} required />
      <button disabled={sending || !conversation || !draft.trim()} type="submit">Enviar</button>
    </form>
  </section>;
}
