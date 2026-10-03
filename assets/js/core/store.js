/**
 * Hockey365 Local Store & User Preferences
 */

const STORAGE_KEY = 'hockey365_user_store_v1';

const defaultState = {
  theme: 'dark',
  timezone: 'Europe/Moscow',
  favorites: {
    teams: [],
    leagues: ['KHL', 'NHL'],
    matches: []
  },
  customApiKey: '',
  notificationsEnabled: false,
  soundEnabled: true
};

function normalizeState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const favorites = value.favorites && typeof value.favorites === 'object' && !Array.isArray(value.favorites) ? value.favorites : {};
  const validFavorites = {};
  for (const key of ['teams', 'leagues', 'matches']) {
    validFavorites[key] = Array.isArray(favorites[key])
      ? [...new Set(favorites[key].filter(id => typeof id === 'string'))]
      : [...defaultState.favorites[key]];
  }
  return {
    theme: ['dark', 'light', 'auto'].includes(value.theme) ? value.theme : defaultState.theme,
    timezone: ['Europe/Moscow', 'UTC', 'local'].includes(value.timezone) ? value.timezone : defaultState.timezone,
    favorites: validFavorites,
    customApiKey: typeof value.customApiKey === 'string' ? value.customApiKey : '',
    notificationsEnabled: value.notificationsEnabled === true,
    soundEnabled: value.soundEnabled !== false
  };
}

class Store {
  constructor() {
    this.state = this._load();
    this.listeners = new Set();
    this.applyTheme(this.state.theme);
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.state.theme === 'auto') this.applyTheme('auto');
    });
  }

  _load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return normalizeState(JSON.parse(saved)) || normalizeState(defaultState);
      }
    } catch (e) {
      console.warn('Failed to load store from localStorage', e);
    }
    return normalizeState(defaultState);
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn('Failed to save store to localStorage', e);
    }
    this._notify();
  }

  _notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (e) {
        console.error('Store listener error', e);
      }
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getTheme() {
    return this.state.theme;
  }

  setTheme(theme) {
    this.state.theme = theme;
    this.applyTheme(theme);
    this._save();
  }

  applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }

  getTimezone() {
    return this.state.timezone || 'Europe/Moscow';
  }

  setTimezone(tz) {
    this.state.timezone = tz;
    this._save();
  }

  isFavorite(type, id) {
    const list = this.state.favorites[type] || [];
    return list.includes(id);
  }

  toggleFavorite(type, id) {
    if (!this.state.favorites[type]) {
      this.state.favorites[type] = [];
    }
    const idx = this.state.favorites[type].indexOf(id);
    if (idx >= 0) {
      this.state.favorites[type].splice(idx, 1);
    } else {
      this.state.favorites[type].push(id);
    }
    this._save();
    return this.isFavorite(type, id);
  }

  isSoundEnabled() {
    return this.state.soundEnabled !== false;
  }

  setSoundEnabled(val) {
    this.state.soundEnabled = Boolean(val);
    this._save();
    this.listeners.forEach(cb => cb(this.state));
  }

  toggleSound() {
    this.setSoundEnabled(!this.isSoundEnabled());
    return this.isSoundEnabled();
  }

  exportData() {
    // Legacy API keys are local-only and are not used by the static site.
    return JSON.stringify({ ...this.state, customApiKey: '' }, null, 2);
  }

  importData(jsonString) {
    try {
      const raw = JSON.parse(jsonString);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
          !['theme', 'timezone', 'favorites'].some(key => Object.hasOwn(raw, key)) ||
          (raw.theme !== undefined && !['dark', 'light', 'auto'].includes(raw.theme)) ||
          (raw.timezone !== undefined && !['Europe/Moscow', 'UTC', 'local'].includes(raw.timezone)) ||
          (raw.favorites !== undefined && (!raw.favorites || typeof raw.favorites !== 'object' || Array.isArray(raw.favorites) ||
            ['teams', 'leagues', 'matches'].some(key => raw.favorites[key] !== undefined &&
              (!Array.isArray(raw.favorites[key]) || raw.favorites[key].some(id => typeof id !== 'string')))))) return false;
      const parsed = normalizeState(raw);
      if (!parsed) return false;
      this.state = parsed;
      this.applyTheme(this.state.theme);
      this._save();
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
}

export const store = new Store();
