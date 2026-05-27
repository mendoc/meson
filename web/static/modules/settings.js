import { showPanel, currentPanel } from './panels.js';
import { state } from './state.js';
import { esc } from './utils.js';

const $apiKey    = document.getElementById('settingsApiKey');
const $model     = document.getElementById('settingsModel');
const $verify    = document.getElementById('settingsVerifyBtn');
const $keyStatus = document.getElementById('settingsKeyStatus');
const $keyHint   = document.getElementById('settingsKeyHint');
const $clearKey  = document.getElementById('settingsClearKeyBtn');
const $save      = document.getElementById('settingsSaveBtn');
const $cancel    = document.getElementById('settingsCancelBtn');

async function loadSettings() {
  const res = await fetch('/api/settings');
  if (!res.ok) return;
  const s = await res.json();

  $model.innerHTML = (s.models || []).map(m =>
    `<option value="${esc(m.id)}"${m.id === s.model ? ' selected' : ''}>${esc(m.label)}</option>`
  ).join('');

  $apiKey.value       = '';
  $apiKey.placeholder = s.has_api_key ? s.api_key_hint : 'sk-ant-…';
  $keyHint.textContent = s.has_api_key
    ? `Clé en place : ${s.api_key_hint}`
    : 'Aucune clé configurée — la variable LLM_API_KEY sera utilisée en fallback.';
  $clearKey.classList.toggle('hidden', !s.has_api_key);
  _setStatus(null);
}

function _setStatus(state) {
  $keyStatus.classList.remove('hidden', 'flex');
  if (state === null) { $keyStatus.innerHTML = ''; return; }
  $keyStatus.classList.add('flex');
  const variants = {
    valid:    `<span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></span><span class="text-emerald-700 dark:text-emerald-400">Clé valide</span>`,
    invalid:  `<span class="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></span><span class="text-red-600 dark:text-red-400" id="settingsKeyErrMsg"></span>`,
    checking: `<span class="w-3 h-3 border-2 border-stone-300 border-t-brand-600 rounded-full animate-spin flex-shrink-0"></span><span class="text-stone-400">Vérification…</span>`,
  };
  $keyStatus.innerHTML = variants[state] ?? '';
}

$verify.addEventListener('click', async () => {
  const newKey = $apiKey.value.trim();
  if (newKey) {
    await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_key: newKey }) });
  }
  _setStatus('checking');
  $verify.disabled = true;
  const res = await fetch('/api/settings/verify', { method: 'POST' });
  $verify.disabled = false;
  if (!res.ok) { _setStatus('invalid'); return; }
  const data = await res.json();
  _setStatus(data.valid ? 'valid' : 'invalid');
  if (!data.valid) {
    const msg = document.getElementById('settingsKeyErrMsg');
    if (msg) msg.textContent = data.error || 'Clé invalide.';
  } else {
    await loadSettings();
  }
});

$clearKey.addEventListener('click', async () => {
  await fetch('/api/settings/api_key', { method: 'DELETE' });
  await loadSettings();
});

$save.addEventListener('click', async () => {
  const body = { model: $model.value };
  const newKey = $apiKey.value.trim();
  if (newKey) body.api_key = newKey;
  await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await loadSettings();
  showPanel(state.prevPanel);
});

$cancel.addEventListener('click', () => showPanel(state.prevPanel));

document.getElementById('btnSettings').addEventListener('click', () => {
  const panel = currentPanel();
  if (panel !== 'settings') state.prevPanel = panel;
  loadSettings();
  showPanel('settings');
});
