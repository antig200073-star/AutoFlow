import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { loginUser, loginWithGoogle, logoutUser } from './services/api';
import Cad from './Cad';
import Dash from './dash';
import Veiculos from './Veiculos';
import Oficinas from './Oficinas';
import Avaliacoes from './Avaliacoes';
import Perfil from './Perfil';
import Brand from './Brand';
import BottomNavigation from './BottomNavigation';
import NativeBridge from './native/NativeBridge';
import { createPageHistory } from './native/navigation';

// Componente da tela de Login
function Login({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setMessage('');
    try {
      const result = await loginUser(email.trim(), senha);
      if (result.success) onNavigate('dash');
      else setMessage(result.message);
    } catch { setMessage('Não foi possível conectar. Tente novamente.'); }
    finally { submitting.current = false; setBusy(false); }
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
            {message && <p role="status" className="form-message message-error">{message}</p>}
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
          disabled={busy}
          onClick={async () => {
            if (submitting.current) return;
            submitting.current = true; setBusy(true); setMessage('');
            try {
              await loginWithGoogle();
            } catch { setMessage('Não foi possível entrar com o Google. Tente novamente.'); }
            finally { submitting.current = false; setBusy(false); }
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
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [history] = useState(createPageHistory);
  const goToPage = page => setCurrentPage(history.visit(page));
  const goBack = () => {
    const previous = history.back();
    if (!previous) return false;
    setCurrentPage(previous);
    return true;
  };
  useEffect(() => {
    let mounted = true, revision = 0;
    const applySession = user => {
      if (!mounted) return;
      setAuthenticated(Boolean(user)); setChecking(false);
      setCurrentPage(page => {
        const next = user ? (['login', 'cadastro'].includes(page) ? 'dash' : page)
          : (page === 'cadastro' ? page : 'login');
        if (next !== page || (!user && next === 'login')) history.reset(next);
        return next;
      });
    };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Não faz consultas dentro do callback de autenticação.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        revision++; applySession(session?.user);
      }
    });
    const initialRevision = revision;
    supabase.auth.getUser().then(({ data }) => {
      if (revision === initialRevision) applySession(data.user);
    }).catch(() => { if (revision === initialRevision) applySession(null); });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [history]);
  const navigate = async (page) => {
    if (page === 'login') {
      try { await logoutUser(); }
      catch { window.alert('Não foi possível encerrar a sessão. Tente novamente.'); return; }
      history.reset('login');
    }
    goToPage(page);
  };
  const page = authenticated ? currentPage : (currentPage === 'cadastro' ? 'cadastro' : 'login');
  const authenticatedPage = authenticated && !['login', 'cadastro'].includes(page);

  return (
    <>
    <NativeBridge onBack={goBack} authenticatedPage={authenticatedPage} />
    {checking ? <main><p role="status" className="empty-state">Verificando sua sessão…</p></main> :
    <div className={authenticatedPage ? 'af-app' : 'af-auth'}>
      {authenticatedPage && <header className="af-app-header"><Brand compact /><span>Área do cliente</span></header>}
      {page === 'login' && <Login onNavigate={goToPage} />}
      {page === 'cadastro' && <Cad onNavigate={goToPage} />}
      {page === 'dash' && <Dash onNavigate={goToPage} />}
      {page === 'veiculos' && <Veiculos />}
      {page === 'oficinas' && <Oficinas />}
      {page === 'avaliacoes' && <Avaliacoes />}
      {page === 'perfil' && <Perfil onNavigate={navigate} />}
      {page === 'servicos' && <Dash onNavigate={goToPage} serviceOnly />}
      {authenticatedPage && <BottomNavigation currentPage={page} onNavigate={goToPage} />}
    </div>}
    </>
  );
}
