import { next } from '@vercel/functions';
import { accessDecision } from './lib/invitation.js';

export default function proxy(request) {
  const decision = accessDecision(request);
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (decision.allow) return next({ headers });
  if (decision.redirect) return new Response(null, { status: decision.status, headers: { ...headers, Location: new URL(decision.redirect, request.url).href } });
  return Response.json({ code: decision.code, message: decision.code === 'PRIVATE_ROOM_REQUIRED' ? 'The employee workroom is founder-only.' : 'Enter your invitation code to join Crow HQ.', privateUrl: decision.privateUrl }, { status: decision.status, headers });
}
