import { founderCookieName, namedCookie, issueFounderSession, verifyFounderSession, readNamedCookie } from '../lib/founder-access.js';
import { identity, readProfile, makeProfile, profileCookie, changeCommunity, cleanRoom, publicRoom, CommunityError } from '../lib/community.js';
import { communityStore } from '../lib/community-store.js';
import { csrfToken, validCsrf } from '../lib/team-room.js';
import { cookieValue, issueSession, sessionCookie, verifySession } from '../lib/invitation.js';
export function createCommunityHandler({ env = process.env, store = communityStore, now = Date.now } = {}) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, data) => { res.statusCode = status; res.end(JSON.stringify(data)); };
    try {
      const at = now(), actor = identity(req, env, at), host = req.headers.host;
      if (!actor) return send(401, { message: 'Enter your invitation code to join.' });
      let profile = readProfile(req.headers.cookie, actor, env), snapshot;
      if (actor.role === 'founder') profile = { ...actor, name: 'Bobby Ng', variant: 0 };
      if (req.method === 'GET') { const { room } = await store.read(); snapshot = publicRoom(cleanRoom(room, at), actor.id, at); }
      else if (req.method === 'POST') {
        if (req.headers.origin !== `${env.VERCEL === '1' ? 'https' : 'http'}://${host}` || !String(req.headers['content-type'] || '').startsWith('application/json')) return send(403, { message: 'Refresh the page before continuing.' });
        if (Number(req.headers['content-length'] || 0) > 4096) return send(413, { message: 'Message is too long.' });
        let body = req.body;
        if (typeof body === 'string' || Buffer.isBuffer(body)) { try { body = JSON.parse(body.toString()); } catch { return send(400, { message: 'Invalid request.' }); } }
        if (!body || Array.isArray(body) || JSON.stringify(body).length > 4096) return send(400, { message: 'Invalid request.' });
        if (!validCsrf(body.csrf, host, env.CROW_INVITE_SESSION_SECRET, at)) return send(403, { message: 'Refresh the page to reconnect.' });
        if (!['profile', 'heartbeat', 'say', 'leave', 'break', 'return', 'order'].includes(body.action)) return send(400, { message: 'Choose a valid action.' });
        if (body.action === 'profile' && actor.role !== 'founder') profile = makeProfile(actor, body.name, body.variant);
        if (!profile) return send(409, { message: 'Choose your name and character first.' });
        snapshot = await changeCommunity(store, profile, body, at);
      } else { res.setHeader('Allow', 'GET, POST'); return send(405, { message: 'Use GET or POST.' }); }
      const cookies = [];
      if (verifyFounderSession(readNamedCookie(req.headers.cookie, founderCookieName(env)), env, at)) cookies.push(namedCookie(founderCookieName(env), issueFounderSession(env, at), env));
      if (profile) cookies.push(profileCookie(profile, env));
      const guest = verifySession(cookieValue(req.headers.cookie, env), env, at);
      if (guest) cookies.push(sessionCookie(issueSession(env, at, guest.nonce), env));
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      return send(200, { ...snapshot, profile, actorId: actor.id, role: actor.role, csrf: csrfToken(host, env.CROW_INVITE_SESSION_SECRET, at), serverTime: now(), pollMs: 5000 });
    } catch (e) { return send(e instanceof CommunityError ? e.status : 503, { message: e instanceof CommunityError ? e.message : 'The community room could not connect. Your message has not been sent; please try again.' }); }
  };
}
export default createCommunityHandler();
