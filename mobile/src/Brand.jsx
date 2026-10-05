import logo from './assets/logo-autoflow.jpg';

export default function Brand({ compact = false }) {
  return (
    <span className={`af-brand ${compact ? 'af-brand-compact' : ''}`}>
      <img src={logo} alt="AutoFlow Mecânica" />
      {compact && <span aria-hidden="true">Auto<span className="af-word-accent">Flow</span></span>}
    </span>
  );
}
