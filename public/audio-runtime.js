(()=>{'use strict';
class BackgroundAudio {
 constructor({audio,onState=()=>{},onEnded=()=>{},onMetadata=()=>{},onProblem=()=>{},onUnavailable=null,createAudio=()=>new Audio(),isOnline=()=>navigator.onLine,setTimer=setTimeout,clearTimer=clearTimeout}){
  Object.assign(this,{audio,onState,onEnded,onMetadata,onProblem,onUnavailable,createAudio,isOnline,setTimer,clearTimer});
  this.wanted=false;this.starting=false;this.buffering=false;this.recoveryNeeded=false;this.blocked=false;this.epoch=0;this.retries=0;this.timer=null;this.url='';this.seekTo=null;this.warmer=null;this.warmUrl='';
  audio.preload='auto';
  audio.addEventListener('playing',()=>{
   if(!this.wanted){audio.pause();return}
   this.starting=false;this.buffering=false;this.recoveryNeeded=false;this.blocked=false;this.retries=0;this._cancelRetry();this._notify();
  });
  audio.addEventListener('pause',()=>{
   if(!audio.paused)return;
   // Replacing a source or reaching its end is not a user request to stop the playlist.
   if(this.wanted&&(this.starting||audio.ended))return;
   this.wanted=false;this.starting=false;this.buffering=false;this._cancelRetry();this.clearPrefetch();this._notify();
  });
  audio.addEventListener('waiting',()=>{if(this.wanted&&!audio.paused){this.buffering=true;this._notify()}});
  audio.addEventListener('canplay',()=>{this.buffering=false;this._notify()});
  audio.addEventListener('loadedmetadata',()=>{
   if(this.seekTo!==null){try{audio.currentTime=Math.max(0,Math.min(this.seekTo,Number.isFinite(audio.duration)?audio.duration:this.seekTo))}catch{}this.seekTo=null}
   this.onMetadata();
  });
  audio.addEventListener('ended',()=>{
   if(!this.wanted||audio.loop)return;
   this.starting=true;this.onEnded();
  });
  audio.addEventListener('error',()=>{if(audio.error)this._fail(audio.error,this.epoch)});
 }
 _notify(){this.onState({wanted:this.wanted,starting:this.starting,buffering:this.buffering,blocked:this.blocked,recoveryNeeded:this.recoveryNeeded})}
 _position(){return this.seekTo??(Number(this.audio.currentTime)||0)}
 _cancelRetry(){if(this.timer!==null){this.clearTimer(this.timer);this.timer=null}}
 _start(replace,position=0){
  const epoch=++this.epoch;this._cancelRetry();this.wanted=true;this.starting=true;this.buffering=false;this.blocked=false;this.recoveryNeeded=false;
  if(replace){this.seekTo=position>0?position:null;this.audio.src=this.url}
  // Call play in the same event/gesture stack. Do not await metadata, UI or a timer.
  let pending;try{pending=this.audio.play()}catch(error){this._fail(error,epoch);return Promise.resolve(false)}
  this._notify();
  return Promise.resolve(pending).then(()=>{if(epoch!==this.epoch||!this.wanted)return false;this.starting=false;this._notify();return true},error=>{this._fail(error,epoch);return false});
 }
 select(url){this.url=url;this.retries=0;return this._start(true)}
 resume(){this.url=this.audio.getAttribute?.('src')||this.audio.currentSrc||this.url;this.retries=0;return this._start(!!this.audio.error,this._position())}
 pause(){
  this.wanted=false;this.starting=false;this.buffering=false;this.recoveryNeeded=false;this.blocked=false;++this.epoch;this._cancelRetry();this.clearPrefetch();this.audio.pause();this._notify();
 }
 _fail(error,epoch){
  if(epoch!==this.epoch||!this.wanted)return;
  if(error?.name==='AbortError'){this.wanted=false;this.starting=false;this.buffering=false;this.recoveryNeeded=false;this._cancelRetry();this.clearPrefetch();this._notify();return}
  this.starting=false;this.buffering=false;
  if(error?.name==='NotAllowedError'){
   this.blocked=true;this.wanted=false;this.recoveryNeeded=false;this._cancelRetry();this._notify();this.onProblem('Pulsa Play para continuar la reproducción.');return;
  }
  if(this.timer!==null)return;
  const unavailable=this.audio.error?.code===4||this.audio.error?.code===3||error?.name==='NotSupportedError';
  if(unavailable&&this.onUnavailable){this.starting=true;this.recoveryNeeded=false;this._notify();this.onUnavailable(error);return}
  this.recoveryNeeded=true;
  if(!this.isOnline()){this._notify();this.onProblem('Sin conexión. La reproducción continuará cuando vuelva la red.');return}
  if(this.retries>=2||this.audio.error?.code===4||this.audio.error?.code===3){
   this._notify();this.onProblem('No se pudo cargar el audio. Puedes reintentar con Play o elegir otra canción.');return;
  }
  this.retries++;const position=this._position();
  this.timer=this.setTimer(()=>{this.timer=null;if(epoch!==this.epoch||!this.wanted)return;this._start(true,position)},800*this.retries);
  this._notify();
 }
 recover(){
  if(!this.wanted||!this.recoveryNeeded||!this.isOnline()||this.starting)return false;
  this.retries=0;this._start(true,this._position());return true;
 }
 prefetch(url,{saveData=false}={}){
  if(!url||!this.wanted){this.clearPrefetch();return}
  if(url===this.warmUrl)return;
  try{if(!this.warmer){this.warmer=this.createAudio();this.warmer.muted=true}
  this.warmUrl=url;this.warmer.preload=saveData?'metadata':'auto';this.warmer.src=url;this.warmer.load()}catch{this.warmUrl=''}
 }
 clearPrefetch(){
  if(!this.warmer||!this.warmUrl)return;
  this.warmUrl='';this.warmer.removeAttribute('src');this.warmer.load();
 }
}
window.NBCBackgroundAudio=BackgroundAudio;
})();