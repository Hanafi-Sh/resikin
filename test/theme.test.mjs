import test from 'node:test';
import assert from 'node:assert/strict';

import {
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  applyTheme,
  getAppliedTheme,
  getNextTheme,
  resolveStoredTheme,
} from '../src/lib/theme.mjs';

function createDocument({ datasetTheme, classes = [] } = {}) {
  const classNames = new Set(classes);

  return {
    documentElement: {
      dataset: datasetTheme ? { theme: datasetTheme } : {},
      classList: {
        contains: (className) => classNames.has(className),
      },
    },
  };
}

function createWindow({ storedTheme, prefersDark = false } = {}) {
  return {
    localStorage: {
      getItem: (key) => (key === THEME_STORAGE_KEY ? storedTheme : null),
    },
    matchMedia: () => ({ matches: prefersDark }),
  };
}

test('resolves stored theme before system preference', () => {
  const win = createWindow({ storedTheme: 'light', prefersDark: true });

  assert.equal(resolveStoredTheme(win), 'light');
});

test('reads the currently applied DOM theme before persisted preference', () => {
  const doc = createDocument({ datasetTheme: 'light' });
  const win = createWindow({ storedTheme: 'dark', prefersDark: true });

  assert.equal(getAppliedTheme(doc, win), 'light');
});

test('toggles from the applied DOM theme, not a stale stored theme', () => {
  const doc = createDocument({ datasetTheme: 'light' });
  const win = createWindow({ storedTheme: 'dark' });

  assert.equal(getNextTheme(getAppliedTheme(doc, win)), 'dark');
});

test('treats a missing DOM theme as visual light even when storage is dark', () => {
  const doc = createDocument();
  const win = createWindow({ storedTheme: 'dark' });

  assert.equal(getAppliedTheme(doc, win), 'light');
  assert.equal(getNextTheme(getAppliedTheme(doc, win)), 'dark');
});

test('applyTheme syncs the SSR theme cookie', () => {
  const classes = new Set(['light']);
  const doc = {
    cookie: '',
    documentElement: {
      dataset: { theme: 'light' },
      classList: {
        remove: (...classNames) => classNames.forEach((className) => classes.delete(className)),
        add: (className) => classes.add(className),
      },
    },
  };
  const events = [];
  const win = {
    dispatchEvent: (event) => events.push(event.type),
  };

  assert.equal(applyTheme('dark', doc, win), true);
  assert.equal(doc.documentElement.dataset.theme, 'dark');
  assert.equal(classes.has('dark'), true);
  assert.equal(doc.cookie, `${THEME_COOKIE_NAME}=dark; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`);
  assert.deepEqual(events, ['resikin-theme-change']);
});
