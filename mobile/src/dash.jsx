import { useEffect, useState } from 'react';
import { clientService, friendlyError } from './services/api';
import { maintenanceStatuses } from './services/client-service';
import { startDashboardRefresh } from './services/dashboard-refresh';

export default function Dash({ onNavigate, serviceOnly = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => startDashboardRefresh({
    load: () => clientService.loadDashboard(),
    onData: result => { setData(result); setError(''); setLoading(false); },
    onError: cause => { setError(friendlyError(cause)); setLoading(false); },
  }), [retry]);

  return <div className="dashboard-wrapper"><main>
    <header className="dashboard-header"><div><p>Bem-vindo de volta!</p><h1>{serviceOnly ? 'Meus serviços' : 'Início'}</h1></div>
      <button type="button" className="profile-link" onClick={() => onNavigate('perfil')}>Meu perfil</button></header>
    {loading && <p role="status" className="empty-state">Carregando suas informações…</p>}
    {error && <div role="alert" className="message-error"><p>{error}</p>
      {data && <p>Os dados exibidos são da última atualização. O status pode ter mudado.</p>}
      <button type="button" className="profile-link" onClick={() => { setLoading(true); setRetry(value => value + 1); }}>Tentar novamente</button></div>}
    {!serviceOnly && data && <section><h2>Visão geral</h2><div className="cards">
      <article className="card"><h3>Veículos cadastrados</h3><p id="total-vehicles">{data.dashboard.totalVehicles}</p></article>
      <article className="card"><h3>Serviços em andamento</h3><p id="total-services">{data.dashboard.totalServices}</p></article>
      <article className="card"><h3>Manutenções finalizadas</h3><p id="total-finished">{data.dashboard.totalFinished}</p></article>
    </div></section>}
    {data && <section className="maintenance-section"><h2>Acompanhamento da manutenção</h2>
      <p className="af-hint">Atualização automática a cada 30 segundos enquanto esta tela estiver aberta.</p>
      <div id="maintenance-list">
        {!data.maintenances.length && <p className="empty-state">Nenhuma manutenção em andamento. Consulte os serviços anteriores no histórico dos seus veículos.</p>}
        {data.maintenances.map(order => <article className="maintenance-card" key={order.id}>
          <h3>O.S. nº {order.id} — {order.vehicleName}</h3>
          {order.plate && <p>Placa: {order.plate}</p>}
          <p>Status atual: <strong>{order.status}</strong></p>
          <ol className="progress-steps" aria-label={`Etapas da ordem de serviço nº ${order.id}`}>
            {maintenanceStatuses.map((step, index) => {
              const current = maintenanceStatuses.indexOf(order.status);
              return <li key={step} className={`step ${index <= current ? 'active' : ''} ${index === current ? 'current' : ''}`}
                aria-current={index === current ? 'step' : undefined}>{step}</li>;
            })}
          </ol>
        </article>)}
      </div>
    </section>}
    <div className="af-service-actions">
      <button type="button" onClick={() => onNavigate('avaliacoes')}>Avaliar serviços</button>
      <button type="button" className="profile-link" onClick={() => onNavigate('veiculos')}>Histórico dos veículos</button>
      <button type="button" className="profile-link" onClick={() => onNavigate('oficinas')}>Encontrar oficina</button>
    </div>
  </main></div>;
}
