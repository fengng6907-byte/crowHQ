import { get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import { emptyCommunity } from './community.js';
const PATH = 'crow-hq/community-live-v1.json';
export function createCommunityStore({ readBlob = get, headBlob = head, writeBlob = put } = {}) {
  return {
    async read() {
      try {
        // Read the authoritative storage validator BEFORE the consistent body read.
        // Content-serving proxies can supply a transformed/weak HTTP ETag. Using
        // that validator for a storage CAS can reject every subsequent update.
        // A write between head and get makes this ETag stale, so CAS safely retries.
        const metadata = await headBlob(PATH);
        const found = await readBlob(PATH, { access: 'private', useCache: false, headers: { 'accept-encoding':'identity' } });
        if (!found) return { room: emptyCommunity(), etag: null };
        if (found.statusCode !== 200 || !metadata.etag) throw new Error('Community unavailable');
        const room = await new Response(found.stream).json();
        if (room.version !== 1 || !Array.isArray(room.people) || !Array.isArray(room.messages)) throw new Error('Invalid community state');
        return { room, etag: metadata.etag };
      } catch (error) {
        if (error instanceof BlobNotFoundError) return { room: emptyCommunity(), etag: null };
        throw error;
      }
    },
    write(room, etag) { return writeBlob(PATH, JSON.stringify(room), { access:'private', contentType:'application/json', addRandomSuffix:false, ...(etag ? { ifMatch:etag, allowOverwrite:true } : { allowOverwrite:false }) }); },
    isConflict: error => error instanceof BlobPreconditionFailedError || /already exists|precondition/i.test(error?.message || ''),
  };
}
export const communityStore = createCommunityStore();
