import { LOCATIONS, findMeal, inBreak, messageScope, canReadMessage } from './space-rules.js';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { isFounder } from './founder-access.js';
import { cookieValue, verifySession, ownerHost, configured, SESSION_SECONDS } from './invitation.js';
export const PRESENCE_MS = 180000, MESSAGE_MS = 15 * 60000;
export const SPOTS = Object.freeze(Object.fromEntries(Object.entries(LOCATIONS).map(([id,p])=>[id,p.point])));
export const emptyCommunity = () => ({ version: 1, people: [], messages: [] });
export class CommunityError extends Error { constructor(status, message) { super(message); this.status = status; } }
const hmac = (value, env) => createHmac('sha256', env.CROW_INVITE_SESSION_SECRET).update(value).digest('hex');
export function identity(req, env, now) {
  if (!configured(env)) return null;
  if (isFounder(req, env, now)) return { id: hmac('community:founder', env).slice(0, 24), role: 'founder' };
  const session = verifySession(cookieValue(req.headers.cookie, env), env, now);
  return session ? { id: session.nonce, role: 'guest' } : null;
}
const profileName = env => env.VERCEL === '1' ? '__Host-crow_person' : 'crow_person_dev';
export function readProfile(header, actor, env) {
  const raw = String(header || '').split(';').map(x => x.trim()).find(x => x.startsWith(profileName(env) + '='))?.split('=')[1];
  if (!raw || raw.length > 2000) return null;
  const [payload, signature, extra] = raw.split('.');
  if (extra || !/^[a-f0-9]{64}$/.test(signature || '') || !payload) return null;
  if (!timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(hmac('profile:' + payload, env), 'hex'))) return null;
  try { const p = JSON.parse(Buffer.from(payload, 'base64url')); return p.id === actor.id && typeof p.name === 'string' && Number.isInteger(p.variant) ? { ...p, role: actor.role } : null; } catch { return null; }
}
export function makeProfile(actor, name, variant = 0) {
  if (typeof name !== 'string') throw new CommunityError(400, 'Enter your name first.');
  name = name.normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim();
  if (!name || [...name].length > 24) throw new CommunityError(400, 'Use a name between 1 and 24 characters.');
  if (!Number.isInteger(variant) || variant < 0 || variant > 999999) throw new CommunityError(400, 'Choose a valid character.');
  return { ...actor, name, variant };
}
export function profileCookie(profile, env) {
  const payload = Buffer.from(JSON.stringify(profile)).toString('base64url');
  return `${profileName(env)}=${payload}.${hmac('profile:' + payload, env)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_SECONDS}${env.VERCEL === '1' ? '; Secure' : ''}`;
}
export function cleanRoom(room, now) {
  room.people = room.people.map(p => {
    const person = { ...p, tabs: Object.fromEntries(Object.entries(p.tabs || {}).filter(([, at]) => at > now - PRESENCE_MS)) };
    if (person.break && !inBreak(person,now)) { person.spot = person.break.returnSpot || 'work'; person.break = null; person.meal = null; }
    if (person.meal && person.meal.finishAt <= now) person.meal = null;
    return person;
  }).filter(p => Object.keys(p.tabs).length || inBreak(p,now));
  room.messages = room.messages.filter(m => m.at > now - MESSAGE_MS).slice(-100);
  return room;
}
export function publicRoom(room, viewerId, now = Date.now()) {
  return { revision:room.revision||0, people: room.people.map(({ tabs, ...p }) => ({ ...p, availability: inBreak(p,now) ? 'away' : 'available' })), messages: room.messages.filter(m=>canReadMessage(m,viewerId)) };
}
export async function changeCommunity(store, profile, command, now) {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(command.tab || '')) throw new CommunityError(400, 'Refresh this tab to reconnect.');
  for (let attempt = 0; attempt < 7; attempt++) {
    const { room, etag } = await store.read(); cleanRoom(room, now);
    let person = room.people.find(p => p.id === profile.id);
    if (command.action === 'leave') {
      if (person) { delete person.tabs[command.tab]; room.people = room.people.filter(p => Object.keys(p.tabs).length || inBreak(p,now)); }
    } else {
      if (!person) {
        if (room.people.length >= 40) throw new CommunityError(409, 'The neighbourhood is full. Please try again shortly.');
        person = { ...profile, spot: 'work', tabs: {}, joinedAt: now }; room.people.push(person);
      }
      Object.assign(person, profile); person.tabs[command.tab] = now;
      if (command.roomId !== undefined && command.roomId !== profile.id) throw new CommunityError(403, 'That boss room belongs to someone else.');
      if (command.spot !== undefined) {
        if (!Object.hasOwn(SPOTS, command.spot)) throw new CommunityError(400, 'Choose a place on the map.');
        if (person.spot !== command.spot) person.meal = null;
        person.spot = command.spot;
        if (['work','hq','suite','park'].includes(person.spot)) person.lastWorkSpot=person.spot;
      }
      if (command.action === 'break') {
        if (!['lunch','coffee'].includes(command.kind) || !Number.isInteger(command.minutes) || command.minutes < 1 || command.minutes > 240) throw new CommunityError(400,'Choose lunch or coffee and a duration from 1 to 240 minutes.');
        const returnSpot = person.break?.returnSpot || person.lastWorkSpot || (['work','hq','suite','park'].includes(person.spot) ? person.spot : 'work');
        person.break = { kind:command.kind, startedAt:now, until:now+command.minutes*60000, returnSpot };
        if (!['mamak','kopi','seven'].includes(person.spot)) person.spot = command.kind === 'lunch' ? 'mamak' : 'kopi';
        person.meal = null;
      }
      if (command.action === 'return') {
        person.spot = person.break?.returnSpot || 'hq'; person.break = null; person.meal = null;
      }
      if (command.action === 'order') {
        if (!findMeal(person.spot,command.mealId)) throw new CommunityError(400,'Take a seat in that restaurant and choose something from its menu.');
        if (person.meal && person.meal.finishAt > now) throw new CommunityError(409,'Enjoy your current meal first.');
        person.meal = { id:command.mealId, place:person.spot, orderedAt:now, servedAt:now+6000, finishAt:now+96000 };
      }
      if (['mamak','kopi','seven'].includes(person.spot)) {
        const used = new Set(room.people.filter(p=>p.id!==person.id&&p.spot===person.spot).map(p=>p.seat));
        if (!Number.isInteger(person.seat) || person.seat < 0 || person.seat >= 12 || used.has(person.seat)) person.seat = Array.from({length:12},(_,i)=>i).find(i=>!used.has(i));
        if (person.seat === undefined) throw new CommunityError(409,'All tables are taken. Try another restaurant or come back shortly.');
      } else delete person.seat;
      if (command.action === 'say') {
        if (typeof command.text !== 'string' || !command.text.trim() || [...command.text].length > 280) throw new CommunityError(400, 'Write a message up to 280 characters.');
        if (!/^[a-zA-Z0-9_-]{8,80}$/.test(command.messageId || '')) throw new CommunityError(400, 'Refresh before sending.');
        if (!room.messages.some(m => m.id === command.messageId && m.personId === profile.id)) {
          const recent = room.messages.filter(m => m.personId === profile.id && m.at > now - 60000);
          if (recent.length >= 12) throw new CommunityError(429, 'Give the conversation a moment before sending again.');
          room.messages.push({ id: command.messageId, personId: profile.id, name: profile.name, role: profile.role, scope: messageScope(person), text: command.text.trim().replace(/[\p{Cc}\p{Cf}]/gu, ' '), at: now });
          room.messages = room.messages.slice(-100);
        }
      }
    }
    room.revision=(room.revision||0)+1;
    try { await store.write(room, etag); return publicRoom(room,profile.id,now); }
    catch (error) { if (!store.isConflict(error)) throw error; }
  }
  throw new CommunityError(409, 'The room is busy. Try again in a moment.');
}
