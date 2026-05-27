/* ── State ───────────────────────────────────────────────────────── */
let selectedFile    = null;
let activeId        = null;
let pollTimer       = null;
let _prevPanelBeforeSettings = 'upload';

/* ── DOM refs ────────────────────────────────────────────────────── */
const $list       = document.getElementById('translationList');
const $btnNew     = document.getElementById('btnNew');
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
const $retryBtn   = document.getElementById('retryBtn');
const $btnSettings     = document.getElementById('btnSettings');
const $settingsApiKey  = document.getElementById('settingsApiKey');
const $settingsModel   = document.getElementById('settingsModel');
const $settingsVerify  = document.getElementById('settingsVerifyBtn');
const $settingsKeyStatus = document.getElementById('settingsKeyStatus');
const $settingsKeyHint = document.getElementById('settingsKeyHint');
const $settingsClearKey = document.getElementById('settingsClearKeyBtn');
const $settingsSave    = document.getElementById('settingsSaveBtn');
const $settingsCancel  = document.getElementById('settingsCancelBtn');

const panels = {
  upload:   document.getElementById('panelUpload'),
  progress: document.getElementById('panelProgress'),
  viewer:   document.getElementById('panelViewer'),
  error:    document.getElementById('panelError'),
  settings: document.getElementById('panelSettings'),
};

/* ── Panel switching (classList, pas .hidden) ────────────────────── */
function showPanel(name) {
  Object.entries(panels).forEach(([k, el]) => {
    if (k === name) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });
}

/* ── Status helpers ──────────────────────────────────────────────── */
function parseStatus(status) {
  if (status === 'pending') return { label: 'En attente',  cls: 'pending',    pct: 0 };
  if (status === 'done')    return { label: 'Terminé',     cls: 'done',       pct: 100 };
  if (status === 'error')   return { label: 'Erreur',      cls: 'error',      pct: 0 };
  const m = status.match(/^processing:(\d+)\/(\d+)$/);
  if (m) {
    const pct = Math.round((+m[1] / +m[2]) * 100);
    return { label: `Page ${m[1]} / ${m[2]}`, cls: 'processing', pct };
  }
  return { label: 'En cours…', cls: 'processing', pct: 0 };
}

const BADGE = {
  pending:    'bg-amber-100  text-amber-800  border border-amber-300',
  processing: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
  done:       'bg-emerald-100 text-emerald-800 border border-emerald-300',
  error:      'bg-red-100    text-red-800    border border-red-300',
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Sidebar ─────────────────────────────────────────────────────── */
function renderList(translations) {
  if (!translations.length) {
    $list.innerHTML = '<li class="px-4 py-8 text-sm text-gray-400 text-center">Aucune traduction pour l\'instant.</li>';
    return;
  }
  $list.innerHTML = translations.map(t => {
    const s      = parseStatus(t.status);
    const badge  = BADGE[s.cls] ?? 'bg-gray-100 text-gray-600';
    const active = t.id === activeId
      ? 'bg-indigo-50 dark:bg-stone-700 border-l-4 border-brand-600'
      : 'border-l-4 border-transparent hover:bg-stone-100 dark:hover:bg-stone-800';
    return `
      <li class="group relative px-4 py-3 cursor-pointer transition-colors ${active}" onclick="selectItem(${t.id})">
        <p class="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate pr-6">${esc(t.titre)}</p>
        <p class="text-xs text-stone-500 dark:text-stone-300 truncate">${esc(t.auteur)}</p>
        <div class="flex items-center gap-2 mt-1.5">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${badge}">${s.label}</span>
          <span class="text-xs text-stone-400">${formatDate(t.created_at)}</span>
        </div>
        <button
          class="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
          title="Supprimer"
          onclick="event.stopPropagation(); deleteTranslation(${t.id}, '${esc(t.titre)}')">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </li>`;
  }).join('');
}

/* ── Suppression ─────────────────────────────────────────────────── */
async function deleteTranslation(id, titre) {
  if (!confirm(`Supprimer « ${titre} » ?\n\nLe PDF généré sera également supprimé.`)) return;
  const res = await fetch(`/api/translations/${id}`, { method: 'DELETE' });
  if (!res.ok) { alert('Erreur lors de la suppression.'); return; }
  if (activeId === id) {
    activeId = null;
    showPanel('upload');
  }
  await loadList();
}

/* ── API calls ───────────────────────────────────────────────────── */
async function loadList() {
  const res = await fetch('/api/translations');
  if (!res.ok) return [];
  const data = await res.json();
  renderList(data);
  return data;
}

/* ── Active panel update ─────────────────────────────────────────── */
function updateActivePanel(t) {
  const s = parseStatus(t.status);

  if (t.status === 'done') {
    showPanel('viewer');
    document.getElementById('viewerTitle').textContent = t.titre;
    const url = `/api/output/${t.id}`;
    const frame = document.getElementById('pdfFrame');
    if (!frame.src.endsWith(url)) frame.src = url;
    const dl = document.getElementById('downloadBtn');
    dl.href = url;
    dl.download = t.titre + '.pdf';
    return;
  }

  if (t.status === 'error') {
    showPanel('error');
    document.getElementById('errorText').textContent = t.error || 'Erreur inconnue.';
    return;
  }

  showPanel('progress');
  document.getElementById('progressTitle').textContent = t.titre;
  document.getElementById('progressText').textContent =
    s.cls === 'processing' ? `Traduction — ${s.label}` : 'Initialisation…';
  document.getElementById('progressFill').style.width = s.pct + '%';
  document.getElementById('progressPct').textContent  = s.pct + ' %';
}

/* ── Polling ─────────────────────────────────────────────────────── */
function schedulePoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const data = await loadList();
    if (activeId) {
      const active = data.find(t => t.id === activeId);
      if (active) updateActivePanel(active);
    }
    const busy = data.some(t => t.status === 'pending' || t.status.startsWith('processing'));
    if (!busy) { clearInterval(pollTimer); pollTimer = null; }
  }, 3000);
}

