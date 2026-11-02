import http from 'node:http';
import { createCommunityHandler } from '../api/community.js';
import { emptyCommunity } from '../lib/community.js';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../api/team.js';
import { emptyRoom } from '../lib/team-room.js';
import { createInvitationHandler } from '../api/invitation.js';
import { accessDecision } from '../lib/invitation.js';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
let saved = emptyRoom(), revision = 0;
const memory = {
  async read() { return { room: structuredClone(saved), etag: revision ? String(revision) : null }; },
  async write(room, etag) { if ((revision ? String(revision) : null) !== etag) throw new Error('conflict'); saved = structuredClone(room); revision++; },
  isConflict: error => error.message === 'conflict',
};
const qa = process.env.CROW_LOCAL_QA === '1' || !process.env.BLOB_READ_WRITE_TOKEN;
const guestEnv = qa ? { CROW_LOCAL_QA: '1', CROW_INVITE_CODE: 'CROW-DEMO-2026-ONLY', CROW_INVITE_SESSION_SECRET: 'only-for-local-qa-not-a-production-session-secret' } : process.env;
let communitySaved = emptyCommunity(), communityRevision = 0;
const communityMemory = {
 async read() { return { room: structuredClone(communitySaved), etag: String(communityRevision) }; },
 async write(room, etag) { if (etag !== String(communityRevision)) throw new Error('conflict'); communitySaved = structuredClone(room); communityRevision++; },
 isConflict: e => e.message === 'conflict',
};
const community = createCommunityHandler({ env: guestEnv, ...(qa ? { store: communityMemory } : {}) });
const invitation = createInvitationHandler({ env: guestEnv });
const team = qa ? createHandler({ store: memory, env: { CROW_LOCAL_QA: '1' }, background: promise => promise,
  generate: async ({ employee }) => { await new Promise(r => setTimeout(r, 450)); return { text: `LOCAL QA FIXTURE — ${employee.toUpperCase()}\n\nThis is a test response for checking the conversation, work board, and completion flow. No AI model was called. In production this message comes from the configured live AI model.`, model: 'local-qa-fixture' }; }
}) : createHandler({ background: promise => promise });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const decision = accessDecision(new Request('http://' + req.headers.host + req.url, { headers: req.headers }), guestEnv);
  if (!decision.allow) {
    if (decision.redirect) { res.writeHead(decision.status, { Location: decision.redirect, 'Cache-Control': 'no-store' }); res.end(); }
    else { res.writeHead(decision.status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ code: decision.code, privateUrl: decision.privateUrl })); }
    return;
  }
  if (url.pathname === '/api/community') {
    let body = ''; for await (const piece of req) { body += piece; if (body.length > 4096) { res.writeHead(413); res.end('{}'); return; } }
    req.body = body || undefined; await community(req, res); return;
  }
  if (url.pathname === '/api/invitation') {
    let body = ''; for await (const piece of req) { body += piece; if (body.length > 2048) { res.writeHead(413); res.end('{}'); return; } }
    req.body = body || undefined; await invitation(req, res); return;
  }
  if (url.pathname === '/api/team') {
    let body = ''; for await (const piece of req) { body += piece; if (body.length > 64000) { res.writeHead(413); res.end('{}'); return; } }
    req.body = body || undefined; await team(req, res); return;
  }
  if (url.pathname === '/space-rules.js') { const content = await readFile(new URL('../lib/space-rules.js', import.meta.url)); res.writeHead(200, { 'Content-Type':'text/javascript', 'Cache-Control':'no-store' }); res.end(content); return; }
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const path = resolve(root, '.' + pathname);
  if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403); res.end(); return; }
  try { const content = await readFile(path); res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content); }
  catch { res.writeHead(404); res.end('Not found'); }
});
const flag = process.argv.indexOf('--port'); const port = Number(process.env.PORT || (flag >= 0 ? process.argv[flag + 1] : 4173));
server.listen(port, '0.0.0.0', () => console.log(`Crow HQ ${qa ? 'LOCAL QA — no live AI' : 'development'} on port ${port}`));
