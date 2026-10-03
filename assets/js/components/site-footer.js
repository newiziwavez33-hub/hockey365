/**
 * Hockey365 Custom Element: <site-footer>
 */

import { CONFIG } from '../core/config.js';
import { buildLink } from '../core/router.js';
import { el } from '../core/dom.js';

export class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    const footer = el('footer', { className: 'site-footer' },
      el('div', { className: 'app-container' },
        el('div', { className: 'footer-content' },
          el('div', { className: 'footer-info' },
            el('div', { className: 'text-bold text-base' }, 'Hockey365 — Хоккейный портал'),
            el('div', { className: 'text-xs text-muted', style: { marginTop: '4px' } },
              'Матчи, турнирные таблицы, статистика и результаты КХЛ и НХЛ в реальном времени. Без сервера, на GitHub Pages.'
            )
          ),
          el('div', { className: 'footer-links' },
            el('a', { href: buildLink('/about/') }, 'О проекте и источниках'),
            el('a', { href: buildLink('/privacy/') }, 'Конфиденциальность'),
            el('a', { href: buildLink('/settings/') }, 'Настройки'),
            el('a', { href: 'https://github.com/newiziwavez33-hub/hockey365', target: '_blank', rel: 'noopener' }, 'GitHub')
          )
        ),
        el('div', { className: 'text-xs text-muted text-center', style: { marginTop: '16px', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '12px' } },
          `© ${new Date().getFullYear()} Hockey365. Версия ${CONFIG.VERSION}. Все товарные знаки и эмблемы клубов принадлежат их законным владельцам.`
        )
      )
    );

    this.innerHTML = '';
    this.appendChild(footer);
  }
}

customElements.define('site-footer', SiteFooter);
