import {get,head,put,BlobNotFoundError,BlobPreconditionFailedError} from '@vercel/blob';

// A short private process cache reduces polling traffic. CAS still governs writes.
export function createBlobStateStore({path,empty,validate,readBlob=get,headBlob=head,writeBlob=put,cacheMs=750,now=Date.now}) {
 let cache=null,inflight=null,generation=0;
 const copy=value=>structuredClone(value);
 async function load() {
  const started=generation;
  try {
   const metadata=await headBlob(path);
   if(cache?.etag===metadata.etag){cache.at=now();return copy(cache.value);}
   // Head must precede the consistent body read. A raced write makes this ETag
   // stale, so a later CAS retries instead of overwriting another writer.
   const found=await readBlob(path,{access:'private',useCache:false,headers:{'accept-encoding':'identity'}});
   if(!found||found.statusCode!==200||!metadata.etag)throw Error('State unavailable');
   const room=await new Response(found.stream).json();
   if(!validate(room))throw Error('Invalid state');
   const value={room,etag:metadata.etag};
   if(started===generation)cache={etag:metadata.etag,value:copy(value),at:now()};
   return value;
  } catch(error) {
   if(error instanceof BlobNotFoundError)return {room:empty(),etag:null};
   throw error;
  }
 }
 return {
  async read(){
   if(cache&&now()-cache.at<cacheMs)return copy(cache.value);
   if(!inflight)inflight=load().finally(()=>{inflight=null;});
   return copy(await inflight);
  },
  async write(room,etag){
   try {
    const result=await writeBlob(path,JSON.stringify(room),{access:'private',contentType:'application/json',addRandomSuffix:false,...(etag?{ifMatch:etag,allowOverwrite:true}:{allowOverwrite:false})});
    generation++;cache=result?.etag?{etag:result.etag,value:{room:copy(room),etag:result.etag},at:now()}:null;
    return result;
   } catch(error){generation++;cache=null;throw error;}
  },
  isConflict:error=>error instanceof BlobPreconditionFailedError||/already exists|precondition/i.test(error?.message||''),
 };
}
