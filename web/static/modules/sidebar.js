import { parseStatus, BADGE, formatDate, esc } from './utils.js';
import { state } from './state.js';

const $list = document.getElementById('translationList');

export function renderList(translations) {
  if (!translations.length) {
    $list.innerHTML = '<li class="px-4 py-8 text-sm text-stone-400 dark:text-stone-500 text-center italic">Aucune traduction pour l\'instant.</li>';
    return;
  }
  $list.innerHTML = translations.map(t => {
    const s      = parseStatus(t.status);
    const badge  = BADGE[s.cls] ?? 'bg-gray-100 text-gray-600';
    const active = t.id === state.activeId
      ? 'bg-indigo-50 dark:bg-stone-700 border-l-4 border-brand-600'
      : 'border-l-4 border-transparent hover:bg-stone-100 dark:hover:bg-stone-800';
    return `
      <li class="group relative px-4 py-3 cursor-pointer transition-colors ${active}" data-id="${t.id}">
        <p class="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate pr-6">${esc(t.titre)}</p>
        <p class="text-xs text-stone-500 dark:text-stone-300 truncate">${esc(t.auteur)}</p>
        <div class="flex items-center gap-2 mt-1.5">
          ${s.cls === 'done' && t.page_count
            ? `<span class="text-xs text-stone-400">${t.page_count} p.</span>`
            : `<span class="text-xs font-semibold px-2 py-0.5 rounded-full ${badge}">${s.label}</span>`}
          <span class="text-xs text-stone-400">${formatDate(t.created_at)}</span>
        </div>
        ${s.cls === 'processing' && s.pct > 0 ? `
        <div class="mt-1.5 w-full bg-stone-200 dark:bg-stone-700 rounded-full h-0.5 overflow-hidden">
          <div class="h-full bg-brand-600 rounded-full transition-all" style="width:${s.pct}%"></div>
        </div>` : ''}
        <button
          class="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
          title="Supprimer"
          data-delete="${t.id}"
          data-titre="${esc(t.titre)}">
          <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </li>`;
  }).join('');
}

export async function loadList() {
  const res = await fetch('/api/translations');
  if (!res.ok) return [];
  const data = await res.json();
  renderList(data);
  return data;
}
