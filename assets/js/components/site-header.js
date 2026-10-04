/**
 * Hockey365 Custom Element: <site-header>
 * Designed in accordance with Google Stitch UI System
 */

import { CONFIG } from '../core/config.js';
import { buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { el } from '../core/dom.js';

export class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = store.subscribe(() => this.render());
    this.render();

    // Global shortcut Ctrl+K / Cmd+K to focus search
    this.keyHandler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = this.querySelector('input[type="search"]');
        if (input) {
          input.focus();
          input.select();
        }
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
  }

  render() {
    const currentPath = window.location.pathname;
    const base = CONFIG.BASE_PATH || '';
    const isHome = currentPath === base || currentPath === base + '/' || currentPath === base + '/index.html';
    const isOnline = currentPath.includes('/online/');
    const isCompetitions = currentPath.includes('/competition');
    const isNews = currentPath.includes('/news/');
    const isTransfers = currentPath.includes('/transfers/');
    const isFavorites = currentPath.includes('/favorites/');

    const navLinks = [
      { name: 'Матчи / Live', path: '/', active: isHome || isOnline },
      { name: 'Турниры & Таблицы', path: '/competitions/', active: isCompetitions },
      { name: 'Новости', path: '/news/', active: isNews },
      { name: 'Трансферы', path: '/transfers/', active: isTransfers },
      { name: 'Моя лента', path: '/favorites/', active: isFavorites },
      { name: 'Статистика', path: '/competition/?id=NHL&tab=stats', active: currentPath.includes('tab=stats') }
    ];

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const timezoneLabel = store.getTimezone() === 'local' ? 'Местное' : store.getTimezone() === 'UTC' ? 'UTC' : 'МСК (UTC+3)';

    const header = el('header', { className: 'site-header' },
      el('div', { className: 'app-container' },
        el('div', { className: 'header-top' },
          // Left: Brand Logo & Search
          el('div', { className: 'header-left-cluster' },
            el('a', { href: buildLink('/'), className: 'brand-link-stitch', 'aria-label': 'Hockey365 Главная' },
              el('div', { className: 'brand-badge-icon' },
                el('span', { className: 'material-symbols-outlined' }, 'sports_hockey')
              ),
              el('span', { className: 'brand-title' },
                'HOCKEY',
                el('span', { className: 'brand-accent' }, '365')
              )
            ),

            // Search Bar with Ctrl+K badge
            el('form', {
              className: 'header-search-stitch',
              role: 'search',
              onsubmit: (e) => {
                e.preventDefault();
                const q = e.currentTarget.querySelector('input').value.trim();
                window.location.href = buildLink('/search/', q ? { q } : {});
              }
            },
              el('span', { className: 'material-symbols-outlined search-icon' }, 'search'),
              el('input', {
                type: 'search',
                placeholder: 'Поиск команд, игроков, матчей или лиг...',
                'aria-label': 'Поиск по сайту'
              }),
              el('kbd', { className: 'search-kbd' }, 'Ctrl+K')
            )
          ),

          // Center: Desktop Main Navigation
          el('nav', { className: 'header-nav-stitch', 'aria-label': 'Основное меню' },
            navLinks.map(link => el('a', {
              href: buildLink(link.path),
              className: `nav-link-stitch ${link.active ? 'active' : ''}`,
              ...(link.active ? { 'aria-current': 'page' } : {})
            }, link.name))
          ),

          // Right: Action Buttons
          el('div', { className: 'header-actions-stitch' },
            // Sound Goal Notifications
            el('button', {
              className: `icon-btn-stitch ${store.isSoundEnabled() ? 'sound-active' : ''}`,
              'aria-label': store.isSoundEnabled() ? 'Отключить звук гола' : 'Включить звук гола',
              title: store.isSoundEnabled() ? 'Звуковые оповещения о голах включены' : 'Звуковые оповещения выключены',
              onClick: () => {
                store.toggleSound();
                this.render();
              }
            },
              el('span', { className: 'material-symbols-outlined' }, store.isSoundEnabled() ? 'volume_up' : 'volume_off')
            ),

            // Timezone Pill
            el('div', { className: 'tz-pill-stitch', title: 'Часовой пояс событий' },
              el('span', { className: 'material-symbols-outlined' }, 'schedule'),
              el('span', {}, timezoneLabel)
            ),

            // Theme Toggle
            el('button', {
              className: 'icon-btn-stitch',
              'aria-label': 'Переключить тему оформления',
              title: isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему',
              onClick: () => {
                const next = isDark ? 'light' : 'dark';
                store.setTheme(next);
              }
            },
              el('span', { className: 'material-symbols-outlined' }, isDark ? 'light_mode' : 'dark_mode')
            ),

            // Favorites quick link
            el('a', {
              href: buildLink('/favorites/'),
              className: 'icon-btn-stitch',
              'aria-label': 'Моя лента и избранное',
              title: 'Избранное и подписки'
            },
              el('span', { className: 'material-symbols-outlined' }, 'star')
            )
          )
        )
      )
    );

    // Mobile Bottom Navigation Bar (Stitch pattern)
    const mobileBottomNav = el('nav', { className: 'mobile-bottom-nav', 'aria-label': 'Мобильная навигация' },
      el('a', { href: buildLink('/'), className: `mob-nav-item ${isHome ? 'active' : ''}`, ...(isHome ? { 'aria-current': 'page' } : {}) },
        el('span', { className: 'material-symbols-outlined' }, 'sports_hockey'),
        el('span', {}, 'Матчи')
      ),
      el('a', { href: buildLink('/online/'), className: `mob-nav-item ${isOnline ? 'active' : ''}` },
        el('div', { className: 'mob-live-badge' },
          el('span', { className: 'material-symbols-outlined' }, 'sensors'),
          el('span', { className: 'mob-live-dot', 'aria-hidden': 'true' })
        ),
        el('span', {}, 'Онлайн')
      ),
      el('a', { href: buildLink('/competitions/'), className: `mob-nav-item ${isCompetitions ? 'active' : ''}` },
        el('span', { className: 'material-symbols-outlined' }, 'leaderboard'),
        el('span', {}, 'Турниры')
      ),
      el('a', { href: buildLink('/news/'), className: `mob-nav-item ${isNews ? 'active' : ''}` },
        el('span', { className: 'material-symbols-outlined' }, 'feed'),
        el('span', {}, 'Новости')
      ),
      el('a', { href: buildLink('/favorites/'), className: `mob-nav-item ${isFavorites ? 'active' : ''}` },
        el('span', { className: 'material-symbols-outlined' }, 'star'),
        el('span', {}, 'Избранное')
      )
    );

    this.innerHTML = '';
    this.appendChild(header);
    this.appendChild(mobileBottomNav);
  }
}

customElements.define('site-header', SiteHeader);

