import {memoryInvites} from './helpers.mjs';
const createInvitationHandler=options=>rawInvitationHandler({store:memoryInvites(),...options});
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accessDecision, configured, cookieName, issueSession, matchesCode, safeNext, SESSION_SECONDS, sessionCookie, verifySession } from '../lib/invitation.js';
import { createInvitationHandler as rawInvitationHandler } from '../api/invitation.js';
import proxy from '../proxy.js';

const env = { VERCEL: '1', VERCEL_URL: 'crow-private-test.vercel.app', CROW_INVITE_CODE: 'CROW-TEST-2345-ABCD-6789', CROW_INVITE_SESSION_SECRET: 'a-test-only-signing-key-at-least-32-characters-long' };
const host = 'crow-hq.vercel.app';
const time = 1793550900000;
const request = (path, token, hostname = host) => new Request('https://' + hostname + path, { headers: { host: hostname, ...(token ? { cookie: cookieName(env) + '=' + token } : {}) } });
const response = () => ({ headers: {}, statusCode: null, setHeader(k, v) { this.headers[k] = v; }, end(body) { this.body = JSON.parse(body); } });
const joinRequest = body => ({ method: 'POST', url: '/api/invitation', headers: { host, origin: 'https://' + host, 'content-type': 'application/json', 'x-real-ip': '192.0.2.5' }, body });

