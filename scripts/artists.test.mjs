import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {webcrypto} from 'node:crypto';
import {testEnvironment,sqliteAvailable} from './test-d1.mjs';
globalThis.crypto ||= webcrypto;
const options={skip:!sqliteAvailable};
async function editor(env){
 const r=await worker.fetch(new Request('https://nbc.test/api/auth/login',{method:'POST',body:JSON.stringify({password:'test-password'})}),env);
 return r.headers.get('set-cookie').split(';')[0];
}
async function call(env,path,method='GET',body=null,cookie=''){
 return worker.fetch(new Request('https://nbc.test'+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
}
function track(env,id,names,album=null){
 if(album)env.sqlite.prepare('INSERT OR IGNORE INTO albums(id,title) VALUES(?,?)').run(album,'Album');
 env.sqlite.prepare('INSERT INTO tracks(id,title,audio_key,album_id) VALUES(?,?,?,?)').run(id,'Song '+id,'audio/'+id+'.mp3',album);
 names.forEach((name,index)=>env.sqlite.prepare('INSERT INTO track_artists(track_id,artist_name,position) VALUES(?,?,?)').run(id,name,index));
}
test('catalog initializes once without changing existing profiles',options,async()=>{
 const env=testEnvironment();env.sqlite.prepare('UPDATE artists SET bio=?,photo_key=? WHERE name=?').run('Existing biography','artists/existing.webp','Neggoneko');
 const r=await call(env,'/api/bootstrap');assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.artists.length,6);assert.equal(data.artists.find(a=>a.name==='Dasito').sort_order,6);
 assert.equal(data.artists.find(a=>a.name==='Neggoneko').bio,'Existing biography');
 assert.equal(env.sqlite.prepare('SELECT value FROM app_settings WHERE key=?').get('artists_catalog_initialized').value,'1');
});
test('new artists are accepted in songs and album tracks',options,async()=>{
 const env=testEnvironment(),cookie=await editor(env);
 assert.equal((await call(env,'/api/artists','POST',{name:"D'Artista",bio:'New bio'},cookie)).status,201);
 assert.equal((await call(env,'/api/tracks','POST',{title:'New single',artists:["D'Artista"],audio_key:'audio/new.mp3'},cookie)).status,201);
 const album=await call(env,'/api/albums','POST',{title:'New album',cover_key:'covers/album.png',tracks:[{title:'New track',artists:["D'Artista",'Dasito'],audio_key:'audio/album.mp3'}]},cookie);
 assert.equal(album.status,201);assert.equal((await call(env,'/api/bootstrap')).status,200);
 assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM track_artists WHERE artist_name=?').get("D'Artista").n,2);
});
test('renaming preserves profile data and updates single and album collaborations atomically',options,async()=>{
 const env=testEnvironment(),cookie=await editor(env);track(env,'single',['Dasito','xAMMO']);track(env,'album',['Dasito'],'album');
 env.sqlite.prepare('UPDATE artists SET bio=?,photo_key=? WHERE name=?').run('Preserved bio','artists/existing.webp','Dasito');
 const before=env.sqlite.prepare('SELECT * FROM tracks ORDER BY id').all();
 const r=await call(env,'/api/artists/Dasito','PUT',{name:'Dasito Nuevo'},cookie);assert.equal(r.status,200);
 const data=await(await call(env,'/api/bootstrap')).json();assert.deepEqual(data.tracks.find(t=>t.id==='single').artists,['Dasito Nuevo','xAMMO']);
 assert.deepEqual(data.tracks.find(t=>t.id==='album').artists,['Dasito Nuevo']);assert.equal(data.artists.some(a=>a.name==='Dasito'),false);
 const profile=data.artists.find(a=>a.name==='Dasito Nuevo');assert.equal(profile.bio,'Preserved bio');assert.equal(profile.photo_key,'artists/existing.webp');assert.equal(profile.sort_order,6);
 assert.deepEqual(env.sqlite.prepare('SELECT * FROM tracks ORDER BY id').all(),before);
 assert.deepEqual(env.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('renamed and deleted initial members do not reappear after a cold start',options,async()=>{
 const env=testEnvironment(),cookie=await editor(env);
 await call(env,'/api/artists/Dasito','PUT',{name:'New Name'},cookie);
 assert.equal((await call(env,'/api/artists/TGT','DELETE',{},cookie)).status,200);
 const fresh=testEnvironment(env.sqlite),r=await call(fresh,'/api/bootstrap'),data=await r.json();
 assert.equal(data.artists.some(a=>a.name==='Dasito'||a.name==='TGT'),false);assert.equal(data.artists.some(a=>a.name==='New Name'),true);
});
test('duplicate names and malformed names leave profiles and song credits unchanged',options,async()=>{
 const env=testEnvironment(),cookie=await editor(env);track(env,'song',['Dasito']);const before=env.sqlite.prepare('SELECT * FROM track_artists').all();
 for(const name of ['xammo','', 'x'.repeat(81),'\u0000test']){
  const r=await call(env,'/api/artists/Dasito','PUT',{name},cookie);assert.ok([400,409].includes(r.status));assert.deepEqual(env.sqlite.prepare('SELECT * FROM track_artists').all(),before);
 }
});
test('removing an artist with songs requires reassignment and preserves music and collaborators',options,async()=>{
 const env=testEnvironment(),cookie=await editor(env);track(env,'solo',['Dasito']);track(env,'collab',['Dasito','xAMMO'],'album');track(env,'other',['Dasito','TGT']);
 const before=env.sqlite.prepare('SELECT * FROM tracks ORDER BY id').all();
 assert.equal((await call(env,'/api/artists/Dasito','DELETE',{},cookie)).status,409);
 const result=await call(env,'/api/artists/Dasito','DELETE',{replacement:'xAMMO'},cookie);assert.equal(result.status,200);
 const data=await(await call(env,'/api/bootstrap')).json();assert.deepEqual(data.tracks.find(t=>t.id==='solo').artists,['xAMMO']);
 assert.deepEqual(data.tracks.find(t=>t.id==='collab').artists,['xAMMO']);assert.deepEqual(data.tracks.find(t=>t.id==='other').artists,['xAMMO','TGT']);
 assert.deepEqual(env.sqlite.prepare('SELECT * FROM tracks ORDER BY id').all(),before);assert.deepEqual(env.sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
});
test('the final artist and unauthorized edits are protected',options,async()=>{
 const env=testEnvironment(),cookie=await editor(env);
 assert.equal((await call(env,'/api/artists','POST',{name:'Unauthorized'})).status,401);
 assert.equal((await call(env,'/api/artists/Dasito','PUT',{name:'Unauthorized'})).status,401);
 assert.equal((await call(env,'/api/artists/Dasito','DELETE',{})).status,401);
 await call(env,'/api/bootstrap');env.sqlite.prepare('DELETE FROM artists WHERE name<>?').run('Dasito');
 assert.equal((await call(env,'/api/artists/Dasito','DELETE',{},cookie)).status,409);
});
test('editing a song rejects removed artist names instead of losing a collaborator silently',options,async()=>{
 const env=testEnvironment(),cookie=await editor(env);track(env,'song',['Dasito','xAMMO']);
 await call(env,'/api/artists/Dasito','PUT',{name:'New Name'},cookie);
 const r=await call(env,'/api/tracks/song','PUT',{title:'New title',artists:['Dasito','xAMMO']},cookie);assert.equal(r.status,400);
 assert.equal(env.sqlite.prepare('SELECT title FROM tracks WHERE id=?').get('song').title,'Song song');
});

test('adopting an existing customized catalog never restores removed default names',options,async()=>{
 const env=testEnvironment();env.sqlite.prepare('UPDATE artists SET name=? WHERE name=?').run('Customized name','Dasito');
 env.sqlite.prepare('DELETE FROM artists WHERE name=?').run('TGT');
 const data=await(await call(env,'/api/bootstrap')).json();
 assert.equal(data.artists.some(a=>a.name==='Dasito'||a.name==='TGT'),false);
 assert.equal(data.artists.some(a=>a.name==='Customized name'),true);
});
