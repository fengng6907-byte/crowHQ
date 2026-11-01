import { configured, cookieValue, founderUrl, issueSession, matchesCode, ownerHost, safeNext, sessionCookie, verifySession } from '../lib/invitation.js';

export function createInvitationHandler({ env = process.env, now = Date.now } = {}) {
  // A bounded, per-process cooldown supplements the high-entropy code. It is not
  // a global rate limiter, and no persistent visitor records are created.
  const attempts = new Map();
  return async function invitation(req, res) {
    const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const host = String(req.headers.host || '').toLowerCase();
    const owner = ownerHost(host, env), ownerUrl = founderUrl(env);
    const base = (env.VERCEL === '1' ? 'https://' : 'http://') + host;
    try {
      if (req.method === 'GET') {
        const action = new URL(req.url, base).searchParams.get('action');
        if (action === 'owner') {
          if (!owner) return send(403, { code: 'FOUNDER_ONLY', message: 'Sign in to the founder invitation desk.', founderUrl: ownerUrl });
          if (!configured(env)) return send(503, { message: 'Invitation access has not been configured yet.' });
          return send(200, { role: 'founder', inviteCode: env.CROW_INVITE_CODE, shareUrl: 'https://crow-hq.vercel.app/', sessionDays: 3 });
        }
        const claims = verifySession(cookieValue(req.headers.cookie, env), env, now());
        return send(200, { role: owner ? 'founder' : claims ? 'guest' : 'visitor', expiresAt: claims ? claims.exp * 1000 : null, founderUrl: ownerUrl, configured: configured(env),
          ...(env.VERCEL !== '1' && env.CROW_LOCAL_QA === '1' ? { demoCode: 'CROW-DEMO-2026-ONLY' } : {}) });
      }
      if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, { message: 'Use GET or POST.' }); }
      if (req.headers.origin !== base || !String(req.headers['content-type'] || '').startsWith('application/json')) return send(403, { message: 'Refresh the invitation page before continuing.' });
      if (Number(req.headers['content-length'] || 0) > 2048) return send(413, { message: 'The invitation request is too long.' });
      let body = req.body;
      if (typeof body === 'string' || Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString()); } catch { return send(400, { message: 'Enter the code Bobby shared with you.' }); } }
      if (!body || typeof body !== 'object' || Array.isArray(body) || JSON.stringify(body).length > 2048) return send(400, { message: 'Enter a valid invitation code.' });
      if (body.action === 'leave') { res.setHeader('Set-Cookie', sessionCookie('', env, 0)); return send(200, { next: '/join.html' }); }
      if (body.action !== 'join') return send(400, { message: 'Choose join or leave.' });
      if (!configured(env)) return send(503, { code: 'NOT_CONFIGURED', message: 'Bobby is preparing invitations. Please try again shortly.' });
      const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').slice(0, 120);
      const recent = attempts.get(ip);
      if (recent && recent.until > now() && recent.count >= 10) return send(429, { message: 'A few too many tries. Please wait 15 minutes or ask Bobby to check the code.' });
      if (!matchesCode(body.code, env)) {
        if (attempts.size > 5000) for (const [key, value] of attempts) if (value.until <= now()) attempts.delete(key);
        if (attempts.size > 5000) attempts.clear();
        attempts.set(ip, recent && recent.until > now() ? { ...recent, count: recent.count + 1 } : { count: 1, until: now() + 15 * 60 * 1000 });
        return send(401, { message: 'That invitation code doesn’t match. Check the code Bobby sent you and try again.' });
      }
      attempts.delete(ip);
      res.setHeader('Set-Cookie', sessionCookie(issueSession(env, now()), env));
      return send(200, { next: safeNext(body.next), role: 'guest' });
    } catch { return send(503, { message: 'The invitation desk is temporarily unavailable. Please try again.' }); }
  };
}
export default createInvitationHandler();
