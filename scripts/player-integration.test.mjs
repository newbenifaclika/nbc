import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
class Element {
 constructor(id=''){this.id=id;this.value='';this.textContent='';this.innerHTML='';this.hidden=false;this.disabled=false;this.dataset={};this.files=[];this.attrs=new Map();this.children=new Map();this.events={};this.style={setProperty(){},removeProperty(){}};this.classList={add(){},remove(){},contains:()=>false,toggle(){}}}
 setAttribute(key,value){this.attrs.set(key,value)}
 getAttribute(key){return this.attrs.get(key)||null}
 removeAttribute(key){this.attrs.delete(key)}
 addEventListener(type,fn){(this.events[type]||=[]).push(fn)}
 querySelectorAll(){return[]}
 querySelector(selector){if(!this.children.has(selector))this.children.set(selector,new Element(selector));return this.children.get(selector)}
 focus(){}
 matches(){return false}
 getClientRects(){return[{}]}
}
class Audio extends Element{
 constructor(){super();this.paused=true;this.ended=false;this.currentTime=0;this.duration=180;this.playbackRate=1;this.error=null;this.calls=[];this._src=''}
 set src(src){this._src=src;this.attrs.set('src',src);this.error=null;this.ended=false;this.currentTime=0;this.duration=NaN;this.calls.push('src:'+src)}
 get src(){return this._src}
 play(){this.paused=false;this.calls.push('play:'+this.src);this.onNativePlay?.();return Promise.resolve()}
 pause(){this.paused=true;this.emit('pause')}
 load(){this.calls.push('load')}
 emit(type){for(const fn of this.events[type]||[])fn({target:this})}
}
async function boot({albumMode=false}={}){
 const elements=new Map(),events={},winEvents={},audio=new Audio();elements.set('audio',audio);
 const document={hidden:false,visibilityState:'visible',title:'',activeElement:null,getElementById:id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)},querySelector:selector=>document.getElementById(selector),querySelectorAll:()=>[],addEventListener:(name,fn)=>(events[name]||=[]).push(fn)};
 const tracks=['one','two','three'].map((id,i)=>({id,title:'Song '+id,artists:['Artist'],audio_key:'audio/'+id+'.mp3',album_id:null,cover_key:'covers/'+id+'.webp',created_at:'2026-01-0'+(3-i),duration_seconds:180}));
 if(albumMode)tracks.forEach((track,index)=>{if(index<2){track.album_id='record';track.track_number=index+1}});
 const albumList=albumMode?[{id:'record',title:'Record',cover_key:'covers/record.webp',created_at:'2026-01-04'}]:[];
 const saved=new Map([['nbc_current_track','one']]),handlers={},positions=[],published=[],starts=[];
 let nativeReady=true,notification=null,metadata=null;
 const session={setActionHandler(name,fn){handlers[name]=fn},setPositionState(value){positions.push(value)},get metadata(){return metadata},set metadata(value){metadata=value;published.push(value);if(nativeReady)notification=value}};
 audio.onNativePlay=()=>{starts.push({src:audio.src,metadata:session.metadata,position:positions.at(-1)});nativeReady=false;notification=null};
 const c={document,Audio,Image:class{},URL,URLSearchParams,Blob,File,Response,Promise,console,setTimeout,clearTimeout,structuredClone,innerWidth:390,scrollTo(){},matchMedia:()=>({matches:false,addEventListener(){}}),navigator:{onLine:true,userAgent:'Android Chrome',connection:{saveData:false},mediaSession:session},MediaMetadata:class{constructor(data){Object.assign(this,data)}},location:new URL('https://nbc.test/'),history:{state:null,replaceState(state){this.state=state},pushState(state){this.state=state}},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},fetch:async path=>new Response(JSON.stringify(path==='/api/bootstrap'?{tracks,albums:albumList,artists:[{name:'Artist'}]}:{authenticated:false}),{status:200,headers:{'Content-Type':'application/json'}})};
 c.window=c;c.addEventListener=(name,fn)=>(winEvents[name]||=[]).push(fn);
 vm.createContext(c);
 for(const path of ['public/playback-tools.js','public/audio-runtime.js','public/app.js'])vm.runInContext(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),c);
 await new Promise(setImmediate);
 return {elements,events,audio,c,handlers,positions,published,starts,document,session,activateNative(){nativeReady=true},getNotification:()=>notification};
}
test('complete application advances while hidden and updates Android media metadata without UI rendering',async()=>{
 const {elements,events,audio,c,handlers,positions,published,starts,document,session,activateNative,getNotification}=await boot();
 assert.equal(elements.get('playerTitle').textContent,'Song one');
 elements.get('playBtn').onclick({currentTarget:elements.get('playBtn')});await new Promise(setImmediate);
 assert.equal(c.navigator.mediaSession.playbackState,'playing');assert.equal(c.navigator.mediaSession.metadata.title,'Song one');
 document.hidden=true;document.visibilityState='hidden';for(const fn of events.visibilitychange)fn();
 audio.ended=true;audio.paused=true;audio.emit('pause');audio.emit('ended');await new Promise(setImmediate);
 assert.equal(starts.at(-1).metadata.title,'Song two','new metadata must precede native play');assert.equal(starts.at(-1).position,undefined,'previous song timeline cleared before play');
 assert.equal(audio.src,'/media/audio/two.mp3');assert.equal(c.navigator.mediaSession.metadata.title,'Song two');assert.equal(c.navigator.mediaSession.playbackState,'playing');
 // A newly activated native player must get a fresh publication even if initial
 // source selection happened while Android's previous media session was ending.
 activateNative();audio.duration=240;audio.emit('loadedmetadata');audio.emit('playing');
 assert.equal(getNotification().title,'Song two');assert.equal(positions.at(-1).duration,240);assert.equal(positions.at(-1).position,0);
 assert.equal(session.playbackState,'playing');
 audio.currentTime=23;audio.playbackRate=1.25;audio.emit('ratechange');
 assert.equal(positions.at(-1).playbackRate,1.25);assert.equal(positions.at(-1).position,23);
 // Repeat the automatic transition without bringing the app into the foreground.
 audio.currentTime=240;audio.ended=true;audio.paused=true;audio.emit('pause');audio.emit('ended');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/three.mp3');assert.equal(session.metadata.title,'Song three');
 activateNative();audio.duration=Infinity;audio.emit('durationchange');assert.equal(positions.at(-1),undefined);
 audio.duration=150;audio.emit('durationchange');const beforePlaying=published.length;audio.emit('playing');
 assert.ok(published.length>beforePlaying,'native playing republishes current metadata');
 assert.equal(getNotification().title,'Song three');assert.equal(getNotification().artist,'Artist');
 assert.equal(getNotification().artwork[0].src,'https://nbc.test/media/covers/three.webp');
 assert.equal(positions.at(-1).duration,150);assert.equal(positions.at(-1).position,0);
 assert.equal(elements.get('playerTitle').textContent,'Song one'); // hidden UI is deliberately deferred
 document.hidden=false;document.visibilityState='visible';for(const fn of events.visibilitychange)fn();assert.equal(elements.get('playerTitle').textContent,'Song three');
 handlers.pause();assert.equal(audio.paused,true);assert.equal(c.navigator.mediaSession.playbackState,'paused');
});

