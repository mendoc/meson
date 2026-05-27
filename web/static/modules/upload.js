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
const $promptCustom  = document.getElementById('promptCustom');
const $submitBtn     = document.getElementById('submitBtn');

function _validateRange(str) {
  for (const part of str.split(',')) {
    const t = part.trim();
    if (t === '') continue;
    if (!/^(\d+-\d+|\d+)$/.test(t)) return false;
  }
  return true;
}

function updateRangeHint() {
  const val = $pageRange.value.trim();
  if (!val) {
    $pageRangeHint.textContent = 'Toutes les pages';
    $pageRangeHint.className = 'text-xs text-stone-400 dark:text-stone-500 whitespace-nowrap min-w-[7rem] text-right';
    return;
  }
  if (!_validateRange(val)) {
    $pageRangeHint.textContent = 'Format invalide';
    $pageRangeHint.className = 'text-xs text-red-500 whitespace-nowrap min-w-[7rem] text-right';
  } else {
    $pageRangeHint.textContent = '';
    $pageRangeHint.className = '';
  }
}

$pageRange.addEventListener('input', updateRangeHint);

function checkSubmitReady() {
  $submitBtn.disabled = !state.selectedFile;
}

function setFile(f) {
  state.selectedFile = f;
  $chosenFile.textContent = f.name;
  $dropIdle.classList.add('hidden');
  $dropReady.classList.remove('hidden');
  $dropReady.classList.add('flex');
  $pageRange.disabled = false;
  updateRangeHint();
  checkSubmitReady();
}

function resetForm() {
  state.selectedFile    = null;
  $fileInput.value      = '';
  $titre.value          = '';
  $auteur.value         = '';
  $pageRange.value      = '';
  $pageRange.disabled   = true;
  $pageRangeHint.textContent = '';
  $dropIdle.classList.remove('hidden');
  $dropReady.classList.add('hidden');
  $dropReady.classList.remove('flex');
  _loadPrefs();
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

const _LS_KEY = 'meson_form_prefs';

function _savePrefs() {
  localStorage.setItem(_LS_KEY, JSON.stringify({
    police:       $police.value,
    theme:        $theme.value,
    promptCustom: $promptCustom.value.trim(),
  }));
}

function _loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(_LS_KEY) || '{}');
    if (p.police)       $police.value       = p.police;
    if (p.theme)        $theme.value        = p.theme;
    if (p.promptCustom) $promptCustom.value = p.promptCustom;
  } catch {}
}

_loadPrefs();

$submitBtn.addEventListener('click', async () => {
  if (!state.selectedFile) return;
  _savePrefs();
  const form = new FormData();
  form.append('file',   state.selectedFile);
  form.append('titre',  $titre.value.trim());
  form.append('auteur', $auteur.value.trim());
  form.append('police',        $police.value);
  form.append('theme',         $theme.value);
  form.append('page_range',    $pageRange.value.trim());
  form.append('prompt_custom', $promptCustom.value.trim());
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
