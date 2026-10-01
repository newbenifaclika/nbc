/* One unfinished album per browser. Files stay local until explicitly uploaded. */
(()=>{
'use strict';
const STORAGE_KEY='nbc_album_draft_v1';
let database;
function db(){
  if(database)return database;
  database=new Promise((resolve,reject)=>{
    const request=indexedDB.open('nbc-upload-drafts',1);
    const timer=setTimeout(()=>reject(new Error('Draft storage unavailable')),5000);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>{clearTimeout(timer);resolve(request.result)};
    request.onerror=request.onblocked=()=>{clearTimeout(timer);reject(request.error||new Error('Draft storage unavailable'))};
  });
  return database;
}
async function transaction(mode,action){
  const database=await db();
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('drafts',mode),request=action(tx.objectStore('drafts'));
    tx.oncomplete=()=>resolve(request.result);
    tx.onerror=tx.onabort=()=>reject(tx.error||new Error('Could not save draft'));
  });
}
function metadata(draft){
  return {...draft,cover:{...draft.cover,file:null},rows:draft.rows.map(row=>({...row,file:null})),filesStored:false};
}
function valid(value){return value?.version===1&&typeof value.id==='string'&&Array.isArray(value.rows)&&value.rows.length<=50}
async function read(){
  let fallback;try{fallback=JSON.parse(localStorage.getItem(STORAGE_KEY))}catch{}
  let stored;try{stored=await transaction('readonly',store=>store.get('active'))}catch{}
  if(valid(fallback)&&(!valid(stored)||fallback.updatedAt>stored.updatedAt))return fallback;
  return valid(stored)?stored:valid(fallback)?fallback:null;
}
async function save(draft){
  const snapshot={...draft,updatedAt:Date.now(),filesStored:true};
  let savedMetadata=false;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(metadata(snapshot)));savedMetadata=true}catch{}
  try{
    await transaction('readwrite',store=>store.put(snapshot,'active'));
    return {filesStored:true,persistent:true};
  }catch{
    return {filesStored:false,persistent:savedMetadata};
  }
}
async function clear(){
  // Leave a tombstone if IndexedDB is temporarily unavailable, so an old draft cannot return.
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,id:'cleared',rows:[],cover:{},cleared:true,updatedAt:Date.now()}))}catch{}
  try{await transaction('readwrite',store=>store.delete('active'))}catch{}
}
window.NBCAlbumDraft={read,save,clear};
})();
