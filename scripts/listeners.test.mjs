import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';
import { testEnvironment, sqliteAvailable } from './test-d1.mjs';

const opt = { skip: !sqliteAvailable };
const origin = 'https://nbc.test';
async function req(env, path, method = 'GET', data, cookie = '', site = origin) {
  return worker.fetch(new Request(origin + path, {
    method, headers: { Origin: site, Cookie: cookie, 'Content-Type': 'application/json' },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  }), env);
}
async function register(env, username, cookie = '') {
  const r = await req(env, '/api/listener/register', 'POST', { username }, cookie);
  assert.equal(r.status, 201);
  return { data: await r.json(), cookie: r.headers.get('set-cookie').split(';')[0], headers: r.headers };
}
async function status(env, cookie) {
  return (await req(env, '/api/listener', 'GET', undefined, cookie)).json();
}
function addTrack(env, id) {
  env.sqlite.prepare('INSERT INTO tracks(id,title,audio_key) VALUES(?,?,?)').run(id,id,'audio/'+id+'.mp3');
}

test('listener registration migrates existing catalog, protects credentials and creates a separate session', opt, async () => {
  const env = testEnvironment(); addTrack(env,'original');
  const a = await register(env,'  Test.Listener  ');
  assert.equal(a.data.username,'test.listener');
  assert.match(a.data.accessKey,/^NBC-[A-Za-z0-9_-]{32}$/);
  assert.match(a.cookie,/^__Host-nbc_listener=/);
  assert.match(a.headers.get('set-cookie'),/Path=\/; Max-Age=\d+; HttpOnly; Secure; SameSite=Strict/);
  assert.equal(a.headers.get('cache-control'),'no-store');
  assert.equal(env.sqlite.prepare('SELECT title FROM tracks WHERE id=?').get('original').title,'original');
  assert.notEqual(env.sqlite.prepare('SELECT access_hash FROM listener_accounts').get().access_hash,a.data.accessKey);
  assert.notEqual(env.sqlite.prepare('SELECT token_hash FROM listener_sessions').get().token_hash,a.cookie.split('=')[1]);
  assert.equal((await req(env,'/api/listener/register','POST',{username:'TEST.LISTENER'})).status,409);
  assert.equal((await req(env,'/api/listener/register','POST',{username:'<script>'})).status,400);
  assert.equal((await req(env,'/api/artists','POST',{name:'Should not edit'},a.cookie)).status,401);
  assert.deepEqual(await status(env,a.cookie),{username:'test.listener',favorites:[]});
});

test('saved songs are private, idempotent and removed when the underlying track is deleted',opt,async()=>{
  const env=testEnvironment();addTrack(env,'demo-track');const a=await register(env,'listener_a'),b=await register(env,'listener_b');
  const path='/api/listener/favorites/demo-track';
  assert.equal((await req(env,path,'PUT')).status,401);
  for(let i=0;i<2;i++)assert.equal((await req(env,path,'PUT',undefined,a.cookie)).status,200);
  assert.deepEqual((await status(env,a.cookie)).favorites,['demo-track']);
  assert.deepEqual((await status(env,b.cookie)).favorites,[]);
  assert.equal((await req(env,path,'DELETE',undefined,b.cookie)).status,200);
  assert.deepEqual((await status(env,a.cookie)).favorites,['demo-track']);
  assert.equal((await req(env,path,'DELETE',undefined,a.cookie)).status,200);
  assert.deepEqual((await status(env,a.cookie)).favorites,[]);
  await req(env,path,'PUT',undefined,a.cookie);
  env.sqlite.prepare('DELETE FROM tracks WHERE id=?').run('demo-track');
  assert.deepEqual((await status(env,a.cookie)).favorites,[]);
  assert.equal((await req(env,path,'PUT',undefined,a.cookie)).status,404);
});

test('a second device sees favorites and logout revokes only the current session', opt, async()=>{
  const env=testEnvironment();addTrack(env,'demo-track');const a=await register(env,'returning');
  await req(env,'/api/listener/favorites/demo-track','PUT',undefined,a.cookie);
  const login=await req(env,'/api/listener/login','POST',{username:'returning',accessKey:a.data.accessKey});
  assert.equal(login.status,200);assert.deepEqual(await login.json(),{username:'returning',favorites:['demo-track']});
  const second=login.headers.get('set-cookie').split(';')[0];
  assert.notEqual(second,a.cookie);
  assert.equal((await req(env,'/api/listener/logout','POST',undefined,second)).status,200);
  assert.equal((await status(env,second)).username,null);
  assert.equal((await status(env,a.cookie)).username,'returning');
  env.sqlite.prepare('UPDATE listener_sessions SET expires_at=0').run();
  assert.equal((await status(env,a.cookie)).username,null);
});

test('cross-origin writes are refused and deleting an account requires its own key',opt,async()=>{
  const env=testEnvironment();addTrack(env,'keep-this');const a=await register(env,'delete_me'),b=await register(env,'other_user');
  assert.equal((await req(env,'/api/listener/favorites/keep-this','PUT',undefined,a.cookie,'https://other.test')).status,403);
  assert.equal((await req(env,'/api/listener','DELETE',{accessKey:b.data.accessKey},a.cookie)).status,403);
  await req(env,'/api/listener/favorites/keep-this','PUT',undefined,a.cookie);
  assert.equal((await req(env,'/api/listener','DELETE',{accessKey:a.data.accessKey},a.cookie)).status,200);
  assert.deepEqual(await status(env,a.cookie),{username:null,favorites:[]});
  assert.equal((await status(env,b.cookie)).username,'other_user');
  assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM listener_favorites').get().n,0);
  assert.equal(env.sqlite.prepare('SELECT COUNT(*) AS n FROM tracks').get().n,1);
});

test('account throttling rejects before database work',opt,async()=>{
  const env=testEnvironment();env.LISTENER_AUTH_LIMIT={async limit(){return {success:false}}};
  const r=await req(env,'/api/listener/register','POST',{username:'blocked'});
  assert.equal(r.status,429);
  assert.equal(env.sqlite.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='listener_accounts'").get().n,0);
});
