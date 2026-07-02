import logoIntus from '../assets/logo-intus.png';
import logoEtra  from '../assets/logo-etra.png';

export default function TopBar({ editMode, onToggleEdit }) {
  return (
    <div className="topbar">
      <div className="topbar-left">
        <img src={logoIntus} className="brand-logo-intus" alt="Intus" />
      </div>
      <div className="topbar-center">
        <div className="topbar-center-title">ETRA Legacy Fund</div>
        <div className="topbar-center-sub">Industry Scoring &amp; Analysis</div>
      </div>
      <div className="topbar-right">
        <img src={logoEtra} className="brand-logo-etra" alt="ETRA" />
        <button
          className={`edit-toggle-btn${editMode ? ' active' : ''}`}
          onClick={onToggleEdit}
        >
          {editMode ? 'Salir de edición' : 'Editar'}
        </button>
      </div>
    </div>
  );
}
