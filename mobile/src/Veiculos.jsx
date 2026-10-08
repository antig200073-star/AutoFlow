import { useEffect, useRef, useState } from 'react';
import { vehicleService } from './services/api';
import { vehicleError, vehicleRemovalPrompt, vehicleRemovalError } from '../../web/public/assets/js/vehicle-service.js';
import '../../web/public/assets/js/vehicle-registration.js';
import '../../web/public/assets/css/vehicles.css';

export default function Veiculos() {
  const registration = useRef(null);
  const revision = useRef(0);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', error: false });
  const removingRef = useRef(false);
  const [removing, setRemoving] = useState(false);
  async function removeVehicle(vehicle) {
    if (removingRef.current || !window.confirm(vehicleRemovalPrompt(vehicle))) return;
    removingRef.current = true; setRemoving(true); revision.current++;
    setLoading(false); setMessage({ text: 'Excluindo veículo…', error: false });
    try {
      await vehicleService.remove(vehicle.id);
      setVehicles(previous => previous.filter(v => v.id !== vehicle.id));
      setMessage({ text: 'Veículo excluído da sua lista. Histórico preservado.', error: false });
    } catch (error) {
      setMessage({ text: vehicleRemovalError(error), error: true });
    } finally { removingRef.current = false; setRemoving(false); revision.current++; }
  }
  async function load() {
    if (removingRef.current) return;
    const current = ++revision.current;
    setLoading(true); setMessage({ text: '', error: false });
    try {
      const result = await vehicleService.list();
      if (current === revision.current) setVehicles(result);
    } catch (error) {
      if (current === revision.current) setMessage({ text: vehicleError(error), error: true });
    } finally { if (current === revision.current) setLoading(false); }
  }
  useEffect(() => {
    const modal = registration.current;
    modal.service = vehicleService;
    const saved = event => {
      revision.current++;
      setLoading(false);
      setVehicles(previous => [event.detail, ...previous.filter(v => v.id !== event.detail.id)]);
      setMessage({ text: 'Veículo cadastrado com sucesso!', error: false });
    };
    modal.addEventListener('vehicle-saved', saved);
    load();
    return () => { revision.current++; modal.removeEventListener('vehicle-saved', saved); };
  }, []);
  return (
    <div className="dashboard-wrapper"><main>
      <header className="page-header"><div><p>Gerenciamento</p><h1>Meus veículos</h1></div></header>
      <section aria-label="Veículos cadastrados">
        <div className="af-vehicles-toolbar"><h2>Veículos cadastrados</h2><div>
          <button className="secondary" type="button" disabled={removing} onClick={load}>Atualizar</button>{' '}
          <button type="button" onClick={() => registration.current.open()}>Cadastrar veículo</button>
        </div></div>
        <p className={`af-vehicles-message${message.error ? ' error' : ''}`} role="status">{message.text}</p>
        <div className="af-vehicles-grid">
          {loading ? <p className="empty-state">Carregando veículos…</p> : vehicles.length === 0 ?
            <p className="empty-state">Nenhum veículo cadastrado. Use o botão para adicionar seu primeiro veículo.</p> :
            vehicles.map(vehicle => <article className="af-vehicle-card" key={vehicle.id}>
              <VehiclePhoto vehicle={vehicle} />
              <div className="af-vehicle-body"><h3>{vehicle.marca} {vehicle.modelo}</h3><dl>
                <div><dt>Placa</dt><dd className="af-plate">{vehicle.placa}</dd></div>
                <div><dt>Ano</dt><dd>{vehicle.ano ?? 'Não informado'}</dd></div>
                <div><dt>Quilometragem</dt><dd>{vehicle.km_atual == null ? 'Não informada' : `${Number(vehicle.km_atual).toLocaleString('pt-BR')} km`}</dd></div>
              </dl><button className="af-delete-vehicle" type="button" disabled={removing}
                aria-label={`Excluir veículo ${vehicle.placa}`} onClick={() => removeVehicle(vehicle)}>Excluir veículo</button></div>
            </article>)}
        </div>
      </section>
      <autoflow-vehicle-registration ref={registration} />
    </main></div>
  );
}
function VehiclePhoto({ vehicle }) {
  const [failedUrl, setFailedUrl] = useState(null);
  return vehicle.photoUrl && failedUrl !== vehicle.photoUrl ?
    <img src={vehicle.photoUrl} alt={`${vehicle.marca} ${vehicle.modelo}`} loading="lazy" onError={() => setFailedUrl(vehicle.photoUrl)} /> :
    <div className="af-vehicle-no-photo">{vehicle.foto_path ? 'Foto indisponível. Atualize a lista para tentar novamente.' : 'Veículo cadastrado sem foto.'}</div>;
}
