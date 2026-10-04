/**
 * Hockey365 DOM Utilities and Safe Rendering (XSS Protection)
 */

export function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function el(tag, attributes = {}, ...children) {
  const svgTags = new Set(['svg', 'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect', 'text', 'g']);
  const element = svgTags.has(tag)
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) continue;

    if (key.startsWith('on') && typeof value === 'function') {
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else if (key === 'className') {
      if (element.namespaceURI === 'http://www.w3.org/2000/svg') element.setAttribute('class', value);
      else element.className = value;
    } else if (key === 'dataset' && typeof value === 'object') {
      for (const [dataKey, dataValue] of Object.entries(value)) {
        element.dataset[dataKey] = dataValue;
      }
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key === 'innerHTML') {
      console.warn('Direct innerHTML usage discouraged. Use children or sanitize.');
      element.innerHTML = value;
    } else {
      element.setAttribute(key, String(value));
    }
  }

  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) {
      for (const subChild of child) {
        if (subChild instanceof Node) {
          element.appendChild(subChild);
        } else if (subChild !== null && subChild !== undefined) {
          element.appendChild(document.createTextNode(String(subChild)));
        }
      }
    } else if (child instanceof Node) {
      element.appendChild(child);
    } else {
      element.appendChild(document.createTextNode(String(child)));
    }
  }

  return element;
}

export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

export function qsa(selector, parent = document) {
  return Array.from(parent.querySelectorAll(selector));
}

export function clearChildren(parent) {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
}

export function renderLoading(container, count = 3) {
  clearChildren(container);
  const wrapper = el('div', { className: 'skeleton-wrap gap-8 flex-col' });
  for (let i = 0; i < count; i++) {
    wrapper.appendChild(el('div', { className: 'skeleton', style: { height: '52px', marginBottom: '8px' } }));
  }
  container.appendChild(wrapper);
}

export function renderError(container, message = 'Не удалось загрузить данные', retryFn = null) {
  clearChildren(container);
  const retryBtn = retryFn ? el('button', { className: 'btn-primary', onClick: retryFn }, 'Повторить') : null;
  const errorBox = el('div', { className: 'state-message card' },
    el('div', { className: 'text-lg text-bold' }, 'Ошибка'),
    el('div', { className: 'text-secondary' }, escapeHTML(message)),
    retryBtn
  );
  container.appendChild(errorBox);
}

export function renderEmpty(container, message = 'Данные отсутствуют', options = {}) {
  clearChildren(container);

  const iconName = options.icon || 'sports_hockey';
  const titleText = options.title || 'Пока здесь пусто';
  const ctaText = options.ctaText || null;
  const ctaAction = options.ctaAction || null;

  const emptyCard = el('div', { className: 'stitch-empty-showcase-card' },
    // Ambient Icon Orb
    el('div', { className: 'empty-showcase-orb' },
      el('span', { className: 'material-symbols-outlined' }, iconName)
    ),

    // Heading & Message
    el('h3', { className: 'empty-showcase-title' }, titleText),
    el('p', { className: 'empty-showcase-desc' }, message),

    // Optional CTA Button
    ctaText ? el('button', {
      type: 'button',
      className: 'empty-showcase-cta-btn',
      onClick: ctaAction
    },
      el('span', {}, ctaText),
      el('span', { className: 'material-symbols-outlined text-[16px]' }, 'arrow_forward')
    ) : null
  );

  container.appendChild(emptyCard);
}
