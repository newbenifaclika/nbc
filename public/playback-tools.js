(()=>{'use strict';
function pendingManual(state){
 return (state.manualEntries||[]).filter(entry=>entry.index>state.pos&&state.queue[entry.index]===entry.id).sort((a,b)=>a.index-b.index);
}
function manualEnd(state){const pending=pendingManual(state);state.manualEnd=pending.length?pending.at(-1).index+1:Math.max(0,state.pos+1)}
function add(state,id,currentId=null){
 if(!state.queue.length&&currentId){state.queue=[currentId];state.pos=0}
 const next=Math.max(0,state.pos+1),pending=pendingManual(state),indices=new Set(pending.map(entry=>entry.index)),ids=[...pending.map(entry=>entry.id),id];
 const automatic=state.queue.slice(next).filter((_,offset)=>!indices.has(next+offset));
 state.queue=[...state.queue.slice(0,next),...ids,...automatic];state.manualEntries=ids.map((id,offset)=>({id,index:next+offset}));manualEnd(state);
 return next+ids.length-1;
}
function remove(state,index){
 if(!Number.isInteger(index)||index<=state.pos||index>=state.queue.length)return false;
 const pending=pendingManual(state);state.queue.splice(index,1);
 state.manualEntries=pending.filter(entry=>entry.index!==index).map(entry=>({...entry,index:entry.index>index?entry.index-1:entry.index}));manualEnd(state);
 if(index<state.primaryLength)state.primaryLength--;return true;
}
function isManual(state,index){return pendingManual(state).some(entry=>entry.index===index)}
function nextIndex(state,currentId,unavailable=new Set()){
 let index=Math.max(0,state.pos+1);
 while(state.queue[index]&&((state.shuffle&&state.queue[index]===currentId)||unavailable.has(state.queue[index])))index++;
 return index;
}
function randomSequence(ids,previous=null,random=Math.random){
 const counts=new Map();for(const id of ids)counts.set(id,(counts.get(id)||0)+1);
 const result=[];
 while(counts.size){
  const candidates=[...counts].filter(([id])=>id!==previous);if(!candidates.length)break;
  const highest=Math.max(...candidates.map(([,count])=>count)),choices=candidates.filter(([,count])=>count===highest);
  const [id,count]=choices[Math.floor(random()*choices.length)];result.push(id);previous=id;
  if(count===1)counts.delete(id);else counts.set(id,count-1);
 }
 return result;
}
function shuffle(state,random=Math.random){
 const next=Math.max(0,state.pos+1),future=randomSequence(state.queue.slice(next),state.queue[state.pos]??null,random);
 state.queue=[...state.queue.slice(0,next),...future];state.manualEntries=[];state.manualEnd=next;
}
function reconcile(state,exists){
 const queue=state.queue,pending=pendingManual(state),indices=new Map(),kept=[];
 queue.forEach((id,index)=>{if(exists(id)){indices.set(index,kept.length);kept.push(id)}});
 state.primaryLength=queue.slice(0,state.primaryLength).filter(exists).length;
 const next=queue.slice(0,Math.max(0,state.pos+1)).filter(exists).length;
 state.queue=kept;state.pos=next-1;state.manualEntries=pending.filter(entry=>indices.has(entry.index)).map(entry=>({...entry,index:indices.get(entry.index)}));manualEnd(state);
}
function metadata(track,album,cover,origin){
 if(!track)return null;
 const src=new URL(cover||'/icons/app-512.png',origin).href;
 const ext=new URL(src).pathname.split('.').pop().toLowerCase(),type=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml',avif:'image/avif'})[ext];
 const art={src};if(type)art.type=type;if(!cover)art.sizes='512x512';
 return{title:track.title,artist:(track.artists||[]).join(' × '),album:album?.title||'New BenifaClika',artwork:[art]};
}
window.NBCPlaybackTools={add,remove,shuffle,randomSequence,reconcile,metadata,isManual,nextIndex};
})();