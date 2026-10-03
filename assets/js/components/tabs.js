/**
 * Hockey365 Accessible Tabs Component
 */

import { el } from '../core/dom.js';

export function createTabs(tabsConfig, activeTabId, onTabChange) {
  const nav = el('div', { className: 'tabs-nav', role: 'tablist' });

  for (const tab of tabsConfig) {
    const isActive = tab.id === activeTabId;
    const btn = el('button', {
      className: `tab-btn ${isActive ? 'active' : ''}`,
      role: 'tab',
      'aria-selected': isActive ? 'true' : 'false',
      'aria-controls': `tab-pane-${tab.id}`,
      id: `tab-btn-${tab.id}`,
      onClick: () => {
        onTabChange(tab.id);
      }
    }, tab.label);

    nav.appendChild(btn);
  }

  return nav;
}
