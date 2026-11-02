import {emptyInvites} from '../lib/invite-codes.js';
export function memoryInvites(){let state=emptyInvites(),rev=0;return {async read(){return{room:structuredClone(state),etag:String(rev)};},async write(room,etag){if(etag!==String(rev))throw Error('precondition');state=structuredClone(room);rev++;},isConflict:e=>e.message==='precondition'};}
