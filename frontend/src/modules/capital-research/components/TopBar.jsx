// The global app header (App.jsx) already shows the INTUS logo and module
// nav, so the old standalone branding bar is redundant here. All that
// remains functionally necessary is the edit-mode toggle, rendered as a
// small button inline in CapitalResearch.jsx's dashboard toolbar.
export default function TopBar({ editMode, onToggleEdit }) {
  return (
    <button
      onClick={onToggleEdit}
      className={
        editMode
          ? 'bg-emerald-500 text-white rounded-lg text-xs font-semibold px-4 py-2 hover:bg-emerald-600 transition-all'
          : 'border border-slate-200 text-slate-500 rounded-lg text-xs font-semibold px-4 py-2 hover:border-emerald-300 hover:text-emerald-600 transition-all'
      }
    >
      {editMode ? 'Salir de edición' : 'Editar'}
    </button>
  );
}