test('album cards open details and album playback continues into the library after the last track',async()=>{
 const {elements,audio,c}=await boot({albumMode:true});
 assert.match(elements.get('homeSingles').innerHTML,/Song three/);
 assert.doesNotMatch(elements.get('homeSingles').innerHTML,/Song one|Song two/);
 assert.match(elements.get('homeAlbums').innerHTML,/Ver álbum/);
 assert.doesNotMatch(elements.get('homeAlbums').innerHTML,/onclick="NBCPlayAlbum/);
 c.NBCOpenAlbum('record');
 assert.match(elements.get('albumDetail').innerHTML,/NBCPlayAlbumTrack\('record','two'\)/);
 c.NBCPlayAlbum('record');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/one.mp3');
 audio.ended=true;audio.paused=true;audio.emit('ended');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/two.mp3');
 audio.ended=true;audio.paused=true;audio.emit('ended');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/three.mp3');
 assert.equal(elements.get('playerContext').textContent,'RADIO DE LA CLIKA');
 c.NBCPlayAlbumTrack('record','two');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/two.mp3');
 assert.equal(elements.get('playerContext').textContent,'ÁLBUM · RECORD');
 audio.ended=true;audio.paused=true;audio.emit('ended');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/three.mp3');
 c.NBCPlayAlbum('record');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/one.mp3');
 c.NBCPlayTrack('one');await new Promise(setImmediate);assert.equal(audio.paused,true);
});
