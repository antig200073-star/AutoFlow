import React, { useState } from 'react';
import Cad from './Cad';
import Dash from './dash';
import Veiculos from './Veiculos';
import Oficinas from './Oficinas';
import Avaliacoes from './Avaliacoes';
import Perfil from './Perfil';
import Brand from './Brand';
import BottomNavigation from './BottomNavigation';

// Componente da tela de Login
function Login({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    // Navega direto para a tela Dash
    onNavigate('dash');
  };

  return (
    <div className="login-page">
      <main className="login-container">
        <section className="login-box">
          <header className="login-header">
            <Brand />
            <h1>Bem-vindo ao AutoFlow</h1>
            <p>Gerenciamento automotivo</p>
          </header>

          <form id="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="senha">Senha</label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="senha"
                name="senha"
                autoComplete="current-password"
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              </button>
            </div>

            <button type="submit">Entrar</button>
          </form>

          <p className="register-link">
            Não possui uma conta?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('cadastro');
              }}
            >
              Cadastre-se
            </a>
          </p>
        </section>

        <button
          id="btn-google"
          type="button"
          onClick={() => onNavigate('dash')}
        >
          Entrar com o Google
        </button>
      </main>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');
  const authenticatedPage = !['login', 'cadastro'].includes(currentPage);

  return (
    <div className={authenticatedPage ? 'af-app' : 'af-auth'}>
      {authenticatedPage && <header className="af-app-header"><Brand compact /><span>Área do cliente</span></header>}
      {currentPage === 'login' && <Login onNavigate={setCurrentPage} />}
      {currentPage === 'cadastro' && <Cad onNavigate={setCurrentPage} />}
      {currentPage === 'dash' && <Dash onNavigate={setCurrentPage} />}
      {currentPage === 'veiculos' && <Veiculos />}
      {currentPage === 'oficinas' && <Oficinas />}
      {currentPage === 'avaliacoes' && <Avaliacoes />}
      {currentPage === 'perfil' && <Perfil onNavigate={setCurrentPage} />}
      {currentPage === 'servicos' && <Dash onNavigate={setCurrentPage} serviceOnly />}
      {authenticatedPage && <BottomNavigation currentPage={currentPage} onNavigate={setCurrentPage} />}
    </div>
  );
}
