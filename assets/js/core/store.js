/**
 * Hockey365 Local Store & User Preferences
 * Enforces Dark Ice Void theme permanently in accordance with Stitch Design System.
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
    theme: 'dark', // Permanently dark
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
    // Enforce dark theme immediately and permanently
    this.applyTheme('dark');
  }

  _load() {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = normalizeState(JSON.parse(saved));
          if (parsed) {
            parsed.theme = 'dark'; // Clean up any stale light preference
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load store from localStorage', e);
    }
    return normalizeState(defaultState);
  }

  _save() {
    try {
      this.state.theme = 'dark';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      }
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
    return 'dark';
  }

  setTheme(theme) {
    // Theme is permanently locked to dark
    this.state.theme = 'dark';
    this.applyTheme('dark');
    this._save();
  }

  applyTheme(theme) {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('data-theme', 'dark');
      root.classList.add('dark');
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
    return JSON.stringify({ ...this.state, customApiKey: '' }, null, 2);
  }

  importData(jsonString) {
    try {
      const raw = JSON.parse(jsonString);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
      const parsed = normalizeState(raw);
      if (!parsed) return false;
      parsed.theme = 'dark';
      this.state = parsed;
      this.applyTheme('dark');
      this._save();
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  }
}

export const store = new Store();
