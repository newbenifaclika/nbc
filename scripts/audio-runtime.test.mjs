import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/audio-runtime.js',import.meta.url),'utf8'),c={window:{},setTimeout,clearTimeout};vm.runInNewContext(source,c);const Runtime=c.window.NBCBackgroundAudio;
class Audio {
 constructor(){this.events={};this.paused=true;this.ended=false;this.error=null;this.loop=false;this.currentTime=0;this.duration=180;this.calls=[];this._src='';this.playFailure=null}
 set src(value){this._src=value;this.error=null;this.ended=false;this.currentTime=0;this.calls.push('src:'+value)}
 get src(){return this._src}
 getAttribute(){return this.src}
 addEventListener(type,handler){(this.events[type]||=[]).push(handler)}
 emit(type){for(const fn of this.events[type]||[])fn()}
 play(){this.calls.push('play:'+this.src);this.paused=false;if(this.playFailure)return Promise.reject(this.playFailure);return Promise.resolve()}
 pause(){this.paused=true;this.emit('pause')}
 load(){this.calls.push('load')}
 removeAttribute(){this._src=''}
}
function setup(options={}){
 const audio=new Audio(),states=[],problems=[],timers=new Map(),warmer=new Audio();let nextTimer=0,online=true;
 const runtime=new Runtime({audio,onState:s=>states.push(s),onProblem:p=>problems.push(p),createAudio:()=>warmer,isOnline:()=>online,setTimer:fn=>{timers.set(++nextTimer,fn);return nextTimer},clearTimer:id=>timers.delete(id),...options});
 return{audio,runtime,states,problems,warmer,timers,setOnline:value=>online=value,runTimer(){const [id,fn]=[...timers][0];timers.delete(id);fn()}};
}
test('source and play are started synchronously before UI callbacks or promises',async()=>{
 const audio=new Audio(),order=audio.calls;const runtime=new Runtime({audio,onState:()=>order.push('ui'),isOnline:()=>true});
 const pending=runtime.select('/media/one.mp3');assert.deepEqual(order.slice(0,3),['src:/media/one.mp3','play:/media/one.mp3','ui']);assert.equal(await pending,true);assert.equal(order.includes('load'),false);
});
test('an ended track and its internal pause immediately advance a locked-screen playlist',async()=>{
 const s=setup();s.runtime.onEnded=()=>s.runtime.select('/media/two.mp3');await s.runtime.select('/media/one.mp3');
 s.audio.ended=true;s.audio.paused=true;s.audio.emit('pause');assert.equal(s.runtime.wanted,true);
 s.audio.emit('ended');assert.equal(s.audio.src,'/media/two.mp3');assert.equal(s.audio.calls.at(-1),'play:/media/two.mp3');
});
test('a pause caused by changing the source cannot cancel the next song',async()=>{
 const s=setup();const pending=s.runtime.select('/media/next.mp3');s.audio.emit('pause');assert.equal(s.runtime.wanted,true);await pending;assert.equal(s.runtime.wanted,true);
});
test('the next song is preloaded without playing a second audio element',async()=>{
 const s=setup();await s.runtime.select('/media/one.mp3');s.runtime.prefetch('/media/two.mp3');s.runtime.prefetch('/media/two.mp3');
 assert.equal(s.warmer.preload,'auto');assert.equal(s.warmer.src,'/media/two.mp3');assert.deepEqual(s.warmer.calls,['src:/media/two.mp3','load']);assert.equal(s.warmer.muted,true);
 s.runtime.prefetch('/media/manual.mp3');assert.equal(s.warmer.src,'/media/manual.mp3');
});
test('pausing cancels pending retries and preloading; stale errors cannot resume audio',async()=>{
 const s=setup();await s.runtime.select('/media/one.mp3');s.runtime.prefetch('/media/two.mp3');s.audio.error={code:2};s.audio.emit('error');assert.equal(s.timers.size,1);
 s.runtime.pause();assert.equal(s.timers.size,0);assert.equal(s.warmer.src,'');s.audio.emit('error');assert.equal(s.timers.size,0);assert.equal(s.runtime.wanted,false);
});
test('network retry preserves position and never changes queue or source track',async()=>{
 const s=setup();await s.runtime.select('/media/one.mp3');s.audio.currentTime=42;s.audio.error={code:2};s.audio.emit('error');s.runTimer();
 assert.equal(s.audio.src,'/media/one.mp3');s.audio.emit('loadedmetadata');assert.equal(s.audio.currentTime,42);
});
test('offline playback can recover on a connection event without skipping the chosen track',async()=>{
 const s=setup();await s.runtime.select('/media/one.mp3');s.setOnline(false);s.audio.error={code:2};s.audio.emit('error');assert.equal(s.timers.size,0);assert.equal(s.runtime.wanted,true);
 s.setOnline(true);assert.equal(s.runtime.recover(),true);assert.equal(s.audio.src,'/media/one.mp3');
});
test('autoplay rejection retains the selected track and waits for an explicit Play gesture',async()=>{
 const s=setup();s.audio.playFailure={name:'NotAllowedError'};assert.equal(await s.runtime.select('/media/one.mp3'),false);
 assert.equal(s.runtime.wanted,false);assert.equal(s.runtime.blocked,true);assert.equal(s.timers.size,0);assert.equal(s.audio.src,'/media/one.mp3');assert.equal(s.problems.length,1);
});
test('a restored player retains its media URL when resuming and retrying',async()=>{
 const s=setup();s.audio.src='/media/restored.mp3';await s.runtime.resume();s.audio.error={code:2};s.audio.emit('error');s.runTimer();assert.equal(s.audio.src,'/media/restored.mp3');
});
test('repeat mode never advances the playlist on ended',async()=>{
 let count=0;const s=setup({onEnded:()=>count++});await s.runtime.select('/media/one.mp3');s.audio.loop=true;s.audio.ended=true;s.audio.emit('ended');assert.equal(count,0);
});
test('an error from an earlier selection cannot schedule a retry over the newer song',async()=>{
 const s=setup();s.audio.playFailure={name:'NetworkError'};const old=s.runtime.select('/media/old.mp3');s.audio.playFailure=null;const newer=s.runtime.select('/media/new.mp3');await old;await newer;assert.equal(s.timers.size,0);assert.equal(s.audio.src,'/media/new.mp3');
});

test('a current interrupted play request clears loading and never resumes by itself',async()=>{
 const s=setup();s.audio.playFailure={name:'AbortError'};assert.equal(await s.runtime.select('/media/one.mp3'),false);
 assert.equal(s.runtime.wanted,false);assert.equal(s.runtime.starting,false);assert.equal(s.timers.size,0);
});

test('unsupported media advances immediately when a playlist handler is provided',async()=>{
 const s=setup();await s.runtime.select('/media/unsupported.mp3');
 s.runtime.onUnavailable=()=>s.runtime.select('/media/next.mp3');s.audio.error={code:4};s.audio.emit('error');
 assert.equal(s.audio.src,'/media/next.mp3');assert.equal(s.timers.size,0);
});
test('a late error event cleared by a newer source cannot restart that source',async()=>{
 const s=setup();await s.runtime.select('/media/new.mp3');s.audio.error=null;s.audio.emit('error');assert.equal(s.timers.size,0);
});