async function selectItem(id) {
  activeId = id;
  document.querySelectorAll('#translationList li[onclick]').forEach(el => {
    const isActive = el.getAttribute('onclick') === `selectItem(${id})`;
    el.classList.toggle('bg-indigo-50', isActive);
    el.classList.toggle('dark:bg-stone-700', isActive);
    el.classList.toggle('border-brand-600', isActive);
    el.classList.toggle('border-transparent', !isActive);
  });
  const res = await fetch(`/api/translations/${id}`);
  if (!res.ok) return;
  updateActivePanel(await res.json());
  schedulePoll();
}

/* ── File selection ──────────────────────────────────────────────── */
function setFile(f) {
  selectedFile = f;
  $chosenFile.textContent = f.name;
  $dropIdle.classList.add('hidden');
  $dropReady.classList.remove('hidden');
  $dropReady.classList.add('flex');
  checkSubmitReady();
}

function checkSubmitReady() {
  $submitBtn.disabled = !(selectedFile && $titre.value.trim() && $auteur.value.trim());
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

/* ── Submit ──────────────────────────────────────────────────────── */
$submitBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  const form = new FormData();
  form.append('file',   selectedFile);
  form.append('titre',  $titre.value.trim());
  form.append('auteur', $auteur.value.trim());
  form.append('police', $police.value);
  form.append('theme',  $theme.value);
  $submitBtn.disabled = true;

  const res = await fetch('/api/translate', { method: 'POST', body: form });
  if (!res.ok) { alert('Erreur lors du démarrage.'); $submitBtn.disabled = false; return; }

  const { id } = await res.json();
  activeId = id;

  // reset form
  selectedFile = null;
  $fileInput.value = '';
  $titre.value = '';
  $auteur.value = '';
  $police.value = 'crimson_pro';
  $theme.value  = 'standard';
  $dropIdle.classList.remove('hidden');
  $dropReady.classList.add('hidden');
  $dropReady.classList.remove('flex');

  await loadList();
  const tRes = await fetch(`/api/translations/${id}`);
  updateActivePanel(await tRes.json());
  schedulePoll();
});

/* ── Buttons ─────────────────────────────────────────────────────── */
$btnNew.addEventListener('click', () => {
  activeId = null;
  showPanel('upload');
  checkSubmitReady();
});

$retryBtn.addEventListener('click', () => {
  activeId = null;
  showPanel('upload');
  checkSubmitReady();
});

/* ── Settings panel ──────────────────────────────────────────────── */
async function loadSettings() {
  const res = await fetch('/api/settings');
  if (!res.ok) return;
  const s = await res.json();

  // Peupler le select modèles
  $settingsModel.innerHTML = (s.models || []).map(m =>
    `<option value="${esc(m.id)}"${m.id === s.model ? ' selected' : ''}>${esc(m.label)}</option>`
  ).join('');

  // Indicateur clé
  $settingsApiKey.value = '';
  $settingsApiKey.placeholder = s.has_api_key ? s.api_key_hint : 'sk-ant-…';
  $settingsKeyHint.textContent = s.has_api_key
    ? `Clé en place : ${s.api_key_hint}`
    : 'Aucune clé configurée — la variable LLM_API_KEY sera utilisée en fallback.';
  $settingsClearKey.classList.toggle('hidden', !s.has_api_key);
  _setKeyStatus(null);
}

