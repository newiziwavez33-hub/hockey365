import { el } from '../core/dom.js';
import {
  displayPlayerName,
  isNumericNhlPlayerId,
  lookupEventPlayer,
  playerIdentity
} from '../core/profile-links.js';

function isLiveNode(node) {
  // `isConnected` is the authoritative guard in the browser. The fallback is
  // useful for the project's lightweight DOM test doubles.
  return Boolean(node) && node.isConnected !== false;
}

function makePlaceholder() {
  return el('span', {
    className: 'event-player-avatar event-player-avatar-placeholder',
    'aria-hidden': 'true'
  }, el('span', { className: 'material-symbols-outlined' }, 'person'));
}

function setClass(node, className, active) {
  if (node.classList?.toggle) node.classList.toggle(className, active);
  else if (active) node.classList?.add?.(className);
  else node.classList?.remove?.(className);
}

function installHeadshot(root, avatar, photo, name) {
  if (!isLiveNode(root) || !photo) return;
  const placeholder = avatar.firstChild || avatar.children?.[0];
  const image = el('img', {
    src: photo,
    alt: name,
    className: 'event-player-avatar event-player-avatar-image',
    loading: 'lazy',
    onError: (event) => {
      const failedImage = event.currentTarget || event.target;
      if (!isLiveNode(root)) return;
      if (typeof failedImage?.remove === 'function') failedImage.remove();
      else if (failedImage?.parentNode?.removeChild) failedImage.parentNode.removeChild(failedImage);
      else if (Array.isArray(avatar.children)) {
        const index = avatar.children.indexOf(failedImage);
        if (index >= 0) avatar.children.splice(index, 1);
      }
      if (placeholder) placeholder.style.display = 'inline-flex';
      setClass(avatar, 'event-player-avatar-placeholder', true);
    }
  });
  if (placeholder) placeholder.style.display = 'none';
  setClass(avatar, 'event-player-avatar-placeholder', false);
  avatar.appendChild(image);
}

/**
 * Render one event participant and hydrate its official name/headshot in the
 * background. The returned node is safe to keep while match polling rerenders
 * the event list: detached nodes are ignored by the async completion.
 */
export function createEventPlayer({ playerId = null, name = null, available = null, role = 'player' } = {}) {
  const fallback = role === 'assist' ? 'Автор передачи' : 'Игрок';
  const initialName = displayPlayerName(playerId, name, fallback);
  const identity = playerIdentity(playerId, initialName, available, fallback);
  const label = identity.querySelector?.('.player-name-label') || identity;
  const avatar = el('span', { className: 'event-player-avatar-wrap' }, makePlaceholder());
  const root = el('span', { className: 'event-player', dataset: { playerId: isNumericNhlPlayerId(playerId) ? playerId : '' } }, avatar, identity);

  if (!isNumericNhlPlayerId(playerId)) return root;

  lookupEventPlayer(playerId).then(profile => {
    if (!profile || !isLiveNode(root)) return;
    const resolvedName = profile.name || initialName;
    if (label) label.textContent = resolvedName;
    if (profile.photo) installHeadshot(root, avatar, profile.photo, resolvedName);
  }).catch(() => {
    // lookupEventPlayer already converts failures to null. Keep this guard so
    // a future resolver change cannot create an unhandled rejection in a live
    // polling page.
  });

  return root;
}

export function createEventAssists(assists, available = null) {
  if (!Array.isArray(assists) || assists.length === 0) return null;
  const children = ['Передачи: '];
  assists.forEach((assist, index) => {
    const playerId = typeof assist === 'string' ? assist : assist?.playerId;
    const name = typeof assist === 'object' ? assist?.playerName : null;
    if (index > 0) children.push(', ');
    children.push(createEventPlayer({ playerId, name, available, role: 'assist' }));
  });
  return el('div', { className: 'text-xs text-muted event-player-assists' }, children);
}
