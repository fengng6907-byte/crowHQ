import { LOCATIONS, MENU, findMeal } from './space-rules.js';

const $s = selector => document.querySelector(selector);
const titles = {mamak:'Mamak Corner · dine in',kopi:'Kedai Kopi Pagi · dine in',seven:'7-Eleven · the little café',suite:'Your private boss room'};
const R=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
const T=(s,x,y,color='#667557',size=11)=>{ctx.font=`${size}px monospace`;ctx.fillStyle=color;ctx.fillText(s,x,y);};
const tile=(x,y,w,h,color='#e6dfc3')=>{R(x,y,w,h,color);for(let j=y;j<y+h;j+=23)R(x,j,w,1,'#b9b99a50');for(let i=x;i<x+w;i+=46)R(i,y,1,h,'#b9b99a50');};
const frame=(x,y,w,h,color='#aab595')=>{R(x-6,y-6,w+12,h+12,color);R(x,y,w,h,'#f0ebd3');};
function windowArt(x,y,w=150){R(x-5,y-5,w+10,88,'#a0b3a0');R(x,y,w,76,'#b5d3c6');for(let i=0;i<6;i++)R(x+i*w/6,y+32-(i*13%25),w/6-4,44+(i*13%25),'#8fb9a1');R(x+w/2-3,y,5,76,'#e0e7cb');R(x,y+37,w,4,'#d9e3cb');R(x-9,y+77,w+18,8,'#c0c7a7');}
function pot(x,y){R(x+2,y,22,25,'#c3a077');R(x+7,y+4,12,18,'#ddc091');R(x+10,y-25,6,29,'#849d68');R(x-2,y-23,16,9,'#8faf76');R(x+14,y-32,17,10,'#6c925d');R(x+2,y-39,14,12,'#9fbb80');}
function seat(index){const group=Math.floor(index/2),col=group%3,row=Math.floor(group/3);return{x:220+col*280+(index%2?36:-36),y:340+row*180+45,cx:220+col*280,cy:340+row*180};}
function roomShell(theme){
 R(0,0,1000,650,theme==='seven'?'#edf1df':'#d8dfc3');frame(35,65,930,540);tile(43,73,914,524,theme==='kopi'?'#d8ceb0':'#e5ddbc');R(43,73,914,137,theme==='mamak'?'#f0dfb8':theme==='kopi'?'#dbe0c7':'#f1f1dc');R(43,204,914,10,theme==='mamak'?'#ad7154':theme==='kopi'?'#74968b':'#63a17d');R(43,214,914,7,'#fff1d1');R(43,590,914,8,'#adb294');
}
function drawRestaurant(place){
 roomShell(place);const accent=place==='mamak'?'#9d5943':place==='kopi'?'#5d817c':'#3d916c';
 R(68,87,485,46,accent);T(place==='mamak'?'RESTORAN MAMAK  /  LEPAK DULU':place==='kopi'?'KEDAI KOPI PAGI  /  早安':'7-ELEVEN  /  A LITTLE PIT STOP',85,116,'#fff0ce',17);
 T(place==='mamak'?'ROTI CANAI • NASI LEMAK • TEH TARIK':place==='kopi'?'KOPI • KAYA TOAST • GOOD COMPANY':'SNACKS • COLD DRINKS • A LITTLE RESET',83,157,'#897652',11);
 if(place==='mamak'){
  R(65,177,450,73,'#bd9d70');R(60,168,460,12,'#e5ce9c');for(let i=0;i<7;i++){R(80+i*56,184,40,34,i%2?'#dbb66e':'#dedac0');R(84+i*56,189,32,8,'#b9c3a0');}R(585,110,128,100,'#b1b59a');R(594,122,111,62,'#778c78');for(let i=0;i<3;i++){R(604+i*34,151,23,12,'#d4cbb2');R(608+i*34,143,15,10,'#8b8b77');}const fan=Math.sin(tick*5)>0;R(818,92,7,77,'#8b8f71');R(fan?785:812,fan?121:94,fan?74:17,fan?14:68,'#c0c4a4');R(810,119,21,20,'#989f7f');T('DAPUR / KITCHEN',594,203,'#7a8468',10);
 }else if(place==='kopi'){
  R(66,178,452,72,'#a68c66');R(61,169,462,12,'#d7c8a0');for(let i=0;i<6;i++){R(79+i*70,190,51,49,'#927b5b');R(83+i*70,194,43,3,'#c6b58c');}R(582,113,49,78,'#8a8e7b');R(588,119,37,38,'#bcbfa0');R(596,154,21,8,'#6c7667');R(590,193,63,7,'#ddd1ae');R(675,163,58,25,'#c8b591');R(681,146,46,18,'#e9d7a6');for(const x of [760,880]){R(x,77,3,39,'#978263');R(x-11,116,25,34,'#bc8c5c');R(x-7,120,17,26,'#dbb071');R(x+1,150,3,12,'#a87550');}windowArt(760,190,135);
 }else{
  R(65,134,490,8,'#e6a35c');R(65,143,490,5,'#faf2d9');R(65,149,490,9,'#61a27b');for(let k=0;k<3;k++){R(590+k*113,91,99,154,'#97ada1');R(597+k*113,99,85,137,'#b8d2bd');R(671+k*113,108,4,116,'#e8edcf');for(let j=0;j<4;j++){R(603+k*113,126+j*28,64,3,'#e3e2be');for(let z=0;z<5;z++)R(605+k*113+z*13,110+j*28,8,15,['#b17c52','#d0c478','#85aa86','#d1a787'][z%4]);}}R(70,184,440,66,'#bfc5a5');R(65,174,450,13,'#e6e4c6');R(375,141,67,32,'#728d7a');R(382,146,50,19,'#b9d2ac');T('HOT BITES',85,209,'#738569',11);
 }
 // A staff character and steam are decorative; visitors remain clearly labelled humans.
 const staff=person(place==='mamak'?'matthew':place==='kopi'?'greentea':'jiayee');drawSprite(ctx,{...staff,shirt:place==='seven'?'#4d9c78':'#e3d9b9'},300+Math.sin(tick*.45)*65,174,2,false);R(280,222,155,28,accent);
 for(let i=0;i<3;i++){const sy=154-((tick*9+i*11)%33);R(138+i*8,sy,3,6,'#fff9e4a0');}
 for(let i=0;i<6;i++){const s=seat(i*2);R(s.cx-73,s.cy+44,146,12,'#9c946d40');for(const dx of [-36,36]){R(s.cx+dx-14,s.cy-3,28,27,place==='mamak'?'#b87651':place==='kopi'?'#8d9973':'#79a48b');R(s.cx+dx-13,s.cy+17,26,7,'#d1bb8c');}R(s.cx-64,s.cy+22,128,36,'#a98960');R(s.cx-68,s.cy+14,136,29,place==='kopi'?'#e8e1c6':'#d6bf8f');T('0'+(i+1),s.cx-5,s.cy+71,'#8f987b',9);}
 pot(75,551);pot(911,551);R(444,590,112,13,'#cad0af');T('JALAN LEPAK  ↑',447,624,'#839074',11);
}
function drawSuite(){
 const self=window.CrowCommunity?.roomOwner(),name=self?.name||'Your';R(0,0,1000,650,'#d5dfc7');frame(75,70,850,505);tile(83,78,834,489,'#e0d8b7');R(83,78,834,149,'#eee6ca');R(83,221,834,9,'#acb494');windowArt(128,104,225);windowArt(639,104,225);
 const color=self?.role==='founder'?'#698a90':'#80946c';R(388,108,224,41,color);T(name.slice(0,21).toUpperCase(),404,133,'#f7efcf',13);T(self?.roomOpen===false?'BOSS ROOM / DOOR CLOSED':'BOSS ROOM / VISITORS WELCOME',395,166,'#8b957a',9);
 R(335,275,325,86,'#bca176');R(328,267,339,20,'#d9c59b');R(441,207,104,67,'#8b9c82');R(448,214,90,49,'#b6ccb0');R(455,222,63,4,'#e7eccb');R(455,235,48,3,'#d4e4bb');R(483,272,21,10,'#84947b');R(428,298,111,17,'#e7dbb6');for(let k=0;k<12;k++)R(433+k*8,302,4,3,'#a2a98b');R(577,292,21,28,'#efe6c8');R(581,287,13,7,'#887d58');R(462,374,39,11,color);
 bookcase(127,294,70);bookcase(795,294,70);pot(121,420);pot(843,420);
 sofa(665,424,158);R(665,500,158,32,'#c0ad86');R(672,492,144,28,'#e3d1a8');R(713,498,38,15,'#9fb18c');R(250,461,84,42,'#bba076');R(243,453,99,24,'#dac49b');R(215,467,20,27,color);R(349,467,20,27,color);
 T('YOUR OWN ROOM. YOUR OWN RHYTHM.',128,544,'#8c987b',10);R(452,566,95,13,'#c8ceac');T('BACK TO THE HQ FLOOR  ↑',400,616,'#7d8f6e',11);
}
function drawHQWing(){
 tile(0,565,1000,285,'#d7d3b6');R(0,565,1000,8,'#bac3a3');tile(1000,0,500,850,'#d8d4b8');R(996,0,9,850,'#b7c0a2');R(985,248,30,70,'#d8d4b8');
 frame(75,605,875,215);tile(83,613,859,199,'#e7ddbc');T('05 / THE COMMUNITY FLOOR',102,640,'#7b8968',13);T('NEW FACES. SAME BIG IDEAS.',103,798,'#8b987a',9);
 for(let row=0;row<2;row++)for(let col=0;col<5;col++){const x=142+col*157,y=663+row*67;R(x,y,111,28,'#bba174');R(x-3,y-5,117,13,'#ddc79b');R(x+35,y-28,38,27,'#8a9c80');R(x+39,y-24,30,17,'#c0d4b0');R(x+42,y+34,27,7,'#96aa7d');}
 T('THE PRIVATE WING',1052,75,'#697d56',18);T('A BOSS ROOM FOR EVERY NEWCOMER',1052,102,'#8c9878',10);
 const me=window.CrowCommunity?.self(),roster=window.CrowCommunity?.people()||[];const residents=[me,...roster.filter(p=>p.id!==me?.id)].filter(Boolean);
 for(let i=0;i<6;i++){const x=1035+(i%2)*226,y=155+Math.floor(i/2)*220,owner=residents[i],mine=owner?.id===me?.id;R(x,y,200,182,mine?'#c5d3b0':'#cbd0b4');R(x+6,y+6,188,170,'#e9e0c0');R(x+20,y+22,160,29,mine?'#839d6a':'#a4ad8f');T(mine?'YOUR BOSS ROOM':owner?owner.name.slice(0,19):'A NEW BOSS ROOM',x+29,y+41,'#fff3d4',11);R(x+62,y+66,77,101,'#b49b70');R(x+68,y+73,65,90,'#cdb58a');R(x+118,y+114,5,5,'#846f47');R(x+76,y+80,48,22,'#eadfc0');T(mine?'ENTER ↗':!owner?'VACANT':owner.roomOpen===false?'CLOSED':'VISIT ↗',x+77,y+96,'#7c8f65',10);if(mine){R(x+76,y+135,48,17,'#839f70');T(owner?.roomOpen===false?'CLOSED':'OPEN',x+79,y+147,'#edf3dc',8);}}
 if(residents.length>6)T('+'+(residents.length-6)+' more personal rooms',1055,833,'#7a8e64',10);
}
function food(c,item,x,y,progress=0){
 const r=(a,b,w,h,col)=>{c.fillStyle=col;c.fillRect(Math.round(a),Math.round(b),w,h);};const kind=item.kind;
 if(['tea','drink','cup'].includes(kind)){r(x-10,y-20,20,29,'#e3d9b7');r(x-7,y-17,14,23*(1-progress),kind==='tea'?'#b27b4c':kind==='drink'?'#90ba8d':'#c4a455');r(x-10,y-22,20,5,kind==='tea'?'#f9e8c2':'#d3b477');if(kind==='drink')r(x+4,y-31,3,19,'#df8860');if(kind==='cup'){r(x-5,y-15,10,2,'#f1d282');r(x-4,y-10,8,2,'#7e9963');}return;}
 if(kind==='icecream'){r(x-4,y-2,9,17,'#bb9769');r(x-13,y-27,26,29,'#f1e2bd');r(x-8,y-34,17,13,'#dfc899');if(progress>.5)r(x-12,y-34,26,14,'#eee0b9');return;}
 r(x-25,y-2,50,16,'#c8b996');r(x-23,y-8,46,19,'#f5edcf');
 if(progress>.88){r(x-6,y,3,2,'#aa8c56');r(x+5,y+3,2,2,'#c49b60');return;}
 const s=progress>.6?.65:1;
 if(kind==='roti'){r(x-17,y-11,30*s,16,'#deb47a');r(x-13,y-8,20*s,2,'#b98b4f');r(x-9,y-1,19*s,2,'#edca8f');r(x+13,y-9,12,11,'#b77a3b');r(x+15,y-7,8,5,'#ceaa56');}
 if(kind==='rice'){r(x-15,y-12,25*s,18,'#fff0cf');r(x-9,y-16,16*s,5,'#fff4dc');r(x+9,y-5,11,9,'#b86443');r(x-20,y-1,7,5,'#8fa66c');r(x+12,y-13,10,7,'#e7bf7c');}
 if(kind==='noodles'){r(x-18,y-9,35*s,14,'#b78445');for(let i=0;i<5;i++)r(x-15+i*6,y-7+(i%2)*5,12*s,2,'#dfb16b');r(x+9,y-13,11,10,'#f7e6ba');r(x+12,y-10,5,4,'#ddad4f');}
 if(kind==='toast'){r(x-18,y-13,17*s,19,'#b17d48');r(x-15,y-10,11*s,12,'#e4c58a');r(x+1,y-10,17*s,16,'#cb9f62');r(x+3,y-7,12*s,2,'#a7b16e');r(x+15,y-22,13,16,'#eee5cb');r(x+17,y-23,9,4,'#654e38');}
 if(kind==='eggs'){for(const dx of [-11,9]){r(x+dx-8,y-12,16,16,'#fff3d7');r(x+dx-3,y-6,7,6,'#dfb158');}r(x-2,y+6,11,2,'#786a4a');}
 if(kind==='puff'){r(x-16,y-11,31*s,16,'#d3a166');r(x-10,y-15,20*s,5,'#e9c38d');for(let i=0;i<5;i++)r(x-13+i*6,y+2,3,3,'#b48046');}
}
function render(){
 const me=window.CrowCommunity?.self(),place=me?.spot||'work',at=window.CrowCommunity?.now()||Date.now(),item=me?.meal?findMeal(me.meal.place,me.meal.id):null;
 $s('#space-location').textContent=place==='suite'&&(me.roomId||me.id)!==me.id?(window.CrowCommunity.roomOwner()?.name||'Neighbour')+'’s boss room':LOCATIONS[place]?.name||'The neighbourhood';
 $s('#space-scene-note').textContent=place==='suite'?((me.roomId||me.id)===me.id?(me.roomOpen===false?'Your door is closed to visitors. Your notes are always private.':'Your door is open. Friends can visit; your notes stay private.'):'Visiting '+(window.CrowCommunity.roomOwner()?.name||'a neighbour')+'’s room. Public chat is shared; private notes stay yours.'):MENU[place]?'Take a seat, choose a pixel meal, and enjoy a little lepak.':'Your character can work here while you work in real life.';
 const menu=$s('#space-menu');menu.classList.toggle('hidden',!MENU[place]);
 const key=place+':'+(me?.meal?.orderedAt||'');if(menu.dataset.key!==key){menu.dataset.key=key;menu.innerHTML=MENU[place]?`<div class="space-menu-heading"><span class="eyebrow">THE PIXEL MENU · FOOD FOR YOUR CHARACTER</span><span id="meal-status" role="status"></span></div><div class="space-menu-items">${MENU[place].map(m=>`<button data-order="${m.id}" ${item?'disabled':''}><canvas width="64" height="48" data-dish="${m.id}" aria-hidden="true"></canvas><span><strong>${safe(m.name)}</strong><small>${safe(m.description)}</small></span><b>＋</b></button>`).join('')}</div>`:'';
  menu.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>window.CrowCommunity.order(b.dataset.order));
  menu.querySelectorAll('[data-dish]').forEach(canvas=>{const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;food(c,findMeal(place,canvas.dataset.dish),32,29);});}
 const mealStatus=$s('#meal-status');if(mealStatus)mealStatus.textContent=item?(at<me.meal.servedAt?'Being prepared…':at<me.meal.finishAt?'Enjoying '+item.name:'A lovely little meal.'):'Choose something for your table';
 const onBreak=me?.break&&me.break.until>at;$s('#break-active').classList.toggle('hidden',!onBreak);$s('#break-form').classList.toggle('hidden',!!onBreak);
 if(onBreak){const seconds=Math.max(0,Math.ceil((me.break.until-at)/1000));$s('#break-countdown').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');$s('#break-label').textContent=(me.break.kind==='lunch'?'Lunch break':'Coffee break')+' · AWAY FROM DESK';$s('#break-return-time').textContent='Expected back '+new Date(me.break.until).toLocaleTimeString('en-SG',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Singapore'})+' SGT';}
 $s('#break-submit').disabled=!me;$s('#break-return').disabled=!me;
 document.querySelectorAll('[data-space-go]').forEach(b=>{b.disabled=!me;b.classList.toggle('active',b.dataset.spaceGo===place);});
}
function openScene(which){
 if(!titles[which])return false;scene=which;state.scene=which;save();cv.width=1000;cv.height=650;ctx.imageSmoothingEnabled=false;$s('#scene-title').textContent=which==='suite'?(window.CrowCommunity?.roomOwner()?.name||'Your')+' · boss room':titles[which];$s('#world-caption').textContent=which==='suite'?'CROW HQ · PERSONAL BOSS ROOM':'JALAN LEPAK · TAKE A SEAT';$s('#town-tab').classList.remove('active');$s('#indoor-tab').classList.toggle('active',which==='suite');$s('#destination-bar').classList.add('hidden');$s('.office-stage').classList.remove('town-scene');$s('#exit-hq').textContent=which==='suite'?'Back to HQ floor ↗':'Back to neighbourhood ↗';cv.setAttribute('aria-label',which==='suite'?(window.CrowCommunity?.roomOwner()?.name||'Your')+'’s pixel boss room with a desk, lounge, meeting table and visitors.':titles[which]+'. A pixel dining room with tables, seated people and animated meals. Use the menu below to order.');return true;
}
window.CrowSpaces={
 render,seat,food,openScene,drawHQWing,sceneFor:spot=>LOCATIONS[spot]?.scene||'town',
 drawScene:which=>which==='suite'?drawSuite():MENU[which]?drawRestaurant(which):undefined,
 drawTableFront(person,x,y){if(!MENU[person.spot])return;const s=seat(person.seat||0);R(s.cx-68,s.cy+18,136,25,person.spot==='kopi'?'#e8e1c6':'#d8c196');R(s.cx-68,s.cy+42,136,4,'#b59b72');},
 position(person,index){if(MENU[person.spot]){const s=seat(person.seat||0);return {...s,seated:true};}if(person.spot==='suite'){const owner=person.roomId||person.id;if(person.id===owner)return{x:481,y:400};const guests=(window.CrowCommunity?.people()||[]).filter(p=>p.spot==='suite'&&(p.roomId||p.id)===owner&&p.id!==owner);const i=Math.max(0,guests.findIndex(p=>p.id===person.id));const points=[[700,485],[770,485],[650,535],[780,535],[570,460],[600,510],[550,420],[630,410]];return{x:points[i%8][0],y:points[i%8][1]};}if(person.spot==='hq')return{x:196+(index%5)*157,y:709+Math.floor(index/5)*30};const p=LOCATIONS[person.spot]?.point||LOCATIONS.work.point;return{x:p[0]+(index%5)*39,y:p[1]+Math.floor(index/5)*35};},
 handleClick(x,y){if(scene==='inside'&&x>=1035&&y>=155&&x<=1461&&y<777){const col=Math.floor((x-1035)/226),row=Math.floor((y-155)/220);if((x-1035)%226>200||(y-155)%220>182)return false;const me=window.CrowCommunity?.self(),people=window.CrowCommunity?.people()||[],residents=[me,...people.filter(p=>p.id!==me?.id)].filter(Boolean),owner=residents[row*2+col];if(owner)window.CrowCommunity.visit(owner.id);else toast('This room is waiting for a new neighbour.');return true;}return false;},
};
$s('#break-form').onsubmit=event=>{event.preventDefault();window.CrowCommunity.startBreak($s('#break-kind').value,Number($s('#break-minutes').value));};
$s('#break-return').onclick=()=>window.CrowCommunity.endBreak();
document.querySelectorAll('[data-space-go]').forEach(button=>button.onclick=()=>window.CrowCommunity.go(button.dataset.spaceGo));
setInterval(render,1000);
