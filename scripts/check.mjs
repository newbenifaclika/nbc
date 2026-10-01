import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('public/index.html'),js=read('public/app.js'),worker=read('src/worker.js'),schema=read('schema.sql');
const checks=[
  ['No Supabase in frontend',!/supabase/i.test(js+html)],
  ['No lyrics feature',!/lyrics|letra/i.test(js+html)],
  ['No sharing feature',!/navigator\.share|shareTrack|shareAlbum|shareArtist/i.test(js+html)],
  ['No stats/play-count feature',!/play_count|reproducciones/i.test(js+html)],
  ['D1 schema has tracks',/CREATE TABLE IF NOT EXISTS tracks/.test(schema)],
  ['Worker has R2 media range',/range: request\.headers/.test(worker)],
  ['Worker has signed session',/HttpOnly; Secure; SameSite=Strict/.test(worker)],
  ['Storage guard enabled',/STORAGE_SOFT_LIMIT_BYTES/.test(worker)],
  ['Progressive song rendering',/SONGS_PAGE=50/.test(js)],
  ['Media Session enabled',/mediaSession/.test(js)],
];
let failed=0;for(const [name,ok] of checks){console.log(`${ok?'✓':'✗'} ${name}`);if(!ok)failed++}
const forbidden=[];for(const file of fs.readdirSync(path.join(root,'public'))){if(/\.(mp3|wav|m4a|ogg|jpe?g|png|webp)$/i.test(file))forbidden.push(file)}
console.log(`${forbidden.length?'✗':'✓'} No user media in public/`);if(forbidden.length){console.log(forbidden);failed++}
process.exitCode=failed?1:0;
