import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoomService, emptyRoom, protectedLocation, csrfToken, validCsrf, validateCommand, friendlyError } from '../lib/team-room.js';
import { createHandler } from '../api/team.js';

function memoryStore() {
  let value = emptyRoom(), version = 0;
  return {
    async read() { return { room: structuredClone(value), etag: version ? String(version) : null }; },
    async write(room, etag) { if ((version ? String(version) : null) !== etag) throw new Error('conflict'); value = structuredClone(room); version++; },
    isConflict: error => error.message === 'conflict',
  };
}
const command = (extra = {}) => ({ requestId: 'message_12345', text: 'Give me a useful idea for a small business.', target: 'team', kind: 'question', ...extra });
const env = { VERCEL: '1', VERCEL_URL: 'crow-abc-owner.vercel.app', BLOB_READ_WRITE_TOKEN: 'test-only-not-a-real-secret' };
function response() { return { headers: {}, statusCode: null, setHeader(k, v) { this.headers[k] = v; }, end(value) { this.body = JSON.parse(value); } }; }

test('public production alias cannot read the private room or start AI work', async () => {
  const handler = createHandler({ env, store: { read() { throw new Error('private data accessed'); } }, generate() { throw new Error('model called'); } });
  for (const method of ['GET', 'POST']) {
    const res = response();
    await handler({ method, url: '/api/team', headers: { host: 'crow-hq.vercel.app', 'x-forwarded-host': env.VERCEL_URL } }, res);
    assert.equal(res.statusCode, 403); assert.equal(res.body.code, 'PRIVATE_ROOM_REQUIRED');
    assert.equal(res.body.privateUrl, 'https://' + env.VERCEL_URL + '/#chat');
    assert.equal(res.body.messages, undefined);
  }
  assert.equal(protectedLocation({ headers: { host: env.VERCEL_URL } }, env).allowed, true);
});
test('CSRF is bound to the protected host, rejects tampering and expires', () => {
  const at = 1793548800000, token = csrfToken(env.VERCEL_URL, env.BLOB_READ_WRITE_TOKEN, at);
  assert.equal(validCsrf(token, env.VERCEL_URL, env.BLOB_READ_WRITE_TOKEN, at + 1000), true);
  assert.equal(validCsrf(token, 'crow-hq.vercel.app', env.BLOB_READ_WRITE_TOKEN, at), false);
  assert.equal(validCsrf(token + 'x', env.VERCEL_URL, env.BLOB_READ_WRITE_TOKEN, at), false);
  assert.equal(validCsrf(token, env.VERCEL_URL, env.BLOB_READ_WRITE_TOKEN, at + 31 * 60000), false);
});
test('mutating API requires both same-origin and a signed room token', async () => {
  const handler = createHandler({ env, store: memoryStore(), background: () => {}, generate: async () => ({ text: 'draft' }) });
  const bootstrap = response(); await handler({ method: 'GET', url: '/api/team', headers: { host: env.VERCEL_URL } }, bootstrap);
  assert.equal(bootstrap.statusCode, 200);
  const headers = { host: env.VERCEL_URL, origin: 'https://' + env.VERCEL_URL, 'content-type': 'application/json', 'x-crow-csrf': bootstrap.body.csrf };
  const malicious = response(); await handler({ method: 'POST', headers: { ...headers, origin: 'https://other.example' }, body: command() }, malicious);
  assert.equal(malicious.statusCode, 403);
  const accepted = response(); await handler({ method: 'POST', headers, body: command() }, accepted);
  assert.equal(accepted.statusCode, 202);
});
test('the team replies in order and each employee receives preceding replies', async () => {
  const calls = [], store = memoryStore();
  const room = createRoomService({ store, generate: async options => { calls.push(options); return { text: options.employee + ' real draft' }; } });
  const { job } = await room.reserve(command()); await room.run(job.id);
  const state = await room.snapshot();
  assert.deepEqual(calls.map(c => c.employee), ['jiayee', 'greentea', 'matthew']);
  assert.match(calls[1].prompt, /jiayee real draft/); assert.match(calls[2].prompt, /greentea real draft/);
  assert.deepEqual(state.messages.filter(m => m.who !== 'bobby').map(m => m.who), ['jiayee', 'greentea', 'matthew']);
  assert.equal(state.jobs[0].status, 'done');
});
test('task completion includes the real draft and produces a review update', async () => {
  const room = createRoomService({ store: memoryStore(), generate: async () => ({ text: 'A costed proposal with assumptions, for Bobby to review.' }) });
  const { job } = await room.reserve(command({ kind: 'task', target: 'greentea', task: { id: 'task-42', title: 'Review a café offer', details: 'Estimate costs and revenue.' } }));
  await room.run(job.id); const state = await room.snapshot();
  assert.equal(state.jobs[0].status, 'done'); assert.match(state.jobs[0].result, /costed proposal/);
  assert.equal(state.messages.at(-1).kind, 'completion'); assert.equal(state.messages.at(-1).task.id, 'task-42');
});
test('a provider failure preserves completed replies and never reports task completion', async () => {
  const room = createRoomService({ store: memoryStore(), generate: async ({ employee }) => { if (employee === 'greentea') throw new Error('insufficient_funds'); return { text: 'The first employee’s draft.' }; } });
  const { job } = await room.reserve(command({ kind: 'task' })); await room.run(job.id); const data = await room.snapshot();
  assert.equal(data.jobs[0].status, 'failed'); assert.deepEqual(data.jobs[0].completed, ['jiayee']);
  assert.equal(data.messages.some(m => m.kind === 'completion'), false); assert.equal(data.messages.at(-1).kind, 'error');
  assert.match(data.messages.at(-1).text, /credits|spending limit/);
});
test('repeating a request ID is idempotent and concurrent different requests cannot double-start', async () => {
  const room = createRoomService({ store: memoryStore(), generate: async () => ({ text: 'draft' }) });
  const attempts = await Promise.allSettled([room.reserve(command()), room.reserve(command({ requestId: 'another_12345' }))]);
  assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1);
  const winner = attempts.find(x => x.status === 'fulfilled').value;
  const retry = await room.reserve(command({ requestId: winner.job.requestId }));
  assert.equal(retry.duplicate, true); assert.equal(retry.job.id, winner.job.id);
  assert.equal((await room.snapshot()).messages.length, 1);
});
test('the same ID cannot resume a completed request and run it twice', async () => {
  let calls = 0; const room = createRoomService({ store: memoryStore(), generate: async () => { calls++; return { text: 'draft' }; } });
  const { job } = await room.reserve(command({ target: 'jiayee' })); await room.run(job.id); await room.run(job.id);
  assert.equal(calls, 1); assert.equal((await room.reserve(command({ target: 'jiayee' }))).duplicate, true);
});
test('interrupted runs become retryable failures, not success', async () => {
  let at = 1793548800000; const room = createRoomService({ store: memoryStore(), now: () => at, generate: async () => ({ text: 'draft' }) });
  await room.reserve(command()); at += 301000; const state = await room.snapshot();
  assert.equal(state.jobs[0].status, 'failed'); assert.match(state.messages.at(-1).text, /interrupted/);
});
test('an @mention selects only that employee, inputs are bounded, and errors contain no secrets', () => {
  assert.deepEqual(validateCommand(command({ text: '@MATTHEW summarize the next step.' })).responders, ['matthew']);
  assert.throws(() => validateCommand(command({ target: 'bobby' })));
  assert.throws(() => validateCommand(command({ text: 'x'.repeat(4001) })));
  assert.doesNotMatch(friendlyError(new Error('secret-value-123 server detail')), /secret-value-123/);
});
