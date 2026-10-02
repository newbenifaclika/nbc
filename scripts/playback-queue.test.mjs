import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),toolsSource=fs.readFileSync(new URL('../public/playback-tools.js',import.meta.url),'utf8');
function tools(){const c={window:{},URL};vm.runInNewContext(toolsSource,c);return c.window.NBCPlaybackTools}
const state=()=>({queue:['a','b','c'],pos:0,manualEnd:1,primaryLength:3});
test('added songs play before automatic continuation in addition order',()=>{const q=state(),t=tools();t.add(q,'d','a');t.add(q,'e','a');assert.deepEqual(q.queue,['a','d','e','b','c']);q.pos=1;t.add(q,'f','d');assert.deepEqual(q.queue,['a','d','e','f','b','c'])});
test('queue can start empty and accept repeated songs',()=>{const q={queue:[],pos:-1,manualEnd:0},t=tools();t.add(q,'x');t.add(q,'x');assert.deepEqual(q.queue,['x','x']);assert.equal(q.pos,-1)});
test('removing a future item preserves the current and subsequent insertion order',()=>{const q=state(),t=tools();t.add(q,'d');t.add(q,'e');assert.equal(t.remove(q,0),false);assert.equal(t.remove(q,1),true);t.add(q,'f');assert.deepEqual(q.queue,['a','e','f','b','c'])});
test('shuffle changes only future songs and preserves all occurrences',()=>{const q=state(),t=tools();t.add(q,'d');t.add(q,'d');const before=q.queue.slice(1);t.shuffle(q,()=>0);assert.equal(q.queue[0],'a');assert.notDeepEqual(q.queue.slice(1),before);assert.deepEqual([...q.queue.slice(1)].sort(),before.sort());assert.equal(q.pos,0)});
test('loop control never reorders or rebuilds the queue',()=>{const q=state(),before=JSON.stringify(q.queue),c={playback:{...q,repeat:false},localStorage:{setItem(){}},renderModes(){},toast(){}};vm.runInNewContext(app.split('\n').find(l=>l.startsWith('function toggleRepeat('))+';toggleRepeat();toggleRepeat()',c);assert.equal(JSON.stringify(c.playback.queue),before);assert.equal(c.playback.repeat,false)});
test('next occurrence of the same track restarts at its queue position',async()=>{const q={queue:['a','a','b'],pos:0,history:[]},audio={paused:false,getAttribute:()=>'/media/a',load(){this.loaded=true},async play(){}},c={playback:q,audio,currentTrack:{id:'a',audio_key:'a'},trackById:()=>({id:'a',audio_key:'a'}),playSeq:0,mediaUrl:key=>'/media/'+key,updateNowUI(){},ensureQueue(){},localStorage:{setItem(){}},toast(){},setPlayState(){}};vm.runInNewContext(app.split('\n').find(l=>l.startsWith('async function playTrack(')),c);await vm.runInNewContext("playTrack('a',{queueIndex:1})",c);assert.equal(q.pos,1);assert.equal(audio.loaded,true);assert.equal(audio.src,'/media/a')});
test('library refresh removes deleted entries without skipping the remaining queue',()=>{const q=state(),t=tools();t.add(q,'d');t.add(q,'e');t.reconcile(q,id=>id!=='d'&&id!=='b');t.add(q,'f');assert.deepEqual([...q.queue],['a','e','f','c']);assert.equal(q.pos,0)});
test('media artwork uses absolute URLs, album cover metadata and a PNG fallback',()=>{const t=tools(),song={title:'Tema',artists:['A','B']},m=t.metadata(song,{title:'Álbum'},'/media/covers/test.webp','https://nbc.test');assert.equal(m.artwork[0].src,'https://nbc.test/media/covers/test.webp');assert.equal(m.artwork[0].type,'image/webp');assert.equal(m.artwork[0].sizes,undefined);assert.equal(m.album,'Álbum');const fallback=t.metadata(song,null,'','https://nbc.test');assert.equal(fallback.artwork[0].type,'image/png');assert.equal(fallback.artwork[0].sizes,'512x512');assert.equal(t.metadata(null,null,'','https://nbc.test'),null)});
test('metadata changes immediately and stale image decoding cannot overwrite a newer cover',async()=>{
 const pending=[],sizes=[];const c={currentTrack:{id:'a',title:'A',artists:['Artist']},artworkKey:'',artworkData:null,artworkSeq:0,queueTools:tools(),trackCover:t=>'/media/'+t.id+'.webp',albumById:()=>null,location:{origin:'https://nbc.test'},URL,navigator:{mediaSession:{}},MediaMetadata:class{constructor(data){Object.assign(this,data)}},Image:class{constructor(){this.naturalWidth=1200;this.naturalHeight=800}decode(){return new Promise(resolve=>pending.push(resolve))}},document:{createElement:()=>{const canvas={getContext:()=>({fillRect(){},drawImage(){}}),toDataURL:()=>{sizes.push([canvas.width,canvas.height]);return'data:image/png;base64,cG5n'}};return canvas}}};
 const start=app.indexOf('function syncMediaSession()'),end=app.indexOf("document.addEventListener('visibilitychange'",start);vm.runInNewContext(app.slice(start,end),c);
 vm.runInNewContext('syncMediaSession()',c);assert.equal(c.navigator.mediaSession.metadata.title,'A');
 c.currentTrack={id:'b',title:'B',artists:['Artist']};vm.runInNewContext('syncMediaSession()',c);assert.equal(c.navigator.mediaSession.metadata.title,'B');
 pending[0]();await new Promise(setImmediate);assert.equal(c.artworkData,null);
 pending[1]();await new Promise(setImmediate);assert.equal(c.navigator.mediaSession.metadata.title,'B');assert.equal(c.navigator.mediaSession.metadata.artwork[0].type,'image/png');assert.equal(c.navigator.mediaSession.metadata.artwork[0].sizes,'512x512');assert.deepEqual(JSON.parse(JSON.stringify(sizes)),[[512,512]]);
});
test('Play starts the first queued choice when nothing is selected',async()=>{const calls=[],c={currentTrack:null,playback:{queue:['chosen'],pos:-1},tracks:[{id:'default'}],playTrack:(id,opt)=>calls.push({id,opt}),buildQueue(){throw Error('must not rebuild')}};vm.runInNewContext(app.split('\n').find(l=>l.startsWith('async function startCurrent(')),c);await vm.runInNewContext('startCurrent()',c);assert.equal(calls[0].id,'chosen');assert.equal(calls[0].opt.queueIndex,0)});

