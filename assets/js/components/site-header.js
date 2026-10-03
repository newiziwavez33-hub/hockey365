/**
 * Hockey365 Custom Element: <site-header>
 */

import { CONFIG } from '../core/config.js';
import { buildLink } from '../core/router.js';
import { store } from '../core/store.js';
import { el } from '../core/dom.js';

export class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.unsubscribe = store.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  render() {
    const currentPath = window.location.pathname;
    const base = CONFIG.BASE_PATH || '';

    const navLinks = [
      { name: 'Главная', path: '/' },
      { name: 'Онлайн', path: '/online/' },
      { name: 'Турниры', path: '/competitions/' },
      { name: 'Новости', path: '/news/' },
      { name: 'Трансферы', path: '/transfers/' },
      { name: 'Моя лента', path: '/favorites/' },
      { name: 'Настройки', path: '/settings/' }
    ];

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const timezoneLabel = store.getTimezone() === 'local' ? 'Местное время' : store.getTimezone() === 'UTC' ? 'UTC' : 'МСК (UTC+3)';
    const isHome = currentPath === base || currentPath === base + '/' || currentPath === base + '/index.html';

    const header = el('header', { className: 'site-header' },
      el('div', { className: 'app-container' },
        el('div', { className: 'header-top' },
          // Brand Logo
          el('a', { href: buildLink('/'), className: 'brand-link' },
            el('svg', { className: 'brand-logo-icon', viewBox: '0 0 32 32', fill: 'currentColor' },
              // Hockey puck & sticks SVG emblem
              el('circle', { cx: '16', cy: '16', r: '14', fill: 'var(--color-accent-blue)' }),
              el('path', { d: 'M9 11 L23 11 C24 11 25 12 25 13 L25 19 C25 20 24 21 23 21 L9 21 C8 21 7 20 7 19 L7 13 C7 12 8 11 9 11 Z', fill: '#0a101d' }),
              el('ellipse', { cx: '16', cy: '13', rx: '8', ry: '2', fill: '#ffffff', opacity: '0.4' })
            ),
            el('span', {}, 'Hockey', el('span', { className: 'brand-accent' }, '365'))
          ),

          // Search bar
          el('form', { className: 'header-search', role: 'search', onsubmit: (e) => {
            e.preventDefault();
            const query = e.currentTarget.querySelector('input').value.trim();
            window.location.href = buildLink('/search/', query ? { q: query } : {});
          } },
            el('button', { type: 'submit', 'aria-label': 'Искать', title: 'Искать', style: { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', padding: '0', display: 'flex', color: 'var(--color-text-muted)' } },
              el('svg', { width: '17', height: '17', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'aria-hidden': 'true' },
                el('circle', { cx: '11', cy: '11', r: '8' }),
                el('line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' })
              )
            ),
            el('input', {
              type: 'search',
              placeholder: 'Поиск команд, игроков, лиг...',
              'aria-label': 'Поиск по сайту'
            })
          ),

          // Header Actions
          el('div', { className: 'header-actions' },
            // Timezone badge
            el('div', {
              className: 'tz-badge',
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: 'var(--surface-elevated)',
                fontSize: '11px',
                fontWeight: '600',
                color: 'var(--text-secondary)'
              }
            },
              el('svg', { width: '13', height: '13', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
                el('circle', { cx: '12', cy: '12', r: '10' }),
                el('polyline', { points: '12 6 12 12 16 14' })
              ),
              el('span', {}, timezoneLabel)
            ),

            // Mobile search icon button
            el('a', {
              href: buildLink('/search/'),
              className: 'icon-btn',
              'aria-label': 'Открыть поиск',
              style: { display: window.innerWidth < 768 ? 'flex' : 'none' }
            },
              el('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
                el('circle', { cx: '11', cy: '11', r: '8' }),
                el('line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' })
              )
            ),

            // Sound Notification Toggle Button
            el('button', {
              className: 'icon-btn sound-toggle-btn',
              'aria-label': store.isSoundEnabled() ? 'Отключить звук гола' : 'Включить звук гола',
              title: store.isSoundEnabled() ? 'Звуковые оповещения о голах включены' : 'Звуковые оповещения выключены',
              style: { color: store.isSoundEnabled() ? 'var(--primary-container)' : 'var(--text-muted)' },
              onClick: () => {
                store.toggleSound();
                this.render();
              }
            },
              store.isSoundEnabled()
                ? el('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
                    el('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
                    el('path', { d: 'M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07' })
                  )
                : el('svg', { width: '18', height: '18', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
                    el('polygon', { points: '11 5 6 9 2 9 2 15 6 15 11 19 11 5' }),
                    el('line', { x1: '23', y1: '9', x2: '17', y2: '15' }),
                    el('line', { x1: '17', y1: '9', x2: '23', y2: '15' })
                  )
            ),

            // Theme Toggle Button
            el('button', {
              className: 'icon-btn theme-toggle-btn',
              'aria-label': 'Переключить тему',
              title: 'Переключить светлую/тёмную тему',
              onClick: () => {
                const nextTheme = store.getTheme() === 'dark' ? 'light' : 'dark';
                store.setTheme(nextTheme);
              }
            },
              isDark
                ? el('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
                    el('circle', { cx: '12', cy: '12', r: '5' }),
                    el('line', { x1: '12', y1: '1', x2: '12', y2: '3' }),
                    el('line', { x1: '12', y1: '21', x2: '12', y2: '23' }),
                    el('line', { x1: '4.22', y1: '4.22', x2: '5.64', y2: '5.64' }),
                    el('line', { x1: '18.36', y1: '18.36', x2: '19.78', y2: '19.78' }),
                    el('line', { x1: '1', y1: '12', x2: '3', y2: '12' }),
                    el('line', { x1: '21', y1: '12', x2: '23', y2: '12' }),
                    el('line', { x1: '4.22', y1: '19.78', x2: '5.64', y2: '18.36' }),
                    el('line', { x1: '18.36', y1: '5.64', x2: '19.78', y2: '4.22' })
                  )
                : el('svg', { width: '20', height: '20', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
                    el('path', { d: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' })
                  )
            )
          )
        )
      ),

      // Navigation Bar
      el('nav', { className: 'header-nav', 'aria-label': 'Основное меню' },
        el('div', { className: 'app-container' },
          el('ul', { className: 'nav-list' },
            navLinks.map(link => {
              const isActive = (link.path === '/' && isHome) ||
                               (link.path !== '/' && currentPath.includes(link.path));

              return el('li', { className: 'nav-item' },
                el('a', {
                  href: buildLink(link.path),
                  className: isActive ? 'active' : '',
                  ...(isActive ? { 'aria-current': 'page' } : {})
                }, link.name)
              );
            })
          )
        )
      )
    );

    // Mobile Bottom Navigation Bar (Stitch app pattern)
    const mobileBottomNav = el('nav', { className: 'mobile-bottom-nav', 'aria-label': 'Мобильная навигация' },
      el('a', { href: buildLink('/'), className: `mob-nav-item ${isHome ? 'active' : ''}`, ...(isHome ? { 'aria-current': 'page' } : {}) },
        el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
          el('path', { d: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }),
          el('polyline', { points: '9 22 9 12 15 12 15 22' })
        ),
        el('span', {}, 'Главная')
      ),
      el('a', { href: buildLink('/online/'), className: `mob-nav-item ${currentPath.includes('/online/') ? 'active' : ''}` },
        el('div', { className: 'mob-live-badge' },
          el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
            el('circle', { cx: '12', cy: '12', r: '10' }),
            el('polygon', { points: '10 8 16 12 10 16 10 8' })
          ),
          el('span', { className: 'mob-live-dot', 'aria-hidden': 'true' })
        ),
        el('span', {}, 'Матчи')
      ),
      el('a', { href: buildLink('/competitions/'), className: `mob-nav-item ${currentPath.includes('/competition') ? 'active' : ''}` },
        el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
          el('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
        ),
        el('span', {}, 'Турниры')
      ),
      el('a', { href: buildLink('/news/'), className: `mob-nav-item ${currentPath.includes('/news/') ? 'active' : ''}` },
        el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
          el('path', { d: 'M19 20H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1m2 13a2 2 0 0 1-2-2V7m2 13a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2' })
        ),
        el('span', {}, 'Новости')
      ),
      el('a', { href: buildLink('/favorites/'), className: `mob-nav-item ${currentPath.includes('/favorites/') ? 'active' : ''}` },
        el('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
          el('polygon', { points: '12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2' })
        ),
        el('span', {}, 'Избранное')
      )
    );

    this.innerHTML = '';
    this.appendChild(header);
    this.appendChild(mobileBottomNav);
  }
}

customElements.define('site-header', SiteHeader);
