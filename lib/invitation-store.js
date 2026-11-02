import {createBlobStateStore} from './blob-state-store.js';
import {emptyInvites} from './invite-codes.js';
export const invitationStore=createBlobStateStore({path:'crow-hq/single-use-invitations-v1.json',empty:emptyInvites,cacheMs:500,validate:r=>r.version===1&&Number.isSafeInteger(r.generation)&&r.generation>=0&&Array.isArray(r.receipts)});
