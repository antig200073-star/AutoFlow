import { useEffect, useState } from 'react';
import { clientService, friendlyError } from './services/api';
import { displayDate } from './services/client-service';
import Modal from './Modal';

function ratingText(ratings) {
  if (!ratings) return 'Avaliações indisponíveis';
  if (!ratings.total) return 'Sem avaliações';
  return `★ ${ratings.average} · ${ratings.total}${ratings.total === 100 ? ' avaliações recentes' : ' avaliação(ões)'}`;
}
function WorkshopDetails({ workshop, onClose }) {
  const [ratings, setRatings] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    clientService.loadWorkshopReviews(workshop.id).then(result => { if (active) setRatings(result); })
      .catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [workshop.id, retry]);
  return <Modal title={workshop.nome} onClose={onClose}>
    <p className="af-detail-line"><strong>Endereço:</strong> {workshop.endereco || 'Não informado'}</p>
    {workshop.telefone && <p className="af-detail-line"><strong>Telefone:</strong> {workshop.telefone}</p>}
    <h3>Avaliações da oficina</h3>
    {error ? <div className="message-error" role="alert"><p>{error}</p><button type="button" onClick={() => { setError(''); setRetry(n => n + 1); }}>Tentar novamente</button></div>
      : !ratings ? <p role="status">Carregando avaliações…</p>
      : <><p className="af-hint">{ratingText(ratings)}</p>
        {!ratings.total && <p>Esta oficina ainda não recebeu comentários.</p>}
        <div className="af-review-list">{ratings.reviews.map(review => <article className="evaluation-card" key={review.id}>
          <p aria-label={`Nota ${review.nota} de 5`} className="rating">{'★'.repeat(review.nota)}{'☆'.repeat(5 - review.nota)}</p>
          <p>{review.comentario || 'Avaliação sem comentário.'}</p><small>{displayDate(review.data)}</small>
        </article>)}</div></>}
  </Modal>;
}
export default function Oficinas() {
  const [workshops, setWorkshops] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    clientService.loadWorkshops().then(result => { if (active) setWorkshops(result); })
      .catch(cause => { if (active) setError(friendlyError(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const filtered = workshops.filter(w => normalize(`${w.nome} ${w.endereco}`).includes(normalize(searchTerm.trim())));
  return <div className="dashboard-wrapper"><main>
    <header className="page-header"><div><p>Localização</p><h1>Oficinas aprovadas</h1></div></header>
    <section><h2>Encontre uma oficina</h2>
      <div className="workshop-search-container"><label htmlFor="workshop-search">Nome ou endereço</label>
        <input type="search" id="workshop-search" placeholder="Buscar por nome ou endereço..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
      {error && <div role="alert" className="message-error"><p>{error}</p><button type="button" onClick={() => { setLoading(true); setError(''); setRetry(n => n + 1); }}>Tentar novamente</button></div>}
      <div className="workshop-grid">{loading ? <p role="status" className="empty-state">Carregando oficinas…</p>
        : !error && !filtered.length ? <p className="empty-state">Nenhuma oficina encontrada.</p>
        : !error && filtered.map(workshop => <article key={workshop.id} className="workshop-card">
          <div className="workshop-header"><h3>{workshop.nome}</h3></div>
          <p className="rating">{ratingText(workshop.ratings)}</p>
          <p className="workshop-address">{workshop.endereco}</p>
          <button type="button" className="button-link" onClick={() => setSelectedWorkshop(workshop)}>Ver detalhes e avaliações</button>
        </article>)}</div>
    </section>
  </main>{selectedWorkshop && <WorkshopDetails key={selectedWorkshop.id} workshop={selectedWorkshop} onClose={() => setSelectedWorkshop(null)} />}</div>;
}
