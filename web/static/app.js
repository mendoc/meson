/* ── State ───────────────────────────────────────────────────────── */
let selectedFile = null;
let activeId     = null;
let pollTimer    = null;

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

const panels = {
  upload:   document.getElementById('panelUpload'),
  progress: document.getElementById('panelProgress'),
  viewer:   document.getElementById('panelViewer'),
  error:    document.getElementById('panelError'),
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
      ? 'bg-indigo-50 border-l-4 border-brand-600'
      : 'border-l-4 border-transparent hover:bg-stone-100';
    return `
      <li class="px-4 py-3 cursor-pointer transition-colors ${active}" onclick="selectItem(${t.id})">
        <p class="text-sm font-semibold text-stone-800 truncate">${esc(t.titre)}</p>
        <p class="text-xs text-stone-500 truncate">${esc(t.auteur)}</p>
        <div class="flex items-center gap-2 mt-1.5">
          <span class="text-xs font-semibold px-2 py-0.5 rounded-full ${badge}">${s.label}</span>
          <span class="text-xs text-stone-400">${formatDate(t.created_at)}</span>
        </div>
      </li>`;
  }).join('');
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
    el.classList.toggle('bg-blue-50', isActive);
    el.classList.toggle('border-blue-600', isActive);
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

/* ── Init ────────────────────────────────────────────────────────── */
(async () => {
  const data = await loadList();
  if (data && data.length) {
    await selectItem(data[0].id);
  } else {
    showPanel('upload');
  }
})();
