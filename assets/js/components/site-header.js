/**
 * Hockey365 Custom Element: <site-header>
 * Designed in 100% accordance with Google Stitch UI System
 * Implements 2-tier sticky header (112px / h-28) + live alert ticker strip:
 * - Tier 1 (56px): Brand cluster, search with ⌘K, 6 nav links, tools & avatar
 * - Tier 2 (56px): Datepicker day cards ribbon + league filter pills
 * - Ticker strip: Live on-air telemetry & arena feed indicator
 */

import { CONFIG } from '../core/config.js';
import { buildLink, getParam, setParam } from '../core/router.js';
import { store } from '../core/store.js';
import { el } from '../core/dom.js';
import { createDatepicker } from './datepicker.js';
import { getTodayISODate } from '../core/format.js';

export class SiteHeader extends HTMLElement {
  connectedCallback() {
    this.render();

    this.unsubscribe = store.subscribe(() => {
      this.updateSoundButton();
    });

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

  updateSoundButton() {
    const btn = this.querySelector('.sound-btn');
    if (!btn) return;
    const isEnabled = store.isSoundEnabled();
    btn.classList.toggle('sound-active', isEnabled);
    btn.setAttribute('aria-label', isEnabled ? 'Отключить звук гола' : 'Включить звук гола');
    btn.title = isEnabled ? 'Звуковые оповещения о голах включены' : 'Звуковые оповещения выключены';
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) icon.textContent = isEnabled ? 'volume_up' : 'volume_off';
  }

  render() {
    const currentPath = window.location.pathname;
    const base = CONFIG.BASE_PATH || '';
    const isHome = currentPath === base || currentPath === base + '/' || currentPath === base + '/index.html';
    const isOnline = currentPath.includes('/online/');
    const isCompetitions = currentPath.includes('/competition') && !currentPath.includes('tab=stats');
    const isKHL = currentPath.includes('id=KHL') || currentPath.includes('/khl');
    const isNHL = currentPath.includes('id=NHL') || currentPath.includes('/nhl');
    const isNews = currentPath.includes('/news/');

    const navLinks = [
      { name: 'Главная', path: '/', active: isHome && !isOnline },
      { name: 'Матч-центр / Live', path: '/online/', active: isOnline },
      { name: 'КХЛ', path: '/competition/?id=KHL', active: isKHL },
      { name: 'НХЛ', path: '/competition/?id=NHL', active: isNHL },
      { name: 'Новости & Медиа', path: '/news/', active: isNews },
      { name: 'Турниры', path: '/competitions/', active: isCompetitions && !isKHL && !isNHL }
    ];

    const timezoneLabel = store.getTimezone() === 'local' ? 'Местное' : store.getTimezone() === 'UTC' ? 'UTC' : 'МСК UTC+3';

    // Build Tier 1 (56px)
    const tier1 = el('div', { className: 'header-tier-1' },
      // Left Cluster: Brand Logo + Search Form
      el('div', { className: 'header-brand-cluster' },
        el('a', { href: buildLink('/'), className: 'brand-link', 'aria-label': 'Hockey365 Главная' },
          el('div', { className: 'brand-badge-icon' },
            el('span', { className: 'material-symbols-outlined' }, 'sports_hockey')
          ),
          el('span', { className: 'brand-title' },
            'HOCKEY',
            el('span', { className: 'brand-accent' }, '365')
          )
        ),

        // Search Bar with ⌘K badge
        el('form', {
          className: 'header-search-bar',
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
            placeholder: 'Поиск команд, игроков, лиг...',
            'aria-label': 'Поиск по сайту'
          }),
          el('kbd', { className: 'search-kbd' }, '⌘K')
        )
      ),

      // Center: Nav Links
      el('nav', { className: 'header-nav-links', 'aria-label': 'Основное меню' },
        navLinks.map(link => el('a', {
          href: buildLink(link.path),
          className: `nav-link ${link.active ? 'active' : ''}`,
          ...(link.active ? { 'aria-current': 'page' } : {})
        }, link.name))
      ),

      // Right: Header Tools & Avatar
      el('div', { className: 'header-actions' },
        // Timezone Pill
        el('div', { className: 'tz-pill-stitch', title: 'Часовой пояс' },
          el('span', { className: 'material-symbols-outlined' }, 'language'),
          el('span', {}, timezoneLabel)
        ),

        // Sound Goal Notifications
        el('button', {
          type: 'button',
          className: `icon-btn-stitch sound-btn ${store.isSoundEnabled() ? 'sound-active' : ''}`,
          'aria-label': store.isSoundEnabled() ? 'Отключить звук гола' : 'Включить звук гола',
          title: store.isSoundEnabled() ? 'Звуковые оповещения о голах включены' : 'Звуковые оповещения выключены',
          onClick: () => {
            store.toggleSound();
            this.updateSoundButton();
          }
        },
          el('span', { className: 'material-symbols-outlined' }, store.isSoundEnabled() ? 'volume_up' : 'volume_off')
        ),

        // Notifications Bell
        el('button', {
          type: 'button',
          className: 'icon-btn-stitch',
          'aria-label': 'Уведомления',
          title: 'Уведомления матчей'
        },
          el('span', { className: 'material-symbols-outlined' }, 'notifications')
        ),

        // Interface Settings Button
        el('a', {
          href: buildLink('/settings/'),
          className: 'icon-btn-stitch',
          'aria-label': 'Настройки интерфейса',
          title: 'Настройки интерфейса'
        },
          el('span', { className: 'material-symbols-outlined' }, 'settings')
        ),

        // User Avatar
        el('div', {
          className: 'user-avatar-stitch',
          title: 'Профиль'
        },
          el('span', { className: 'material-symbols-outlined' }, 'person')
        )
      )
    );

