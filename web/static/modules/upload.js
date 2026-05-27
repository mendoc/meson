import { state } from './state.js';
import { showPanel } from './panels.js';
import { loadList } from './sidebar.js';
import { updateActivePanel } from './panels.js';
import { schedulePoll } from './poll.js';

const $dropzone   = document.getElementById('dropzone');
const $fileInput  = document.getElementById('fileInput');
const $browseBtn  = document.getElementById('browseBtn');
const $dropIdle   = document.getElementById('dropzoneIdle');
const $dropReady  = document.getElementById('dropzoneReady');
const $chosenFile = document.getElementById('chosenFile');
const $titre      = document.getElementById('titre');
const $auteur     = document.getElementById('auteur');
const $police     = document.getElementById('police');
const $theme      = document.getElementById('theme');
const $submitBtn  = document.getElementById('submitBtn');

function checkSubmitReady() {
  $submitBtn.disabled = !(state.selectedFile && $titre.value.trim() && $auteur.value.trim());
}

function setFile(f) {
  state.selectedFile = f;
  $chosenFile.textContent = f.name;
  $dropIdle.classList.add('hidden');
  $dropReady.classList.remove('hidden');
  $dropReady.classList.add('flex');
  checkSubmitReady();
}

function resetForm() {
  state.selectedFile = null;
  $fileInput.value   = '';
  $titre.value       = '';
  $auteur.value      = '';
  $police.value      = 'crimson_pro';
  $theme.value       = 'standard';
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
  form.append('police', $police.value);
  form.append('theme',  $theme.value);
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
