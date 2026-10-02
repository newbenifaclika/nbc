import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const gestures=source.slice(source.indexOf("const nowSheet=q("),source.indexOf("document.addEventListener('keydown',event=>{if(event.key==='Escape'",source.indexOf("const nowSheet=q(")));
function setup({scrollTop=0,control=false,header=false}={}){
 const listeners={},classes=new Set(['can-scroll']),backdrop=new Set(['show']),styles=new Map();let closes=0,prevented=0;
 const target={closest:selector=>control&&selector.includes('button')||header&&selector==='.now-sheet-header'};
 const sheet={clientHeight:700,scrollHeight:920,scrollTop,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},addEventListener:(name,fn,options)=>listeners[name]={fn,options},setPointerCapture(){},hasPointerCapture:()=>false};
 const context={q:()=>sheet,$:()=>({classList:{contains:x=>backdrop.has(x),remove:x=>backdrop.delete(x)}}),sheetEnterTimer:0,clearTimeout(){},requestAnimationFrame:()=>1,cancelAnimationFrame(){},closeSheet:()=>closes++};
 vm.runInNewContext(gestures,context);
 const touch=(y,x=100)=>({identifier:7,clientX:x,clientY:y});
 const fire=(name,y,time=0,extra={})=>listeners[name].fn({target,touches:[touch(y)],changedTouches:[touch(y)],timeStamp:time,cancelable:true,preventDefault:()=>prevented++,...extra});
 return{fire,listeners,styles,classes,closes:()=>closes,prevented:()=>prevented};
}
test('finger swipe on an overflowing mobile cover closes the sheet',()=>{const s=setup();s.fire('touchstart',100);s.fire('touchmove',280,200);s.fire('touchend',280,210);assert.equal(s.closes(),1);assert.equal(s.prevented(),1);assert.equal(s.listeners.touchmove.options.passive,false)});
test('short slow gesture returns without closing',()=>{const s=setup();s.fire('touchstart',100);s.fire('touchmove',125,200);s.fire('touchend',125,210);assert.equal(s.closes(),0);assert.equal(s.styles.has('--sheet-drag'),false)});
test('fast flick closes, but holding before release cancels the flick',()=>{for(const [release,expected]of [[60,1],[300,0]]){const s=setup();s.fire('touchstart',100);s.fire('touchmove',160,50);s.fire('touchend',160,release);assert.equal(s.closes(),expected)}});
test('touch cancellation and multitouch restore the sheet',()=>{for(const name of ['touchcancel','touchstart']){const s=setup();s.fire('touchstart',100);s.fire('touchmove',280,200);s.fire(name,280,220,name==='touchstart'?{touches:[{identifier:7},{identifier:8}]}:{});assert.equal(s.closes(),0);assert.equal(s.classes.has('dragging'),false)}});
test('controls, upward movement, horizontal movement and scrolled content keep native behavior',()=>{for(const kind of ['control','up','horizontal','scrolled']){const s=setup({control:kind==='control',scrollTop:kind==='scrolled'?40:0});s.fire('touchstart',100);s.fire('touchmove',kind==='up'?50:280,200,kind==='horizontal'?{touches:[{identifier:7,clientX:350,clientY:120}]}:{});s.fire('touchend',280,220);assert.equal(s.closes(),0,kind);assert.equal(s.prevented(),0,kind)}});
test('header can dismiss even when the sheet content is scrolled',()=>{const s=setup({header:true,scrollTop:40});s.fire('touchstart',100);s.fire('touchmove',280,200);s.fire('touchend',280,220);assert.equal(s.closes(),1)});
test('touch-generated pointer events do not handle the same gesture twice',()=>{const s=setup();for(const name of ['pointerdown','pointermove','pointerup'])s.listeners[name].fn({pointerType:'touch',pointerId:7,isPrimary:true,button:0,clientX:100,clientY:name==='pointerdown'?100:280,timeStamp:200,target:{closest:()=>false}});assert.equal(s.closes(),0);s.fire('touchstart',100);s.fire('touchmove',280,200);s.fire('touchend',280,220);assert.equal(s.closes(),1)});
