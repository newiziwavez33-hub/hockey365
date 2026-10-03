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
  notificationsEnabled: false
};

class Store {
  constructor() {
    this.state = this._load();
    this.listeners = new Set();
    this.applyTheme(this.state.theme);
  }

  _load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultState, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load store from localStorage', e);
    }
    return { ...defaultState };
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

  exportData() {
    return JSON.stringify(this.state, null, 2);
  }

  importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      this.state = { ...defaultState, ...parsed };
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
