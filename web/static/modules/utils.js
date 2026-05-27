export function parseStatus(status) {
  if (status === 'pending')     return { label: 'En attente',      cls: 'pending',    pct: 0 };
  if (status === 'done')        return { label: 'Terminé',         cls: 'done',       pct: 100 };
  if (status === 'error')       return { label: 'Erreur',          cls: 'error',      pct: 0 };
  if (status === 'recompiling') return { label: 'Recompilation…',  cls: 'processing', pct: 50 };
  const m = status.match(/^processing:(\d+)\/(\d+)$/);
  if (m) {
    const pct = Math.round((+m[1] / +m[2]) * 100);
    return { label: `Page ${m[1]} / ${m[2]}`, cls: 'processing', pct };
  }
  return { label: 'En cours…', cls: 'processing', pct: 0 };
}

export const BADGE = {
  pending:    'bg-amber-100  text-amber-800  border border-amber-300',
  processing: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
  done:       'bg-emerald-100 text-emerald-800 border border-emerald-300',
  error:      'bg-red-100    text-red-800    border border-red-300',
};

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
