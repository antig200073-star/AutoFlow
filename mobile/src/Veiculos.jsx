import React, { useEffect, useState } from 'react';

export default function Veiculos() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    modelo: '',
    marca: '',
    placa: '',
    ano: '',
  });
  const [message, setMessage] = useState({ text: '', type: '' });

  // Carrega a lista de veículos ao montar o componente
  useEffect(() => {
    async function fetchVehicles() {
      try {
        const hook = window.AutoFlowIntegration?.loadVehicles;
        if (typeof hook === 'function') {
          const result = await hook();
          setVehicles(result || []);
        }
      } catch (error) {
        console.error('Erro ao carregar veículos:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchVehicles();
  }, []);

  // Atualiza os campos do formulário
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'placa' ? value.toUpperCase() : value,
    }));
  };

  // Submissão do formulário de cadastro de veículo
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    try {
      const hook = window.AutoFlowIntegration?.addVehicle;
      if (typeof hook === 'function') {
        const result = await hook(formData);
        if (result?.success) {
          setMessage({
            text: 'Veículo cadastrado com sucesso!',
            type: 'message-success',
          });
          setVehicles((prev) => [...prev, result.data || formData]);
          setFormData({ modelo: '', marca: '', placa: '', ano: '' });
          return;
        }
      }

      // Caso não exista o hook de integração, adiciona localmente
      setVehicles((prev) => [...prev, { ...formData, id: Date.now() }]);
      setMessage({
        text: 'Veículo cadastrado com sucesso!',
        type: 'message-success',
      });
      setFormData({ modelo: '', marca: '', placa: '', ano: '' });
    } catch (error) {
      console.error(error);
      setMessage({
        text: 'Erro ao cadastrar veículo.',
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
            <p>Gerenciamento</p>
            <h1>Meus veículos</h1>
          </div>
        </header>

        {/* LISTA DE VEÍCULOS */}
        <section className="vehicle-section">
          <h2>Veículos cadastrados</h2>

          <div id="vehicle-list">
            {loading ? (
              <p className="empty-state">Carregando veículos...</p>
            ) : vehicles.length === 0 ? (
              <p className="empty-state">Nenhum veículo cadastrado.</p>
            ) : (
              <div className="vehicle-grid">
                {vehicles.map((v, index) => (
                  <article className="vehicle-card" key={v.id || index}>
                    <h3>
                      {v.marca} {v.modelo}
                    </h3>
                    <dl>
                      <div>
                        <dt>Placa</dt>
                        <dd>{v.placa}</dd>
                      </div>
                      <div>
                        <dt>Ano</dt>
                        <dd>{v.ano}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* FORMULÁRIO DE CADASTRO */}
        <section className="vehicle-form-section">
          <h2>Cadastrar veículo</h2>

          <form id="vehicle-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="modelo">Modelo</label>
                <input
                  type="text"
                  id="modelo"
                  name="modelo"
                  required
                  value={formData.modelo}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="marca">Marca</label>
                <input
                  type="text"
                  id="marca"
                  name="marca"
                  required
                  value={formData.marca}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="placa">Placa</label>
                <input
                  type="text"
                  id="placa"
                  name="placa"
                  maxLength={7}
                  placeholder="ABC1D23"
                  required
                  value={formData.placa}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="ano">Ano</label>
                <input
                  type="number"
                  id="ano"
                  name="ano"
                  min="1900"
                  required
                  value={formData.ano}
                  onChange={handleChange}
                />
              </div>
            </div>

            <button type="submit">Cadastrar veículo</button>

            {message.text && (
              <p
                id="vehicle-message"
                className={`form-message ${message.type}`}
                aria-live="polite"
              >
                {message.text}
              </p>
            )}
          </form>
        </section>
      </main>

      {/* RODAPÉ FIXO ESTILO INSTAGRAM */}
    </div>
  );
}
