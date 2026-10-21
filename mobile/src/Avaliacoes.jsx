import { useEffect, useRef, useState } from 'react';
import { clientService, friendlyError } from './services/api';
import { displayDate } from './services/client-service';

export default function Avaliacoes() {
  const [orders, setOrders] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    let active = true;
    clientService.loadEvaluationData().then(result => {
      if (active) { setOrders(result.orders); setEvaluations(result.evaluations); }
    }).catch(error => { if (active) setLoadError(friendlyError(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting.current) return;
    setMessage({ text: '', type: '' });
    if (!rating || !selectedOrder) {
      setMessage({ text: 'Selecione um serviço concluído e uma nota de 1 a 5 estrelas.', type: 'message-error' }); return;
    }
    submitting.current = true; setBusy(true);
    try {
      const saved = await clientService.createEvaluation({ osId: selectedOrder, nota: rating, comentario: comment });
      setEvaluations(previous => [saved, ...previous.filter(item => item.id !== saved.id)]);
      setOrders(previous => previous.filter(order => String(order.id) !== String(selectedOrder)));
      setSelectedOrder(''); setRating(0); setHoverRating(0); setComment('');
      setMessage({ text: 'Avaliação enviada com sucesso!', type: 'message-success' });
    } catch (error) { setMessage({ text: friendlyError(error), type: 'message-error' }); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <div className="dashboard-wrapper"><main>
    <header className="page-header"><div><p>Experiência</p><h1>Avaliações</h1></div></header>
    {loading && <p className="empty-state" role="status">Carregando avaliações…</p>}
    {loadError && <div className="message-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => { setLoading(true); setLoadError(''); setRetry(n => n + 1); }}>Tentar novamente</button></div>}
    {!loading && !loadError && <>
      <section className="evaluation-form-section"><h2>Avalie seu atendimento</h2>
        <p>Conte como foi sua experiência com a oficina após retirar o veículo.</p>
        {!orders.length && <p className="empty-state">Não há serviços concluídos pendentes de avaliação.</p>}
        <form onSubmit={handleSubmit}>
          <fieldset disabled={busy || !orders.length} className="af-form-fields">
            <div className="form-group"><label htmlFor="evaluation-order">Serviço concluído</label>
              <select id="evaluation-order" required value={selectedOrder} onChange={e => setSelectedOrder(e.target.value)}>
                <option value="">Selecione uma ordem de serviço</option>
                {orders.map(order => <option key={order.id} value={order.id}>{order.descricao}</option>)}
              </select></div>
            <fieldset className="rating-field"><legend>Selecione uma nota</legend><div className="stars">
              {[1, 2, 3, 4, 5].map(star => <button key={star} type="button" aria-label={`${star} estrela${star > 1 ? 's' : ''}`}
                aria-pressed={rating === star} className={`rating-star ${star <= (hoverRating || rating) ? 'selected' : ''}`}
                onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}>★</button>)}
            </div></fieldset>
            <div className="form-group"><label htmlFor="comentario">Comentário</label>
              <textarea id="comentario" rows="5" placeholder="Conte como foi sua experiência..." value={comment} onChange={e => setComment(e.target.value)} /></div>
            <button type="submit">{busy ? 'Enviando…' : 'Enviar avaliação'}</button>
          </fieldset>
          {message.text && <p className={message.type} role="status">{message.text}</p>}
        </form>
      </section>
      <section className="previous-evaluations"><h2>Avaliações anteriores</h2><div className="evaluation-grid">
        {!evaluations.length && <p className="empty-state">Nenhuma avaliação encontrada.</p>}
        {evaluations.map(item => <article key={item.id} className="evaluation-card">
          <div className="evaluation-header"><h3>{item.oficina}</h3><span className="rating" aria-label={`Nota ${item.nota} de 5`}>{'★'.repeat(item.nota)}</span></div>
          <p>{item.comentario || 'Avaliação sem comentário.'}</p><small>O.S. nº {item.osId} · {displayDate(item.data)}</small>
        </article>)}
      </div></section>
    </>}
  </main></div>;
}
