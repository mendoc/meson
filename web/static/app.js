import './modules/theme.js';
import './modules/upload.js';
import './modules/settings.js';
import './modules/recompile.js';
import { loadList } from './modules/sidebar.js';
import { selectItem } from './modules/poll.js';
import { deleteTranslation } from './modules/modal.js';
import { showPanel } from './modules/panels.js';

// Délégation d'événements pour la sidebar — évite les onclick inline
document.getElementById('translationList').addEventListener('click', e => {
  const btn = e.target.closest('[data-delete]');
  if (btn) {
    e.stopPropagation();
    deleteTranslation(+btn.dataset.delete, btn.dataset.titre);
    return;
  }
  const li = e.target.closest('li[data-id]');
  if (li) selectItem(+li.dataset.id);
});

(async () => {
  const data = await loadList();
  if (data?.length) await selectItem(data[0].id);
  else showPanel('upload');
})();
