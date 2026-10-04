/**
 * Hockey365 News Page Logic
 */

import { qs, el, renderLoading, renderEmpty, renderError } from '../core/dom.js';
import { getNews } from '../core/api.js';
import { getParam, buildLink } from '../core/router.js';
import { formatDate } from '../core/format.js';
import { getAssetUrl } from '../core/config.js';

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
      const article = newsList.find(n => n.id === newsId || n.slug === newsId);
      if (!article) {
        renderError(container, 'Новость не найдена');
        return;
      }

      const card = el('div', { className: 'card overflow-hidden' },
        article.image ? el('div', { className: 'news-article-hero-wrap' },
          el('img', {
            src: getAssetUrl(article.image),
            alt: article.title,
            className: 'news-article-hero-img'
          })
        ) : null,
        el('div', { className: 'card-header' },
          el('h1', { className: 'card-title' }, article.title)
        ),
        el('div', { className: 'card-body flex-col gap-16' },
          el('div', { className: 'text-xs text-muted flex items-center justify-between' },
            el('span', {}, `Источник: ${article.source || 'Hockey365'}`),
            el('span', {}, formatDate(article.publishedAt, 'full'))
          ),
          article.summary ? el('p', { className: 'text-base', style: { lineHeight: '1.7', fontWeight: '500' } }, article.summary) : null,
          (article.content && article.content !== article.summary) ? el('p', { className: 'text-base', style: { lineHeight: '1.7' } }, article.content) : null,
          (article.relatedTeamIds && article.relatedTeamIds.length > 0) ? el('div', { className: 'flex gap-6 flex-wrap items-center', style: { marginTop: '8px' } },
            el('span', { className: 'text-xs text-muted' }, 'Команды:'),
            article.relatedTeamIds.map(tId => el('a', { href: buildLink('/team/', { id: tId }), className: 'badge badge-filter text-xs' }, tId.replace('khl:', '').replace('nhl:', '').toUpperCase()))
          ) : null,
          (article.tags && article.tags.length > 0) ? el('div', { className: 'flex gap-6 flex-wrap', style: { marginTop: '8px' } },
            article.tags.map(t => el('span', { className: 'badge badge-scheduled' }, `#${t}`))
          ) : null,
          el('div', { className: 'flex items-center gap-12 flex-wrap', style: { marginTop: '16px' } },
            el('a', { href: buildLink('/news/'), className: 'btn-primary text-xs' }, '← Ко всем новостям'),
            article.url ? el('a', {
              href: article.url,
              target: '_blank',
              rel: 'noopener noreferrer',
              className: 'btn-glass text-xs'
            }, 'Оригинал на Чемпионате ↗') : null
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
          className: 'news-list-card flex gap-16 items-start'
        },
          n.image ? el('a', { href: buildLink('/news/', { id: n.id }), className: 'news-list-thumb-wrap shrink-0' },
            el('img', {
              src: getAssetUrl(n.image),
              alt: n.title,
              className: 'news-list-thumb',
              loading: 'lazy'
            })
          ) : null,
          el('div', { className: 'flex-col gap-6 flex-1' },
            el('div', { className: 'flex items-center gap-8 mb-1' },
              el('span', { className: 'badge badge-scheduled text-xs' }, n.tags?.[0] || 'Хоккей'),
              el('span', { className: 'text-xs text-muted' }, formatDate(n.publishedAt, 'dayMonth'))
            ),
            el('a', { href: buildLink('/news/', { id: n.id }), className: 'text-lg text-bold link-accent' }, n.title),
            el('p', { className: 'text-sm text-secondary' }, n.summary),
            el('div', { className: 'text-xs text-muted' }, n.source || 'Пресс-служба')
          )
        ))
      )
    );

    container.appendChild(card);
  } catch (err) {
    renderError(container, 'Не удалось загрузить новости');
  }
}
