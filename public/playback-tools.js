(()=>{'use strict';
function add(state,id,currentId=null){
 if(!state.queue.length&&currentId){state.queue=[currentId];state.pos=0}
 const next=Math.max(0,state.pos+1),at=Math.min(state.queue.length,Math.max(next,state.manualEnd||next));
 state.queue.splice(at,0,id);state.manualEnd=at+1;return at;
}
function remove(state,index){
 if(!Number.isInteger(index)||index<=state.pos||index>=state.queue.length)return false;
 state.queue.splice(index,1);if(index<state.manualEnd)state.manualEnd--;if(index<state.primaryLength)state.primaryLength--;return true;
}
function shuffle(state,random=Math.random){
 const next=Math.max(0,state.pos+1),future=state.queue.slice(next);
 for(let i=future.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[future[i],future[j]]=[future[j],future[i]]}
 state.queue=[...state.queue.slice(0,next),...future];state.manualEnd=next;
}
function reconcile(state,exists){
 const queue=state.queue,prefix=queue.slice(0,Math.max(0,state.pos+1)).filter(exists),manual=queue.slice(Math.max(0,state.pos+1),Math.max(state.pos+1,state.manualEnd||0)).filter(exists),rest=queue.slice(Math.max(state.pos+1,state.manualEnd||0)).filter(exists);
 state.primaryLength=queue.slice(0,state.primaryLength).filter(exists).length;state.queue=[...prefix,...manual,...rest];state.pos=prefix.length-1;state.manualEnd=prefix.length+manual.length;
}
function metadata(track,album,cover,origin){
 if(!track)return null;
 const src=new URL(cover||'/icons/app-512.png',origin).href;
 const ext=new URL(src).pathname.split('.').pop().toLowerCase(),type=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml',avif:'image/avif'})[ext];
 const art={src};if(type)art.type=type;if(!cover)art.sizes='512x512';
 return{title:track.title,artist:(track.artists||[]).join(' × '),album:album?.title||'New BenifaClika',artwork:[art]};
}
window.NBCPlaybackTools={add,remove,shuffle,reconcile,metadata};
})();