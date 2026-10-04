// Run with: node --experimental-default-type=module --test tests/test_match_row.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

class TestNode {
  constructor(tag = '#text', text = '') {
    this.tag = tag;
    this.value = text;
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.listeners = {};
    this.className = '';
    this.classList = {
      add: name => { this.className = `${this.className} ${name}`.trim(); },
      toggle: (name, active) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        if (active) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      }
    };
  }
  setAttribute(name, value) { this.attributes[name] = value; }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  appendChild(child) { this.children.push(child); return child; }
  get textContent() { return this.tag === '#text' ? this.value : this.children.map(child => child.textContent).join(''); }
}
globalThis.Node = TestNode;
globalThis.document = {
  documentElement: new TestNode('html'),
  createElement: tag => new TestNode(tag),
  createTextNode: text => new TestNode('#text', text)
};
globalThis.window = {
  location: { pathname: '/', origin: 'https://hockey365.test', href: 'https://hockey365.test/' },
  history: { replaceState() {}, pushState() {} }
};

const { createMatchGridCardStitch, createMatchRow } = await import('../assets/js/components/match-row.js');
const { store } = await import('../assets/js/core/store.js');

function fixture(id) {
  return JSON.parse(readFileSync(new URL(`../data/matches/${id}.json`, import.meta.url), 'utf8'));
}
function find(node, className) {
  if (node.className.split(/\s+/).includes(className)) return node;
  for (const child of node.children) {
    const result = find(child, className);
    if (result) return result;
  }
  return null;
}

test('scheduled NHL fixture has its actual date and no invented matchup or score', () => {
  const card = createMatchGridCardStitch(fixture('nhl:2026020060'));
  const text = card.textContent;
  assert.match(find(card, 'card-status-badge').textContent, /9 окт.*02:00 МСК.*NHL/i);
  assert.match(text, /Матч запланирован/);
  assert.match(text, /Информация о матче/);
  assert.doesNotMatch(text, /СЕГОДНЯ|20:00|Шестеркин|Бобровский|Арена готова|прямой репортаж/);
  assert.equal(find(card, 'card-sog-pill'), null);
  assert.equal((text.match(/-/g) || []).length >= 2, true);
});

test('live period, clock and shots are shown only when supplied', () => {
  const live = { ...fixture('nhl:2026020027'), id: 'test-live', status: 'LIVE', period: 2, clock: '05:12' };
  live.home = { ...live.home, score: 0, shots: 0 };
  live.away = { ...live.away, score: 1, shots: 14 };
  const card = createMatchGridCardStitch(live);
  assert.match(find(card, 'card-status-badge').textContent, /2-Й ПЕРИОД • 05:12/);
  assert.equal(find(card, 'card-sog-pill').textContent, 'БРОСКИ 0 - 14');
  assert.doesNotMatch(card.textContent, /28 - 31|прямой репортаж/);

  live.clock = null;
  live.period = null;
  live.home.shots = null;
  assert.match(find(createMatchGridCardStitch(live), 'card-status-badge').textContent, /МАТЧ ИДЕТ/);
  assert.equal(find(createMatchGridCardStitch(live), 'card-sog-pill'), null);
  live.stats = { shotsOnGoal: [8, 11] };
  assert.equal(find(createMatchGridCardStitch(live), 'card-sog-pill').textContent, 'БРОСКИ В СТВОР 8 - 11');
});

test('intermission is not a playing clock, and cancelled games are not scheduled', () => {
  const match = fixture('nhl:2026020060');
  match.status = 'INTERMISSION';
  match.period = 2;
  let card = createMatchGridCardStitch(match);
  assert.match(card.textContent, /ПЕРЕРЫВ/);
  assert.equal(find(card, 'badge-pulse-dot'), null);
  match.status = 'CANCELLED';
  card = createMatchGridCardStitch(match);
  assert.match(card.textContent, /ОТМЕНЕН|Матч отменен/);
  assert.doesNotMatch(card.textContent, /СЕГОДНЯ|Матч запланирован/);
});

test('finished fixture does not claim missing shots and has one pair of period parentheses', () => {
  const match = {
    id: 'test:finished-with-shots',
    compId: 'NHL',
    season: '2026/27',
    utcDate: '2026-10-03T16:30:00Z',
    status: 'FINISHED',
    finishedIn: 'OT',
    home: { id: 'nhl:det', score: 3, periods: [1, 1, 0, 1], shots: 34 },
    away: { id: 'nhl:wpg', score: 2, periods: [0, 1, 1, 0], shots: 29 }
  };
  const card = createMatchGridCardStitch(match);
  assert.equal(find(card, 'card-bottom-note').textContent, 'Периоды: (1:0, 1:1, 0:1, 1:0)');
  assert.equal(find(card, 'card-sog-pill').textContent, 'БРОСКИ 34 - 29');
  assert.match(find(card, 'card-status-badge').textContent, /ФИНАЛ \(ОТ\)/);
  assert.equal(find(createMatchGridCardStitch(fixture('nhl:2026020027')), 'card-sog-pill'), null);
});

test('favorite toggle keeps accessible name and pressed state in sync', () => {
  const match = fixture('nhl:2026020060');
  const original = store.isFavorite('matches', match.id);
  const button = find(createMatchGridCardStitch(match), 'card-star-btn');
  try {
    assert.equal(button.getAttribute('aria-pressed'), String(original));
    button.listeners.click({ stopPropagation() {}, currentTarget: button });
    assert.equal(button.getAttribute('aria-pressed'), String(!original));
    assert.equal(button.getAttribute('aria-label'), original ? 'Добавить в избранное' : 'Удалить из избранного');
  } finally {
    if (store.isFavorite('matches', match.id) !== original) store.toggleFavorite('matches', match.id);
  }
});

test('createMatchRow renders full 7-column Stitch row with status, teams, and score', () => {
  const match = fixture('nhl:2026020027');
  const row = createMatchRow(match);
  assert.equal(find(row, 'match-card-stitch') !== null || row.className.includes('match-card-stitch'), true);
  assert.notEqual(find(row, 'match-col-status'), null);
  assert.notEqual(find(row, 'match-col-7grid'), null);
  assert.notEqual(find(row, 'score-pill-box'), null);
  assert.match(row.textContent, /Коламбус Блю Джекетс/);
  assert.match(row.textContent, /Юта Хоккей Клаб/);
  assert.match(row.textContent, /1.*:.*4/);
});
