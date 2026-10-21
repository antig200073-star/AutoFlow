import { useEffect, useId, useRef } from 'react';

export default function Modal({ title, onClose, children }) {
  const dialog = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    element.showModal();
    return () => { element.close(); previousFocus?.focus(); };
  }, []);
  return <dialog ref={dialog} className="af-mobile-dialog" aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== dialog.current) return;
      const rect = dialog.current.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <header className="af-history-header"><h2 id={titleId}>{title}</h2>
      <button type="button" onClick={onClose} aria-label="Fechar janela">Fechar</button></header>
    {children}
  </dialog>;
}
