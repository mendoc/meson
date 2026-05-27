import { state } from './state.js';
import { loadList } from './sidebar.js';
import { updateActivePanel } from './panels.js';

export function schedulePoll() {
  if (state.pollTimer) clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    const data = await loadList();
    if (state.activeId) {
      const active = data.find(t => t.id === state.activeId);
      if (active) updateActivePanel(active);
    }
    const busy = data.some(t =>
      t.status === 'pending' || t.status === 'recompiling' || t.status.startsWith('processing'));
    if (!busy) { clearInterval(state.pollTimer); state.pollTimer = null; }
  }, 3000);
}

export async function selectItem(id) {
  state.activeId = id;
  const res = await fetch(`/api/translations/${id}`);
  if (!res.ok) return;
  updateActivePanel(await res.json());
  schedulePoll();
  // Rafraîchir la sidebar pour mettre à jour le surligné actif
  await loadList();
}
