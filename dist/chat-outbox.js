// Keep composing responsive while delivery runs. Retries retain the message ID.
export function createOutbox({send,onChange=()=>{}}) {
 const items=new Map();let running=false;
 async function drain(){
  if(running)return;running=true;
  try{for(;;){const item=[...items.values()].find(i=>i.state==='queued');if(!item)break;item.state='sending';onChange();try{await send(item.command);items.delete(item.message.id);}catch(error){item.state='failed';item.error=error.message||'Could not send. Try again.';}onChange();}}finally{running=false;}
 }
 return {
  enqueue(message,command){if(items.size>=32||[...items.values()].filter(i=>i.state!=='failed').length>=8)return false;items.set(message.id,{message,command,state:'queued',error:''});onChange();void drain();return true;},
  retry(id){const i=items.get(id);if(i?.state==='failed'){i.state='queued';i.error='';onChange();void drain();}},
  acknowledge(messages,actorId){for(const m of messages)if(m.personId===actorId)items.delete(m.id);},
  messages(){return [...items.values()].map(i=>({...i.message,_delivery:i.state,_error:i.error}));},
  get busy(){return running;},
 };
}
