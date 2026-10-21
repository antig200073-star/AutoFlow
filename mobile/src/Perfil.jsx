import { useEffect, useRef, useState } from 'react';
import { clientService, friendlyError } from './services/api';

export default function Perfil({ onNavigate }) {
  const [userData, setUserData] = useState(null);
  const [tempData, setTempData] = useState({ nome: '', email: '', telefone: '' });
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState({ text: '', error: false });
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    clientService.loadProfile().then(profile => {
      if (active) { setUserData(profile); setTempData(profile); }
    }).catch(error => { if (active) setLoadError(friendlyError(error)); });
    return () => { active = false; };
  }, [retry]);
  async function handleSubmit(event) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setMessage({ text: '', error: false });
    try {
      const result = await clientService.updateProfile(tempData);
      setUserData(result.profile); setTempData(result.profile); setIsEditing(false);
      setMessage({ text: result.message, error: result.warning });
    } catch (error) { setMessage({ text: friendlyError(error), error: true }); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="dashboard-wrapper"><main>
    <header className="page-header"><div><p>Minha conta</p><h1>Perfil</h1></div></header>
    {loadError ? <div className="message-error" role="alert"><p>{loadError}</p><button type="button" onClick={() => { setLoadError(''); setRetry(n => n + 1); }}>Tentar novamente</button></div>
      : !userData ? <p className="empty-state" role="status">Carregando perfil…</p>
      : <section className="profile-section"><h2>Meus dados</h2>
        <form onSubmit={handleSubmit}><fieldset disabled={busy} className="af-form-fields">
          {[['nome', 'Nome', 'text', 'name'], ['email', 'E-mail', 'email', 'email'], ['telefone', 'Telefone', 'tel', 'tel']].map(([name, label, type, autoComplete]) =>
            <div className="form-group" key={name}><label htmlFor={`profile-${name}`}>{label}</label>
              <input id={`profile-${name}`} name={name} type={type} autoComplete={autoComplete} required={name !== 'telefone'}
                readOnly={!isEditing} value={isEditing ? tempData[name] : userData[name]}
                onChange={event => setTempData(previous => ({ ...previous, [name]: event.target.value }))} /></div>)}
          <div className="af-service-actions">{isEditing ? <>
            <button key="save" type="submit">{busy ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" className="profile-link" onClick={() => { setIsEditing(false); setTempData(userData); setMessage({ text: '', error: false }); }}>Cancelar</button>
          </> : <button key="edit" type="button" onClick={event => { event.preventDefault(); setTempData(userData); setIsEditing(true); setMessage({ text: '', error: false }); }}>Editar</button>}</div>
        </fieldset></form>
        {message.text && <p role="status" className={message.error ? 'message-error' : 'message-success'}>{message.text}</p>}
      </section>}
    <div className="af-service-actions"><button type="button" disabled={busy} onClick={() => onNavigate('avaliacoes')}>Minhas avaliações</button>
      <button type="button" disabled={busy} className="profile-link" onClick={() => onNavigate('login')}>Sair da conta</button></div>
  </main></div>;
}
