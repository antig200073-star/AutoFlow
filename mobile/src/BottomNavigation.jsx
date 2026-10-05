const items = [
  { page: 'dash', label: 'Início', path: 'M3 10 12 3l9 7v11h-6v-7H9v7H3Z' },
  { page: 'oficinas', label: 'Oficinas', path: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM9 10a3 3 0 1 0 6 0 3 3 0 1 0-6 0' },
  { page: 'veiculos', label: 'Veículos', path: 'M3 10l3-6h12l3 6v9H3ZM3 10h18M6 14h2M16 14h2M6 19v3M18 19v3' },
  { page: 'servicos', label: 'Serviços', path: 'M14 6l4 4 4-4a7 7 0 0 1-9 9l-7 7-4-4 7-7a7 7 0 0 1 9-9Z' },
  { page: 'perfil', label: 'Perfil', path: 'M8 7a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4 22v-3a8 8 0 0 1 16 0v3' },
];

export default function BottomNavigation({ currentPage, onNavigate }) {
  const activePage = currentPage === 'avaliacoes' ? 'servicos' : currentPage;
  return (
    <nav className="af-bottom-nav" aria-label="Navegação principal">
      {items.map(({ page, label, path }) => (
        <button
          type="button"
          key={page}
          className={`af-nav-item ${page === 'veiculos' ? 'af-nav-center' : ''}`}
          aria-current={activePage === page ? 'page' : undefined}
          onClick={() => onNavigate(page)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
