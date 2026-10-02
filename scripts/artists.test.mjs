import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import {webcrypto} from 'node:crypto';
globalThis.crypto ||= webcrypto;
function environment(){
 const artists=new Map([['Neggoneko',{name:'Neggoneko',sort_order:1,bio:'Existing biography',photo_key:'artists/existing.webp'}]]);let seeds=0;
 const DB={prepare(sql){return{sql,values:[],bind(...v){this.values=v;return this},async all(){return{results:sql.includes('FROM artists')?[...artists.values()]:[]}},async first(){return sql.includes('FROM artists')?artists.get(this.values[0])||null:null},async run(){if(sql.startsWith('UPDATE artists')){const a=artists.get(this.values[2]);a.photo_key=this.values[0];a.bio=this.values[1]}return{success:true}}}},async batch(statements){seeds++;for(const s of statements)if(s.sql.startsWith('INSERT OR IGNORE INTO artists')&&!artists.has(s.values[0]))artists.set(s.values[0],{name:s.values[0],sort_order:s.values[1],bio:null,photo_key:null});return[]}};
 return{DB,ADMIN_PASSWORD:'test-password',SESSION_SECRET:'test-secret',state:{artists,get seeds(){return seeds}}};
}
test('bootstrap creates Dasito once and preserves existing profiles',async()=>{
 const env=environment(),request=()=>new Request('https://nbc.test/api/bootstrap');
 const first=await worker.fetch(request(),env);assert.equal(first.status,200);const data=await first.json();
 assert.equal(data.artists.find(a=>a.name==='Dasito').sort_order,6);assert.equal(env.state.artists.size,6);
 assert.equal(env.state.artists.get('Neggoneko').bio,'Existing biography');assert.equal(env.state.artists.get('Neggoneko').photo_key,'artists/existing.webp');
 await worker.fetch(request(),env);assert.equal(env.state.seeds,1);
});
test('Dasito can be edited on an existing database without running SQL manually',async()=>{
 const env=environment();const login=await worker.fetch(new Request('https://nbc.test/api/auth/login',{method:'POST',body:JSON.stringify({password:'test-password'})}),env);
 const cookie=login.headers.get('set-cookie').split(';')[0];
 const result=await worker.fetch(new Request('https://nbc.test/api/artists/Dasito',{method:'PUT',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({bio:'New member',photo_key:null})}),env);
 assert.equal(result.status,200);assert.equal(env.state.artists.get('Dasito').bio,'New member');
});
test('public visitors cannot edit the new artist',async()=>{
 const env=environment(),result=await worker.fetch(new Request('https://nbc.test/api/artists/Dasito',{method:'PUT',body:JSON.stringify({bio:'No'})}),env);
 assert.equal(result.status,401);assert.equal(env.state.seeds,0);
});