test('the complete deployed world and its assets require an invitation session', () => {
  for (const path of ['/', '/index.html', '/app.js', '/neighbourhood.js', '/style.css', '/chat.js', '/founder.js', '/access.js', '/anything']) {
    const decision = accessDecision(request(path), env, time);
    assert.equal(decision.allow, false, path); assert.equal(decision.status, 303); assert.match(decision.redirect, /^\/join.html/);
  }
  for (const path of ['/join.html', '/join.js', '/join.css', '/api/invitation', '/robots.txt']) assert.equal(accessDecision(request(path), env, time).allow, true, path);
});
test('a correct code gives access, but it cannot create a founder session', () => {
  assert.equal(configured(env), true); assert.equal(matchesCode('crow test 2345 abcd 6789', env), true); assert.equal(matchesCode('wrong', env), false);
  const token = issueSession(env, time), claims = verifySession(token, env, time);
  assert.equal(claims.role, 'guest'); assert.equal(claims.exp, undefined); assert.equal(claims.v, 2);
  assert.equal(accessDecision(request('/', token), env, time).role, 'guest');
  assert.equal(accessDecision(request('/api/team', token), env, time).status, 403);
  assert.equal(accessDecision(request('/founder.html', token), env, time).allow, false);
  assert.equal(accessDecision(request('/api/another-private-endpoint'), env, time).status, 401);
});
test('sessions have no scheduled expiry; forged and revoked sessions fail closed', () => {
  const token = issueSession(env, time);
  const [payload, signature] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url')), role: 'founder' })).toString('base64url') + '.' + signature;
  assert.equal(verifySession(forged, env, time), null);
  assert.equal(verifySession(token, env, time + 50 * 365 * 24 * 3600000).role, 'guest');
  assert.equal(verifySession(token, { ...env, CROW_INVITE_CODE: 'CROW-ANOTHER-SECRET-CODE' }, time), null);
  assert.equal(verifySession(token, { ...env, CROW_INVITE_SESSION_SECRET: 'another-signing-key-with-at-least-32-characters' }, time), null);
  assert.equal(verifySession(token + '.extra', env, time), null);
  assert.equal(verifySession(token, {}, time), null);
});
test('only the existing protected deployment host can reveal the founder invitation', async () => {
  const handler = createInvitationHandler({ env, now: () => time });
  const denied = response(); await handler({ method: 'GET', url: '/api/invitation?action=owner', headers: { host, 'x-forwarded-host': env.VERCEL_URL } }, denied);
  assert.equal(denied.statusCode, 403); assert.equal(denied.body.inviteCode, undefined);
  const allowed = response(); await handler({ method: 'GET', url: '/api/invitation?action=owner', headers: { host: env.VERCEL_URL } }, allowed);
  assert.equal(allowed.statusCode, 200); assert.equal(allowed.body.inviteCode, env.CROW_INVITE_CODE);
  assert.equal(accessDecision(request('/founder.html', null, env.VERCEL_URL), env, time).role, 'founder');
});
test('join validates origin and code and sets a secure HttpOnly guest cookie', async () => {
  const handler = createInvitationHandler({ env, now: () => time });
  const badOrigin = joinRequest({ action: 'join', code: env.CROW_INVITE_CODE }); badOrigin.headers.origin = 'https://unrelated.example';
  const rejected = response(); await handler(badOrigin, rejected); assert.equal(rejected.statusCode, 403); assert.equal(rejected.headers['Set-Cookie'], undefined);
  const invalid = response(); await handler(joinRequest({ action: 'join', code: 'incorrect' }), invalid); assert.equal(invalid.statusCode, 401); assert.equal(invalid.headers['Set-Cookie'], undefined);
  const accepted = response(); await handler(joinRequest({ action: 'join', code: env.CROW_INVITE_CODE, next: '/' }), accepted);
  assert.equal(accepted.statusCode, 200); assert.equal(accepted.body.role, 'guest'); assert.equal(accepted.body.inviteCode, undefined);
  const cookie = accepted.headers['Set-Cookie']; assert.match(cookie, /^__Host-crow_guest=/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Max-Age=34560000/);
});
test('public session metadata never includes the invitation code, secret, or member data', async () => {
  const handler = createInvitationHandler({ env, now: () => time });
  const res = response(); await handler({ method: 'GET', url: '/api/invitation', headers: { host } }, res);
  assert.equal(res.body.role, 'visitor'); assert.equal(res.body.inviteCode, undefined); assert.equal(res.body.demoCode, undefined);
  const json = JSON.stringify(res.body); assert.equal(json.includes(env.CROW_INVITE_CODE), false); assert.equal(json.includes(env.CROW_INVITE_SESSION_SECRET), false);
});
test('logging out clears the session; unconfigured entry never grants access', async () => {
  const leave = response(); await createInvitationHandler({ env })(joinRequest({ action: 'leave' }), leave);
  assert.ok(leave.headers['Set-Cookie'].every(cookie=>cookie.includes('Max-Age=0')));
  const disabled = response(); await createInvitationHandler({ env: {} })(joinRequest({ action: 'join', code: env.CROW_INVITE_CODE }), disabled);
  // A local handler expects an HTTP origin; after matching that origin it must still fail closed.
  assert.equal(disabled.statusCode, 403);
  const local = joinRequest({ action: 'join', code: env.CROW_INVITE_CODE }); local.headers.origin = 'http://' + host;
  const noConfig = response(); await createInvitationHandler({ env: {} })(local, noConfig); assert.equal(noConfig.statusCode, 503);
});
test('return paths cannot redirect to another site or a privileged endpoint', () => {
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/api/team', '/founder.html', '/join.html', '/\r\nLocation:evil']) assert.equal(safeNext(path), '/');
  assert.equal(safeNext('/?view=map#office'), '/?view=map#office');
});
test('failed-code cooldown is bounded and expires', async () => {
  let at = time; const handler = createInvitationHandler({ env, now: () => at });
  for (let i = 0; i < 10; i++) { const res = response(); await handler(joinRequest({ action: 'join', code: 'bad' }), res); assert.equal(res.statusCode, 401); }
  const blocked = response(); await handler(joinRequest({ action: 'join', code: env.CROW_INVITE_CODE }), blocked); assert.equal(blocked.statusCode, 429);
  at += 16 * 60000; const accepted = response(); await handler(joinRequest({ action: 'join', code: env.CROW_INVITE_CODE }), accepted); assert.equal(accepted.statusCode, 200);
});
test('the platform proxy sends an actual redirect without a session', () => {
  const res = proxy(request('/'));
  assert.equal(res.status, 303); assert.match(res.headers.get('location'), /\/join.html/); assert.equal(res.headers.get('cache-control'), 'private, no-store');
});

test('unexpired legacy visits migrate without changing the guest identity', async () => {
 const token=issueSession(env,time); const claims=JSON.parse(Buffer.from(token.split('.')[0],'base64url'));
 claims.v=1;claims.exp=claims.iat+3*24*3600;const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
 const legacy=payload+'.'+createHmac('sha256',env.CROW_INVITE_SESSION_SECRET).update(payload).digest('hex');
 assert.equal(verifySession(legacy,env,time).nonce,claims.nonce);assert.equal(verifySession(legacy,env,time+3*24*3600000),null);
 const res=response();await createInvitationHandler({env,now:()=>time})({method:'GET',url:'/api/invitation',headers:{host,cookie:cookieName(env)+'='+legacy}},res);
 const upgraded=res.headers['Set-Cookie'].split(';')[0].split('=')[1];
 assert.equal(verifySession(upgraded,env,time+50*365*24*3600000).nonce,claims.nonce);assert.equal(res.body.expiresAt,null);
});
