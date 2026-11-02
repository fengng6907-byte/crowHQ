import test from 'node:test';
import assert from 'node:assert/strict';
import {EMOJIS,emojiTokens,richHtml,drawEmoji,bubbleRows,initEmojiPicker} from '../dist/emoji.js';
test('mixed text and Unicode emoji render safely, preserving unsupported emoji',()=>{
 assert.equal(EMOJIS.length,24);
 assert.deepEqual(emojiTokens('Hi 🙂❤️!'),[{text:'Hi '},{emoji:'smile'},{emoji:'heart'},{text:'!'}]);
 const html=richHtml('<img onerror="alert(1)">😂');assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);assert.match(html,/data-emoji="laugh"/);
 assert.equal(richHtml('🦉'),'🦉');
});
test('all pixel icons draw and long speech bubbles remain bounded',()=>{
 const calls=[],ctx={fillRect(...args){calls.push(args);},save(){},restore(){},translate(){},rotate(){},measureText(s){return {width:s.length*7};}};
 for(const e of EMOJIS)drawEmoji(ctx,e.id);
 assert.ok(calls.length>100);assert.equal(ctx.imageSmoothingEnabled,false);
 const rows=bubbleRows(ctx,'🙂 hello '.repeat(100));assert.ok(rows.length<=3);assert.ok(rows[0].tokens.some(t=>t.emoji==='smile'));
});
test('picker inserts at caret, respects maxlength, supports keyboard and closes without submitting',()=>{
 const handlers={},docHandlers={};let focused=false;
 const input={value:'hello world',selectionStart:6,selectionEnd:11,maxLength:280,disabled:false,setRangeText(v,a,b){this.value=this.value.slice(0,a)+v+this.value.slice(b);this.selectionStart=this.selectionEnd=a+v.length;},dispatchEvent(){},focus(){focused=true;}};
 const attrs={},classes=new Set(['hidden']);const toggle={setAttribute(k,v){attrs[k]=v;},contains(){return false;},focus(){}};
 const choice={dataset:{pickEmoji:'smile'},focus(){}};
 const picker={classList:{add(x){classes.add(x);},contains(x){return classes.has(x);},toggle(x){if(classes.has(x)){classes.delete(x);return false;}classes.add(x);return true;}},querySelector(){return choice;},querySelectorAll(){return [choice];},addEventListener(k,v){handlers[k]=v;},contains(){return true;}};
 const nodes={'#emoji-picker':picker,'#emoji-toggle':toggle,'#community-text':input,'#emoji-grid':{},'#emoji-close':{}};
 globalThis.document={querySelector:s=>nodes[s],querySelectorAll:()=>[],addEventListener(k,v){docHandlers[k]=v;}};
 const close=initEmojiPicker();toggle.onclick();assert.equal(attrs['aria-expanded'],'true');
 handlers.click({target:{closest:()=>choice}});assert.equal(input.value,'hello 🙂');assert.ok(focused);assert.ok(classes.has('hidden'));
 input.maxLength=input.value.length;handlers.click({target:{closest:()=>choice}});assert.equal(input.value,'hello 🙂');
 toggle.onclick();docHandlers.keydown({key:'Escape'});assert.ok(classes.has('hidden'));close();delete globalThis.document;
});
