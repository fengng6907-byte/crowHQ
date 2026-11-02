import './spaces.js';
import { LOCATIONS, MENU, findMeal, messageScope } from './space-rules.js';
'use strict';
(() => {
  const panel = document.querySelector('#community-panel');
  const feed = document.querySelector('#community-feed'), status = document.querySelector('#community-status'), notice = document.querySelector('#community-notice');
  const dialog = document.querySelector('#community-profile'), nameInput = document.querySelector('#community-name');
  const locations=Object.fromEntries(Object.entries(LOCATIONS).map(([id,p])=>[id,[p.name,...p.point]]));
  const skins = ['#f1c7a1','#deb18a','#c68d65','#a86c4b','#805036'];
  const hairs = ['#373c32','#694934','#292f35','#a27646','#6c4452','#a8aaa0'];
  const shirts = ['#8fae78','#af91bf','#78a5ab','#c98a66','#d0b66a','#9c99ca','#79aaa0','#ba8190'];
  let actorId = 'preview', profile = null, role = 'guest', csrf = '', peopleNow = [], messages = [], variant = 0, active = false, busy = false, profileBusy = false, clockOffset = 0, lastBeat = 0, lastTranscript = '', hiddenSince = 0;
  const positions = new Map(); let snapshotRevision=-1, snapshotTime=0, previousSpot=null;
  const self=()=>peopleNow.find(p=>p.id===profile?.id)||(profile?{...profile,spot:'work'}:null);
  const now=()=>Date.now()+clockOffset;
  const isAway=p=>!!(p.break&&p.break.until>now());
  const awayText=p=>p.break?(p.break.kind==='lunch'?'Lunch':'Coffee')+' · '+Math.max(0,Math.ceil((p.break.until-now())/60000))+'m left':'Working';
  const viewMySpot=()=>{showView('office');sceneView(window.CrowSpaces.sceneFor(self()?.spot));document.querySelector('#office').scrollIntoView({behavior:'smooth',block:'center'});};
  const uid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2,'0')).join('');
  const tabId = uid();
  const hash = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0),16777619); return h >>> 0; };
  function appearance(p) { if(p.role==='founder') return {...person('bobby'),name:p.name}; const h = hash(p.id + ':' + p.name + ':' + p.variant); return { id: 'human', name: p.name, skin:skins[h % skins.length], hair:hairs[(h>>>4)%hairs.length], shirt:shirts[(h>>>8)%shirts.length], pants:['#4f645c','#59596b','#776450'][(h>>>12)%3], longHair:!!(h&0x10000) }; }
  function paint(canvas,p) { if (!canvas || !p) return; const c=canvas.getContext('2d'); c.imageSmoothingEnabled=false;c.clearRect(0,0,canvas.width,canvas.height);drawSprite(c,appearance(p),canvas.width*.16,canvas.height*.05,canvas.width/24); }
  function preview() { paint(document.querySelector('#community-preview'),{ id:profile?.id||actorId,name:nameInput.value||'New friend',variant,role }); }
  function editProfile() { nameInput.value=profile?.name||'';variant=profile?.variant||0;document.querySelector('#community-cancel').classList.toggle('hidden',!profile);preview();if(!dialog.open)dialog.showModal();setTimeout(()=>nameInput.focus(),50); }
  function consume(data) {
    if((data.revision||0)<snapshotRevision||((data.revision||0)===snapshotRevision&&data.serverTime<snapshotTime))return;
    snapshotRevision=data.revision||0;snapshotTime=data.serverTime;
    actorId=data.actorId||actorId;csrf=data.csrf||csrf;role=data.role||role;profile=data.profile;clockOffset=data.serverTime-Date.now();peopleNow=data.people||[];messages=data.messages||[];
    const away=peopleNow.filter(isAway).length;status.textContent=(peopleNow.length-away)+' HERE · '+away+' ON BREAK';
    const self=peopleNow.find(p=>p.id===profile?.id);
    document.querySelector('#community-my-name').textContent=profile?.name||'Your seat is waiting';
    document.querySelector('#community-my-role').textContent=profile ? (role==='founder'?'FOUNDER':'INVITED GUEST')+' · HUMAN' : 'CHOOSE A NAME TO JOIN';
    document.querySelector('#community-place').value=self?.spot||'work';
    document.querySelector('#community-edit').classList.toggle('hidden',role==='founder');
    document.querySelector('#community-text').disabled=!profile;document.querySelector('#community-send').disabled=!profile;
    if(profile)paint(document.querySelector('#community-avatar'),profile);
    document.querySelector('#community-roster').innerHTML=peopleNow.map(p=>`<span class="community-member">${safe(p.name)}${p.id===profile?.id?' · YOU':''} ${p.role==='founder'?'✦':''}<span class="human-indicator"> / ${safe(isAway(p)?'AWAY · '+awayText(p):locations[p.spot]?.[0]||'Here')}</span></span>`).join('')||'<span class="human-indicator">Be the first to settle in.</span>';
    const scope=messageScope(self||profile||{spot:'work'});const visibleMessages=messages.filter(m=>(m.scope||'community')===scope);
    document.querySelector('#community-chat-label').textContent=scope==='community'?'THE LEPAK ROOM · REAL PEOPLE':'YOUR BOSS ROOM · PRIVATE NOTES';
    document.querySelector('#community-text').placeholder=scope==='community'?'Say hello to the neighbourhood…':'A private note in your own room…';
    const transcript=scope+JSON.stringify(visibleMessages);
    if(transcript!==lastTranscript){const nearBottom=feed.scrollHeight-feed.scrollTop-feed.clientHeight<60;lastTranscript=transcript;feed.innerHTML=visibleMessages.length?visibleMessages.map(m=>`<article class="community-message"><div class="community-message-head"><strong>${safe(m.name)}</strong><small>${m.role==='founder'?'FOUNDER':'GUEST'} · ${new Date(m.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</small></div><p>${safe(m.text)}</p></article>`).join(''):(scope==='community'?'<div class="community-empty">A little hello goes a long way.<br>Say something to the humans in your neighbourhood.</div>':'<div class="community-empty">A quiet corner for your own thoughts.<br>Notes in this room are visible only to you.</div>');if(nearBottom||visibleMessages.at(-1)?.personId===profile?.id)feed.scrollTop=feed.scrollHeight;}
    window.CrowSpaces.render();if(self&&previousSpot!==self.spot){const was=previousSpot;previousSpot=self.spot;if(was!==null||self.spot!=='work')sceneView(window.CrowSpaces.sceneFor(self.spot));}
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
  document.querySelector('#community-place').onchange=e=>go(e.target.value);
  document.querySelector('#community-form').onsubmit=async e=>{e.preventDefault();const input=document.querySelector('#community-text'),button=document.querySelector('#community-send');if(!input.value.trim()||button.disabled)return;button.disabled=true;try{await api({action:'say',text:input.value,messageId:uid()});input.value='';notice.textContent='';viewMySpot();}catch(error){notice.textContent=error.message;}finally{button.disabled=!profile;}};
  function leave() { if(!profile||!csrf)return Promise.resolve();return fetch('/api/community',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'leave',tab:tabId,csrf})}).catch(()=>{}); }
  window.addEventListener('pagehide',leave);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenSince=Date.now();else{hiddenSince=0;sync(true);}});
  async function command(action,extra={}) {
    try { await api({action,...extra});lastBeat=Date.now();notice.textContent='';window.CrowSpaces.render();return true; }
    catch(error){notice.textContent=error.message;document.querySelector('#space-notice').textContent=error.message;return false;}
  }
  async function go(spot){if(await command('heartbeat',{spot})){viewMySpot();document.querySelector('#space-notice').textContent='';}}
  function draw(c,currentScene,dt) {
    const visible=peopleNow.filter(p=>window.CrowSpaces.sceneFor(p.spot)===currentScene&&(p.spot!=='suite'||p.id===profile?.id));
    const drawn=[],occupants={};
    for(const p of visible){const index=occupants[p.spot]||0;occupants[p.spot]=index+1;const target=window.CrowSpaces.position(p,index);let a=positions.get(p.id);
      if(!a||a.scene!==currentScene){const existing=p.id!==profile?.id||!!p.meal;const start=existing?target:currentScene==='town'?target:currentScene==='inside'?{x:970,y:814}:{x:500,y:600};a={x:start.x,y:start.y,path:[],target:'',scene:currentScene};positions.set(p.id,a);}
      const key=target.x+','+target.y;
      if(a.target!==key){a.target=key;const to=[target.x,target.y];a.path=currentScene==='town'?outdoorRoute([a.x,a.y],to):Math.hypot(a.x-target.x,a.y-target.y)<1?[]:currentScene==='inside'?[[a.x,814],[target.x,814],to]:currentScene==='suite'?[[500,500],[target.x,500],to]:[[a.x,610],[70,610],[70,target.y+62],[target.x,target.y+62],to];}
      const walking=a.path.length>0;if(walking){const [x,y]=a.path[0],dx=x-a.x,dy=y-a.y,d=Math.hypot(dx,dy),speed=145*dt;if(d<=speed||d<.01){a.x=x;a.y=y;a.path.shift();}else{a.x+=dx/d*speed;a.y+=dy/d*speed;}}
      const x=Math.round(a.x),y=Math.round(a.y),look=appearance(p),seated=target.seated&&!a.path.length;
      c.fillStyle=isAway(p)?'#d5ba84':p.id===profile?.id?'#bfd783':'#d3c799';c.fillRect(x-19,y-3,38,5);
      if(seated){c.save();c.beginPath();c.rect(x-20,y-56,42,34);c.clip();drawSprite(c,look,x-16,y-55,2);c.restore();}
      else drawSprite(c,look,x-16,y-40,2,walking,Math.sin(tick*9)>0?2:-2,false);
      drawn.push({p,a,x,y,seated,look});
    }
    if(MENU[currentScene])for(let i=0;i<6;i++)window.CrowSpaces.drawTableFront({spot:currentScene,seat:i*2});
    for(const {p,a,x,y,seated,look} of drawn){
      if(seated&&p.meal&&p.meal.servedAt<=now()&&p.meal.finishAt>now()){
        const item=findMeal(p.meal.place,p.meal.id);if(item){window.CrowSpaces.food(c,item,x,y-15,(now()-p.meal.servedAt)/(p.meal.finishAt-p.meal.servedAt));if(Math.sin(tick*4)>0){c.fillStyle=look.skin;c.fillRect(x+7,y-44,5,6);c.fillStyle='#9b967a';c.fillRect(x+10,y-40,2,14);c.fillStyle='#d8ba7a';c.fillRect(x+3,y-42,2,2);}if(['tea','cup','noodles'].includes(item.kind)){c.fillStyle='#fff6dd99';c.fillRect(x-2,y-39-(tick*7%12),2,5);}}
      }
      c.font='10px monospace';const label=p.name+(p.id===profile?.id?' · YOU':''),width=Math.min(195,c.measureText(label).width+18);c.fillStyle='#fffdeb';c.fillRect(x-width/2,y+9,width,17);c.fillStyle='#53674c';c.textAlign='center';c.fillText(label.slice(0,29),x,y+21);c.font='8px monospace';c.fillStyle=isAway(p)?'#94703d':'#60734f';c.fillText(isAway(p)?'AWAY · '+awayText(p):p.role==='founder'?'✦ FOUNDER · HUMAN':'HUMAN',x,y+36);c.textAlign='left';
    }
    for(const {p,a,x,y} of drawn){const m=messages.filter(m=>m.personId===p.id&&(m.scope||'community')===messageScope(p)&&now()-m.at<15000).at(-1);if(!m)continue;
      c.font='12px monospace';const lines=[];let line='';for(const char of [...m.text]){if(c.measureText(line+char).width>205){lines.push(line);line='';}line+=char;if(lines.length===3)break;}if(line&&lines.length<3)lines.push(line);if([...m.text].length>lines.join('').length)lines[lines.length-1]=lines.at(-1).slice(0,-2)+'…';
      const w=Math.max(60,...lines.map(s=>c.measureText(s).width))+22,h=lines.length*17+18,bx=Math.max(5,Math.min(cv.width-5-w,x-w/2)),by=y-63-h;
      c.fillStyle='#627451';c.fillRect(bx-2,by-2,w+4,h+4);c.fillStyle='#fffef0';c.fillRect(bx,by,w,h);c.fillRect(x-4,by+h,9,6);c.fillRect(x-2,by+h+6,5,4);c.fillStyle='#435139';lines.forEach((s,i)=>c.fillText(s,bx+11,by+19+i*17));
    }
  }
  window.CrowCommunity={draw,self,now,people:()=>peopleNow,founderStatus:()=>{const p=peopleNow.find(p=>p.role==='founder');return p?{label:isAway(p)?'AWAY · '+(p.break.kind==='lunch'?'LUNCH':'COFFEE'):(LOCATIONS[p.spot]?.name||'HERE').toUpperCase(),away:isAway(p)}:{label:'FOUNDER OFFLINE',away:false};},isJoined:()=>!!profile,go,hasFounder:()=>peopleNow.some(p=>p.role==='founder'),leave,focus:viewMySpot,
    async order(mealId){if(await command('order',{mealId})){const p=self(),target=window.CrowSpaces.position(p,0);positions.set(p.id,{x:target.x,y:target.y,path:[],target:target.x+','+target.y,scene:window.CrowSpaces.sceneFor(p.spot)});viewMySpot();toast('Your pixel meal is being prepared.');}},
    async startBreak(kind,minutes){if(await command('break',{kind,minutes})){viewMySpot();toast('You’re marked away from your real-life desk.');}},
    async endBreak(){if(await command('return')){viewMySpot();toast('Welcome back. You’re available again.');}},
    open:()=>{showView('office');panel.scrollIntoView({behavior:'smooth',block:'center'});}
  };
  document.querySelector('#community-nav').onclick=()=>window.CrowCommunity.open();
  window.addEventListener('crow-access-ready',()=>{active=true;sync(true);});
  if(window.CrowAccess){active=true;sync(true);}
  setInterval(()=>{if(!document.hidden||!hiddenSince||Date.now()-hiddenSince>25000){sync();if(document.hidden)hiddenSince=Date.now();}},5000);
})();
