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

const $toggle = document.getElementById('themeToggle');
const $label  = document.getElementById('themeModeLabel');
const _mq     = window.matchMedia('(prefers-color-scheme: dark)');
let _mode     = localStorage.getItem('colorMode') || 'system';

function _apply(mode) {
  const dark = mode === 'dark' || (mode === 'system' && _mq.matches);
  document.documentElement.classList.toggle('dark', dark);
  if ($toggle) $toggle.innerHTML = MODE_META[mode].icon;
  if ($label)  $label.textContent = MODE_META[mode].label;
}

_apply(_mode);
if ($toggle) $toggle.addEventListener('click', () => {
  _mode = MODES[(MODES.indexOf(_mode) + 1) % MODES.length];
  localStorage.setItem('colorMode', _mode);
  _apply(_mode);
});
_mq.addEventListener('change', () => { if (_mode === 'system') _apply('system'); });
