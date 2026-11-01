import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from '../api/team.js';
import { emptyRoom } from '../lib/team-room.js';

const root = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
let saved = emptyRoom(), revision = 0;
const memory = {
  async read() { return { room: structuredClone(saved), etag: revision ? String(revision) : null }; },
  async write(room, etag) { if ((revision ? String(revision) : null) !== etag) throw new Error('conflict'); saved = structuredClone(room); revision++; },
  isConflict: error => error.message === 'conflict',
};
const qa = process.env.CROW_LOCAL_QA === '1' || !process.env.BLOB_READ_WRITE_TOKEN;
const team = qa ? createHandler({ store: memory, env: { CROW_LOCAL_QA: '1' }, background: promise => promise,
  generate: async ({ employee }) => { await new Promise(r => setTimeout(r, 450)); return { text: `LOCAL QA FIXTURE — ${employee.toUpperCase()}\n\nThis is a test response for checking the conversation, work board, and completion flow. No AI model was called. In production this message comes from the configured live AI model.`, model: 'local-qa-fixture' }; }
}) : createHandler({ background: promise => promise });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/team') {
    let body = ''; for await (const piece of req) { body += piece; if (body.length > 64000) { res.writeHead(413); res.end('{}'); return; } }
    req.body = body || undefined; await team(req, res); return;
  }
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const path = resolve(root, '.' + pathname);
  if (!path.startsWith(root + sep) && path !== root) { res.writeHead(403); res.end(); return; }
  try { const content = await readFile(path); res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(content); }
  catch { res.writeHead(404); res.end('Not found'); }
});
const flag = process.argv.indexOf('--port'); const port = Number(process.env.PORT || (flag >= 0 ? process.argv[flag + 1] : 4173));
server.listen(port, '0.0.0.0', () => console.log(`Crow HQ ${qa ? 'LOCAL QA — no live AI' : 'development'} on port ${port}`));
