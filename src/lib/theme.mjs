export const THEME_STORAGE_KEY = 'resikin-theme';
export const THEME_COOKIE_NAME = 'resikin-theme';
export const THEMES = ['light', 'dark'];
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isTheme(theme) {
  return THEMES.includes(theme);
}

export function getSystemTheme(win = globalThis.window) {
  if (!win?.matchMedia) return 'light';
  return win.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveStoredTheme(win = globalThis.window) {
  if (!win?.localStorage) return getSystemTheme(win);

  const storedTheme = win.localStorage.getItem(THEME_STORAGE_KEY);
  if (isTheme(storedTheme)) return storedTheme;

  return getSystemTheme(win);
}

export function getAppliedTheme(doc = globalThis.document, win = globalThis.window) {
  const appliedTheme = doc?.documentElement?.dataset?.theme;
  if (isTheme(appliedTheme)) return appliedTheme;

  const classList = doc?.documentElement?.classList;
  if (classList?.contains?.('dark')) return 'dark';
  if (classList?.contains?.('light')) return 'light';

  return 'light';
}

export function getNextTheme(currentTheme) {
  return currentTheme === 'dark' ? 'light' : 'dark';
}

export function applyTheme(theme, doc = globalThis.document, win = globalThis.window) {
  if (!isTheme(theme) || !doc?.documentElement) return false;

  doc.documentElement.classList.remove('light', 'dark');
  doc.documentElement.classList.add(theme);
  doc.documentElement.dataset.theme = theme;
  doc.cookie = `${THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  win?.dispatchEvent?.(new CustomEvent('resikin-theme-change'));

  return true;
}
