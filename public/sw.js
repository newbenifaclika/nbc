const CACHE='nbc-cloudflare-v2';
const SHELL=['/','/index.html','/app.css','/app.js','/manifest.webmanifest','/icon.svg'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/media/'))return;
  event.respondWith((async()=>{
    try{
      const fresh=await fetch(req);
      if(fresh.ok){const cache=await caches.open(CACHE);cache.put(req,fresh.clone())}
      return fresh;
    }catch{
      return (await caches.match(req))||(await caches.match('/index.html'));
    }
  })());
});
