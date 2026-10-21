import { useEffect, useState } from 'react';
import Modal from './Modal';
import { vehicleService, friendlyError } from './services/api';
import { displayDate, statusLabel } from './services/client-service';

export default function VehicleHistory({ vehicle, onClose }) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    vehicleService.history(vehicle.id).then(data => { if (active) setOrders(data); })
      .catch(cause => { if (active) setError(friendlyError(cause)); });
    return () => { active = false; };
  }, [vehicle.id, retry]);
  return <Modal title={`Histórico de manutenção — ${vehicle.marca} ${vehicle.modelo} (${vehicle.placa})`} onClose={onClose}>
    {error ? <div role="alert" className="message-error"><p>{error}</p>
      <button type="button" onClick={() => { setOrders(null); setError(''); setRetry(value => value + 1); }}>Tentar novamente</button></div>
      : !orders ? <p role="status">Consultando ordens de serviço…</p>
      : <><p className="af-hint">{orders.length ? `${orders.length} ordem(ns) de serviço encontrada(s).` : 'Nenhuma manutenção registrada para este veículo.'}</p>
        <div className="af-history-list">{orders.map(order => <article className="af-history-item" key={order.id}>
          <h3>O.S. nº {order.id} — {statusLabel(order.status)}</h3>
          <p>Oficina: {order.oficina}</p><p>Serviço / defeito: {order.problema || 'Não informado'}</p>
          <p>Entrada: {displayDate(order.entrada)}</p>
          {order.saida && <p>Saída: {displayDate(order.saida)}</p>}
          <small>{order.status === 'entregue' ? 'Manutenção entregue' : 'Manutenção em acompanhamento'}</small>
        </article>)}</div></>}
  </Modal>;
}
