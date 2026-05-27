import { state } from './state.js';
import { showPanel } from './panels.js';
import { loadList } from './sidebar.js';
import { updateActivePanel } from './panels.js';
import { schedulePoll } from './poll.js';

const $dropzone    = document.getElementById('dropzone');
const $fileInput   = document.getElementById('fileInput');
const $browseBtn   = document.getElementById('browseBtn');
const $dropIdle    = document.getElementById('dropzoneIdle');
const $dropReady   = document.getElementById('dropzoneReady');
const $chosenFile  = document.getElementById('chosenFile');
const $titre       = document.getElementById('titre');
const $auteur      = document.getElementById('auteur');
const $police      = document.getElementById('police');
const $theme       = document.getElementById('theme');
const $pageRange     = document.getElementById('pageRange');
const $pageRangeHint = document.getElementById('pageRangeHint');
const $submitBtn     = document.getElementById('submitBtn');

let _pageTotal = 0;

function parsePageRange(str, total) {
  const pages = new Set();
  for (const part of str.split(',')) {
    const t = part.trim();
    const range = t.match(/^(\d+)-(\d+)$/);
    if (range) {
      const a = +range[1], b = +range[2];
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) pages.add(i);
    } else if (/^\d+$/.test(t)) {
      pages.add(+t);
    } else if (t !== '') {
      return null; // syntaxe invalide
    }
  }
  return [...pages].filter(p => p >= 1 && p <= total).sort((a, b) => a - b);
}

function updateRangeHint() {
  if (!_pageTotal) return;
  const val = $pageRange.value.trim();
  if (!val) {
    $pageRangeHint.textContent = `${_pageTotal} pages`;
    $pageRangeHint.className = 'text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap min-w-[7rem] text-right';
    return;
  }
  const pages = parsePageRange(val, _pageTotal);
  if (!pages) {
    $pageRangeHint.textContent = 'Format invalide';
    $pageRangeHint.className = 'text-xs text-red-500 whitespace-nowrap min-w-[7rem] text-right';
  } else {
    $pageRangeHint.textContent = `${pages.length} page${pages.length > 1 ? 's' : ''}`;
    $pageRangeHint.className = 'text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap min-w-[7rem] text-right';
  }
}

$pageRange.addEventListener('input', updateRangeHint);

function checkSubmitReady() {
  $submitBtn.disabled = !(state.selectedFile && $titre.value.trim() && $auteur.value.trim());
}

async function setFile(f) {
  state.selectedFile = f;
  $chosenFile.textContent = f.name;
  $dropIdle.classList.add('hidden');
  $dropReady.classList.remove('hidden');
  $dropReady.classList.add('flex');

  // Inspecter le PDF pour obtenir le nombre de pages
  try {
    const form = new FormData();
    form.append('file', f);
    const res = await fetch('/api/inspect', { method: 'POST', body: form });
    if (res.ok) {
      const { page_count } = await res.json();
      _pageTotal = page_count;
      $pageRange.value    = `1-${page_count}`;
      $pageRange.disabled = false;
      updateRangeHint();
    }
  } catch { /* non bloquant */ }

  checkSubmitReady();
}

function resetForm() {
  state.selectedFile    = null;
  _pageTotal            = 0;
  $fileInput.value      = '';
  $titre.value          = '';
  $auteur.value         = '';
  $police.value         = 'crimson_pro';
  $theme.value          = 'standard';
  $pageRange.value      = '';
  $pageRange.disabled   = true;
  $pageRangeHint.textContent = '';
  $dropIdle.classList.remove('hidden');
  $dropReady.classList.add('hidden');
  $dropReady.classList.remove('flex');
  checkSubmitReady();
}

$dropzone.addEventListener('dragover',  e => { e.preventDefault(); $dropzone.classList.add('border-blue-400', 'bg-blue-50'); });
$dropzone.addEventListener('dragleave', ()  => $dropzone.classList.remove('border-blue-400', 'bg-blue-50'));
$dropzone.addEventListener('drop', e => {
  e.preventDefault();
  $dropzone.classList.remove('border-blue-400', 'bg-blue-50');
  const f = e.dataTransfer.files[0];
  if (f?.type === 'application/pdf') setFile(f);
});
$dropzone.addEventListener('click', () => $fileInput.click());
$browseBtn.addEventListener('click', e => { e.stopPropagation(); $fileInput.click(); });
$fileInput.addEventListener('change', () => { if ($fileInput.files[0]) setFile($fileInput.files[0]); });
$titre.addEventListener('input', checkSubmitReady);
$auteur.addEventListener('input', checkSubmitReady);

$submitBtn.addEventListener('click', async () => {
  if (!state.selectedFile) return;
  const form = new FormData();
  form.append('file',   state.selectedFile);
  form.append('titre',  $titre.value.trim());
  form.append('auteur', $auteur.value.trim());
  form.append('police',     $police.value);
  form.append('theme',      $theme.value);
  form.append('page_range', $pageRange.value.trim());
  $submitBtn.disabled = true;

  const res = await fetch('/api/translate', { method: 'POST', body: form });
  if (!res.ok) { alert('Erreur lors du démarrage.'); $submitBtn.disabled = false; return; }

  const { id } = await res.json();
  state.activeId = id;
  resetForm();

  await loadList();
  const tRes = await fetch(`/api/translations/${id}`);
  updateActivePanel(await tRes.json());
  schedulePoll();
});

document.getElementById('btnNew').addEventListener('click', () => {
  state.activeId = null;
  showPanel('upload');
  checkSubmitReady();
});

document.getElementById('retryBtn').addEventListener('click', () => {
  state.activeId = null;
  showPanel('upload');
  checkSubmitReady();
});
