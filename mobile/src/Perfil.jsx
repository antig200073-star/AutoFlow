import React, { useState, useEffect } from 'react';

export default function Perfil({ onNavigate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    nome: 'Samuel Bueno',
    email: 'samuel@email.com',
    telefone: '(11) 99999-9999',
  });
  const [tempData, setTempData] = useState({ ...userData });
  const [message, setMessage] = useState('');

  // Tenta carregar os dados do usuário salvos na integração ou usa o valor padrão
  useEffect(() => {
    async function loadProfile() {
      try {
        const hook = window.AutoFlowIntegration?.getProfile;
        if (typeof hook === 'function') {
          const profile = await hook();
          if (profile) {
            setUserData(profile);
            setTempData(profile);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      }
    }
    loadProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTempData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEdit = () => {
    setTempData({ ...userData });
    setIsEditing(true);
    setMessage('');
  };

  const handleCancel = () => {
    setTempData({ ...userData });
    setIsEditing(false);
    setMessage('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const hook = window.AutoFlowIntegration?.updateProfile;
      if (typeof hook === 'function') {
        await hook(tempData);
      }
      setUserData({ ...tempData });
      setIsEditing(false);
      setMessage('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      setMessage('Erro ao salvar alterações.');
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* CONTEÚDO PRINCIPAL */}
      <main>
        <header className="page-header">
          <div>
            <p>Minha conta</p>
            <h1>Perfil</h1>
          </div>
        </header>

        <section className="profile-section">
          <h2>Meus dados</h2>

          <form id="profile-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="profile-name">Nome</label>
              <input
                type="text"
                id="profile-name"
                name="nome"
                value={isEditing ? tempData.nome : userData.nome}
                onChange={handleChange}
                autoComplete="name"
                required
                readOnly={!isEditing}
              />
            </div>

            <div className="form-group">
              <label htmlFor="profile-email">E-mail</label>
              <input
                type="email"
                id="profile-email"
                name="email"
                value={isEditing ? tempData.email : userData.email}
                onChange={handleChange}
                autoComplete="email"
                required
                readOnly={!isEditing}
              />
            </div>

            <div className="form-group">
              <label htmlFor="profile-phone">Telefone</label>
              <input
                type="text"
                id="profile-phone"
                name="telefone"
                value={isEditing ? tempData.telefone : userData.telefone}
                onChange={handleChange}
                autoComplete="tel"
                readOnly={!isEditing}
              />
            </div>

            <div className="profile-actions" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              {!isEditing ? (
                <button type="button" id="edit-profile" onClick={handleEdit}>
                  Editar
                </button>
              ) : (
                <>
                  <button type="submit" id="save-profile">
                    Salvar
                  </button>
                  <button
                    type="button"
                    id="cancel-profile"
                    onClick={handleCancel}
                    style={{ backgroundColor: '#6b7280' }}
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
          </form>

          {message && (
            <p id="profile-message" className="form-message" style={{ marginTop: '15px' }}>
              {message}
            </p>
          )}
        </section>
        <button type="button" className="profile-link" onClick={() => onNavigate('login')}>Sair da conta</button>
      </main>

      {/* RODAPÉ FIXO ESTILO INSTAGRAM */}
    </div>
  );
}
