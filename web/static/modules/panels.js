import { parseStatus } from './utils.js';

let _prevStatus  = '';
let _currentPage = 1;
let _currentTid  = null;

export function setCurrentPage(n) { _currentPage = n; }

const _MODEL_LABELS = {
  'claude-opus-4-7':           'Opus 4.7',
  'claude-sonnet-4-6':         'Sonnet 4.6',
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
};
const _POLICE_LABELS = {
  crimson_pro: 'Crimson Pro', lora: 'Lora',
  eb_garamond: 'EB Garamond', sabon: 'Sabon', minion_pro: 'Minion Pro',
};
const _THEME_LABELS = { standard: 'Standard', oreilly: "O'Reilly" };

function _updateMeta(t) {
  const $meta = document.getElementById('viewerMeta');
  if (!$meta) return;
  const parts = [];
  if (t.model)   parts.push(_MODEL_LABELS[t.model]  || t.model);
  if (t.police)  parts.push(_POLICE_LABELS[t.police] || t.police);
  if (t.theme)   parts.push(_THEME_LABELS[t.theme]   || t.theme);
  if (t.page_range) parts.push(`Pages ${t.page_range}`);
  if (t.prompt_custom) parts.push(`"${t.prompt_custom.slice(0, 40)}${t.prompt_custom.length > 40 ? '…' : ''}"`);
  if (parts.length) {
    $meta.textContent = parts.join(' · ');
    $meta.classList.remove('hidden');
  } else {
    $meta.classList.add('hidden');
  }
}

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

// Lit le numéro de page courant depuis le hash de l'iframe.
// Chrome et Firefox mettent à jour le hash de l'iframe quand l'utilisateur
// navigue dans le PDF (ex : #page=7).
setInterval(() => {
  try {
    const hash = $pdfFrame.contentWindow?.location?.hash ?? '';
    const m = hash.match(/#page=(\d+)/i);
    if (m) _currentPage = parseInt(m[1], 10);
  } catch {}
}, 1500);

export function updateActivePanel(t) {
  if (t.status === 'error') {
    _prevStatus = 'error';
    showPanel('error');
    document.getElementById('errorText').textContent = t.error || 'Erreur inconnue.';
    return;
  }

  // Réinitialise la page courante quand on change de traduction
  if (t.id !== _currentTid) {
    _currentPage = 1;
    _currentTid  = t.id;
  }

  if (t.status === 'done') {
    const wasRecompiling = _prevStatus === 'recompiling';
    _prevStatus = 'done';
    _showViewer(t, 'done', 0, 0, wasRecompiling);
    return;
  }

  if (t.status === 'recompiling') {
    _prevStatus = 'recompiling';
    _showViewer(t, 'recompiling');
    return;
  }

  const m = t.status.match(/^processing:(\d+)\/(\d+)$/);
  if (m && +m[1] >= 1) {
    _prevStatus = 'processing';
    _showViewer(t, 'processing', +m[1], +m[2]);
    return;
  }

  _prevStatus = 'pending';
  showPanel('progress');
  const _titre  = t.titre  || 'Analyse en cours…';
  const _auteur = t.auteur || '';
  document.getElementById('progressTitle').textContent = _auteur ? `${_titre} — ${_auteur}` : _titre;
}

function _showViewer(t, mode, n = 0, total = 0, forceReload = false) {
  showPanel('viewer');
  $viewerTitle.textContent = t.titre || 'Analyse en cours…';

  const $btnRecompile   = document.getElementById('btnRecompile');
  const $btnPages       = document.getElementById('btnPages');
  const $recompilePanel = document.getElementById('recompilePanel');

  if (mode === 'processing') {
    $viewerStatus.textContent = `En cours — Page ${n} / ${total}`;
    $viewerStatus.className   = 'text-xs text-brand-600 mt-0.5';
    $viewerSpinner.classList.remove('hidden');
    $viewerProgress.classList.remove('hidden');
    $viewerBar.style.width    = Math.round(n / total * 100) + '%';
    $downloadBtn.classList.add('hidden');
    $btnRecompile?.classList.add('hidden');
    $btnPages?.classList.add('hidden');
    $recompilePanel?.classList.add('hidden');

    const group = Math.floor(n / 5);
    const url   = `/api/output/${t.id}/partial?g=${group}`;
    if ($pdfFrame.dataset.partialUrl !== url) {
      $pdfFrame.dataset.partialUrl = url;
      $pdfFrame.src = url;
    }

  } else if (mode === 'recompiling') {
    $viewerStatus.textContent = 'Recompilation en cours…';
    $viewerStatus.className   = 'text-xs text-brand-600 mt-0.5';
    $viewerSpinner.classList.remove('hidden');
    $viewerProgress.classList.remove('hidden');
    $viewerBar.style.width    = '50%';
    $downloadBtn.classList.add('hidden');
    $btnRecompile?.classList.add('hidden');
    $btnPages?.classList.add('hidden');
    $recompilePanel?.classList.add('hidden');

  } else {
    // done
    $viewerStatus.textContent = 'Traduction terminée';
    $viewerStatus.className   = 'text-xs text-stone-500 dark:text-stone-400 mt-0.5';
    $viewerSpinner.classList.add('hidden');
    $viewerProgress.classList.add('hidden');
    $downloadBtn.classList.remove('hidden');
    $btnRecompile?.classList.remove('hidden');
    $btnPages?.classList.remove('hidden');
    _updateMeta(t);

    const baseUrl = `/api/output/${t.id}`;
    const url     = baseUrl;

    if (forceReload || !$pdfFrame.src.includes(baseUrl) || $pdfFrame.dataset.partialUrl) {
      // Recharge le PDF en positionnant sur la page que l'utilisateur lisait
      $pdfFrame.src = `${baseUrl}?v=${Date.now()}#page=${_currentPage}`;
      delete $pdfFrame.dataset.partialUrl;
    }
    $downloadBtn.href     = url;
    $downloadBtn.download = `${t.titre}.pdf`;
  }
}
