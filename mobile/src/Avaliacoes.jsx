import React, { useEffect, useState } from 'react';

export default function Avaliacoes() {
  const [orders, setOrders] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedOrder, setSelectedOrder] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  // Carrega Ordens de Serviço concluídas e Avaliações anteriores
  useEffect(() => {
    async function fetchData() {
      try {
        const loadOrders = window.AutoFlowIntegration?.loadOrders;
        const loadEvals = window.AutoFlowIntegration?.loadEvaluations;

        if (typeof loadOrders === 'function') {
          const resOrders = await loadOrders();
          setOrders(resOrders || []);
        } else {
          setOrders([
            { id: '101', descricao: 'Troca de Óleo - Oficina AutoTech' },
            { id: '102', descricao: 'Alinhamento e Balanceamento - Mecânica Central' },
          ]);
        }

        if (typeof loadEvals === 'function') {
          const resEvals = await loadEvals();
          setEvaluations(resEvals || []);
        } else {
          setEvaluations([
            {
              id: 1,
              servico: 'Troca de Óleo',
              nota: 5,
              comentario: 'Atendimento muito rápido e transparente!',
            },
          ]);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!rating) {
      setMessage({
        text: 'Por favor, selecione uma nota de 1 a 5 estrelas.',
        type: 'message-error',
      });
      return;
    }

    const payload = {
      os_id: selectedOrder,
      nota: rating,
      comentario: comment,
    };

    try {
      const hook = window.AutoFlowIntegration?.addEvaluation;
      if (typeof hook === 'function') {
        const res = await hook(payload);
        if (res?.success) {
          setMessage({
            text: 'Avaliação enviada com sucesso!',
            type: 'message-success',
          });
        }
      } else {
        setMessage({
          text: 'Avaliação enviada com sucesso!',
          type: 'message-success',
        });
      }

      setEvaluations((prev) => [
        ...prev,
        {
          id: Date.now(),
          servico: `Serviço #${selectedOrder}`,
          nota: rating,
          comentario: comment,
        },
      ]);

      setSelectedOrder('');
      setRating(0);
      setComment('');
    } catch (error) {
      console.error(error);
      setMessage({
        text: 'Erro ao enviar avaliação.',
        type: 'message-error',
      });
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* CONTEÚDO PRINCIPAL */}
      <main>
        <header className="page-header">
          <div>
            <p>Experiência</p>
            <h1>Avaliações</h1>
          </div>
        </header>

        {/* FORMULÁRIO DE AVALIAÇÃO */}
        <section className="evaluation-form-section">
          <h2>Avalie seu atendimento</h2>
          <p>Conte como foi sua experiência com a oficina.</p>

          <form id="evaluation-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="evaluation-order">Serviço concluído</label>
              <select
                id="evaluation-order"
                name="os_id"
                required
                value={selectedOrder}
                onChange={(e) => setSelectedOrder(e.target.value)}
              >
                <option value="">Selecione uma ordem de serviço</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.descricao || `Ordem de Serviço #${o.id}`}
                  </option>
                ))}
              </select>
            </div>

            <fieldset className="rating-field">
              <legend>Selecione uma nota</legend>

              <div className="stars" id="stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`rating-star ${
                      star <= (hoverRating || rating) ? 'selected' : ''
                    }`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    ★
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="form-group">
              <label htmlFor="comentario">Comentário</label>
              <textarea
                id="comentario"
                name="comentario"
                rows="5"
                placeholder="Conte como foi sua experiência..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              ></textarea>
            </div>

            <button type="submit">Enviar avaliação</button>

            {message.text && (
              <p id="evaluation-message" className={message.type}>
                {message.text}
              </p>
            )}
          </form>
        </section>

        {/* HISTÓRICO DE AVALIAÇÕES */}
        <section className="previous-evaluations">
          <h2>Avaliações anteriores</h2>

          <div className="evaluation-grid" id="evaluation-list">
            {loading ? (
              <p className="empty-state">Carregando avaliações...</p>
            ) : evaluations.length === 0 ? (
              <p className="empty-state">Nenhuma avaliação encontrada.</p>
            ) : (
              evaluations.map((item) => (
                <article key={item.id} className="evaluation-card">
                  <div className="evaluation-header">
                    <h3>{item.servico || 'Atendimento'}</h3>
                    <span className="rating">{'★'.repeat(item.nota)}</span>
                  </div>
                  <p>{item.comentario}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {/* RODAPÉ FIXO ESTILO INSTAGRAM */}
    </div>
  );
}
