import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {webcrypto} from 'node:crypto';
globalThis.crypto ||= webcrypto;
const UUID='c49276c0-a03b-4db9-81dc-45717a51d72c';
function environment(){
  const files=new Map(),albums=new Map(),tracks=new Map();let bytes=0,puts=0;
  const DB={prepare(sql){return {bind(...values){this.values=values;return this},async first(){
    if(sql.includes('app_settings'))return {value:String(bytes)};
    if(sql.includes('FROM albums WHERE id='))return albums.get(this.values[0])||null;
    if(sql.includes('SELECT 1 AS used'))return [...albums.values()].some(a=>a.cover_key===this.values[0])?{used:1}:null;
    return null;
  },async all(){return {results:[...tracks.values()].filter(t=>t.album_id===this.values[0]).sort((a,b)=>a.track_number-b.track_number)}},
  async run(){if(sql.includes('app_settings'))bytes=Number(this.values[0]);return {success:true}},sql,values:[]}},
  async batch(statements){
    for(const s of statements)if(s.sql.startsWith('INSERT INTO albums')&&albums.has(s.values[0]))throw Error('UNIQUE constraint failed');
    for(const s of statements){const v=s.values;
      if(s.sql.startsWith('INSERT INTO albums'))albums.set(v[0],{id:v[0],title:v[1],cover_key:v[2]});
      if(s.sql.startsWith('INSERT INTO tracks'))tracks.set(v[0],{id:v[0],title:v[1],album_id:v[2],track_number:v[3],audio_key:v[5]});
    }
  }};
  return {DB,MEDIA:{async head(key){return files.get(key)||null},async put(key,body,options){puts++;const size=(await new Response(body).arrayBuffer()).byteLength;const object={size,customMetadata:options.customMetadata};files.set(key,object);return object},async delete(key){files.delete(key)}},
    ADMIN_PASSWORD:'test-password',SESSION_SECRET:'test-secret',STORAGE_SOFT_LIMIT_BYTES:100,
    state:{files,albums,tracks,get bytes(){return bytes},get puts(){return puts}}
  };
}
async function session(env){
  const response=await worker.fetch(new Request('https://example.test/api/auth/login',{method:'POST',body:JSON.stringify({password:'test-password'})}),env);
  assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];
}
function post(path,cookie,body,headers={}){return new Request('https://example.test'+path,{method:'POST',headers:{Cookie:cookie,...headers},body})}
test('upload retry reuses R2 object and does not charge storage twice, including at the limit',async()=>{
  const env=environment(),cookie=await session(env);
  const path='/api/upload?kind=audio&name=test.mp3&upload_id='+UUID;
  const headers={'Content-Type':'audio/mpeg','X-File-Size':'100'};
  let response=await worker.fetch(post(path,cookie,new Uint8Array(100),headers),env);assert.equal(response.status,200);
  const first=await response.json();
  response=await worker.fetch(post(path,cookie,new Uint8Array(100),headers),env);
  assert.equal(response.status,200);const retried=await response.json();
  assert.equal(retried.key,first.key);assert.equal(retried.reused,true);assert.equal(env.state.puts,1);assert.equal(env.state.bytes,100);
});
test('upload identifiers are validated and cannot be reused for another file',async()=>{
  const env=environment(),cookie=await session(env);
  const path='/api/upload?kind=audio&name=test.mp3&upload_id='+UUID,headers={'Content-Type':'audio/mpeg','X-File-Size':'3'};
  assert.equal((await worker.fetch(post(path,cookie,new Uint8Array(3),headers),env)).status,200);
  assert.equal((await worker.fetch(post(path,cookie,new Uint8Array(2),{...headers,'X-File-Size':'2'}),env)).status,409);
  assert.equal((await worker.fetch(post(path.replace(UUID,'bad'),cookie,new Uint8Array(3),headers),env)).status,400);
});
test('album retry after a lost response returns the original album without duplicate tracks',async()=>{
  const env=environment(),cookie=await session(env);
  const data={upload_id:UUID,title:'Test album',cover_key:'covers/test.png',tracks:[{title:'One',artists:['Neggoneko'],audio_key:'audio/one.mp3'},{title:'Two',artists:['xAMMO'],audio_key:'audio/two.mp3'}]};
  const first=await worker.fetch(post('/api/albums',cookie,JSON.stringify(data)),env);assert.equal(first.status,201);
  const original=await first.json(),second=await worker.fetch(post('/api/albums',cookie,JSON.stringify(data)),env);
  assert.equal(second.status,200);assert.deepEqual((await second.json()).track_ids,original.track_ids);assert.equal(env.state.albums.size,1);assert.equal(env.state.tracks.size,2);
  data.tracks[0].audio_key='audio/different.mp3';
  assert.equal((await worker.fetch(post('/api/albums',cookie,JSON.stringify(data)),env)).status,409);
});
test('recovery endpoints still require authentication',async()=>{
  const env=environment();const response=await worker.fetch(post('/api/upload?kind=audio&name=a.mp3&upload_id='+UUID,'',new Uint8Array(1),{'X-File-Size':'1','Content-Type':'audio/mpeg'}),env);
  assert.equal(response.status,401);assert.equal(env.state.puts,0);
});

test('installed-app icons include correctly sized PNGs and a maskable version',async()=>{
  const {readFile}=await import('node:fs/promises');
  const manifest=JSON.parse(await readFile(new URL('../public/manifest.webmanifest',import.meta.url),'utf8'));
  assert.ok(manifest.icons.some(icon=>icon.purpose.includes('maskable')));
  for(const [name,size] of [['app-192.png',192],['app-512.png',512],['apple-touch-180.png',180]]){
    const png=await readFile(new URL('../public/icons/'+name,import.meta.url));
    assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
  }
});
test('draft metadata survives unavailable file storage and clearing cannot resurrect it',async()=>{
  const {readFile}=await import('node:fs/promises'),{runInNewContext}=await import('node:vm');
  const memory=new Map(),window={};
  runInNewContext(await readFile(new URL('../public/album-draft.js',import.meta.url),'utf8'),{
    window,indexedDB:{open(){throw Error('storage unavailable')}},
    localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},setTimeout,clearTimeout,Date,JSON
  });
  const draft={version:1,id:UUID,title:'My album',cover:{key:'covers/saved.png',file:{name:'local.png'}},rows:[{title:'My track',artists:['xAMMO'],key:'audio/saved.mp3',file:{name:'local.mp3'},fileInfo:{name:'local.mp3',size:200}}]};
  const saved=await window.NBCAlbumDraft.save(draft);assert.equal(saved.persistent,true);assert.equal(saved.filesStored,false);
  const recovered=await window.NBCAlbumDraft.read();assert.equal(recovered.title,draft.title);assert.equal(recovered.rows[0].key,draft.rows[0].key);assert.equal(recovered.rows[0].file,null);
  await window.NBCAlbumDraft.clear();assert.equal((await window.NBCAlbumDraft.read()).cleared,true);
});
