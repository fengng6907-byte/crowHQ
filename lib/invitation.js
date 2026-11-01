import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_SECONDS = 3 * 24 * 60 * 60;
const publicPaths = new Set(['/join.html', '/join.css', '/join.js', '/robots.txt', '/favicon.ico', '/api/invitation']);
export const normalizeCode = code => typeof code === 'string' ? code.toUpperCase().replace(/[\s-]/g, '') : '';
const digest = value => createHash('sha256').update(value).digest();
export function configured(env = process.env) {
  return normalizeCode(env.CROW_INVITE_CODE).length >= 16 && String(env.CROW_INVITE_SESSION_SECRET || '').length >= 32;
}
export function cookieName(env = process.env) { return env.VERCEL === '1' ? '__Host-crow_guest' : 'crow_guest_dev'; }
export function founderUrl(env = process.env) {
  const host = String(env.VERCEL_URL || '').toLowerCase();
  return /^[a-z0-9-]+\.vercel\.app$/.test(host) ? `https://${host}/founder.html` : null;
}
export function ownerHost(host, env = process.env) {
  return env.VERCEL === '1' && /^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL || '') && String(host || '').toLowerCase() === env.VERCEL_URL.toLowerCase();
}
export function matchesCode(input, env = process.env) {
  if (!configured(env) || typeof input !== 'string' || input.length > 100) return false;
  return timingSafeEqual(digest(normalizeCode(input)), digest(normalizeCode(env.CROW_INVITE_CODE)));
}
export function issueSession(env = process.env, now = Date.now()) {
  if (!configured(env)) throw new Error('Invitation configuration unavailable');
  const claims = { v: 1, role: 'guest', iat: Math.floor(now / 1000), exp: Math.floor(now / 1000) + SESSION_SECONDS,
    epoch: digest(normalizeCode(env.CROW_INVITE_CODE)).toString('hex').slice(0, 24), nonce: randomBytes(12).toString('hex') };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return payload + '.' + createHmac('sha256', env.CROW_INVITE_SESSION_SECRET).update(payload).digest('hex');
}
export function verifySession(token, env = process.env, now = Date.now()) {
  if (!configured(env) || typeof token !== 'string' || token.length > 1200) return null;
  const [payload, signature, extra] = token.split('.');
  if (extra !== undefined || !payload || !/^[A-Za-z0-9_-]+$/.test(payload) || !/^[a-f0-9]{64}$/.test(signature || '')) return null;
  const expected = createHmac('sha256', env.CROW_INVITE_SESSION_SECRET).update(payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const seconds = Math.floor(now / 1000);
    if (claims.v !== 1 || claims.role !== 'guest' || !Number.isInteger(claims.iat) || !Number.isInteger(claims.exp)
      || claims.iat > seconds + 10 || claims.exp <= seconds || claims.exp - claims.iat !== SESSION_SECONDS
      || claims.epoch !== digest(normalizeCode(env.CROW_INVITE_CODE)).toString('hex').slice(0, 24)) return null;
    return claims;
  } catch { return null; }
}
export function cookieValue(header, env = process.env) {
  const name = cookieName(env) + '=';
  const part = String(header || '').split(';').map(s => s.trim()).find(s => s.startsWith(name));
  return part ? part.slice(name.length) : '';
}
export function sessionCookie(value, env = process.env, maxAge = SESSION_SECONDS) {
  return `${cookieName(env)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${env.VERCEL === '1' ? '; Secure' : ''}`;
}
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  if (value.startsWith('/api/') || value.startsWith('/join') || value.startsWith('/founder')) return '/';
  try { const u = new URL(value, 'https://crow.invalid'); return u.origin === 'https://crow.invalid' ? u.pathname + u.search + u.hash : '/'; }
  catch { return '/'; }
}

export function accessDecision(request, env = process.env, now = Date.now()) {
  const url = new URL(request.url);
  const host = request.headers.get('host') || url.host;
  if (ownerHost(host, env)) return { allow: true, role: 'founder' };
  if (publicPaths.has(url.pathname)) return { allow: true, role: 'entry' };
  if (url.pathname === '/founder.html') return { allow: false, status: 303, redirect: founderUrl(env) || '/join.html', code: 'FOUNDER_ONLY' };
  if (url.pathname.startsWith('/api/team')) return { allow: false, status: 403, code: 'PRIVATE_ROOM_REQUIRED', privateUrl: founderUrl(env)?.replace('/founder.html', '/#chat') || null };
  const claims = verifySession(cookieValue(request.headers.get('cookie'), env), env, now);
  if (claims) return { allow: true, role: 'guest' };
  if (url.pathname.startsWith('/api/')) return { allow: false, status: 401, code: 'INVITATION_REQUIRED' };
  return { allow: false, status: 303, redirect: '/join.html?next=' + encodeURIComponent(safeNext(url.pathname + url.search)), code: 'INVITATION_REQUIRED' };
}
