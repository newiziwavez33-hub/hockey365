/**
 * Hockey365 News Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getNews } from '../core/api.js';
import { getParam, buildLink } from '../core/router.js';
import { formatDate } from '../core/format.js';

export async function initNewsPage() {
  const newsId = getParam('id');
  const container = qs('#news-feed-slot');

  renderLoading(container, 3);

  try {
    const data = await getNews();
    const newsList = data.news || [];
    container.innerHTML = '';

    if (newsId) {
      // Single Article View
      const article = newsList.find(n => n.id === newsId);
      if (!article) {
        renderError(container, 'Новость не найдена');
        return;
      }

      const card = el('div', { className: 'card' },
        el('div', { className: 'card-header' },
          el('h1', { className: 'card-title' }, article.title)
        ),
        el('div', { className: 'card-body flex-col gap-16' },
          el('div', { className: 'text-xs text-muted flex items-center justify-between' },
            el('span', {}, `Источник: ${article.source || 'Hockey365'}`),
            el('span', {}, formatDate(article.publishedAt, 'full'))
          ),
          el('p', { className: 'text-base', style: { lineHeight: '1.7', fontWeight: '500' } }, article.summary),
          el('p', { className: 'text-base', style: { lineHeight: '1.7' } }, article.content),
          article.tags && article.tags.length > 0 ? el('div', { className: 'flex gap-6 flex-wrap', style: { marginTop: '12px' } },
            article.tags.map(t => el('span', { className: 'badge badge-scheduled' }, `#${t}`))
          ) : null,
          el('div', { style: { marginTop: '16px' } },
            el('a', { href: buildLink('/news/'), className: 'btn-primary text-xs' }, '← Ко всем новостям')
          )
        )
      );

      container.appendChild(card);
      return;
    }

    // List of Articles
    if (newsList.length === 0) {
      renderEmpty(container, 'Новостей пока нет.');
      return;
    }

    const card = el('div', { className: 'card' },
      el('div', { className: 'card-header' },
        el('h2', { className: 'card-title' }, 'Лента хоккейных новостей')
      ),
      el('div', { className: 'card-body flex-col gap-16' },
        newsList.map(n => el('div', {
          className: 'news-item flex-col gap-6',
          style: { padding: '12px 0', borderBottom: '1px solid var(--color-border-subtle)' }
        },
          el('a', { href: buildLink('/news/', { id: n.id }), className: 'text-lg text-bold link-accent' }, n.title),
          el('p', { className: 'text-sm text-secondary' }, n.summary),
          el('div', { className: 'flex items-center justify-between text-xs text-muted' },
            el('span', {}, n.source || 'Пресс-служба'),
            el('span', {}, formatDate(n.publishedAt, 'dayMonth'))
          )
        ))
      )
    );

    container.appendChild(card);
  } catch (err) {
    renderError(container, 'Не удалось загрузить новости');
  }
}
