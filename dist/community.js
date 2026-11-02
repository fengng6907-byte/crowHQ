'use strict';
(() => {
  const panel = document.querySelector('#community-panel');
  const feed = document.querySelector('#community-feed'), status = document.querySelector('#community-status'), notice = document.querySelector('#community-notice');
  const dialog = document.querySelector('#community-profile'), nameInput = document.querySelector('#community-name');
  const locations = { work: ['Working together',810,702], mamak: ['Mamak break',770,550], kopi: ['Kopitiam break',1205,550], seven: ['7-Eleven run',1020,550], park: ['Park break',450,701] };
  const skins = ['#f1c7a1','#deb18a','#c68d65','#a86c4b','#805036'];
  const hairs = ['#373c32','#694934','#292f35','#a27646','#6c4452','#a8aaa0'];
  const shirts = ['#8fae78','#af91bf','#78a5ab','#c98a66','#d0b66a','#9c99ca','#79aaa0','#ba8190'];
  let actorId = 'preview', profile = null, role = 'guest', csrf = '', peopleNow = [], messages = [], variant = 0, active = false, busy = false, profileBusy = false, clockOffset = 0, lastBeat = 0, lastTranscript = '', hiddenSince = 0;
  const positions = new Map();
  const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2,'0')).join('');
  const tabId = uid();
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0),16777619); return h >>> 0; };
  function appearance(p) { if(p.role==='founder') return {...person('bobby'),name:p.name}; const h = hash(p.id + ':' + p.name + ':' + p.variant); return { id: 'human', name: p.name, skin:skins[h % skins.length], hair:hairs[(h>>>4)%hairs.length], shirt:shirts[(h>>>8)%shirts.length], pants:['#4f645c','#59596b','#776450'][(h>>>12)%3], longHair:!!(h&0x10000) }; }
  function paint(canvas,p) { if (!canvas || !p) return; const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;c.clearRect(0,0,canvas.width,canvas.height);drawSprite(c,appearance(p),canvas.width*.16,canvas.height*.05,canvas.width/24); }
  function preview() { paint(document.querySelector('#community-preview'),{ id:profile?.id||actorId,name:nameInput.value||'New friend',variant,role }); }
  function editProfile() { nameInput.value=profile?.name||'';variant=profile?.variant||0;document.querySelector('#community-cancel').classList.toggle('hidden',!profile);preview();if(!dialog.open)dialog.showModal();setTimeout(()=>nameInput.focus(),50); }
  function consume(data) {
    actorId=data.actorId||actorId;csrf=data.csrf||csrf;role=data.role||role;profile=data.profile;clockOffset=data.serverTime-Date.now();peopleNow=data.people||[];messages=data.messages||[];
    status.textContent=peopleNow.length+' HUMAN'+(peopleNow.length===1?'':'S')+' ONLINE';
    const self=peopleNow.find(p=>p.id===profile?.id);
    document.querySelector('#community-my-name').textContent=profile?.name||'Your seat is waiting';
    document.querySelector('#community-my-role').textContent=profile ? (role==='founder'?'FOUNDER':'INVITED GUEST')+' · HUMAN' : 'CHOOSE A NAME TO JOIN';
    document.querySelector('#community-place').value=self?.spot||'work';
    document.querySelector('#community-edit').classList.toggle('hidden',role==='founder');
    document.querySelector('#community-text').disabled=!profile;document.querySelector('#community-send').disabled=!profile;
    if(profile)paint(document.querySelector('#community-avatar'),profile);
    document.querySelector('#community-roster').innerHTML=peopleNow.map(p=>`<span class="community-member">${safe(p.name)}${p.id===profile?.id?' · YOU':''} ${p.role==='founder'?'✦':''}<span class="human-indicator"> / ${safe(locations[p.spot]?.[0]||'Here')}</span></span>`).join('')||'<span class="human-indicator">Be the first to settle in.</span>';
    const transcript=JSON.stringify(messages);
    if(transcript!==lastTranscript){const nearBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<60;lastTranscript=transcript;feed.innerHTML=messages.length?messages.map(m=>`<article class="community-message"><div class="community-message-head"><strong>${safe(m.name)}</strong><small>${m.role==='founder'?'FOUNDER':'GUEST'} · ${new Date(m.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div><p>${safe(m.text)}</p></article>`).join(''):'<div class="community-empty">A little hello goes a long way.<br>Say something to the humans in your neighbourhood.</div>';if(nearBottom||messages.at(-1)?.personId===profile?.id)feed.scrollTop=feed.scrollHeight;}
    for(const id of positions.keys())if(!peopleNow.some(p=>p.id===id))positions.delete(id);
  }
  async function api(command) {
    const response=await fetch('/api/community', { method:command?'POST':'GET', credentials:'same-origin',cache:'no-store',headers:command?{'Content-Type':'application/json'}:{},body:command?JSON.stringify({...command,csrf,tab:tabId}):undefined, signal:AbortSignal.timeout(18000) });
    const data=await response.json();if(response.status===401){location.replace('/join.html');throw new Error('Your invitation is needed.');}if(!response.ok)throw new Error(data.message||'The community could not connect.');consume(data);return data;
  }
  async function sync(force=false) {
    if(!active||busy)return;busy=true;
    try { if(profile&&(force||Date.now()-lastBeat>40000)){await api({action:'heartbeat'});lastBeat=Date.now();}else { await api(); if(profile && !lastBeat) { await api({action:'heartbeat'});lastBeat=Date.now(); } }notice.textContent='';if(!profile&&!dialog.open)editProfile(); }
    catch(e){status.textContent='RECONNECTING';notice.textContent=e.message;}
    finally{busy=false;}
  }
  document.querySelector('#community-profile-form').onsubmit=async e=>{e.preventDefault();if(profileBusy)return;profileBusy=true;const button=document.querySelector('#community-save');button.disabled=true;const error=document.querySelector('#community-profile-error');error.textContent='';try{await api({action:'profile',name:nameInput.value,variant});lastBeat=Date.now();dialog.close();sceneView('town');toast('Your seat is ready. Welcome, '+profile.name+'.');}catch(e){error.textContent=e.message;}finally{profileBusy=false;button.disabled=false;}};
  dialog.addEventListener('cancel',e=>{if(!profile)e.preventDefault();});
  nameInput.addEventListener('input',preview);
  document.querySelector('#community-regenerate').onclick=()=>{variant=Math.floor(Math.random()*1000000);preview();};
  document.querySelector('#community-edit').onclick=editProfile;
  document.querySelector('#community-cancel').onclick=()=>dialog.close();
  document.querySelector('#community-place').onchange=async e=>{try{await api({action:'heartbeat',spot:e.target.value});lastBeat=Date.now();sceneView('town');document.querySelector('#office').scrollIntoView({behavior:'smooth',block:'center'});}catch(error){notice.textContent=error.message;}};
  document.querySelector('#community-form').onsubmit=async e=>{e.preventDefault();const input=document.querySelector('#community-text'),button=document.querySelector('#community-send');if(!input.value.trim()||button.disabled)return;button.disabled=true;try{await api({action:'say',text:input.value,messageId:uid()});input.value='';notice.textContent='';sceneView('town');document.querySelector('#office').scrollIntoView({behavior:'smooth',block:'center'});}catch(error){notice.textContent=error.message;}finally{button.disabled=!profile;}};
  function leave() { if(!profile||!csrf)return Promise.resolve();return fetch('/api/community',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',tab:tabId,csrf})}).catch(()=>{}); }
  window.addEventListener('pagehide',leave);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenSince=Date.now();else{hiddenSince=0;sync(true);}});
  function draw(c,currentScene,dt) {
    if(currentScene!=='town')return;
    const occupants={};
    for(const p of peopleNow){const spot=locations[p.spot]||locations.work,slot=occupants[p.spot]||0;occupants[p.spot]=slot+1;
      const cols=p.spot==='work'?5:4,tx=spot[1]+(slot%cols)*39-(p.spot==='work'?0:45),ty=spot[2]+Math.floor(slot/cols)*43;
      let a=positions.get(p.id);if(!a){a={x:tx,y:ty,path:[],target:''};positions.set(p.id,a);}
      const target=tx+','+ty;if(a.target!==target){a.path=outdoorRoute([a.x,a.y],[tx,ty]);a.target=target;}
      const walking=a.path.length>0;
      if(walking){const [x,y]=a.path[0],dx=x-a.x,dy=y-a.y,d=Math.hypot(dx,dy),speed=90*dt;if(d<=speed||d<.01){a.x=x;a.y=y;a.path.shift();}else{a.x+=dx/d*speed;a.y+=dy/d*speed;}}
      const x=Math.round(a.x),y=Math.round(a.y);c.fillStyle=p.id===profile?.id?'#bfd783':'#d3c799';c.fillRect(x-19,y-3,38,5);
      drawSprite(c,appearance(p),x-16,y-40,2,walking,Math.sin(Date.now()/130)>0?2:-2,false);
      c.font='10px monospace';const label=p.name+(p.id===profile?.id?' · YOU':''),width=Math.min(195,c.measureText(label).width+18);c.font='10px monospace';c.fillStyle='#fffdeb';c.fillRect(x-width/2,y+9,width,17);c.fillStyle='#53674c';c.textAlign='center';c.fillText(label,x,y+21);c.font='7px monospace';c.fillStyle='#60734f';c.fillText(p.role==='founder'?'✦ FOUNDER · HUMAN':'HUMAN',x,y+35);c.textAlign='left';
    }
    // Paint speech last so it remains readable above all characters.
    for(const p of peopleNow){const a=positions.get(p.id),m=messages.filter(m=>m.personId===p.id&&Date.now()+clockOffset-m.at<15000).at(-1);if(!a||!m)continue;
      c.font='12px monospace';const maxWidth=205,lines=[];let line='';for(const char of [...m.text]){if(c.measureText(line+char).width>maxWidth){lines.push(line);line='';}line+=char;if(lines.length===3)break;}if(line&&lines.length<3)lines.push(line);if([...m.text].length>lines.join('').length)lines[lines.length-1]=lines.at(-1).slice(0,-2)+'…';
      const w=Math.max(60,...lines.map(s=>c.measureText(s).width))+22,h=lines.length*17+18,bx=Math.max(5,Math.min(1395-w,a.x-w/2)),by=a.y-57-h;
      c.fillStyle='#627451';c.fillRect(bx-2,by-2,w+4,h+4);c.fillStyle='#fffef0';c.fillRect(bx,by,w,h);c.fillRect(a.x-4,by+h,9,6);c.fillRect(a.x-2,by+h+6,5,4);c.fillStyle='#435139';lines.forEach((s,i)=>c.fillText(s,bx+11,by+19+i*17));
    }
  }
  window.CrowCommunity={ draw,hasFounder:()=>peopleNow.some(p=>p.role==='founder'),leave,focus:()=>{showView('office');sceneView('town');document.querySelector('#office').scrollIntoView({behavior:'smooth',block:'center'});},open:()=>{showView('office');panel.scrollIntoView({behavior:'smooth',block:'center'});} };
  document.querySelector('#community-nav').onclick=()=>window.CrowCommunity.open();
  window.addEventListener('crow-access-ready',()=>{active=true;sync(true);});
  if(window.CrowAccess){active=true;sync(true);}
  setInterval(()=>{if(!document.hidden||!hiddenSince||Date.now()-hiddenSince>25000){sync();if(document.hidden)hiddenSince=Date.now();}},5000);
})();
