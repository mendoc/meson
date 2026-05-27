import { state } from './state.js';
import { showPanel } from './panels.js';
import { loadList } from './sidebar.js';

const $modal    = document.getElementById('modalDelete');
const $title    = document.getElementById('modalDeleteTitle');
const $confirm  = document.getElementById('modalDeleteConfirm');
const $cancel   = document.getElementById('modalDeleteCancel');
const $backdrop = document.getElementById('modalDeleteBackdrop');

let _resolve = null;

function _open(titre) {
  $title.textContent = `« ${titre} »`;
  $modal.classList.remove('hidden');
  $confirm.focus();
  return new Promise(resolve => { _resolve = resolve; });
}

function _close(confirmed) {
  $modal.classList.add('hidden');
  if (_resolve) { _resolve(confirmed); _resolve = null; }
}

$confirm.addEventListener('click',  () => _close(true));
$cancel.addEventListener('click',   () => _close(false));
$backdrop.addEventListener('click', () => _close(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$modal.classList.contains('hidden')) _close(false);
});

export async function deleteTranslation(id, titre) {
  if (!await _open(titre)) return;
  const res = await fetch(`/api/translations/${id}`, { method: 'DELETE' });
  if (!res.ok) { alert('Erreur lors de la suppression.'); return; }
  if (state.activeId === id) {
    state.activeId = null;
    showPanel('upload');
  }
  await loadList();
}
