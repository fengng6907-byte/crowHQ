'use strict';
(() => {
  const input = document.querySelector('#invite-code'), button = document.querySelector('#join-submit'), message = document.querySelector('#join-message');
  const requestId=Array.from(crypto.getRandomValues(new Uint8Array(24)),b=>b.toString(16).padStart(2,'0')).join('');
  const desired = new URLSearchParams(location.search).get('next') || '/';
  async function bootstrap() {
    try { const response = await fetch('/api/invitation', { cache: 'no-store' }); const data = await response.json();
      if (data.role === 'founder') { location.replace('/#founder'); return; }
      if (data.role === 'guest') { location.replace('/'); return; }
      const founder = document.querySelector('#founder-link');
      if (data.founderLoginUrl === '/api/invitation?action=founder-start') { founder.href = data.founderLoginUrl; founder.classList.remove('hidden'); }
      if (!data.configured) { message.textContent = 'Bobby is preparing invitations. Please check back shortly.'; button.disabled = true; }
      if (data.demoCode) message.textContent = 'Local QA only · test code: ' + data.demoCode;
    } catch { message.textContent = 'The invitation desk could not connect. Refresh and try again.'; }
  }
  document.querySelector('#join-form').onsubmit = async event => {
    event.preventDefault(); if (!input.value.trim()) return;
    button.disabled = true; button.firstChild.textContent = 'Checking your invitation… '; message.textContent = '';
    try { const response = await fetch('/api/invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action: 'join', code: input.value.trim(), requestId, next: desired }), signal: AbortSignal.timeout(15000) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message || 'That invitation could not be checked.');
      const target = new URL(data.next || '/', location.origin); location.assign(target.origin === location.origin ? target.href : '/');
    } catch (error) { message.textContent = error.name === 'TimeoutError' ? 'That took a little too long. Your code is still here; try again.' : error.message; button.disabled = false; button.firstChild.textContent = 'Enter the neighbourhood '; }
  };
  const c = document.querySelector('#entry-art'), ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const r = (x,y,w,h,color) => { ctx.fillStyle=color; ctx.fillRect(x,y,w,h); };
  r(0,0,680,390,'#d4e2c9');r(0,0,680,116,'#d7e8d9');
  for(let i=0;i<14;i++){const h=25+i*17%45;r(i*52-10,124-h,35,h,'#c0d3bb');}r(0,122,680,268,'#c0d0a9');
  for(const x of [81,206]){r(x+3,99,80,166,'#c4a453');r(x+9,79,68,21,'#d6b968');r(x+18,63,50,18,'#dfc679');r(x+29,49,28,16,'#e6d18b');r(x+40,20,5,32,'#b99a48');for(let y=104;y<265;y+=10){r(x,y,86,3,'#eed89a');r(x+6,y+4,74,3,'#9f995e');}for(let i=0;i<6;i++)r(x+9+i*13,107,3,155,'#e4cc85');r(x-5,265,95,9,'#d7c17a');}
  r(163,163,48,10,'#dec57e');r(166,172,42,4,'#a59b67');r(148,230,66,42,'#a18f50');r(144,222,74,13,'#617552');ctx.fillStyle='#eee2b2';ctx.font='8px monospace';ctx.fillText('CROW HQ',153,232);r(163,241,37,31,'#d5ddba');
  for(const [x,w,awning,col] of [[352,133,'#bc825d','#95604a'],[520,131,'#8aada1','#5e8580']]){r(x+5,164,w,105,'#a2af8a');r(x,152,w,105,'#e9ddba');r(x-5,143,w+10,12,'#a39c7d');r(x+8,163,w-16,20,col);r(x+9,194,w-18,52,'#a1aa8d');r(x+13,202,w-26,32,'#c1cbb0');for(let i=0;i<w;i+=18){r(x+i,186,17,13,i%36?'#efe2bf':awning);}r(x-4,254,w+8,6,'#bfb18c');}
  ctx.fillStyle='#f4e8c5';ctx.font='10px monospace';ctx.fillText('MAMAK CORNER',361,177);ctx.fillText('KEDAI KOPI',532,177);
  r(36,277,628,45,'#e4dab7');for(let x=36;x<664;x+=27)r(x,278,1,42,'#c7c5a044');r(36,321,628,5,'#abb994');
  for(const x of [372,554]){r(x,267,39,17,'#eadcba');r(x+16,283,5,21,'#96957c');r(x-9,278,8,12,'#b99472');r(x+42,278,8,12,'#b99472');r(x+12,271,8,7,'#f8eccb');}
  for(const [x,col]of [[432,'#c4a2c9'],[493,'#a2b98a'],[303,'#b88c64']]){r(x+5,265,12,12,'#6b5444');r(x+6,269,10,10,'#e5bc96');r(x+3,280,17,16,col);r(x+5,296,5,9,'#687863');r(x+14,296,5,9,'#687863');}
  for(const [x,y]of [[26,218],[313,204],[635,292]]){r(x+17,y+23,7,49,'#aa966c');r(x+2,y+8,36,25,'#86a674');r(x+9,y,24,17,'#9aba81');r(x,y+16,42,15,'#8aaf76');}
  r(0,352,680,38,'#99ac98');for(let x=14;x<680;x+=70)r(x,369,33,2,'#e4e0b8');r(124,332,97,5,'#b1c59a');
  bootstrap();
})();
