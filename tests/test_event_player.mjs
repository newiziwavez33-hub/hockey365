// Run with: node --test tests/test_event_player.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class TestNode {
  constructor(tag = '#text', value = '') {
    this.tag = tag;
    this.value = value;
    this.parentNode = null;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.className = '';
    this._connected = false;
    this.classList = {
      add: name => this.classList.toggle(name, true),
      remove: name => this.classList.toggle(name, false),
      toggle: (name, active) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        if (active) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      }
    };
  }

  get isConnected() { return this._connected || Boolean(this.parentNode?.isConnected); }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this.tag === '#text' ? this.value : this.children.map(child => child.textContent).join(''); }
  set textContent(value) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.appendChild(new TestNode('#text', String(value)));
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  dispatch(name) { for (const callback of this.listeners[name] || []) callback({ currentTarget: this, target: this }); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const matches = node => selector[0] === '.'
      ? node.className.split(/\s+/).includes(selector.slice(1))
      : node.tag === selector.toLowerCase();
    const found = [];
    const walk = node => {
      for (const child of node.children) {
        if (matches(child)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

globalThis.Node = TestNode;
globalThis.document = {
  createElement: tag => new TestNode(tag),
  createTextNode: value => new TestNode('#text', value)
};
globalThis.window = {
  location: { pathname: '/', origin: 'https://hockey365.test', href: 'https://hockey365.test/' },
  history: { replaceState() {}, pushState() {} }
};

const { createEventPlayer, createEventAssists } = await import('../assets/js/components/event-player.js');
const { clearEventPlayerLookupCache, displayPlayerName, lookupEventPlayer, playerName } =
  await import('../assets/js/core/profile-links.js');

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'Test', json: async () => data };
}

function landing(id, name = `Official ${id}`, headshot = `https://assets.nhle.com/mugs/nhl/20262027/EDM/${id}.png`) {
  const [first, last] = name.split(' ');
  return { playerId: Number(id), firstName: { default: first }, lastName: { default: last }, headshot };
}

const host = new TestNode('main');
host._connected = true;
function attach(node) { return host.appendChild(node); }
function cleanup() {
  for (const child of host.children) child.parentNode = null;
  host.children = [];
  clearEventPlayerLookupCache();
}

function mockFetch(official = {}, snapshots = {}) {
  const calls = [];
  globalThis.fetch = async url => {
    const path = String(url);
    calls.push(path);
    if (path.endsWith('/data/meta.json')) return response({ unverifiedCompetitions: [] });
    if (path.includes('/api/nhl.php?health=1')) return response({}, 404);
    const player = /\/player\/(\d+)\/landing/.exec(path)?.[1];
    if (player) {
      const result = official[player];
      return result ? response(result) : response({}, 404);
    }
    const snapshot = /\/data\/players\/nhl:p_(\d+)\.json/.exec(path)?.[1];
    if (snapshot) return snapshots[snapshot] ? response(snapshots[snapshot]) : response({}, 404);
    throw new Error(`Unexpected fetch: ${path}`);
  };
  return calls;
}

const tick = () => new Promise(resolve => setImmediate(resolve));
async function settle() { await tick(); await tick(); }
function hrefs(node) { return node.querySelectorAll('a').map(link => link.getAttribute('href')); }

test('known NHL name and official headshot render with accessible dossier link', async () => {
  cleanup();
  const calls = mockFetch({ 8478402: landing(8478402, 'Connor McDavid') });
  const node = attach(createEventPlayer({ playerId: 'nhl:p_8478402', name: 'Connor McDavid' }));
  assert.equal(node.textContent.includes('Connor McDavid'), true);
  assert.deepEqual(hrefs(node), ['/player/?id=nhl%3Ap_8478402']);
  assert.equal(node.querySelector('.event-player-avatar-placeholder') !== null, true);
  await settle();
  const img = node.querySelector('img');
  assert.equal(img.getAttribute('src'), 'https://assets.nhle.com/mugs/nhl/20262027/EDM/8478402.png');
  assert.equal(img.getAttribute('alt'), 'Connor McDavid');
  assert.equal(img.getAttribute('loading'), 'lazy');
  assert.equal(calls.filter(url => url.includes('/player/8478402/landing')).length, 1);
  assert.match(readFileSync(new URL('../match/index.html', import.meta.url), 'utf8'), /assets\/css\/event-player\.css/);
});

test('case-insensitive technical entity IDs never appear as names, including assists', async () => {
  cleanup();
  mockFetch({ 123: landing(123, 'Official Scorer'), 124: landing(124, 'Official Helper') });
  for (const technical of ['nhl:P_123', 'NHL:p_123', 'khl:p_abc', 'KHL:p_888', 'p_123']) {
    assert.equal(displayPlayerName('nhl:p_123', technical), 'Игрок');
    assert.equal(displayPlayerName('nhl:p_123', technical, 'Автор передачи'), 'Автор передачи');
  }
  assert.equal(playerName('khl:p_abc', 'KHL:p_abc', new Set()).textContent, 'Игрок');
  const scorer = attach(createEventPlayer({ playerId: 'nhl:P_123', name: 'NHL:p_123' }));
  const assists = attach(createEventAssists(['nhl:P_124', { playerId: 'khl:p_888', playerName: 'KHL:p_888' }]));
  assert.equal(scorer.textContent, 'personИгрок');
  assert.match(assists.textContent, /Передачи:.*Автор передачи.*Автор передачи/);
  assert.doesNotMatch(scorer.textContent + assists.textContent, /(?:nhl|khl):p_/i);
  assert.equal(hrefs(scorer)[0], '/player/?id=nhl%3Ap_123');
  assert.deepEqual(hrefs(assists), ['/player/?id=nhl%3Ap_124']);
  await settle();
  assert.match(scorer.textContent, /Official Scorer/);
  assert.match(assists.textContent, /Official Helper/);
});

test('assists with published names and raw IDs have name links, not technical labels', async () => {
  cleanup();
  mockFetch({ 210: landing(210, 'Official Helper'), 211: landing(211, 'Official Second') });
  const assists = attach(createEventAssists([
    { playerId: 'nhl:p_210', playerName: 'Published Helper' },
    'nhl:p_211'
  ]));
  assert.match(assists.textContent, /Передачи:.*Published Helper.*Автор передачи/);
  assert.deepEqual(hrefs(assists), ['/player/?id=nhl%3Ap_210', '/player/?id=nhl%3Ap_211']);
  await settle();
  assert.match(assists.textContent, /Official Helper.*Official Second/);
  assert.doesNotMatch(assists.textContent, /nhl:p_\d+/i);
  assert.equal(assists.querySelectorAll('img').length, 2);
});

test('only official NHL source and assets.nhle.com photo pass headshot guard', async () => {
  cleanup();
  mockFetch({
    310: landing(310, 'Bad Host', 'https://assets.nhle.com.evil.test/mug.png'),
    311: landing(311, 'Bad Scheme', 'http://assets.nhle.com/mug.png'),
    312: { playerId: 312 },
    313: { playerId: 313 }
  }, {
    312: { id: 'nhl:p_312', name: 'Unofficial Photo', photo: 'https://assets.nhle.com/mug.png', source: { official: false, provider: 'NHL Web API' } },
    313: { id: 'nhl:p_313', name: 'Wrong Provider', photo: 'https://assets.nhle.com/mug.png', source: { official: true, provider: 'Other API' } }
  });
  const nodes = [310, 311, 312, 313].map(id => attach(createEventPlayer({ playerId: `nhl:p_${id}` })));
  await settle();
  for (const node of nodes) {
    assert.equal(node.querySelector('img'), null);
    assert.equal(node.querySelector('.event-player-avatar-placeholder') !== null, true);
  }
  assert.match(nodes[2].textContent, /Unofficial Photo/);
});

test('image failure restores neutral placeholder without retrying the URL or fetching again', async () => {
  cleanup();
  const calls = mockFetch({ 410: landing(410, 'Image Failure') });
  const first = attach(createEventPlayer({ playerId: 'nhl:p_410' }));
  await settle();
  const image = first.querySelector('img');
  image.dispatch('error');
  assert.equal(first.querySelector('img'), null);
  assert.equal(first.querySelectorAll('.event-player-avatar-placeholder').at(-1).style.display, 'inline-flex');
  assert.equal(first.textContent.includes('Image Failure'), true);
  // A cached profile may populate a fresh row, but no failed img has an
  // onerror handler that rewrites src into an infinite retry loop.
  const second = attach(createEventPlayer({ playerId: 'nhl:p_410' }));
  await settle();
  second.querySelector('img').dispatch('error');
  assert.equal(second.querySelector('img'), null);
  assert.equal(calls.filter(url => url.includes('/player/410/landing')).length, 1);
});

test('missing or mismatched official profile remains neutral and is cached across rerenders', async () => {
  cleanup();
  const calls = mockFetch({ 411: { playerId: 411 } }, {
    411: { id: 'nhl:p_999', name: 'Wrong Player', photo: 'https://assets.nhle.com/wrong.png' }
  });
  const first = attach(createEventPlayer({ playerId: 'nhl:p_411' }));
  await settle();
  assert.equal(first.textContent, 'personИгрок');
  assert.equal(first.querySelector('img'), null);
  const next = attach(createEventPlayer({ playerId: 'nhl:p_411' }));
  await settle();
  assert.equal(next.textContent, 'personИгрок');
  assert.equal(calls.filter(url => url.includes('/player/411/landing')).length, 1);
  assert.equal(calls.filter(url => url.includes('/players/nhl:p_411.json')).length, 1);
});

test('detached event row ignores async lookup result after polling rerender', async () => {
  cleanup();
  let release;
  let requested;
  const started = new Promise(resolve => { requested = resolve; });
  globalThis.fetch = async url => {
    const path = String(url);
    if (path.endsWith('/data/meta.json')) return response({ unverifiedCompetitions: [] });
    if (path.includes('/api/nhl.php?health=1')) return response({}, 404);
    requested();
    return new Promise(resolve => { release = () => resolve(response(landing(510, 'Later Name'))); });
  };
  const oldRow = attach(createEventPlayer({ playerId: 'nhl:p_510' }));
  await started;
  const previousText = oldRow.textContent;
  oldRow.remove();
  const replacement = attach(createEventPlayer({ playerId: 'nhl:p_510' }));
  release();
  await settle();
  assert.equal(oldRow.isConnected, false);
  assert.equal(oldRow.textContent, previousText);
  assert.equal(oldRow.querySelector('img'), null);
  assert.match(replacement.textContent, /Later Name/);
});

test('same-player rerenders deduplicate in-flight fetches and resolved cache', async () => {
  cleanup();
  let release;
  let requested;
  const started = new Promise(resolve => { requested = resolve; });
  const calls = [];
  globalThis.fetch = async url => {
    const path = String(url);
    if (path.endsWith('/data/meta.json')) return response({ unverifiedCompetitions: [] });
    if (path.includes('/api/nhl.php?health=1')) return response({}, 404);
    calls.push(path);
    requested();
    return new Promise(resolve => { release = () => resolve(response(landing(610, 'Shared Player'))); });
  };
  const rows = Array.from({ length: 15 }, () => attach(createEventPlayer({ playerId: 'nhl:p_610' })));
  await started;
  assert.equal(calls.length, 1);
  for (const row of rows.slice(0, 10)) row.remove();
  release();
  await settle();
  assert.equal(calls.length, 1);
  assert.match(rows[14].textContent, /Shared Player/);
  const cached = attach(createEventPlayer({ playerId: 'nhl:p_610' }));
  await settle();
  assert.match(cached.textContent, /Shared Player/);
  assert.equal(calls.length, 1);
});

test('at most four official fetches run; queue and page budget remain bounded on rerender', async () => {
  cleanup();
  const pending = new Map();
  const calls = [];
  let maxActive = 0;
  globalThis.fetch = async url => {
    const path = String(url);
    if (path.endsWith('/data/meta.json')) return response({ unverifiedCompetitions: [] });
    if (path.includes('/api/nhl.php?health=1')) return response({}, 404);
    const id = /\/player\/(\d+)\/landing/.exec(path)?.[1];
    assert.ok(id, path);
    calls.push(id);
    const result = new Promise(resolve => pending.set(id, () => {
      pending.delete(id);
      resolve(response(landing(id)));
    }));
    maxActive = Math.max(maxActive, pending.size);
    return result;
  };
  const attempts = Array.from({ length: 100 }, (_, index) => `nhl:p_${700 + index}`);
  const first = attempts.map(playerId => lookupEventPlayer(playerId));
  await settle();
  assert.equal(calls.length, 4);
  assert.equal(maxActive, 4);
  // Polling with the same event list must not enqueue duplicate pending work.
  const second = attempts.map(playerId => lookupEventPlayer(playerId));
  await settle();
  assert.equal(calls.length, 4);

  async function drain() {
    for (let n = 0; n < 100 && pending.size; n++) {
      for (const release of [...pending.values()]) release();
      await settle();
    }
  }
  await drain();
  await Promise.all([...first, ...second]);
  assert.equal(calls.length, 32); // 4 active + 28 queued, not 100.
  assert.equal(maxActive, 4);

  const again = attempts.map(playerId => lookupEventPlayer(playerId));
  await settle();
  await drain();
  await Promise.all(again);
  assert.equal(calls.length, 64); // 64 distinct IDs per page, even after polling.
  await Promise.all(attempts.map(playerId => lookupEventPlayer(playerId)));
  assert.equal(calls.length, 64);
});
