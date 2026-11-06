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
 set src(src){this._src=src;this.attrs.set('src',src);this.error=null;this.ended=false;this.currentTime=0;this.calls.push('src:'+src)}
 get src(){return this._src}
 play(){this.paused=false;this.calls.push('play:'+this.src);return Promise.resolve()}
 pause(){this.paused=true;this.emit('pause')}
 load(){this.calls.push('load')}
 emit(type){for(const fn of this.events[type]||[])fn({target:this})}
}
test('complete application advances while hidden and updates Android media metadata without UI rendering',async()=>{
 const elements=new Map(),events={},winEvents={},audio=new Audio();elements.set('audio',audio);
 const document={hidden:false,visibilityState:'visible',title:'',activeElement:null,getElementById:id=>{if(!elements.has(id))elements.set(id,new Element(id));return elements.get(id)},querySelector:selector=>document.getElementById(selector),querySelectorAll:()=>[],addEventListener:(name,fn)=>(events[name]||=[]).push(fn)};
 const tracks=['one','two','three'].map((id,i)=>({id,title:'Song '+id,artists:['Artist'],audio_key:'audio/'+id+'.mp3',album_id:null,cover_key:null,created_at:'2026-01-0'+(3-i),duration_seconds:180}));
 const saved=new Map([['nbc_current_track','one']]),handlers={};
 const c={document,Audio,Image:class{},URL,URLSearchParams,Blob,File,Response,Promise,console,setTimeout,clearTimeout,structuredClone,innerWidth:390,scrollTo(){},matchMedia:()=>({matches:false,addEventListener(){}}),navigator:{onLine:true,userAgent:'Android Chrome',connection:{saveData:false},mediaSession:{setActionHandler(name,fn){handlers[name]=fn},setPositionState(){}}},MediaMetadata:class{constructor(data){Object.assign(this,data)}},location:new URL('https://nbc.test/'),history:{state:null,replaceState(state){this.state=state},pushState(state){this.state=state}},localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},fetch:async path=>new Response(JSON.stringify(path==='/api/bootstrap'?{tracks,albums:[],artists:[{name:'Artist'}]}:{authenticated:false}),{status:200,headers:{'Content-Type':'application/json'}})};
 c.window=c;c.addEventListener=(name,fn)=>(winEvents[name]||=[]).push(fn);
 vm.createContext(c);
 for(const path of ['public/playback-tools.js','public/audio-runtime.js','public/app.js'])vm.runInContext(fs.readFileSync(new URL('../'+path,import.meta.url),'utf8'),c);
 await new Promise(setImmediate);
 assert.equal(elements.get('playerTitle').textContent,'Song one');
 elements.get('playBtn').onclick({currentTarget:elements.get('playBtn')});await new Promise(setImmediate);
 assert.equal(c.navigator.mediaSession.playbackState,'playing');assert.equal(c.navigator.mediaSession.metadata.title,'Song one');
 document.hidden=true;document.visibilityState='hidden';for(const fn of events.visibilitychange)fn();
 audio.ended=true;audio.paused=true;audio.emit('pause');audio.emit('ended');await new Promise(setImmediate);
 assert.equal(audio.src,'/media/audio/two.mp3');assert.equal(c.navigator.mediaSession.metadata.title,'Song two');assert.equal(c.navigator.mediaSession.playbackState,'playing');
 assert.equal(elements.get('playerTitle').textContent,'Song one'); // hidden UI is deliberately deferred
 document.hidden=false;document.visibilityState='visible';for(const fn of events.visibilitychange)fn();assert.equal(elements.get('playerTitle').textContent,'Song two');
 handlers.pause();assert.equal(audio.paused,true);assert.equal(c.navigator.mediaSession.playbackState,'paused');
});
