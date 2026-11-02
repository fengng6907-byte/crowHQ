import {emptyCommunity} from './community.js';
import {createBlobStateStore} from './blob-state-store.js';
export function createCommunityStore(options={}) {
 return createBlobStateStore({path:'crow-hq/community-live-v1.json',empty:emptyCommunity,validate:r=>r.version===1&&Array.isArray(r.people)&&Array.isArray(r.messages),...options});
}
export const communityStore=createCommunityStore();
