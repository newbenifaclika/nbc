import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('artist names containing quotes are safely encoded in clickable profiles',()=>{
 const c={};vm.runInNewContext(app.split('\n').find(line=>line.startsWith('const artistToken='))+';globalThis.result=artistToken("D\\\'Artista")',c);
 assert.equal(c.result,"D%27Artista");assert.ok(html.includes('id="profileName"'));assert.ok(html.includes('id="artistReplacement"'));
});
test('renaming refreshes song credits, current player, artist context and draft selections',()=>{
 const track={id:'song',artists:['Dasito','xAMMO']},els={albumRows:{},albumTitle:{}},c={artists:[{name:'Dasito',bio:'Biography'},{name:'xAMMO'}],tracks:[track],currentTrack:track,currentArtist:'Dasito',currentView:'artistDetail',MEMBERS:['Dasito','xAMMO'],playback:{source:{type:'artist',id:'Dasito',name:'Dasito'}},albumDraft:{rows:[{artists:['Dasito']}]},trackArtists:t=>t.artists,trackById:id=>c.tracks.find(t=>t.id===id),readAlbumFields(){},renderAlbumDraft(){c.draftRendered=true},persistAlbumDraft(){c.draftSaved=true},history:{replaceState(state,title,url){c.newRoute=url}},routeUrl:r=>r.artist,rebuildAlbums(){},renderAll(){c.rendered=true},showView(){}};
 const start=app.indexOf('function applyArtistMutation('),end=app.indexOf("$('profileForm').onsubmit",start);vm.runInNewContext(app.slice(start,end),c);
 vm.runInNewContext("applyArtistMutation('Dasito','Nuevo nombre',{bio:'Biography'})",c);
 assert.deepEqual([...c.tracks[0].artists],['Nuevo nombre','xAMMO']);assert.equal(c.currentTrack.artists[0],'Nuevo nombre');assert.equal(c.currentArtist,'Nuevo nombre');assert.equal(c.playback.source.id,'Nuevo nombre');
 assert.equal(c.albumDraft.rows[0].artists[0],'Nuevo nombre');assert.equal(c.newRoute,'Nuevo nombre');assert.equal(c.rendered,true);
});
