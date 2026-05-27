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

const $viewerTitle    = document.getElementById('viewerTitle');
const $viewerStatus   = document.getElementById('viewerStatusText');
const $viewerSpinner  = document.getElementById('viewerSpinner');
const $viewerProgress = document.getElementById('viewerProgressContainer');
const $viewerBar      = document.getElementById('viewerProgressBar');
const $pdfFrame       = document.getElementById('pdfFrame');
const $downloadBtn    = document.getElementById('downloadBtn');

export function updateActivePanel(t) {
  if (t.status === 'error') {
    showPanel('error');
    document.getElementById('errorText').textContent = t.error || 'Erreur inconnue.';
    return;
  }

  if (t.status === 'done') {
    _showViewer(t, false);
    return;
  }

  // processing:N/M avec N >= 1 — basculer sur le viewer avec le PDF partiel
  const m = t.status.match(/^processing:(\d+)\/(\d+)$/);
  if (m && +m[1] >= 1) {
    _showViewer(t, true, +m[1], +m[2]);
    return;
  }

  // pending / processing sans numéro (initialisation, page 1 pas encore finie)
  showPanel('progress');
  document.getElementById('progressTitle').textContent = `${t.titre} — ${t.auteur}`;
}

function _showViewer(t, processing, n = 0, total = 0) {
  showPanel('viewer');
  $viewerTitle.textContent = t.titre;

  if (processing) {
    $viewerStatus.textContent  = `En cours — Page ${n} / ${total}`;
    $viewerStatus.className    = 'text-xs text-brand-600 mt-0.5';
    $viewerSpinner.classList.remove('hidden');
    $viewerProgress.classList.remove('hidden');
    $viewerBar.style.width     = Math.round(n / total * 100) + '%';
    $downloadBtn.classList.add('hidden');

    // Recharger l'iframe uniquement quand un nouveau partiel est compilé
    // (toutes les 5 pages, discriminant = Math.floor(N/5))
    const group = Math.floor(n / 5);
    const url   = `/api/output/${t.id}/partial?g=${group}`;
    if ($pdfFrame.dataset.partialUrl !== url) {
      $pdfFrame.dataset.partialUrl = url;
      $pdfFrame.src = url;
    }
  } else {
    $viewerStatus.textContent  = 'Traduction terminée';
    $viewerStatus.className    = 'text-xs text-stone-500 dark:text-stone-400 mt-0.5';
    $viewerSpinner.classList.add('hidden');
    $viewerProgress.classList.add('hidden');
    $downloadBtn.classList.remove('hidden');

    const url = `/api/output/${t.id}`;
    if (!$pdfFrame.src.endsWith(url) || $pdfFrame.dataset.partialUrl) {
      $pdfFrame.src = url;
      delete $pdfFrame.dataset.partialUrl;
    }
    $downloadBtn.href     = url;
    $downloadBtn.download = t.titre + '.pdf';
  }
}
