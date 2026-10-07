import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { loginUser, logoutUser } from './services/api';
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
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true); setMessage('');
    try {
      const result = await loginUser(email.trim(), senha);
      if (result.success) onNavigate('dash');
      else setMessage(result.message);
    } catch { setMessage('Não foi possível conectar. Tente novamente.'); }
    finally { setBusy(false); }
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

            <button type="submit" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
            <p role="status" className="form-message message-error">{message}</p>
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
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
            if (error) setMessage('Não foi possível entrar com o Google. Confira a configuração do provedor.');
          }}
        >
          Entrar com o Google
        </button>
      </main>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('login');
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => { if (mounted && data.user) setCurrentPage('dash'); }).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setCurrentPage('login');
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);
  const navigate = async (page) => {
    if (page === 'login') {
      try { await logoutUser(); }
      catch { window.alert('Não foi possível encerrar a sessão. Tente novamente.'); return; }
    }
    setCurrentPage(page);
  };
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
      {currentPage === 'perfil' && <Perfil onNavigate={navigate} />}
      {currentPage === 'servicos' && <Dash onNavigate={setCurrentPage} serviceOnly />}
      {authenticatedPage && <BottomNavigation currentPage={currentPage} onNavigate={setCurrentPage} />}
    </div>
  );
}
