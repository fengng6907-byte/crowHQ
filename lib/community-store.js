import { get, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import { emptyCommunity } from './community.js';
const PATH = 'crow-hq/community-live-v1.json';
export const communityStore = {
  async read() {
    try {
      const found = await get(PATH, { access: 'private', useCache: false });
      if (!found) return { room: emptyCommunity(), etag: null };
      if (found.statusCode !== 200) throw new Error('Community unavailable');
      const room = await new Response(found.stream).json();
      if (room.version !== 1 || !Array.isArray(room.people) || !Array.isArray(room.messages)) throw new Error('Invalid community state');
      return { room, etag: found.blob.etag };
    } catch (e) { if (e instanceof BlobNotFoundError) return { room: emptyCommunity(), etag: null }; throw e; }
  },
  write(room, etag) { return put(PATH, JSON.stringify(room), { access: 'private', contentType: 'application/json', addRandomSuffix: false, ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false }) }); },
  isConflict: e => e instanceof BlobPreconditionFailedError || /already exists|precondition/i.test(e?.message || ''),
};