    // Build Tier 2 (56px): Datepicker Ribbon (Left) + Filter Pills (Right)
    const tier2DatepickerWrap = el('div', { id: 'header-datepicker-slot', className: 'tier2-datepicker-wrap' });

    // Populate initial datepicker in slot
    const initialDate = getParam('date') || getTodayISODate();
    tier2DatepickerWrap.appendChild(createDatepicker(initialDate, (selectedDate) => {
      if (isHome) {
        setParam('date', selectedDate, true);
        window.dispatchEvent(new CustomEvent('hockey365:date-change', { detail: { date: selectedDate } }));
      } else {
        window.location.href = buildLink('/', { date: selectedDate });
      }
    }));

    const activeFilterParam = getParam('filter') || 'all';

    const tier2FilterPills = el('div', {
      id: 'header-filter-pills',
      className: 'tier2-filter-pills',
      role: 'group',
      'aria-label': 'Фильтры'
    },
      el('button', {
        type: 'button',
        className: `filter-pill ${activeFilterParam === 'all' ? 'active' : ''}`,
        dataset: { filter: 'all' },
        'aria-pressed': activeFilterParam === 'all' ? 'true' : 'false'
      }, 'Все матчи'),
      el('button', {
        type: 'button',
        className: `filter-pill pill-live ${activeFilterParam === 'live' ? 'active' : ''}`,
        dataset: { filter: 'live' },
        'aria-pressed': activeFilterParam === 'live' ? 'true' : 'false'
      },
        el('span', { className: 'live-pulse-dot' }),
        el('span', {}, 'В игре (LIVE)')
      ),
      el('button', {
        type: 'button',
        className: `filter-pill ${activeFilterParam === 'KHL' ? 'active' : ''}`,
        dataset: { filter: 'KHL' },
        'aria-pressed': activeFilterParam === 'KHL' ? 'true' : 'false'
      }, 'КХЛ'),
      el('button', {
        type: 'button',
        className: `filter-pill ${activeFilterParam === 'NHL' ? 'active' : ''}`,
        dataset: { filter: 'NHL' },
        'aria-pressed': activeFilterParam === 'NHL' ? 'true' : 'false'
      }, 'НХЛ'),
      el('button', {
        type: 'button',
        className: `filter-pill ${activeFilterParam === 'MHL' ? 'active' : ''}`,
        dataset: { filter: 'MHL' },
        'aria-pressed': activeFilterParam === 'MHL' ? 'true' : 'false'
      }, 'МХЛ')
    );

    // If not on home page, clicking a filter pill redirects to home with that filter
    tier2FilterPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-pill');
      if (!btn) return;
      if (!isHome) {
        window.location.href = buildLink('/', { filter: btn.dataset.filter });
      }
    });

    const tier2 = el('div', { className: 'header-tier-2' },
      tier2DatepickerWrap,
      tier2FilterPills
    );

    // Ticker strip underneath Tier 2 (matching Stitch)
    const tickerStrip = el('div', { className: 'header-ticker-strip' },
      el('div', { className: 'ticker-left' },
        el('span', { className: 'ticker-pill-live' }, 'LIVE ON-AIR'),
        el('span', { className: 'ticker-text' }, 'Показаны сохранённые матчи и прямые протоколы реального времени. Смена составов и puck-tracking активны.')
      ),
      el('div', { className: 'ticker-right' },
        el('span', { className: 'ticker-live-dot' }, '●'),
        el('span', {}, 'NHL & KHL Live Feeds • Арена: Москва & Детройт')
      )
    );

    // Header Container
    const header = el('header', { className: 'site-header-stitch' },
      el('div', { className: 'header-container' },
        tier1,
        tier2
      ),
      tickerStrip
    );

    // Mobile Bottom Navigation Bar (Stitch pattern)
    const mobileBottomNav = el('nav', { className: 'mobile-bottom-nav', 'aria-label': 'Мобильная навигация' },
      el('a', { href: buildLink('/'), className: `mob-nav-item ${isHome ? 'active' : ''}`, ...(isHome ? { 'aria-current': 'page' } : {}) },
        el('span', { className: 'material-symbols-outlined' }, 'sports_hockey'),
        el('span', {}, 'Главная')
      ),
      el('a', { href: buildLink('/online/'), className: `mob-nav-item ${isOnline ? 'active' : ''}` },
        el('div', { className: 'mob-live-badge' },
          el('span', { className: 'material-symbols-outlined' }, 'sensors'),
          el('span', { className: 'mob-live-dot', 'aria-hidden': 'true' })
        ),
        el('span', {}, 'Матч-центр')
      ),
      el('a', { href: buildLink('/competition/?id=KHL'), className: `mob-nav-item ${isKHL ? 'active' : ''}` },
        el('span', { className: 'material-symbols-outlined' }, 'sports_score'),
        el('span', {}, 'КХЛ')
      ),
      el('a', { href: buildLink('/competition/?id=NHL'), className: `mob-nav-item ${isNHL ? 'active' : ''}` },
        el('span', { className: 'material-symbols-outlined' }, 'sports_hockey'),
        el('span', {}, 'НХЛ')
      ),
      el('a', { href: buildLink('/news/'), className: `mob-nav-item ${isNews ? 'active' : ''}` },
        el('span', { className: 'material-symbols-outlined' }, 'feed'),
        el('span', {}, 'Новости')
      )
    );

    this.innerHTML = '';
    this.appendChild(header);
    this.appendChild(mobileBottomNav);
  }
}

customElements.define('site-header', SiteHeader);
