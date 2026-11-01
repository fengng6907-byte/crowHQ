import { generateText } from 'ai';
import { waitUntil } from '@vercel/functions';
import { blobStore } from '../lib/blob-room.js';
import { createRoomService, protectedLocation, csrfToken, validCsrf, RoomError, MODEL } from '../lib/team-room.js';

export function createHandler({ store = blobStore, generate, env = process.env, background = waitUntil } = {}) {
  const service = createRoomService({ store, generate: generate || (async ({ model, instructions, prompt }) => {
    const result = await generateText({ model, instructions, prompt, maxOutputTokens: 1800, maxRetries: 0, timeout: 55000 });
    return { text: result.text, model };
  }), model: env.AI_GATEWAY_MODEL || MODEL });

  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Vary', 'Host');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
    try {
      const location = protectedLocation(req, env);
      if (!location.allowed) return send(403, { code: 'PRIVATE_ROOM_REQUIRED', message: 'Your team room is private. Open it with your Vercel account to continue.', privateUrl: location.privateUrl });
      if (!['GET', 'POST'].includes(req.method)) { res.setHeader('Allow', 'GET, POST'); return send(405, { message: 'Use GET or POST.' }); }
      const secret = env.BLOB_READ_WRITE_TOKEN || (location.local ? 'local-development-only' : '');
      if (!secret || (!env.BLOB_READ_WRITE_TOKEN && env.VERCEL === '1')) return send(503, { code: 'STORAGE_REQUIRED', message: 'Private conversation storage is not connected. Connect the Crow HQ Blob store in Vercel.' });
      const host = String(req.headers.host || '').toLowerCase();
      if (req.method === 'GET') {
        const url = new URL(req.url, location.local ? 'http://' + host : 'https://' + host);
        const before = Number(url.searchParams.get('before'));
        const data = await service.snapshot(Number.isFinite(before) && before > 0 ? before : null);
        return send(200, { ...data, csrf: csrfToken(host, secret), mode: env.CROW_LOCAL_QA === '1' ? 'test' : 'live', private: !location.local });
      }
      const origin = location.local ? 'http://' + host : 'https://' + host;
      if (req.headers.origin !== origin || !String(req.headers['content-type'] || '').startsWith('application/json') || !validCsrf(req.headers['x-crow-csrf'], host, secret)) return send(403, { code: 'INVALID_SESSION', message: 'Refresh the team room before sending this message.' });
      if (Number(req.headers['content-length'] || 0) > 64000) return send(413, { message: 'The brief is too long.' });
      let input = req.body;
      if (typeof input === 'string' || Buffer.isBuffer(input)) { try { input = JSON.parse(input.toString()); } catch { throw new RoomError(400, 'BAD_REQUEST', 'The message is not valid JSON.'); } }
      if (JSON.stringify(input || {}).length > 64000) return send(413, { message: 'The brief is too long.' });
      const result = await service.reserve(input);
      if (!result.duplicate) background(service.run(result.job.id));
      return send(202, result);
    } catch (error) {
      if (error instanceof RoomError) return send(error.status, { code: error.code, message: error.message });
      // Provider responses and configuration secrets never reach the browser or logs.
      return send(503, { code: 'ROOM_UNAVAILABLE', message: 'The private room is temporarily unavailable. Your draft is still here; please retry.' });
    }
  };
}
export default createHandler();
