import { get, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import { emptyRoom } from './team-room.js';
const PATH = 'crow-hq/team-room-v1.json';

export const blobStore = {
  async read() {
    try {
      const found = await get(PATH, { access: 'private', useCache: false });
      if (!found) return { room: emptyRoom(), etag: null };
      if (found.statusCode !== 200) throw new Error('Room response unavailable');
      const room = await new Response(found.stream).json();
      if (room.version !== 1 || !Array.isArray(room.messages) || !Array.isArray(room.jobs)) throw new Error('Invalid room schema');
      return { room, etag: found.blob.etag };
    } catch (error) {
      if (error instanceof BlobNotFoundError) return { room: emptyRoom(), etag: null };
      throw error;
    }
  },
  async write(room, etag) {
    return put(PATH, JSON.stringify(room), {
      access: 'private', contentType: 'application/json', addRandomSuffix: false,
      ...(etag ? { ifMatch: etag, allowOverwrite: true } : { allowOverwrite: false }),
    });
  },
  isConflict(error) {
    return error instanceof BlobPreconditionFailedError || /already exists|precondition/i.test(error?.message || '');
  },
};