test('shuffle never places the current song next or repeats adjacent duplicates',()=>{
 const t=tools(),q={queue:['a','a','b','b','c','c'],pos:0,manualEnd:1};t.shuffle(q,()=>0);
 for(let i=1;i<q.queue.length;i++)assert.notEqual(q.queue[i],q.queue[i-1]);
 assert.deepEqual([...q.queue.slice(1)].sort(),['a','b','b','c','c']);
});
test('random ordering preserves every occurrence whenever separation is possible',()=>{
 const t=tools();
 for(let a=0;a<=4;a++)for(let b=0;b<=4;b++)for(let c=0;c<=4;c++)for(const previous of [null,'a','b','c']){
  const counts={a,b,c},ids=Object.entries(counts).flatMap(([id,count])=>Array(count).fill(id)),n=ids.length;
  const ordered=t.randomSequence(ids,previous,()=>0);let last=previous;
  for(const id of ordered){assert.notEqual(id,last);last=id}
  const possible=Object.entries(counts).every(([id,count])=>count<=n-count+(id===previous?0:1));
  if(possible)assert.deepEqual([...ordered].sort(),[...ids].sort());
 }
});
test('unavoidable duplicate-only runs are not played back to back in random mode',()=>{
 const t=tools();assert.deepEqual([...t.randomSequence(['a','a','a'],'a',()=>0)],[]);
 assert.deepEqual([...t.randomSequence(['a','a','a'],null,()=>0)],['a']);
});
test('next skips newly added duplicates of the current track in random mode',()=>{
 const played=[],c={audio:{loop:false},playback:{queue:['a','a','a','b'],pos:0,shuffle:true,repeat:false},currentTrack:{id:'a'},ensureQueue(){},appendRadio(){},playTrack:(id,opt)=>played.push({id,index:opt.queueIndex}),setPlayState(){}};
 vm.runInNewContext(app.split('\n').find(l=>l.startsWith('function nextTrack('))+';nextTrack()',c);
 assert.deepEqual(played,[{id:'b',index:3}]);
});
