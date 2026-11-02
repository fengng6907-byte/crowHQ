import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ownerHost, SESSION_SECONDS } from './invitation.js';

export const COMMUNITY_ORIGIN = 'https://crow-hq.vercel.app';
const keyReady = env => String(env.CROW_INVITE_SESSION_SECRET || '').length >= 32;
const sha = value => createHash('sha256').update(value).digest('hex');
const mac = (purpose, payload, env) => createHmac('sha256', env.CROW_INVITE_SESSION_SECRET).update(purpose + ':' + payload).digest();
const sign = (purpose, claims, env) => {
  if (!keyReady(env)) throw new Error('Founder access unavailable');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return payload + '.' + mac(purpose, payload, env).toString('hex');
};
function verify(purpose, token, env) {
  if (!keyReady(env) || typeof token !== 'string' || token.length > 2400) return null;
  const [payload, signature, extra] = token.split('.');
  if (extra || !/^[A-Za-z0-9_-]+$/.test(payload || '') || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
  if (!timingSafeEqual(mac(purpose, payload, env), Buffer.from(signature, 'hex'))) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url')); } catch { return null; }
}
export const founderCookieName = env => env.VERCEL === '1' ? '__Host-crow_founder' : 'crow_founder_dev';
export const claimCookieName = env => env.VERCEL === '1' ? '__Host-crow_claim' : 'crow_claim_dev';
export function readNamedCookie(header, name) {
  return String(header || '').split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1) || '';
}
export const namedCookie = (name, value, env, age = SESSION_SECONDS) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${env.VERCEL === '1' ? '; Secure' : ''}`;
export function issueFounderSession(env, now = Date.now()) {
  return sign('founder-session', { v: 1, role: 'founder', sub: 'bobby', project: 'crow-hq', iat: Math.floor(now / 1000) }, env);
}
export function verifyFounderSession(token, env, now = Date.now()) {
  const claims = verify('founder-session', token, env);
  return claims?.v === 1 && claims.role === 'founder' && claims.sub === 'bobby' && claims.project === 'crow-hq' && Number.isInteger(claims.iat) && claims.iat <= Math.floor(now / 1000) + 10 && !Object.hasOwn(claims, 'exp') ? claims : null;
}
export function isFounder(req, env, now = Date.now()) {
  return ownerHost(req.headers.host, env) || !!verifyFounderSession(readNamedCookie(req.headers.cookie, founderCookieName(env)), env, now);
}
export function newFounderChallenge() {
  const nonce = randomBytes(32).toString('hex'); return { nonce, challenge: sha(nonce) };
}
export function issueFounderClaim(challenge, env, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(challenge || '')) throw new Error('Invalid claim challenge');
  return sign('founder-claim', { v: 1, purpose: 'reclaim-bobby', challenge, aud: COMMUNITY_ORIGIN, iss: env.VERCEL_URL, iat: now, exp: now + 120000 }, env);
}
export function verifyFounderClaim(ticket, nonce, env, now = Date.now()) {
  if (!/^[a-f0-9]{64}$/.test(nonce || '')) return false;
  const claims = verify('founder-claim', ticket, env);
  return !!(claims?.v === 1 && claims.purpose === 'reclaim-bobby' && claims.challenge === sha(nonce) && claims.aud === COMMUNITY_ORIGIN && claims.iss === env.VERCEL_URL && Number.isInteger(claims.iat) && Number.isInteger(claims.exp) && claims.iat <= now + 10000 && claims.exp > now && claims.exp - claims.iat === 120000);
}
