/**
 * Hockey365 Accessible Tabs Component
 */

import { el } from '../core/dom.js';

export function createTabs(tabsConfig, activeTabId, onTabChange) {
  const nav = el('div', { className: 'tabs-nav', role: 'tablist', 'aria-label': 'Разделы страницы' });

  for (const tab of tabsConfig) {
    const isActive = tab.id === activeTabId;
    const btn = el('button', {
      className: `tab-btn ${isActive ? 'active' : ''}`,
      role: 'tab',
      'aria-selected': isActive ? 'true' : 'false',
      'aria-controls': `tab-pane-${tab.id}`,
      id: `tab-btn-${tab.id}`,
      tabindex: isActive ? '0' : '-1',
      onClick: () => {
        onTabChange(tab.id);
        document.getElementById(`tab-btn-${tab.id}`)?.focus();
      },
      onkeydown: (event) => {
        const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
        if (!direction && event.key !== 'Home' && event.key !== 'End') return;
        event.preventDefault();
        const index = tabsConfig.findIndex(item => item.id === tab.id);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabsConfig.length - 1 : (index + direction + tabsConfig.length) % tabsConfig.length;
        onTabChange(tabsConfig[next].id);
        document.getElementById(`tab-btn-${tabsConfig[next].id}`)?.focus();
      }
    }, tab.label);

    nav.appendChild(btn);
  }

  return nav;
}
