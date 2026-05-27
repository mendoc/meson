import { parseStatus } from './utils.js';

const _panels = {
  upload:   document.getElementById('panelUpload'),
  progress: document.getElementById('panelProgress'),
  viewer:   document.getElementById('panelViewer'),
  error:    document.getElementById('panelError'),
  settings: document.getElementById('panelSettings'),
};

export function showPanel(name) {
  Object.entries(_panels).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
}

export function currentPanel() {
  const entry = Object.entries(_panels).find(([, el]) => !el.classList.contains('hidden'));
  return entry ? entry[0] : 'upload';
}

export function updateActivePanel(t) {
  const s = parseStatus(t.status);

  if (t.status === 'done') {
    showPanel('viewer');
    document.getElementById('viewerTitle').textContent = t.titre;
    const url = `/api/output/${t.id}`;
    const frame = document.getElementById('pdfFrame');
    if (!frame.src.endsWith(url)) frame.src = url;
    const dl = document.getElementById('downloadBtn');
    dl.href = url;
    dl.download = t.titre + '.pdf';
    return;
  }

  if (t.status === 'error') {
    showPanel('error');
    document.getElementById('errorText').textContent = t.error || 'Erreur inconnue.';
    return;
  }

  showPanel('progress');
  document.getElementById('progressTitle').textContent = t.titre;
  document.getElementById('progressText').textContent =
    s.cls === 'processing' ? `Traduction — ${s.label}` : 'Initialisation…';
  document.getElementById('progressFill').style.width = s.pct + '%';
  document.getElementById('progressPct').textContent  = s.pct + ' %';
}
