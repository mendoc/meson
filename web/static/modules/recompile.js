import { state } from './state.js';
import { schedulePoll } from './poll.js';
import { updateActivePanel, setCurrentPage } from './panels.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const $pdfFrame = document.getElementById('pdfFrame');

function _getPdfCurrentPage() {
  // Le visualiseur PDF du navigateur met à jour le hash de l'iframe au fil
  // de la navigation (ex: #page=7). On tente de le lire.
  try {
    const hash = $pdfFrame.contentWindow?.location?.hash ?? '';
    const m = hash.match(/[#&]page=(\d+)/i);
    if (m) return parseInt(m[1], 10);
  } catch {}
  return 1;
}

function _triggerRecompilingUI() {
  // Affiche immédiatement l'état "recompilation en cours" sans attendre le poll
  updateActivePanel({
    id:     state.activeId,
    titre:  document.getElementById('viewerTitle').textContent,
    auteur: '',
    status: 'recompiling',
  });
}

// ── Panneau recompilation ─────────────────────────────────────────────────────

const $btnRecompile    = document.getElementById('btnRecompile');
const $recompilePanel  = document.getElementById('recompilePanel');
const $recompilePolice = document.getElementById('recompilePolice');
const $recompileTheme  = document.getElementById('recompileTheme');
const $recompileSubmit = document.getElementById('recompileSubmit');
const $recompileError  = document.getElementById('recompileError');

$btnRecompile.addEventListener('click', () => {
  $recompilePanel.classList.toggle('hidden');
  if (!$recompilePanel.classList.contains('hidden')) _syncCurrentParams();
});

async function _syncCurrentParams() {
  if (!state.activeId) return;
  const res = await fetch(`/api/translations/${state.activeId}`);
  if (!res.ok) return;
  const t = await res.json();
  $recompilePolice.value = t.police || 'crimson_pro';
  $recompileTheme.value  = t.theme  || 'standard';
}

$recompileSubmit.addEventListener('click', async () => {
  if (!state.activeId) return;
  $recompileError.classList.add('hidden');
  $recompileSubmit.disabled    = true;
  $recompileSubmit.textContent = 'Lancement…';

  const res = await fetch(`/api/translations/${state.activeId}/recompile`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ police: $recompilePolice.value, theme: $recompileTheme.value }),
  });

  $recompileSubmit.disabled    = false;
  $recompileSubmit.textContent = 'Lancer la recompilation';

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    $recompileError.textContent = err.detail || 'Erreur lors de la recompilation.';
    $recompileError.classList.remove('hidden');
    return;
  }

  _triggerRecompilingUI();
  $recompilePanel.classList.add('hidden');
  schedulePoll();
});

// ── Modale d'édition de page ──────────────────────────────────────────────────

const $modal         = document.getElementById('modalPageEditor');
const $backdrop      = document.getElementById('modalPageEditorBackdrop');
const $btnClose      = document.getElementById('modalPageEditorClose');
const $pageInput     = document.getElementById('editorPageInput');
const $loadBtn       = document.getElementById('editorLoadBtn');
const $editorCode    = document.getElementById('editorCode');
const $editorStatus  = document.getElementById('editorStatus');
const $saveBtn       = document.getElementById('editorSaveBtn');
const $saveRecompile = document.getElementById('editorSaveRecompileBtn');
const $btnPages      = document.getElementById('btnPages');

let _loadedPage = null; // numéro 0-based actuellement chargé dans l'éditeur

async function _loadPage(pageNum1Based) {
  if (!state.activeId || isNaN(pageNum1Based)) return;
  const pageNum0 = pageNum1Based - 1; // conversion vers l'index DB (0-based)

  $editorStatus.textContent = 'Chargement…';
  $saveBtn.disabled = true;
  $saveRecompile.disabled = true;

  const res = await fetch(`/api/translations/${state.activeId}/pages`);
  if (!res.ok) { $editorStatus.textContent = 'Impossible de charger les pages.'; return; }

  const pages = await res.json();
  const page  = pages.find(p => p.page_number === pageNum0);
  if (!page) {
    const available = pages.map(p => p.page_number + 1).join(', '); // affichage 1-based
    $editorStatus.textContent = `Page ${pageNum1Based} introuvable. Pages disponibles : ${available}.`;
    return;
  }

  _loadedPage = pageNum0;
  setCurrentPage(pageNum1Based); // mémorise la position pour le rechargement post-recompilation
  $editorCode.value = page.typst_code;
  $editorStatus.textContent = `Page ${pageNum1Based} chargée.`;
  $saveBtn.disabled = false;
  $saveRecompile.disabled = false;
}

function _openModal() {
  $modal.classList.remove('hidden');
  _loadedPage = null;
  $editorCode.value = '';
  $editorStatus.textContent = '';
  $saveBtn.disabled = true;
  $saveRecompile.disabled = true;

  const currentPage = _getPdfCurrentPage();
  $pageInput.value = currentPage;
  $pageInput.focus();
  _loadPage(currentPage);
}

function _closeModal() { $modal.classList.add('hidden'); }

$btnPages.addEventListener('click', _openModal);
$btnClose.addEventListener('click', _closeModal);
$backdrop.addEventListener('click', _closeModal);

$loadBtn.addEventListener('click', () => _loadPage(parseInt($pageInput.value, 10)));

// Validation par la touche Entrée dans le champ de numéro de page
$pageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') _loadPage(parseInt($pageInput.value, 10));
});

async function _savePage() {
  if (_loadedPage === null || !state.activeId) return false;
  const res = await fetch(`/api/translations/${state.activeId}/pages/${_loadedPage}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ typst_code: $editorCode.value }),
  });
  if (!res.ok) { $editorStatus.textContent = 'Erreur lors de la sauvegarde.'; return false; }
  $editorStatus.textContent = `Page ${_loadedPage + 1} sauvegardée.`; // affichage 1-based
  return true;
}

$saveBtn.addEventListener('click', async () => {
  $saveBtn.disabled = true;
  await _savePage();
  $saveBtn.disabled = false;
});

$saveRecompile.addEventListener('click', async () => {
  $saveBtn.disabled = true;
  $saveRecompile.disabled = true;

  const ok = await _savePage();
  if (ok) {
    const res = await fetch(`/api/translations/${state.activeId}/recompile`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({}),
    });
    if (res.ok) {
      _triggerRecompilingUI();
      _closeModal();
      schedulePoll();
    } else {
      $editorStatus.textContent = 'Erreur lors du lancement de la recompilation.';
    }
  }

  $saveBtn.disabled = false;
  $saveRecompile.disabled = false;
});
