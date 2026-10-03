/**
 * Hockey365 Settings Page Logic
 */

import { qs, el } from '../core/dom.js';
import { store } from '../core/store.js';

export function initSettingsPage() {
  const themeSelect = qs('#theme-select');
  const timezoneSelect = qs('#timezone-select');
  const apiKeyInput = qs('#custom-api-key');
  const exportBtn = qs('#export-settings-btn');
  const importInput = qs('#import-file-input');
  const statusMsg = qs('#settings-status');

  if (themeSelect) {
    themeSelect.value = store.getTheme();
    themeSelect.addEventListener('change', (e) => {
      store.setTheme(e.target.value);
      showStatus('Тема сохранена!');
    });
  }

  if (timezoneSelect) {
    timezoneSelect.value = store.getTimezone();
    timezoneSelect.addEventListener('change', (e) => {
      store.setTimezone(e.target.value);
      showStatus('Часовой пояс сохранен!');
    });
  }

  if (apiKeyInput) {
    apiKeyInput.value = store.state.customApiKey || '';
    apiKeyInput.addEventListener('change', (e) => {
      store.state.customApiKey = e.target.value.trim();
      store._save();
      showStatus('Ключ API сохранен в локальном хранилище!');
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(store.exportData());
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'hockey365-settings.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showStatus('Настройки успешно экспортированы!');
    });
  }

  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const success = store.importData(event.target.result);
        if (success) {
          showStatus('Настройки успешно импортированы! Перезагрузка...');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          showStatus('Ошибка при чтении файла настроек.');
        }
      };
      reader.readAsText(file);
    });
  }

  function showStatus(text) {
    if (!statusMsg) return;
    statusMsg.textContent = text;
    statusMsg.style.display = 'block';
    setTimeout(() => {
      statusMsg.style.display = 'none';
    }, 3500);
  }
}
