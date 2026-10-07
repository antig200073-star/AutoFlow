import React, { useEffect, useState } from 'react';
import { fetchApprovedWorkshops } from './services/api';

export default function Oficinas() {
  const [workshops, setWorkshops] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedWorkshop, setSelectedWorkshop] = useState(null);
  const [error, setError] = useState('');

  // Carrega lista de oficinas
  useEffect(() => {
    async function fetchWorkshops() {
      try {
        setWorkshops(await fetchApprovedWorkshops());
      } catch (error) {
        console.error('Erro ao carregar oficinas:', error);
        setError('Não foi possível carregar as oficinas aprovadas. Confira sua conexão e entre novamente.');
      } finally {
        setLoading(false);
      }
    }

    fetchWorkshops();
  }, []);

  // Filtra oficinas pelo termo de busca
  const filteredWorkshops = workshops.filter((w) => {
    const term = searchTerm.toLowerCase();
    return (
      w.nome?.toLowerCase().includes(term) ||
      w.endereco?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="dashboard-wrapper">
      {/* CONTEÚDO PRINCIPAL */}
      <main>
        <header className="page-header">
          <div>
            <p>Localização</p>
            <h1>Oficinas aprovadas</h1>
          </div>
        </header>

        <section>
          <h2>Encontre uma oficina</h2>

          <div className="workshop-search-container">
            <input
              type="text"
              id="workshop-search"
              placeholder="Buscar por nome ou endereço..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="workshop-grid" id="workshop-list">
            {error ? <p className="empty-state" role="alert">{error}</p> : loading ? (
              <p className="empty-state">Carregando oficinas...</p>
            ) : filteredWorkshops.length === 0 ? (
              <p className="empty-state">Nenhuma oficina encontrada.</p>
            ) : (
              filteredWorkshops.map((w) => (
                <article key={w.id} className="workshop-card">
                  <div className="workshop-header">
                    <h3>{w.nome}</h3>
                    <span className="rating">{w.avaliacao}</span>
                  </div>
                  <p className="workshop-address">{w.endereco}</p>
                  <p className="workshop-distance">{w.distancia}</p>
                  <button
                    type="button"
                    className="button-link"
                    onClick={() => setSelectedWorkshop(w)}
                  >
                    Ver detalhes
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      </main>

      {/* MODAL DE DETALHES DA OFICINA */}
      {selectedWorkshop && (
        <div className="modal-overlay" id="workshop-modal">
          <div className="modal">
            <div className="modal-header">
              <h2 id="workshop-modal-name">{selectedWorkshop.nome}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setSelectedWorkshop(null)}
              >
                ×
              </button>
            </div>
            <p id="workshop-modal-address">
              <strong>Endereço:</strong> {selectedWorkshop.endereco}
            </p>
            <p id="workshop-modal-distance">
              <strong>Distância:</strong> {selectedWorkshop.distancia}
            </p>
            <p id="workshop-modal-rating">
              <strong>Avaliação:</strong> {selectedWorkshop.avaliacao}
            </p>
          </div>
        </div>
      )}

      {/* RODAPÉ FIXO ESTILO INSTAGRAM */}
    </div>
  );
}
