import React, { useState } from 'react';
import Brand from './Brand';
import { registerUser } from './services/api';

export default function Cad({ onNavigate }) {
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    senha: '',
    confirmarSenha: '',
  });

  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage({ text: '', type: '' });

    if (formData.senha !== formData.confirmarSenha) {
      setMessage({
        text: 'As senhas não coincidem.',
        type: 'message-error',
      });
      return;
    }

    const payload = {
      nome: formData.nome.trim(),
      telefone: formData.telefone.trim(),
      email: formData.email.trim(),
      senha: formData.senha,
    };

    try {
      const result = await registerUser(payload);
      setMessage({
        text: result.message || 'Não foi possível criar a conta.',
        type: result.success ? 'message-success' : 'message-error',
      });
    } catch (error) {
      console.error(error);
      setMessage({
        text: 'Não foi possível criar a conta.',
        type: 'message-error',
      });
    }
  };

  return (
    <div className="login-page">
      <main className="login-container">
        <section className="login-box">
          <header className="login-header">
            <Brand />
            <h1>Criar sua conta</h1>
            <p>Criar uma conta</p>
          </header>

          <form id="register-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="nome">Nome completo</label>
              <input
                type="text"
                id="nome"
                name="nome"
                autoComplete="name"
                required
                value={formData.nome}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="telefone">Telefone</label>
              <input
                type="tel"
                id="telefone"
                name="telefone"
                autoComplete="tel"
                value={formData.telefone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="senha">Senha</label>
              <input
                type={showSenha ? 'text' : 'password'}
                id="senha"
                name="senha"
                autoComplete="new-password"
                minLength={6}
                required
                value={formData.senha}
                onChange={handleChange}
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowSenha((prev) => !prev)}
              >
                {showSenha ? 'Ocultar senha' : 'Mostrar senha'}
              </button>
            </div>

            <div className="form-group">
              <label htmlFor="confirmar-senha">Confirmar senha</label>
              <input
                type={showConfirmarSenha ? 'text' : 'password'}
                id="confirmar-senha"
                name="confirmarSenha"
                autoComplete="new-password"
                minLength={6}
                required
                value={formData.confirmarSenha}
                onChange={handleChange}
              />

              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirmarSenha((prev) => !prev)}
              >
                {showConfirmarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              </button>
            </div>

            <button type="submit">Criar conta</button>

            {message.text && (
              <p
                id="register-message"
                className={`form-message ${message.type}`}
                aria-live="polite"
              >
                {message.text}
              </p>
            )}
          </form>

          <p className="register-link">
            Já possui uma conta?{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (onNavigate) onNavigate('login');
              }}
            >
              Entrar
            </a>
          </p>
        </section>
      </main>
    </div>
  );
}
