import React, { useEffect, useState } from 'react';

const maintenanceStatuses = [
  'Recebido',
  'Diagnóstico',
  'Aguardando Peça',
  'Em Reparo',
  'Pronto para Retirada',
];

export default function Dash({ onNavigate, serviceOnly = false }) {
  const [dashboardData, setDashboardData] = useState({
    totalVehicles: 0,
    totalServices: 0,
    totalFinished: 0,
  });

  const [maintenanceData, setMaintenanceData] = useState({
    vehicleName: 'Nenhuma manutenção em andamento',
    status: '',
  });

  useEffect(() => {
    async function loadData() {
      try {
        const hook = window.AutoFlowIntegration?.loadDashboard;
        if (typeof hook === 'function') {
          const result = await hook();
          if (result?.dashboard) setDashboardData(result.dashboard);
          if (result?.maintenance) setMaintenanceData(result.maintenance);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      }
    }

    loadData();
  }, []);

  const currentStatusIndex = maintenanceStatuses.indexOf(maintenanceData.status);

  return (
    <div className="dashboard-wrapper">
      {/* CONTEÚDO PRINCIPAL */}
      <main>
        <header className="dashboard-header">
          <div>
            <p>Bem-vindo de volta!</p>
            <h1>{serviceOnly ? 'Meus serviços' : 'Início'}</h1>
          </div>

          <button
            type="button"
            className="profile-link"
            onClick={() => onNavigate('perfil')}
          >
            Meu perfil
          </button>
        </header>

        {/* VISÃO GERAL */}
        {!serviceOnly && <section>
          <h2>Visão geral</h2>

          <div className="cards">
            <article className="card">
              <h3>Veículos cadastrados</h3>
              <p id="total-vehicles">{dashboardData.totalVehicles}</p>
            </article>

            <article className="card">
              <h3>Serviços em andamento</h3>
              <p id="total-services">{dashboardData.totalServices}</p>
            </article>

            <article className="card">
              <h3>Manutenções finalizadas</h3>
              <p id="total-finished">{dashboardData.totalFinished}</p>
            </article>
          </div>
        </section>}

        {/* ACOMPANHAMENTO DA MANUTENÇÃO */}
        <section className="maintenance-section">
          <h2>Acompanhamento da manutenção</h2>

          <article className="maintenance-card">
            <h3 id="maintenance-vehicle-name">
              {maintenanceData.vehicleName}
            </h3>

            <p>
              Status atual:{' '}
              <strong id="maintenance-status">
                {maintenanceData.status || 'Sem serviço ativo'}
              </strong>
            </p>

            {maintenanceData.status && <div className="progress-steps">
              {maintenanceStatuses.map((stepName, index) => {
                const isActive =
                  currentStatusIndex >= 0 && index <= currentStatusIndex;
                return (
                  <div
                    key={stepName}
                    className={`step ${isActive ? 'active' : ''} ${index === currentStatusIndex ? 'current' : ''}`}
                  >
                    {stepName}
                  </div>
                );
              })}
            </div>}
          </article>
        </section>
        {serviceOnly && <div className="af-service-actions">
          <button type="button" onClick={() => onNavigate('avaliacoes')}>Avaliar serviços</button>
          <button type="button" className="profile-link" onClick={() => onNavigate('oficinas')}>Encontrar oficina</button>
        </div>}
      </main>
    </div>
  );
}
