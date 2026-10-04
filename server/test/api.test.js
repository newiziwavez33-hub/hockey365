import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/index.js';

test('GET /health returns 200 and version 2.0.0', async () => {
  const res = await app.request('/health');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, 'ok');
  assert.equal(data.version, '2.0.0');
});

test('GET /api/meta returns site metadata', async () => {
  const res = await app.request('/api/meta');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.siteName);
});

test('GET /api/matches returns match list for date', async () => {
  const res = await app.request('/api/matches?date=2026-10-04');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.matches));
  assert.equal(data.date, '2026-10-04');
});

test('GET /api/news returns normalized hockey news', async () => {
  const res = await app.request('/api/news');
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.news));
});

test('Chat API handles posting, filtering and rate-limiting', async () => {
  const roomId = 'test_match_room_1';
  const userId = `user_${Date.now()}`;

  // 1. Post valid message with profanity that should be censored
  const postRes = await app.request(`/api/chat/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      userName: 'Хоккеист87',
      authProvider: 'telegram',
      content: 'Отличный гол, сука красота!'
    })
  });

  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.success, true);
  assert.equal(postData.message.content, 'Отличный гол, *** красота!');

  // 2. Immediate second post by same user triggers rate-limit (429)
  const rapidRes = await app.request(`/api/chat/${roomId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      userName: 'Хоккеист87',
      content: 'Спам спам'
    })
  });
  assert.equal(rapidRes.status, 429);

  // 3. Retrieve messages
  const getRes = await app.request(`/api/chat/${roomId}/messages`);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.count, 1);
  assert.equal(getData.messages[0].userName, 'Хоккеист87');
});