function _setKeyStatus(state) {
  $settingsKeyStatus.classList.remove('hidden', 'flex');
  if (state === null) { $settingsKeyStatus.innerHTML = ''; return; }
  $settingsKeyStatus.classList.add('flex');
  if (state === 'valid') {
    $settingsKeyStatus.innerHTML =
      `<span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span>
       <span class="text-emerald-700 dark:text-emerald-400">Clé valide</span>`;
  } else if (state === 'invalid') {
    $settingsKeyStatus.innerHTML =
      `<span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span>
       <span class="text-red-600 dark:text-red-400" id="settingsKeyErrMsg"></span>`;
  } else if (state === 'checking') {
    $settingsKeyStatus.innerHTML =
      `<span class="w-3 h-3 border-2 border-stone-300 border-t-brand-600 rounded-full animate-spin flex-shrink-0"></span>
       <span class="text-stone-400">Vérification…</span>`;
  }
}

$settingsVerify.addEventListener('click', async () => {
  // Si l'utilisateur a saisi une nouvelle clé, la sauvegarder d'abord
  const newKey = $settingsApiKey.value.trim();
  if (newKey) {
    await fetch('/api/settings', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ api_key: newKey }) });
  }
  _setKeyStatus('checking');
  $settingsVerify.disabled = true;
  const res = await fetch('/api/settings/verify', { method: 'POST' });
  $settingsVerify.disabled = false;
  if (!res.ok) { _setKeyStatus('invalid'); return; }
  const data = await res.json();
  _setKeyStatus(data.valid ? 'valid' : 'invalid');
  if (!data.valid) {
    const msg = document.getElementById('settingsKeyErrMsg');
    if (msg) msg.textContent = data.error || 'Clé invalide.';
  } else {
    await loadSettings();
  }
});

$settingsClearKey.addEventListener('click', async () => {
  await fetch('/api/settings/api_key', { method: 'DELETE' });
  await loadSettings();
  _setKeyStatus(null);
});

$settingsSave.addEventListener('click', async () => {
  const body = {};
  const newKey = $settingsApiKey.value.trim();
  if (newKey) body.api_key = newKey;
  body.model = $settingsModel.value;
  await fetch('/api/settings', { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  await loadSettings();
  showPanel(_prevPanelBeforeSettings);
});

$settingsCancel.addEventListener('click', () => {
  showPanel(_prevPanelBeforeSettings);
});

$btnSettings.addEventListener('click', () => {
  // Mémoriser le panel actif avant de basculer sur Settings
  const current = Object.entries(panels).find(([, el]) => !el.classList.contains('hidden'));
  if (current && current[0] !== 'settings') _prevPanelBeforeSettings = current[0];
  loadSettings();
  showPanel('settings');
});

/* ── Dark mode toggle ────────────────────────────────────────────── */
const $themeToggle   = document.getElementById('themeToggle');
const $themeModeLabel = document.getElementById('themeModeLabel');

const MODES = ['system', 'light', 'dark'];

const MODE_META = {
  light: {
    label: 'Clair',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>`,
  },
  dark: {
    label: 'Sombre',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>`,
  },
  system: {
    label: 'Auto',
    icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>`,
  },
};

let _currentMode = localStorage.getItem('colorMode') || 'system';
let _mq = window.matchMedia('(prefers-color-scheme: dark)');

function _applyMode(mode) {
  const dark = mode === 'dark' || (mode === 'system' && _mq.matches);
  document.documentElement.classList.toggle('dark', dark);
  if ($themeToggle) $themeToggle.innerHTML = MODE_META[mode].icon;
  if ($themeModeLabel) $themeModeLabel.textContent = MODE_META[mode].label;
}

function _cycleMode() {
  const idx = MODES.indexOf(_currentMode);
  _currentMode = MODES[(idx + 1) % MODES.length];
  localStorage.setItem('colorMode', _currentMode);
  _applyMode(_currentMode);
}

_applyMode(_currentMode);
if ($themeToggle) $themeToggle.addEventListener('click', _cycleMode);

_mq.addEventListener('change', () => {
  if (_currentMode === 'system') _applyMode('system');
});

/* ── Init ────────────────────────────────────────────────────────── */
(async () => {
  const data = await loadList();
  if (data && data.length) {
    await selectItem(data[0].id);
  } else {
    showPanel('upload');
  }
})();
