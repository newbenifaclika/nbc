(()=>{
'use strict';
const $=id=>document.getElementById(id);const q=(s,r=document)=>r.querySelector(s);const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let MEMBERS=[];let creatingArtist=false;
let listener=null, listenerVersion=0, listenerMode='login', listenerBusy=false, pendingFavorite=null;
let favoriteIds=new Set();
const savingFavorites=new Map(),HEART_ICON="<svg class=\"ui-icon heart-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20.7 5.5a5 5 0 0 0-7.1 0L12 7.1l-1.6-1.6a5 5 0 0 0-7.1 7.1L12 21l8.7-8.4a5 5 0 0 0 0-7.1Z\"/></svg>";
const artistToken=name=>encodeURIComponent(name).replace(/'/g,'%27');
const audio=$('audio');const queueTools=window.NBCPlaybackTools;
const QUEUE_ICON='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>';
const QUEUE_ADD_ICON='<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h12M4 12h8M4 18h8M18 11v10M13 16h10"/></svg>';
function queueAddButton(t){return `<button class="circle-btn queue-add" onclick="NBCAddQueue('${t.id}')" aria-label="Añadir a la cola: ${esc(t.title)}" title="Añadir a la cola">${QUEUE_ADD_ICON}</button>`}
let queueVisible=false,queueLimit=50,artworkSeq=0,artworkKey='',artworkData=null;
const ICONS={"play":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m8 5 11 7-11 7z\"/></svg>","pause":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 5v14M16 5v14\"/></svg>","previous":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M5 5v14m14-14-10 7 10 7z\"/></svg>","next":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M19 5v14M5 5l10 7-10 7z\"/></svg>","shuffle":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 6h2c5 0 7 12 12 12h2M4 18h2c2.2 0 3.9-2.3 5.5-5.3M13 9.3C14.5 7.4 16 6 18 6h2\"/><path d=\"m17 3 3 3-3 3m0 6 3 3-3 3\"/></svg>","repeat":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 10V8a3 3 0 0 1 3-3h13M20 14v2a3 3 0 0 1-3 3H4\"/><path d=\"m17 2 3 3-3 3M7 16l-3 3 3 3\"/></svg>","volume":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 9h4l5-4v14l-5-4H4zM17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14\"/></svg>","mute":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 9h4l5-4v14l-5-4H4zM17 9l5 6m0-6-5 6\"/></svg>","back":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 12H4m6-6-6 6 6 6\"/></svg>","close":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 6 12 12M6 18 18 6\"/></svg>","upload":"<svg class=\"ui-icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M12 16V4m-4 4 4-4 4 4M5 16v3h14v-3\"/></svg>"};
let pendingPlaybackMessage='';const failedTracks=new Set();
let tracks=[],albumsMeta=[],artists=[],albums=[];let user=false,currentView='home',currentAlbumId=null,currentArtist=null,searchFilter='all';
let currentTrack=null,isStarting=false,isBuffering=false,wantsPlayback=false,playSeq=0;let deferredPrompt=null;let uploadBusy=false;
let visibleSongsLimit=50;const SONGS_PAGE=50;let albumEditFiles=[];let albumRemoveIds=new Set();
const playback={queue:[],pos:-1,manualEnd:0,manualEntries:[],source:{type:'radio',id:null,name:'Radio de la clika'},primaryLength:0,history:[],radioSeen:new Set(),shuffle:localStorage.getItem('nbc_shuffle')==='1',repeat:localStorage.getItem('nbc_repeat')==='1'};
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const ALBUM_FALLBACK='<svg class="album-fallback-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="12" cy="12" r="3.2"/><path d="M12 8.8v6.4"/></svg>';
const EDIT_ICON='<svg class="row-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 16.8-.8 3 3-.8L18.6 7.6a2.2 2.2 0 0 0-3.1-3.1z"/><path d="m14.2 5.8 4 4"/></svg>';
const TRASH_ICON='<svg class="row-action-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7h15"/><path d="M9 4.5h6"/><path d="m7 7 .7 12h8.6L17 7"/><path d="M10 10.5v5M14 10.5v5"/></svg>';
const norm=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const initials=v=>String(v||'NBC').split(/\s+/).map(x=>x[0]).join('').slice(0,3).toUpperCase();
const fmt=s=>{s=Math.floor(Number(s)||0);return s?`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`:'—'};
const fmtLong=s=>{s=Math.floor(Number(s)||0);const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h?`${h} h ${m} min`:`${m} min`};
const formatBytes=n=>{n=Number(n)||0;if(n<1024)return`${n} B`;const u=['KB','MB','GB','TB'];let i=-1;do{n/=1024;i++}while(n>=1024&&i<u.length-1);return`${n.toFixed(n>=100?0:n>=10?1:2)} ${u[i]}`};
const coverStyle=url=>url?`style="background-image:url('${esc(url)}')"`:'';const mediaUrl=key=>key?`/media/${String(key).split('/').map(encodeURIComponent).join('/')}`:'';
const trackById=id=>tracks.find(t=>t.id===id)||null;const albumById=id=>albums.find(a=>a.id===id)||null;const artistByName=name=>artists.find(a=>a.name===name)||{name,bio:null,photo_key:null};
function toast(msg){const e=$('toast');e.textContent=msg;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),2800)}
async function api(path,opt={}){const options={credentials:'same-origin',...opt,headers:{...(opt.body instanceof Blob||opt.body instanceof File?{}:{'Content-Type':'application/json'}),...(opt.headers||{})}};let r;try{r=await fetch(path,options)}catch{throw new Error(navigator.onLine?'No se pudo conectar con el servidor. Inténtalo de nuevo.':'No hay conexión. Inténtalo cuando vuelva.')}let data={};try{data=await r.json()}catch{}if(!r.ok)throw Object.assign(new Error(data.error||`Error ${r.status}`),{status:r.status});return data}
function trackArtists(t){return Array.isArray(t?.artists)?t.artists:[]}function artistText(t){return trackArtists(t).join(' × ')}
function albumCover(a){return a?.cover_key?mediaUrl(a.cover_key):''}function trackCover(t){if(t?.cover_key)return mediaUrl(t.cover_key);if(t?.album_id)return albumCover(albumById(t.album_id));return''}
function rebuildAlbums(){albums=albumsMeta.map(m=>{const list=tracks.filter(t=>t.album_id===m.id).sort((a,b)=>(a.track_number||999)-(b.track_number||999));return{...m,tracks:list,artists:[...new Set(list.flatMap(trackArtists))],duration:list.reduce((n,t)=>n+(Number(t.duration_seconds)||0),0)}}).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')))}
async function loadAll(){try{const data=await api('/api/bootstrap');tracks=data.tracks||[];albumsMeta=data.albums||[];artists=data.artists||[];failedTracks.clear();MEMBERS=artists.map(artist=>artist.name);rebuildAlbums();queueTools.reconcile(playback,id=>!!trackById(id));if(currentTrack&&trackById(currentTrack.id))currentTrack=trackById(currentTrack.id);renderAll();restoreTrackOnce()}catch(e){toast(`No se pudo cargar la biblioteca: ${e.message}`)}}
async function authStatus(){try{const x=await api('/api/auth/status');user=!!x.authenticated;setEditorUI()}catch{user=false;setEditorUI()}}
function renderAll(){renderCurrent();$('anniversaryCounts').textContent=`${tracks.length} ${tracks.length===1?'tema':'temas'} · ${albums.length} ${albums.length===1?'álbum':'álbumes'}`;updateNowUI()}
function renderCurrent(){if(currentView==='home')renderHome();else if(currentView==='songs')renderSongs();else if(currentView==='albums')renderAlbums();else if(currentView==='artists')renderArtists();else if(currentView==='favorites')renderFavorites();else if(currentView==='albumDetail')renderAlbumDetail(currentAlbumId);else if(currentView==='artistDetail')renderArtistDetail(currentArtist);else if(currentView==='search')renderSearch($('globalSearch').value);syncPlaybackCards()}
function resetSearch(){const i=$('globalSearch');i.value='';$('searchSuggest').classList.remove('show');$('searchSuggest').innerHTML='';searchFilter='all';$$('#searchFilters .chip').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'))}
function showView(v,{scroll=true}={}){currentView=v;$$('.view').forEach(x=>x.classList.toggle('active',x.id===`view-${v}`));$$('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===v));renderCurrent();if(scroll)scrollTo({top:0,behavior:'auto'})}
function routeUrl(route){const u=new URL(location.href);u.search='';if(['songs','albums','artists','favorites'].includes(route.view))u.searchParams.set('view',route.view);else if(route.view==='albumDetail')u.searchParams.set('album',route.album);else if(route.view==='artistDetail')u.searchParams.set('artist',route.artist);else if(route.view==='search')u.searchParams.set('search',route.query);return u}
function pushRoute(route){history.pushState({nbc:true,route},'',routeUrl(route))}
function navigate(v){resetSearch();showView(v);pushRoute({view:v})}
$$('[data-nav]').forEach(b=>b.onclick=()=>{const v=b.dataset.nav;if(currentView===v){resetSearch();scrollTo({top:0});return}navigate(v)});
window.NBCBack=()=>history.length>1?history.back():showView('home');
window.addEventListener('popstate',e=>{closeSheetDirect('nowPlayingSheet');const r=e.state?.route||routeFromUrl();applyRoute(r,false)});
function routeFromUrl(){const p=new URLSearchParams(location.search);if(p.get('album'))return{view:'albumDetail',album:p.get('album')};if(p.get('artist'))return{view:'artistDetail',artist:p.get('artist')};if(p.get('search'))return{view:'search',query:p.get('search')};if(['songs','albums','artists','favorites'].includes(p.get('view')))return{view:p.get('view')};return{view:'home'}}
function applyRoute(r,scroll=true){if(r.view==='albumDetail'){currentAlbumId=r.album;showView('albumDetail',{scroll})}else if(r.view==='artistDetail'){currentArtist=r.artist;showView('artistDetail',{scroll})}else if(r.view==='search'){$('globalSearch').value=r.query||'';showView('search',{scroll})}else showView(['songs','albums','artists','favorites'].includes(r.view)?r.view:'home',{scroll})}
function releaseCard(x){return x.type==='album'?albumCard(x.data):singleCard(x.data)}
function cardPlaybackState(type,id){const current=!!currentTrack&&(type==='album'?currentTrack.album_id===id&&playback.source.type==='album'&&playback.source.id===id:currentTrack.id===id);return {current,playing:current&&!audio.paused&&!audio.ended&&!audio.error&&!transport.recoveryNeeded}}
function cardPlayContent(playing){return `${playing?ICONS.pause:ICONS.play} ${playing?'Pausa':'Play'}`}
function syncPlaybackCards(){
  $$('.media-card[data-track-id],.media-card[data-album-id]').forEach(card=>{
    const album=card.dataset.albumId,state=cardPlaybackState(album?'album':'track',album||card.dataset.trackId);
    card.classList.toggle('is-current',state.current);card.classList.toggle('playing',state.playing);
    const button=q('.card-actions .btn-play',card);
    if(button){const content=cardPlayContent(state.playing);if(button.innerHTML!==content)button.innerHTML=content;const title=q('.card-meta strong',card)?.textContent||'';button.setAttribute('aria-label',`${state.playing?'Pausar':'Reproducir'} ${title}`)}
  });
  $$('[data-play-album]').forEach(button=>{
    const playing=cardPlaybackState('album',button.dataset.playAlbum).playing;
    button.innerHTML=`${playing?ICONS.pause:ICONS.play} ${playing?'Pausa':'Play'}`;
    button.setAttribute('aria-label',`${playing?'Pausar':'Reproducir'} álbum ${albumById(button.dataset.playAlbum)?.title||''}`);
  });
}
function albumCard(a){const cover=albumCover(a),state=cardPlaybackState('album',a.id);return`<article class="media-card${state.current?' is-current':''}${state.playing?' playing':''}" data-album-id="${a.id}"><button class="cover" aria-label="Abrir álbum ${esc(a.title)}" onclick="NBCOpenAlbum('${a.id}')" ${coverStyle(cover)}>${cover?'':`<span class="album-fallback">${ALBUM_FALLBACK}</span>`}</button><button class="card-meta" onclick="NBCOpenAlbum('${a.id}')"><strong>${esc(a.title)}</strong><span>${esc(a.artists.join(' × '))}</span><span>${a.tracks.length} pistas · ${fmtLong(a.duration)}</span></button><div class="card-actions"><button class="btn-sm btn-open" onclick="NBCOpenAlbum('${a.id}')" aria-label="Ver álbum ${esc(a.title)}">Ver álbum</button></div></article>`}
function singleCard(t){const c=trackCover(t),state=cardPlaybackState('track',t.id);return`<article class="media-card${state.current?' is-current':''}${state.playing?' playing':''}" data-track-id="${t.id}"><button class="cover" aria-label="Reproducir ${esc(t.title)}" ${coverStyle(c)} onclick="NBCPlayTrack('${t.id}')">${c?'':`<span class="initial">${esc(initials(trackArtists(t)[0]))}</span>`}</button>${favoriteButton(t,true)}<button class="card-meta" onclick="NBCPlayTrack('${t.id}')"><strong>${esc(t.title)}</strong><span>${esc(artistText(t))}</span><span>Single</span></button>${user?`<div class="card-actions"><button class="btn-sm btn-edit" onclick="NBCEditTrack('${t.id}')">Editar</button><button class="btn-sm btn-edit" onclick="NBCDeleteTrack('${t.id}')">Borrar</button></div>`:`<div class="card-actions"><button class="btn-sm btn-play" onclick="NBCPlayTrack('${t.id}')">${cardPlayContent(state.playing)}</button>${queueAddButton(t)}</div>`}</article>`}
function artistCard(name){const a=artistByName(name),photo=a.photo_key?mediaUrl(a.photo_key):'',list=tracks.filter(t=>trackArtists(t).includes(name)),collabs=list.filter(t=>trackArtists(t).length>1).length;return`<article class="media-card artist-card"><button class="cover" ${coverStyle(photo)} onclick="NBCOpenArtist('${artistToken(name)}')">${photo?'':`<span class="initial">${esc(initials(name))}</span>`}</button><button class="card-meta" onclick="NBCOpenArtist('${artistToken(name)}')"><strong>${esc(name)}</strong><span>${list.length} temas · ${collabs} collabs</span></button><div class="card-actions"><button class="btn-sm btn-play" onclick="NBCPlayArtist('${artistToken(name)}')">${ICONS.play} Reproducir</button><button class="btn-sm btn-edit" onclick="NBCOpenArtist('${artistToken(name)}')">Ver perfil</button></div></article>`}
function trackRow(t,{albumId=null}={}){const play=albumId?`NBCPlayAlbumTrack('${albumId}','${t.id}')`:`NBCPlayTrack('${t.id}')`,c=trackCover(t),playing=currentTrack?.id===t.id&&!audio.paused&&!audio.ended;return`<div class="track-row ${playing?'playing':''}" data-track-id="${t.id}"><button class="row-cover" aria-label="Reproducir ${esc(t.title)}" ${coverStyle(c)} onclick="${play}">${c?'':esc(initials(trackArtists(t)[0]))}</button><button class="row-main" onclick="${play}"><strong>${esc(t.title)}</strong><span>${esc(artistText(t))}${t.album_id?` · ${esc(albumById(t.album_id)?.title||'')}`:''}</span><div class="row-submeta">${fmt(t.duration_seconds)}</div></button><div class="row-actions">${favoriteButton(t)}${queueAddButton(t)}${user?`<button class="circle-btn edit-mobile" onclick="NBCEditTrack('${t.id}')" aria-label="Editar ${esc(t.title)}">${EDIT_ICON}</button><button class="circle-btn delete-track-btn" onclick="NBCDeleteTrack('${t.id}')" aria-label="Borrar ${esc(t.title)}">${TRASH_ICON}</button>`:''}</div></div>`}
function renderHome(){
 const newest=(a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||''));
 const singles=tracks.filter(t=>!t.album_id).sort(newest).slice(0,8),latestAlbums=[...albums].sort(newest).slice(0,8);
 $('homeSingles').innerHTML=singles.map(singleCard).join('')||'<div class="search-empty">Todavía no hay sencillos.</div>';
 $('homeAlbums').innerHTML=latestAlbums.map(albumCard).join('')||'<div class="search-empty">Todavía no hay álbumes.</div>';
 $('homeArtists').innerHTML=MEMBERS.map(name=>{const a=artistByName(name),p=a.photo_key?mediaUrl(a.photo_key):'';return`<button class="artist-pill-card" onclick="NBCOpenArtist('${artistToken(name)}')"><span class="artist-avatar" ${coverStyle(p)}>${p?'':esc(initials(name))}</span><strong>${esc(name)}</strong></button>`}).join('');
}
function renderSongs(){const list=[...tracks].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))),show=list.slice(0,visibleSongsLimit);$('songsCount').textContent=`${list.length} ${list.length===1?'tema':'temas'}`;$('songsList').innerHTML=show.map(trackRow).join('')||'<div class="search-empty">No hay canciones.</div>';$('songsLoadMoreWrap').innerHTML=visibleSongsLimit<list.length?'<button class="secondary" onclick="NBCMoreSongs()">Cargar más canciones</button>':''}
window.NBCMoreSongs=()=>{visibleSongsLimit+=SONGS_PAGE;renderSongs()};function renderAlbums(){$('albumsCount').textContent=`${albums.length} ${albums.length===1?'álbum':'álbumes'}`;$('albumsGrid').innerHTML=albums.map(albumCard).join('')||'<div class="search-empty">No hay álbumes.</div>'}function renderArtists(){$('artistsGrid').innerHTML=MEMBERS.map(artistCard).join('')}
window.NBCOpenAlbum=id=>{currentAlbumId=id;showView('albumDetail');pushRoute({view:'albumDetail',album:id})};window.NBCOpenArtist=e=>{currentArtist=decodeURIComponent(e);showView('artistDetail');pushRoute({view:'artistDetail',artist:currentArtist})};
function renderAlbumDetail(id){const a=albumById(id);if(!a)return $('albumDetail').innerHTML='<div class="search-empty">Álbum no encontrado.</div>';const c=albumCover(a);$('albumDetail').innerHTML=`<button class="page-back" onclick="NBCBack()">${ICONS.back}<span>Volver</span></button><div class="detail-hero"><div class="detail-art" ${coverStyle(c)}>${c?'':ALBUM_FALLBACK}</div><div class="detail-copy"><span class="kicker">Álbum</span><h2>${esc(a.title)}</h2><p>${esc(a.artists.join(' × '))}</p><div class="statline"><span class="stat">${a.tracks.length} pistas</span><span class="stat">${fmtLong(a.duration)}</span></div><div class="detail-actions"><button class="primary-action" data-play-album="${a.id}" onclick="NBCPlayAlbum('${a.id}')">${cardPlayContent(cardPlaybackState('album',a.id).playing)}</button>${user?`<button class="ghost-action" onclick="NBCEditAlbum('${a.id}')">${EDIT_ICON} Editar álbum</button>`:''}</div></div></div><section class="content-section"><div class="section-head"><h2>Canciones</h2></div><div class="track-list">${a.tracks.map(t=>trackRow(t,{albumId:a.id})).join('')}</div></section>`}
function renderArtistDetail(name){if(!MEMBERS.includes(name)){return $('artistDetail').innerHTML='<button class="page-back" onclick="NBCBack()">Volver</button><div class="search-empty">Artista no encontrado.</div>'}const a=artistByName(name),photo=a.photo_key?mediaUrl(a.photo_key):'',list=tracks.filter(t=>trackArtists(t).includes(name)).sort((x,y)=>String(y.created_at).localeCompare(String(x.created_at))),collabs=list.filter(t=>trackArtists(t).length>1),als=albums.filter(x=>x.artists.includes(name));$('artistDetail').innerHTML=`<button class="page-back" onclick="NBCBack()">${ICONS.back}<span>Volver</span></button><div class="detail-hero"><div class="detail-art round" ${coverStyle(photo)}>${photo?'':esc(initials(name))}</div><div class="detail-copy"><span class="kicker">Artista</span><h2>${esc(name)}</h2><p>${a.bio?esc(a.bio):'Miembro de New BenifaClika.'}</p><div class="statline"><span class="stat">${list.length} ${list.length===1?'tema':'temas'}</span><span class="stat">${collabs.length} ${collabs.length===1?'colaboración':'colaboraciones'}</span><span class="stat">${als.length} ${als.length===1?'álbum':'álbumes'}</span></div><div class="detail-actions"><button class="primary-action" onclick="NBCPlayArtist('${artistToken(name)}')">${ICONS.play} Reproducir artista</button>${user?`<button class="ghost-action" onclick="NBCEditArtist('${artistToken(name)}')">${EDIT_ICON} Editar perfil</button>`:''}</div></div></div>${als.length?`<section class="content-section"><div class="section-head"><h2>Álbumes</h2></div><div class="card-grid">${als.map(albumCard).join('')}</div></section>`:''}${collabs.length?`<section class="content-section"><div class="section-head"><h2>Colaboraciones</h2></div><div class="track-list">${collabs.map(trackRow).join('')}</div></section>`:''}<section class="content-section"><div class="section-head"><h2>Todas las canciones</h2></div><div class="track-list">${list.map(trackRow).join('')||'<div class="search-empty">Sin canciones.</div>'}</div></section>`}
function searchData(v){const n=norm(v);if(!n)return{tracks:[],albums:[],artists:[]};return{tracks:tracks.filter(t=>norm(`${t.title} ${artistText(t)} ${albumById(t.album_id)?.title||''}`).includes(n)),albums:albums.filter(a=>norm(`${a.title} ${a.artists.join(' ')}`).includes(n)),artists:MEMBERS.filter(name=>norm(name).includes(n)||tracks.some(t=>trackArtists(t).includes(name)&&norm(`${t.title} ${albumById(t.album_id)?.title||''}`).includes(n)))}}
function renderSuggestions(v){const box=$('searchSuggest');if(!v.trim()){box.classList.remove('show');box.innerHTML='';return}const r=searchData(v);const group=(h,items,fn)=>items.length?`<div class="suggest-group"><strong>${h}</strong>${items.slice(0,4).map(fn).join('')}</div>`:'';box.innerHTML=group('Artistas',r.artists,n=>{const p=artistByName(n).photo_key?mediaUrl(artistByName(n).photo_key):'';return`<button class="suggest-item" data-a="${artistToken(n)}"><span class="suggest-thumb round" ${coverStyle(p)}>${p?'':esc(initials(n))}</span><span><strong>${esc(n)}</strong><span>Artista</span></span></button>`})+group('Álbumes',r.albums,a=>`<button class="suggest-item" data-al="${a.id}"><span class="suggest-thumb" ${coverStyle(albumCover(a))}>${albumCover(a)?'':ALBUM_FALLBACK}</span><span><strong>${esc(a.title)}</strong><span>${esc(a.artists.join(' × '))}</span></span></button>`)+group('Canciones',r.tracks,t=>`<button class="suggest-item" data-t="${t.id}"><span class="suggest-thumb" ${coverStyle(trackCover(t))}>${trackCover(t)?'':esc(initials(trackArtists(t)[0]))}</span><span><strong>${esc(t.title)}</strong><span>${esc(artistText(t))}</span></span></button>`)+`<button class="suggest-more" id="showSearchAll">Ver todos los resultados</button>`;box.classList.add('show');$$('[data-a]',box).forEach(b=>b.onclick=()=>{box.classList.remove('show');NBCOpenArtist(b.dataset.a)});$$('[data-al]',box).forEach(b=>b.onclick=()=>{box.classList.remove('show');NBCOpenAlbum(b.dataset.al)});$$('[data-t]',box).forEach(b=>b.onclick=()=>{box.classList.remove('show');NBCPlayTrack(b.dataset.t)});$('showSearchAll').onclick=()=>openSearch(v)}
function openSearch(v){$('searchSuggest').classList.remove('show');$('globalSearch').value=v;showView('search');pushRoute({view:'search',query:v})}function renderSearch(v){const r=searchData(v),f=searchFilter;$('searchSummary').textContent=v?`Resultados para “${v}”`:'Escribe algo para buscar';let h='';if(f==='all'||f==='artists')h+=`<section class="search-group"><div class="search-group-head"><h3>Artistas</h3><span>${r.artists.length}</span></div><div class="card-grid">${r.artists.map(artistCard).join('')||'<div class="search-empty">Sin artistas.</div>'}</div></section>`;if(f==='all'||f==='albums')h+=`<section class="search-group"><div class="search-group-head"><h3>Álbumes</h3><span>${r.albums.length}</span></div><div class="card-grid">${r.albums.map(albumCard).join('')||'<div class="search-empty">Sin álbumes.</div>'}</div></section>`;if(f==='all'||f==='tracks')h+=`<section class="search-group"><div class="search-group-head"><h3>Canciones</h3><span>${r.tracks.length}</span></div><div class="track-list">${r.tracks.map(trackRow).join('')||'<div class="search-empty">Sin canciones.</div>'}</div></section>`;$('searchResults').innerHTML=h}
let searchTimer;$('globalSearch').oninput=e=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>renderSuggestions(e.target.value),100)};$('globalSearch').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();openSearch(e.target.value)}};document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))$('searchSuggest').classList.remove('show')});$$('#searchFilters .chip').forEach(b=>b.onclick=()=>{$$('#searchFilters .chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');searchFilter=b.dataset.filter;renderSearch($('globalSearch').value)});
function shuffleArray(a){const o=[...a];for(let i=o.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[o[i],o[j]]=[o[j],o[i]]}return o}
function sourceIds(source){if(source.type==='favorites')return favoriteTracks().map(t=>t.id);if(source.type==='album')return(albumById(source.id)?.tracks||[]).map(t=>t.id);if(source.type==='artist')return tracks.filter(t=>trackArtists(t).includes(source.id)).map(t=>t.id);return tracks.map(t=>t.id)}
function appendRadio(count=28){const seen=new Set(playback.queue),pool=tracks.map(t=>t.id).filter(id=>!seen.has(id));let candidates=playback.shuffle?queueTools.randomSequence(pool,playback.queue.at(-1)):pool;if(!candidates.length){playback.radioSeen.clear();const previous=playback.source.type==='favorites'?playback.queue.at(-1):currentTrack?.id;candidates=tracks.map(t=>t.id).filter(id=>id!==previous);if(playback.shuffle)candidates=queueTools.randomSequence(candidates,playback.queue.at(-1))}playback.queue.push(...candidates.slice(0,count))}
function buildQueue(source,startId=null){let ids=sourceIds(source);if(playback.shuffle)ids=shuffleArray(ids);if(startId&&ids.includes(startId)){const i=ids.indexOf(startId);ids=[startId,...ids.slice(0,i),...ids.slice(i+1)]}playback.queue=ids;playback.pos=0;playback.manualEnd=1;playback.manualEntries=[];playback.primaryLength=ids.length;playback.source=source;playback.history=[];if(playback.queue.length<10)appendRadio();}
function ensureQueue(){if(playback.queue.length-playback.pos<8)appendRadio();prepareNextTrack();renderQueue()}
function contextText(){if(playback.pos>=playback.primaryLength)return'RADIO DE LA CLIKA';if(playback.source.type==='favorites')return'FAVORITOS';if(playback.source.type==='album')return`ÁLBUM · ${String(playback.source.name||'').toUpperCase()}`;if(playback.source.type==='artist')return`ARTISTA · ${String(playback.source.name||'').toUpperCase()}`;return'RADIO DE LA CLIKA'}
function needsPlaybackResume(){return audio.paused||audio.ended||!!audio.error||transport.recoveryNeeded||transport.blocked}
function setPlayState(){if(document.hidden){return}const loading=!!currentTrack&&(isStarting||isBuffering),playing=!!currentTrack&&!audio.paused&&!audio.ended&&!audio.error&&!transport.recoveryNeeded&&!loading;['playBtn','nowPlayBtn'].forEach(id=>{const b=$(id);b?.classList.toggle('loading',loading);const i=b?.querySelector('.play-icon');if(i)i.innerHTML=playing?ICONS.pause:ICONS.play;b?.setAttribute('aria-label',playing?'Pausar':'Reproducir');b?.setAttribute('title',playing?'Pausar':'Reproducir')});$('player').classList.toggle('playing',playing);$$('[data-track-id]').forEach(r=>r.classList.toggle('playing',playing&&r.dataset.trackId===currentTrack?.id));syncPlaybackCards();renderQueue()}
function renderModes(){[['shuffleBtn',playback.shuffle],['nowShuffleBtn',playback.shuffle],['repeatBtn',playback.repeat],['nowRepeatBtn',playback.repeat]].forEach(([id,on])=>{const b=$(id);if(!b)return;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));const s=b.querySelector('small');if(s)s.textContent=on?'ON':'OFF'});audio.loop=playback.repeat}
function paintProgress(el,pct){if(!el)return;const value=Math.max(0,Math.min(100,Number(pct)||0));el.value=value;el.style.setProperty('--played',value+'%')}
let progressPreview=null;
function seekDuration(){
 const duration=Number(audio.duration);
 return Number.isFinite(duration)&&duration>0?duration:0;
}
function renderProgress(position,duration){
 if(document.hidden)return;
 const percent=duration?(position/duration)*100:0;
 ['progress','nowProgress'].forEach(id=>paintProgress($(id),percent));
 const elapsed=position>=1?fmt(position):'0:00',total=duration?fmt(duration):'0:00';
 $('currentTime').textContent=$('nowCurrentTime').textContent=elapsed;
 $('duration').textContent=$('nowDuration').textContent=total;
}
function updateProgress(){
 const duration=seekDuration(),position=Math.max(0,Math.min(Number(audio.currentTime)||0,duration));
 const preview=progressPreview?.sequence===playSeq?progressPreview:null;
 renderProgress(preview?duration*preview.fraction:position,duration);
 try{
  if('mediaSession' in navigator){
   if(duration)navigator.mediaSession.setPositionState({duration,playbackRate:audio.playbackRate||1,position});
   else navigator.mediaSession.setPositionState();
  }
 }catch{}
}
function updateNowUI(){if(!document.hidden)syncNowFavorite();if(document.hidden){document.title=currentTrack?`${currentTrack.title} · New BenifaClika`:'New BenifaClika';syncMediaSession();return}const t=currentTrack,c=t?trackCover(t):'';const title=t?.title||'Selecciona una canción',artist=t?artistText(t):'New BenifaClika',ctx=contextText();[['playerCover',c,t],['nowLargeCover',c,t]].forEach(([id,url,tr])=>{const e=$(id);e.style.backgroundImage=url?`url("${url}")`:'';e.textContent=url?'':tr?initials(trackArtists(tr)[0]):'NBC'});$('playerTitle').textContent=title;$('nowLargeTitle').textContent=title;$('playerArtist').textContent=artist;$('nowLargeArtist').textContent=artist;$('playerContext').textContent=ctx;$('nowLargeContext').textContent=ctx;document.title=t?`${t.title} · New BenifaClika`:'New BenifaClika';syncMediaSession();setPlayState()}
async function playTrack(id,{record=true,queueIndex=null}={}){
 const t=trackById(id);if(!t)return;
 if(queueIndex===null&&currentTrack?.id===id&&audio.getAttribute('src')){if(!needsPlaybackResume())transport.pause();else await startCurrent();return}
 if(queueIndex===null)failedTracks.delete(id);
 const seq=++playSeq;currentTrack=t;playback.pos=queueIndex??Math.max(0,playback.queue.indexOf(id));
 if(record&&playback.history.at(-1)!==id)playback.history.push(id);
 // Android can snapshot metadata as soon as play() acquires audio focus.
 // Publish the next song and clear the previous timeline before starting its source.
 syncMediaSession();try{navigator.mediaSession?.setPositionState()}catch{}
 const attempt=transport.select(mediaUrl(t.audio_key));updateNowUI();ensureQueue();
 if(await attempt&&seq===playSeq){try{localStorage.setItem('nbc_current_track',id)}catch{}}
}

window.NBCPlayTrack=id=>{const t=trackById(id);if(!t)return;if(currentTrack?.id===id&&audio.getAttribute('src'))return playTrack(id);if(!playback.queue.includes(id)||playback.source.type!=='radio')buildQueue({type:'radio',id:null,name:'Radio de la clika'},id);playTrack(id)};window.NBCPlayAlbum=id=>{const a=albumById(id);if(!a?.tracks.length)return;if(currentTrack?.album_id===id&&playback.source.type==='album'&&playback.source.id===id&&audio.getAttribute('src'))return playTrack(currentTrack.id);buildQueue({type:'album',id,name:a.title});playTrack(playback.queue[0])};window.NBCPlayArtist=e=>{const name=decodeURIComponent(e),list=tracks.filter(t=>trackArtists(t).includes(name));if(!list.length)return toast('Este artista todavía no tiene canciones.');buildQueue({type:'artist',id:name,name});playTrack(playback.queue[0])};
window.NBCPlayAlbumTrack=(albumId,id)=>{
 const a=albumById(albumId);if(!a?.tracks.some(t=>t.id===id))return;
 if(currentTrack?.id===id&&playback.source.type==='album'&&playback.source.id===albumId)return playTrack(id);
 buildQueue({type:'album',id:albumId,name:a.title});
 playTrack(id,{queueIndex:playback.queue.indexOf(id)});
};
async function startCurrent(){
 if(!currentTrack){if(playback.queue.length){playback.pos=0;return playTrack(playback.queue[0],{queueIndex:0})}if(tracks[0]){buildQueue({type:'radio',id:null,name:'Radio de la clika'},tracks[0].id);return playTrack(tracks[0].id)}return}
 failedTracks.delete(currentTrack.id);const attempt=transport.resume();updateNowUI();prepareNextTrack();return attempt;
}
function nextTrack(manual=true){
 if(playback.repeat&&manual)audio.loop=false;
 let next=queueTools.nextIndex(playback,currentTrack?.id,failedTracks);
 if(!playback.queue[next]){appendRadio();next=queueTools.nextIndex(playback,currentTrack?.id,failedTracks)}
 const id=playback.queue[next];if(id)playTrack(id,{queueIndex:next});else{transport.pause();setPlayState()}
 if(playback.repeat&&manual)audio.loop=true;
}

function previousTrack(){if(audio.currentTime>4){audio.currentTime=0;updateProgress();return}if(playback.pos>0){playback.pos--;playTrack(playback.queue[playback.pos],{queueIndex:playback.pos})}}
function toggleShuffle(){playback.shuffle=!playback.shuffle;localStorage.setItem('nbc_shuffle',playback.shuffle?'1':'0');if(playback.shuffle){queueTools.shuffle(playback);renderQueue();prepareNextTrack()}renderModes();toast(playback.shuffle?'Aleatorio activado':'Aleatorio desactivado')}
function toggleRepeat(){playback.repeat=!playback.repeat;localStorage.setItem('nbc_repeat',playback.repeat?'1':'0');renderModes();prepareNextTrack();toast(playback.repeat?'Bucle activado':'Bucle desactivado')}
function animateTransport(button){button.classList.remove('play-feedback');void button.offsetWidth;button.classList.add('play-feedback')}
['playBtn','nowPlayBtn'].forEach(id=>$(id).addEventListener('animationend',event=>{if(event.target===$(id))$(id).classList.remove('play-feedback')}));
$('playBtn').onclick=$('nowPlayBtn').onclick=event=>{animateTransport(event.currentTarget);if(needsPlaybackResume())startCurrent();else transport.pause()};$('prevBtn').onclick=$('nowPrevBtn').onclick=previousTrack;$('nextBtn').onclick=$('nowNextBtn').onclick=()=>nextTrack(true);$('shuffleBtn').onclick=$('nowShuffleBtn').onclick=toggleShuffle;$('repeatBtn').onclick=$('nowRepeatBtn').onclick=toggleRepeat;
const savedVol=Math.max(0,Math.min(1,Number(localStorage.getItem('nbc_volume')??1)));audio.volume=savedVol;$('volume').value=savedVol;audio.muted=localStorage.getItem('nbc_muted')==='1';$('muteBtn').innerHTML=audio.muted?ICONS.mute:ICONS.volume;$('muteBtn').setAttribute('aria-label',audio.muted?'Activar sonido':'Silenciar');$('volume').oninput=e=>{audio.volume=Number(e.target.value);localStorage.setItem('nbc_volume',String(audio.volume))};$('muteBtn').onclick=()=>{audio.muted=!audio.muted;localStorage.setItem('nbc_muted',audio.muted?'1':'0');$('muteBtn').innerHTML=audio.muted?ICONS.mute:ICONS.volume;$('muteBtn').setAttribute('aria-label',audio.muted?'Activar sonido':'Silenciar')};
for(const id of ['progress','nowProgress']){
 const slider=$(id);
 slider.addEventListener('input',()=>{
  if(progressPreview?.slider!==slider)progressPreview={slider,sequence:playSeq,fraction:0};
  if(progressPreview.sequence!==playSeq)return;
  const duration=seekDuration();
  progressPreview.fraction=Number(slider.value)/100;
  renderProgress(duration*progressPreview.fraction,duration);
 });
 slider.addEventListener('change',()=>{
  if(progressPreview?.slider!==slider)return;
  const {sequence,fraction}=progressPreview;
  progressPreview=null;
  const duration=seekDuration();
  if(sequence===playSeq&&duration)audio.currentTime=fraction*duration;
  updateProgress();
 });
 const cancelPreview=()=>{
  if(progressPreview?.slider!==slider)return;
  progressPreview=null;
  updateProgress();
 };
 slider.addEventListener('pointercancel',cancelPreview);
 slider.addEventListener('blur',cancelPreview);
}
function prepareNextTrack(){
 const next=trackById(playback.queue[queueTools.nextIndex(playback,currentTrack?.id,failedTracks)]);
 transport.prefetch(!playback.repeat&&next?mediaUrl(next.audio_key):'',{saveData:!!navigator.connection?.saveData});
}
function reportPlaybackProblem(message){if(document.hidden)pendingPlaybackMessage=message;else toast(message)}
const transport=new NBCBackgroundAudio({
 audio,
 onState(state){
  wantsPlayback=state.wanted;isStarting=state.starting;isBuffering=state.buffering;
  refreshNativeSession();
  if(state.wanted&&!state.starting&&!state.buffering)prepareNextTrack()
  setPlayState();
 },
 onEnded(){if(!playback.repeat)nextTrack(false)},
 onMetadata:refreshNativeSession,
 onUnavailable(){
  if(currentTrack)failedTracks.add(currentTrack.id);
  if(failedTracks.size>=tracks.length){transport.pause();reportPlaybackProblem('No se pudo reproducir ningún audio. Revisa la conexión o los archivos.')}
  else nextTrack(false);
 },
 onProblem:reportPlaybackProblem
});
// Refresh at native lifecycle boundaries as Android may recreate its notification
// after ended/load, independently of the play() promise and page visibility.
function refreshNativeSession(){
 syncMediaSession();updateProgress();
 try{navigator.mediaSession.playbackState=wantsPlayback&&!transport.blocked&&!transport.recoveryNeeded?'playing':'paused'}catch{}
}
audio.addEventListener('playing',refreshNativeSession);
audio.addEventListener('durationchange',refreshNativeSession);
audio.addEventListener('seeked',updateProgress);audio.addEventListener('ratechange',updateProgress);
audio.addEventListener('timeupdate',updateProgress);audio.addEventListener('emptied',updateProgress);
window.addEventListener('online',()=>transport.recover());

if('mediaSession'in navigator){const action=(n,f)=>{try{navigator.mediaSession.setActionHandler(n,f)}catch{}};action('play',startCurrent);action('pause',()=>transport.pause());action('previoustrack',previousTrack);action('nexttrack',()=>nextTrack(true));action('seekbackward',d=>audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||10)));action('seekforward',d=>audio.currentTime=Math.min(audio.duration||0,audio.currentTime+(d.seekOffset||10)));action('seekto',d=>{if(Number.isFinite(d.seekTime))audio.currentTime=d.seekTime})}
renderModes();function restoreTrackOnce(){if(window.__restored)return;window.__restored=true;const id=localStorage.getItem('nbc_current_track');if(id&&trackById(id)){currentTrack=trackById(id);buildQueue({type:'radio',id:null,name:'Radio de la clika'},id);audio.src=mediaUrl(currentTrack.audio_key);audio.load();updateNowUI()}}
const sheetCloseTimers=new Map();let sheetEnterTimer=0;
function resetSheet(id){const backdrop=$(id),sheet=q('.now-sheet',backdrop);clearTimeout(sheetEnterTimer);clearTimeout(sheetCloseTimers.get(id));sheetCloseTimers.delete(id);backdrop.classList.remove('show','closing','opening');sheet?.classList.remove('dragging');sheet?.style.removeProperty('--sheet-drag');document.body.classList.remove('has-now-sheet')}
function openSheet(id,showQueue=false){resetSheet(id);setQueueView(showQueue);$(id).classList.add('show','opening');sheetEnterTimer=setTimeout(()=>$(id).classList.remove('opening'),280);document.body.classList.add('has-now-sheet');history.pushState({nbc:true,overlay:id},'',location.href);q('[data-sheet-close]',$(id))?.focus()}
function closeSheetDirect(id){const backdrop=$(id);if(!backdrop?.classList.contains('show')||backdrop.classList.contains('closing'))return;const sheet=q('.now-sheet',backdrop);sheet?.classList.remove('dragging');backdrop.classList.add('closing');const opener=queueVisible?'nowQueueBtn':'openNowPlayingBtn';const finish=()=>{resetSheet(id);setQueueView(false);$(opener).focus()};if(matchMedia('(prefers-reduced-motion: reduce)').matches)return finish();sheetCloseTimers.set(id,setTimeout(finish,260))}
function closeSheet(id){if(!$(id)?.classList.contains('show')||$(id).classList.contains('closing'))return;closeSheetDirect(id);if(history.state?.overlay===id)history.back()}
$('openNowPlayingBtn').onclick=()=>openSheet('nowPlayingSheet');$$('[data-sheet-close]').forEach(b=>b.onclick=()=>closeSheet(b.dataset.sheetClose));
const nowSheet=q('.now-sheet',$('nowPlayingSheet'));let sheetDrag=null,sheetFrame=0;
function paintSheetDrag(){sheetFrame=0;if(sheetDrag)nowSheet.style.setProperty('--sheet-drag',`${sheetDrag.distance}px`)}
function beginSheetDrag(point,target,kind){
  if($('nowPlayingSheet').classList.contains('closing')||target.closest('button,input,a,select,textarea,.now-controls,.now-timeline')||(nowSheet.scrollTop>2&&!target.closest('.now-sheet-header')))return;
  sheetDrag={id:point.id,kind,x:point.x,y:point.y,lastY:point.y,lastTime:point.time,distance:0,velocity:0,active:false};
}
function moveSheetDrag(point){
  const drag=sheetDrag;if(!drag||point.id!==drag.id)return false;const dy=point.y-drag.y,dx=point.x-drag.x;
  if(!drag.active){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return false;if(dy<=0||Math.abs(dx)>dy){sheetDrag=null;return false}drag.active=true;clearTimeout(sheetEnterTimer);$('nowPlayingSheet').classList.remove('opening');if(drag.kind==='pointer')nowSheet.setPointerCapture(drag.id);nowSheet.classList.add('dragging')}
  drag.distance=Math.max(0,dy);const dt=point.time-drag.lastTime;if(dt>0)drag.velocity=(point.y-drag.lastY)/dt;drag.lastY=point.y;drag.lastTime=point.time;if(!sheetFrame)sheetFrame=requestAnimationFrame(paintSheetDrag);return true;
}
function finishSheetDrag(point,cancelled=false){
  if(!sheetDrag||point.id!==sheetDrag.id)return;const drag=sheetDrag;sheetDrag=null;cancelAnimationFrame(sheetFrame);sheetFrame=0;nowSheet.classList.remove('dragging');if(drag.kind==='pointer'&&nowSheet.hasPointerCapture(drag.id))nowSheet.releasePointerCapture(drag.id);
  const threshold=Math.max(72,Math.min(nowSheet.clientHeight*.18,140)),velocity=point.time-drag.lastTime>100?0:drag.velocity;
  if(!cancelled&&(drag.distance>=threshold||(drag.distance>35&&velocity>.65))){nowSheet.style.setProperty('--sheet-drag',`${drag.distance}px`);closeSheet('nowPlayingSheet')}else nowSheet.style.removeProperty('--sheet-drag');
}
const pointerPoint=event=>({id:event.pointerId,x:event.clientX,y:event.clientY,time:event.timeStamp});
nowSheet.addEventListener('pointerdown',event=>{if(event.pointerType!=='touch'&&event.isPrimary&&event.button===0)beginSheetDrag(pointerPoint(event),event.target,'pointer')});
nowSheet.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')moveSheetDrag(pointerPoint(event))});
nowSheet.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')finishSheetDrag(pointerPoint(event))});
nowSheet.addEventListener('pointercancel',event=>{if(event.pointerType!=='touch')finishSheetDrag(pointerPoint(event),true)});
nowSheet.addEventListener('lostpointercapture',event=>{if(event.pointerType!=='touch')finishSheetDrag(pointerPoint(event),true)});
const touchPoint=(touch,event)=>({id:touch.identifier,x:touch.clientX,y:touch.clientY,time:event.timeStamp});
nowSheet.addEventListener('touchstart',event=>{
  if(event.touches.length!==1){if(sheetDrag)finishSheetDrag({id:sheetDrag.id,time:event.timeStamp},true);return}
  beginSheetDrag(touchPoint(event.touches[0],event),event.target,'touch');
},{passive:true});
nowSheet.addEventListener('touchmove',event=>{
  if(!sheetDrag||sheetDrag.kind!=='touch')return;
  if(event.touches.length!==1||!event.cancelable){finishSheetDrag({id:sheetDrag.id,time:event.timeStamp},true);return}
  const touch=[...event.touches].find(item=>item.identifier===sheetDrag.id);if(touch&&moveSheetDrag(touchPoint(touch,event)))event.preventDefault();
},{passive:false});
function endSheetTouch(event,cancelled){if(!sheetDrag||sheetDrag.kind!=='touch')return;const touch=[...event.changedTouches].find(item=>item.identifier===sheetDrag.id);if(touch)finishSheetDrag(touchPoint(touch,event),cancelled)}
nowSheet.addEventListener('touchend',event=>endSheetTouch(event,false));nowSheet.addEventListener('touchcancel',event=>endSheetTouch(event,true));
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!q('.modal-backdrop.show')&&$('nowPlayingSheet').classList.contains('show')){event.preventDefault();closeSheet('nowPlayingSheet')}});


function renderQueue(){
 if(document.hidden){return}
 const next=Math.max(0,playback.pos+1),upcoming=playback.queue.slice(next),count=upcoming.length;
 $('nowQueueBtn').setAttribute('aria-label',`Ver cola: ${count} canciones`);
 $('nowQueueBtn').setAttribute('aria-expanded',String(queueVisible));
 if(!queueVisible)return;
 $('queueSummary').textContent=`${count} ${count===1?'canción':'canciones'} a continuación`;
 const t=currentTrack,c=t?trackCover(t):'';
 $('queueCurrent').innerHTML=t?`<span class="queue-thumb" ${coverStyle(c)}>${c?'':esc(initials(trackArtists(t)[0]))}</span><div><small>Ahora suena</small><strong>${esc(t.title)}</strong><span>${esc(artistText(t))}</span></div>`:'<p>Añade canciones y pulsa Play para empezar.</p>';
 $('queueList').innerHTML=upcoming.slice(0,queueLimit).map((id,offset)=>{
  const track=trackById(id);if(!track)return'';const index=next+offset,cover=trackCover(track),added=queueTools.isManual(playback,index);
  return `<li class="queue-row"><button class="queue-song" onclick="NBCPlayQueue(${index})"><span class="queue-thumb" ${coverStyle(cover)}>${cover?'':esc(initials(trackArtists(track)[0]))}</span><span><strong>${esc(track.title)}</strong><small>${esc(artistText(track))}</small>${added?'<em>Añadida a la cola</em>':''}</span></button><button class="circle-btn" onclick="NBCRemoveQueue(${index})" aria-label="Quitar de la cola: ${esc(track.title)}">${ICONS.close}</button></li>`;
 }).join('')||'<li class="queue-empty">La cola está vacía.</li>';
 $('queueMore').hidden=count<=queueLimit;
}
function setQueueView(visible){
 queueVisible=visible;syncNowFavorite();queueLimit=50;$('nowPlaybackPanel').hidden=queueVisible;$('nowQueuePanel').hidden=!queueVisible;
 $('nowQueueBtn').classList.toggle('active',queueVisible);$('nowSheetTitle').textContent=visible?'Cola de reproducción':'Ahora suena';nowSheet.setAttribute('aria-label',$('nowSheetTitle').textContent);q('[data-sheet-close]',$('nowPlayingSheet'))?.setAttribute('aria-label',visible?'Cerrar cola':'Cerrar Ahora suena');nowSheet.scrollTop=0;renderQueue();
}
$('nowQueueBtn').innerHTML=QUEUE_ICON;$('nowQueueBtn').onclick=()=>openSheet('nowPlayingSheet',true);
$('queueMore').onclick=()=>{queueLimit+=50;renderQueue()};
window.NBCAddQueue=id=>{const t=trackById(id);if(!t)return;queueTools.add(playback,id,currentTrack?.id);renderQueue();prepareNextTrack();toast(`“${t.title}” añadida a la cola.`)};
window.NBCRemoveQueue=index=>{if(queueTools.remove(playback,index)){renderQueue();prepareNextTrack();toast('Canción quitada de la cola.')}};
window.NBCPlayQueue=index=>{if(index<=playback.pos||index>=playback.queue.length)return;failedTracks.delete(playback.queue[index]);playTrack(playback.queue[index],{queueIndex:index})};
function syncMediaSession(){
 if(!('mediaSession'in navigator)||typeof MediaMetadata==='undefined')return;
 const t=currentTrack,cover=t?trackCover(t):'',key=t?`${t.id}:${cover}`:'';
 if(key!==artworkKey){artworkKey=key;artworkData=null;const seq=++artworkSeq;if(cover)prepareSessionArtwork(cover,seq)}
 const data=queueTools.metadata(t,t?albumById(t.album_id):null,cover,location.origin);
 if(data&&artworkData)data.artwork=[{src:artworkData,sizes:'512x512',type:'image/png'},...data.artwork];
 try{navigator.mediaSession.metadata=data?new MediaMetadata(data):null}catch{}
}
async function prepareSessionArtwork(cover,seq){
 try{const image=new Image();image.src=new URL(cover,location.origin).href;await image.decode();if(seq!==artworkSeq)return;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.fillStyle='#15171b';ctx.fillRect(0,0,512,512);const size=Math.min(image.naturalWidth,image.naturalHeight),x=(image.naturalWidth-size)/2,y=(image.naturalHeight-size)/2;
  ctx.drawImage(image,x,y,size,size,0,0,512,512);const png=canvas.toDataURL('image/png');if(seq!==artworkSeq)return;artworkData=png;syncMediaSession();
 }catch{/* Keep the original accessible artwork if decoding is unavailable. */}
}
document.addEventListener('visibilitychange',()=>{
 syncMediaSession();
 if(!document.hidden){transport.recover();if(wantsPlayback&&audio.ended&&!isStarting&&!playback.repeat)nextTrack(false);updateNowUI();renderQueue();updateProgress();if(pendingPlaybackMessage){toast(pendingPlaybackMessage);pendingPlaybackMessage=''}}
 else prepareNextTrack();
});

const modalFocus=new Map();
function openModal(id){const modal=$(id);modalFocus.set(id,document.activeElement);modal.classList.add('show');const dialog=q('.modal',modal);if(dialog){dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',q('h3',dialog)?.textContent||'Editar');}setTimeout(()=>q('input:not([type=hidden]):not([type=file]),select,button',modal)?.focus(),0)}
function closeModal(id,force=false){const modal=$(id);if(!force&&modal.dataset.busy==='true'){toast('Espera a que termine el guardado.');return}if(id==='listenerModal')clearListenerSecrets();if(id==='albumUploadModal'&&albumDraft&&!uploadBusy)persistAlbumDraft();modal.classList.remove('show');modalFocus.get(id)?.focus?.()}
function lockForm(id){
  const form=$(id),modal=form.closest('.modal-backdrop'),controls=$$('input,textarea,select,button',modal),wasDisabled=controls.map(control=>control.disabled);
  uploadBusy=true;modal.dataset.busy='true';form.setAttribute('aria-busy','true');controls.forEach(control=>control.disabled=true);
  return ()=>{controls.forEach((control,i)=>control.disabled=wasDisabled[i]);uploadBusy=false;delete modal.dataset.busy;form.removeAttribute('aria-busy')};
}
async function refreshAfterSave(){try{await loadAll()}catch{toast('Guardado. No se pudo refrescar la biblioteca; recarga la página.')}loadStorageStatus()}
$$('.status').forEach(status=>{status.setAttribute('role','status');status.setAttribute('aria-live','polite')});
$('toast').setAttribute('role','status');
document.addEventListener('keydown',event=>{
  if($('imageCropDialog').open)return;
  const modal=$$('.modal-backdrop.show').at(-1);if(!modal)return;
  if(event.key==='Escape'){event.preventDefault();closeModal(modal.id);return}
  if(event.key==='Tab'){
    const items=$$('button,input,textarea,select,[tabindex="0"]',modal).filter(item=>!item.disabled&&item.type!=='hidden'&&item.getClientRects().length);
    if(!items.length)return;const first=items[0],last=items.at(-1);
    if(event.shiftKey&&(document.activeElement===first||!modal.contains(document.activeElement))){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&(document.activeElement===last||!modal.contains(document.activeElement))){event.preventDefault();first.focus()}
  }
});$$('[data-modal-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.modalClose));
function pickerHtml(selected=[]){return MEMBERS.map(n=>`<label class="artist-option"><input type="checkbox" value="${esc(n)}" ${selected.includes(n)?'checked':''}><span>${esc(n)}</span></label>`).join('')}function selectedArtists(root){return $$('input:checked',root).map(i=>i.value)}function setPicker(root,selected){root.innerHTML=pickerHtml(selected)}
function setEditorUI(){const logged=user;[$('editBtn'),$('sideEditBtn'),$('mobileEditBtn')].forEach(b=>b?.classList.toggle('active',logged));const label=$('editBtnLabel');if(label)label.textContent=logged?'Editar página':'Editar';renderCurrent()}
async function editorEntry(){if(user){openModal('editMenuModal');loadStorageStatus();return}openModal('loginModal')}$('editBtn').onclick=$('sideEditBtn').onclick=$('mobileEditBtn').onclick=editorEntry;
$('loginForm').onsubmit=async e=>{e.preventDefault();$('loginStatus').innerHTML='<span class="spinner"></span>Entrando…';try{await api('/api/auth/login',{method:'POST',body:JSON.stringify({password:$('loginPassword').value})});user=true;$('loginPassword').value='';$('loginStatus').textContent='';closeModal('loginModal');setEditorUI();openModal('editMenuModal');loadStorageStatus()}catch(err){$('loginStatus').textContent=err.message}};
$('logoutAction').onclick=async()=>{await api('/api/auth/logout',{method:'POST'}).catch(()=>{});user=false;closeModal('editMenuModal');setEditorUI();toast('Modo edición cerrado.')};
async function loadStorageStatus(){try{const s=await api('/api/storage');$('storageText').textContent=`${formatBytes(s.bytes)} / ${formatBytes(s.limit_bytes)} (${s.percent.toFixed(1)}%)`;$('storageBar').style.width=`${Math.min(100,s.percent)}%`;$('storageBar').style.background=s.percent>90?'#ff8b8b':s.percent>75?'#f6cf65':'var(--active)'}catch{$('storageText').textContent='No disponible'}}$('recountStorageBtn').onclick=async()=>{try{$('storageText').textContent='Recalculando…';const s=await api('/api/storage/recount',{method:'POST'});toast(`R2 recalculado: ${formatBytes(s.bytes)}`);loadStorageStatus()}catch(e){toast(e.message)}};
// Encadre cuadrado en píxeles de origen, compartido por la vista previa y el archivo final.
function cropRect(width,height,zoom,x,y){
 const size=Math.min(width,height)/zoom;
 return {size,x:(width-size)*x,y:(height-size)*y};
}
const framedImages=new WeakMap();
function selectedImage(input){
 const original=input?.files[0],entry=framedImages.get(input);
 return entry&&entry.original===original?entry.file:original;
}
function bindImageCrop(input,circle=false,onSelect=()=>{}){
 input.onchange=()=>{
  const original=input.files[0];if(!original)return;
  const dialog=$('imageCropDialog'),frame=$('imageCropFrame'),canvas=$('imageCropPreview'),status=$('imageCropStatus');
  const zoom=$('imageCropZoom'),horizontal=$('imageCropX'),vertical=$('imageCropY'),apply=$('imageCropApply');
  const originalButton=$('imageCropOriginal'),cancel=$('imageCropCancel');
  const previous=framedImages.get(input);
  let bitmap=null,drag=null,result=null;
  const url=URL.createObjectURL(original),img=new Image();
  const rect=()=>cropRect(bitmap.naturalWidth,bitmap.naturalHeight,Number(zoom.value),Number(horizontal.value)/1000,Number(vertical.value)/1000);
  const controls=[zoom,horizontal,vertical];
  function draw(target){
   const ctx=target.getContext('2d'),r=rect();
   ctx.clearRect(0,0,target.width,target.height);
   ctx.drawImage(bitmap,r.x,r.y,r.size,r.size,0,0,target.width,target.height);
  }
  const redraw=()=>{if(bitmap)draw(canvas)};
  frame.classList.toggle('crop-circle',circle);zoom.value='1';horizontal.value=vertical.value='500';
  canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);
  status.textContent='Cargando imagen…';apply.disabled=true;originalButton.disabled=false;cancel.disabled=false;
  controls.forEach(control=>{control.disabled=true;control.oninput=redraw});
  canvas.onpointerdown=e=>{
   if(!bitmap||apply.disabled||e.button!==0)return;
   const r=rect(),bounds=canvas.getBoundingClientRect();
   drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:Number(horizontal.value),top:Number(vertical.value),step:r.size/bounds.width};
   canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove=e=>{
   if(!drag||e.pointerId!==drag.id)return;
   const r=rect(),clamp=value=>Math.max(0,Math.min(1000,value));
   const roomX=bitmap.naturalWidth-r.size,roomY=bitmap.naturalHeight-r.size;
   if(roomX>0)horizontal.value=String(clamp(drag.left-(e.clientX-drag.x)*drag.step*1000/roomX));
   if(roomY>0)vertical.value=String(clamp(drag.top-(e.clientY-drag.y)*drag.step*1000/roomY));
   redraw();
  };
  canvas.onpointerup=canvas.onpointercancel=canvas.onlostpointercapture=()=>{drag=null};
  cancel.onclick=()=>dialog.close();
  originalButton.onclick=()=>{result=original;dialog.close()};
  apply.onclick=async()=>{
   if(!bitmap||apply.disabled)return;
   apply.disabled=true;originalButton.disabled=true;cancel.disabled=true;status.textContent='Preparando imagen…';
   try{
    const output=document.createElement('canvas'),size=Math.min(1200,Math.max(1,Math.round(rect().size)));
    output.width=output.height=size;draw(output);
    const blob=await new Promise(resolve=>output.toBlob(resolve,'image/webp',.94));
    if(!blob)throw new Error();
    if(!dialog.open||dialog.onclose!==closeCrop)return;
    result=new File([blob],fileBase(original)+(blob.type==='image/webp'?'.webp':'.png'),{type:blob.type});dialog.close();
   }catch{if(dialog.open){status.textContent='No se pudo recortar la imagen. Puedes reintentar o usar la original.';apply.disabled=originalButton.disabled=cancel.disabled=false}}
  };
  function closeCrop(){
   URL.revokeObjectURL(url);
   if(input.files[0]!==original)return;
   if(!result){
    input.value='';
    if(previous){const restored=new DataTransfer();restored.items.add(previous.original);input.files=restored.files;framedImages.set(input,{original:input.files[0],file:previous.file})}
    return;
   }
   framedImages.set(input,{original,file:result});onSelect(result);
  }
  dialog.onclose=closeCrop;
  dialog.showModal();
  img.onload=()=>{
   if(!dialog.open||dialog.onclose!==closeCrop||input.files[0]!==original)return;
   bitmap=img;redraw();status.textContent='';apply.disabled=false;controls.forEach(control=>control.disabled=false);
  };
  img.onerror=()=>{if(dialog.open&&dialog.onclose===closeCrop)status.textContent='No se puede previsualizar este formato. Puedes usar el original o elegir otra imagen.'};
  img.src=url;
 };
}

async function optimizeImage(file,max=1400,quality=.86){if(!file||!file.type.startsWith('image/'))return file;if(file.size<420000)return file;const bitmap=await createImageBitmap(file);const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const blob=await new Promise(r=>canvas.toBlob(r,'image/webp',quality));return new File([blob],file.name.replace(/\.[^.]+$/,'.webp'),{type:'image/webp'})}
function audioDuration(file){return new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),a=new Audio();a.preload='metadata';a.onloadedmetadata=()=>{const d=Math.round(a.duration)||null;URL.revokeObjectURL(u);resolve(d)};a.onerror=()=>{URL.revokeObjectURL(u);reject(new Error(`No se pudo leer ${file.name}`))};a.src=u})}
async function uploadFile(file,kind,onProgress,uploadId=null){
  if(!file)throw new Error('Vuelve a seleccionar el archivo pendiente.');
  const f=kind==='audio'?file:await optimizeImage(file);
  const url=`/api/upload?kind=${encodeURIComponent(kind)}&name=${encodeURIComponent(f.name)}${uploadId?'&upload_id='+encodeURIComponent(uploadId):''}`;
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',url);xhr.withCredentials=true;xhr.timeout=180000;
    xhr.setRequestHeader('Content-Type',f.type||'application/octet-stream');xhr.setRequestHeader('X-File-Size',String(f.size));
    xhr.upload.onprogress=event=>{if(event.lengthComputable)onProgress?.(event.loaded/event.total)};
    xhr.onload=()=>{let data={};try{data=JSON.parse(xhr.responseText)}catch{}if(xhr.status>=200&&xhr.status<300){onProgress?.(1);resolve(data)}else reject(new Error(data.error||`No se pudo subir ${f.name} (error ${xhr.status}).`))};
    xhr.onerror=()=>reject(new Error('Se ha interrumpido la conexión.'));
    xhr.ontimeout=()=>reject(new Error('La subida ha tardado demasiado.'));
    xhr.onabort=()=>reject(new Error('Subida interrumpida.'));xhr.send(f);
  });
}
async function rollbackKeys(keys){for(const key of [...keys].reverse()){try{await api(`/api/files?key=${encodeURIComponent(key)}`,{method:'DELETE'})}catch{}}}
bindImageCrop($('trackCover'));
$('addTrackAction').onclick=()=>{closeModal('editMenuModal');openTrackEditor()};function openTrackEditor(id=null){const t=id?trackById(id):null;$('trackModalTitle').textContent=t?'Editar tema':'Añadir tema';$('trackId').value=t?.id||'';$('trackTitle').value=t?.title||'';$('trackAudio').value='';framedImages.delete($('trackCover'));$('trackCover').value='';$('trackCoverLabel').style.display=t?.album_id?'none':'';setPicker($('trackArtists'),t?trackArtists(t):MEMBERS.slice(0,1));$('trackStatus').textContent='';openModal('trackModal')}window.NBCEditTrack=id=>openTrackEditor(id);
$('trackForm').onsubmit=async e=>{e.preventDefault();if(uploadBusy)return;const id=$('trackId').value||null,t=id?trackById(id):null,title=$('trackTitle').value.trim(),artistsSel=selectedArtists($('trackArtists')),audioFile=$('trackAudio').files[0],coverFile=selectedImage($('trackCover'));if(!title||!artistsSel.length)return $('trackStatus').textContent='Falta título o artistas.';if(!id&&!audioFile)return $('trackStatus').textContent='Selecciona un audio.';const unlock=lockForm('trackForm');$('trackStatus').innerHTML='<span class="spinner"></span>Guardando…';const uploaded=[];try{let audio_key=t?.audio_key,cover_key=t?.cover_key,duration=t?.duration_seconds||null;if(audioFile){duration=await audioDuration(audioFile);const up=await uploadFile(audioFile,'audio');audio_key=up.key;uploaded.push(up.key)}if(coverFile){const up=await uploadFile(coverFile,'cover');cover_key=up.key;uploaded.push(up.key)}const payload={title,artists:artistsSel,audio_key,cover_key,duration_seconds:duration};if(id)await api(`/api/tracks/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify(payload)});else await api('/api/tracks',{method:'POST',body:JSON.stringify(payload)});closeModal('trackModal',true);await refreshAfterSave();toast(id?'Tema actualizado.':'Tema añadido.')}catch(err){await rollbackKeys(uploaded);$('trackStatus').textContent=err.message}finally{unlock()}};
window.NBCDeleteTrack=async id=>{const t=trackById(id);if(!t||!confirm(`¿Borrar “${t.title}”?`))return;try{await api(`/api/tracks/${encodeURIComponent(id)}`,{method:'DELETE'});if(currentTrack?.id===id){transport.pause();currentTrack=null;audio.removeAttribute('src');audio.load()}await loadAll();loadStorageStatus();toast('Tema borrado.')}catch(e){toast(e.message)}};
function fileBase(f){return f.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim()}
let albumDraft=null,draftTimer,draftWrites=Promise.resolve();
const fileInfo=file=>file?{name:file.name,size:file.size,lastModified:file.lastModified,type:file.type}:null;
function draftRow(){return {id:crypto.randomUUID(),title:'',artists:MEMBERS.slice(0,1),file:null,fileInfo:null,uploadId:crypto.randomUUID(),key:null,duration:null}}
function newAlbumDraft(){return {version:1,id:crypto.randomUUID(),title:'',cover:{file:null,fileInfo:null,uploadId:crypto.randomUUID(),key:null},rows:Array.from({length:4},draftRow),cleanupKeys:[],commitAttempted:false}}
function rememberOldKey(item){if(item.key)(albumDraft.cleanupKeys||=[]).push(item.key)}
function readAlbumFields(){
  if(!albumDraft)return;
  albumDraft.title=$('albumTitle').value;
  $$('.album-track',$('albumRows')).forEach((element,i)=>{
    const row=albumDraft.rows[i];if(!row)return;
    row.title=q('.album-row-title',element).value;
    row.artists=selectedArtists(q('.album-row-artists',element));
  });
}
function persistAlbumDraft(){
  clearTimeout(draftTimer);
  if(!albumDraft)return Promise.resolve();
  readAlbumFields();
  const snapshot=structuredClone(albumDraft);
  draftWrites=draftWrites.catch(()=>{}).then(async()=>{
    const result=await NBCAlbumDraft.save(snapshot);
    if(albumDraft?.id!==snapshot.id)return;
    $('albumDraftNotice').textContent=result.filesStored?'Borrador guardado en este navegador. Puedes cerrar y continuar después.':result.persistent?'Datos y avances guardados. Si cierras, tendrás que volver a seleccionar los archivos pendientes.':'Este navegador no permite guardar el borrador. Mantén esta pestaña abierta para conservarlo.';
  });
  return draftWrites;
}
function scheduleAlbumDraft(){clearTimeout(draftTimer);draftTimer=setTimeout(persistAlbumDraft,450)}
function draftAudioText(row){return row.key?'✓ Audio subido':row.file?'Listo: '+row.file.name:row.fileInfo?'Vuelve a seleccionar '+row.fileInfo.name:'Selecciona un audio'}
function renderAlbumDraft(){
  $('albumTrackCount').value=albumDraft.rows.length;
  $('albumFilesSummary').textContent=`${albumDraft.rows.filter(row=>row.key||row.file).length}/${albumDraft.rows.length} audios preparados`;
  $('albumCover').required=false;
  $('albumCoverSummary').textContent=albumDraft.cover.key?'✓ Portada subida':albumDraft.cover.file?'Portada preparada: '+albumDraft.cover.file.name:albumDraft.cover.fileInfo?'Vuelve a seleccionar '+albumDraft.cover.fileInfo.name:'Selecciona una portada';
  $('albumRows').innerHTML=albumDraft.rows.map((row,i)=>`<div class="album-track" data-index="${i}"><div class="album-track-head"><strong>Pista ${i+1}</strong><span>${row.key?'Subida':row.fileInfo?esc(row.fileInfo.name):`${i+1}/${albumDraft.rows.length}`}</span></div><label>Título<input class="album-row-title" maxlength="120" value="${esc(row.title)}" required></label><fieldset><legend>Artistas / colaboradores</legend><div class="artist-picker album-row-artists">${pickerHtml(row.artists)}</div></fieldset><label>Audio<input class="album-row-audio" type="file" accept="audio/*,.mp3,.mpeg,.m4a,.wav,.ogg"><small class="selected-audio">${esc(draftAudioText(row))}</small></label></div>`).join('');
  $$('.album-row-audio',$('albumRows')).forEach((input,i)=>input.onchange=()=>{
    const file=input.files[0];if(!file)return;readAlbumFields();const row=albumDraft.rows[i];
    rememberOldKey(row);Object.assign(row,{file,fileInfo:fileInfo(file),uploadId:crypto.randomUUID(),key:null,duration:null});
    if(!row.title)row.title=fileBase(file);renderAlbumDraft();persistAlbumDraft();
  });
  $('saveAlbumBtn').textContent=albumDraft.rows.some(row=>row.key)||albumDraft.cover.key?'Continuar subida':'Subir álbum';
}
function buildAlbumRows(n){
  if(uploadBusy||!albumDraft)return;
  readAlbumFields();n=Math.max(1,Math.min(50,Number(n)||1));
  if(n<albumDraft.rows.length){albumDraft.rows.slice(n).forEach(rememberOldKey);albumDraft.rows=albumDraft.rows.slice(0,n)}
  while(albumDraft.rows.length<n)albumDraft.rows.push(draftRow());
  renderAlbumDraft();persistAlbumDraft();
}
function setAlbumFiles(files){
  if(uploadBusy||!albumDraft)return;readAlbumFields();
  const list=[...files].filter(file=>file.type.startsWith('audio/')||/\.(mp3|m4a|wav|ogg|mpeg)$/i.test(file.name));
  if(list.length>50)return toast('Puedes seleccionar hasta 50 audios por álbum.');
  if(!list.length)return toast('Selecciona archivos de audio.');
  const used=new Set();
  for(const file of list){
    let index=albumDraft.rows.findIndex((row,i)=>!used.has(i)&&row.fileInfo?.name===file.name&&row.fileInfo?.size===file.size&&row.fileInfo?.lastModified===file.lastModified);
    if(index<0)index=albumDraft.rows.findIndex((row,i)=>!used.has(i)&&!row.key&&!row.file);
    if(index<0){if(albumDraft.rows.length>=50)break;index=albumDraft.rows.length;albumDraft.rows.push(draftRow())}
    used.add(index);const row=albumDraft.rows[index];
    const same=row.fileInfo?.name===file.name&&row.fileInfo?.size===file.size&&row.fileInfo?.lastModified===file.lastModified;
    if(!same){rememberOldKey(row);row.uploadId=crypto.randomUUID();row.key=null;row.duration=null}
    row.file=file;row.fileInfo=fileInfo(file);if(!row.title)row.title=fileBase(file);
  }
  // Remove only untouched placeholders at the end, never edited tracks.
  while(albumDraft.rows.length>list.length){const row=albumDraft.rows.at(-1);if(row.title||row.file||row.key||row.fileInfo)break;albumDraft.rows.pop()}
  renderAlbumDraft();persistAlbumDraft();
}
async function openAlbumUpload(){
  if(uploadBusy)return;await draftWrites.catch(()=>{});
  if(!albumDraft){const stored=await NBCAlbumDraft.read();albumDraft=stored&&!stored.cleared?stored:newAlbumDraft()}
  $('albumTitle').value=albumDraft.title;framedImages.delete($('albumCover'));$('albumCover').value='';$('albumMultiAudio').value='';
  $('albumUploadStatus').textContent='';$('albumUploadProgress').classList.remove('show');
  renderAlbumDraft();openModal('albumUploadModal');persistAlbumDraft();
}
$('addAlbumAction').onclick=()=>{closeModal('editMenuModal');openAlbumUpload()};
$('buildAlbumRows').onclick=()=>buildAlbumRows($('albumTrackCount').value);
$('albumTrackCount').onchange=()=>buildAlbumRows($('albumTrackCount').value);
$('albumMultiAudio').onchange=e=>setAlbumFiles(e.target.files);
bindImageCrop($('albumCover'),false,file=>{if(!albumDraft)return;readAlbumFields();rememberOldKey(albumDraft.cover);albumDraft.cover={file,fileInfo:fileInfo(file),uploadId:crypto.randomUUID(),key:null};renderAlbumDraft();persistAlbumDraft()});
$('albumUploadForm').addEventListener('input',scheduleAlbumDraft);
$('albumUploadForm').addEventListener('change',scheduleAlbumDraft);
const dz=$('albumDropzone');
['dragover','dragenter'].forEach(event=>dz.addEventListener(event,e=>{e.preventDefault();if(!uploadBusy)dz.classList.add('dragging')}));
['dragleave','drop'].forEach(event=>dz.addEventListener(event,e=>{e.preventDefault();dz.classList.remove('dragging')}));
dz.addEventListener('drop',e=>setAlbumFiles(e.dataTransfer.files));
dz.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!uploadBusy){e.preventDefault();$('albumMultiAudio').click()}});
function uploadProgress(text,pct){$('albumUploadProgress').classList.add('show');$('albumProgressText').textContent=text;$('albumProgressPct').textContent=`${Math.round(pct)}%`;$('albumProgressBar').style.width=`${pct}%`}
async function clearAlbumDraft(){
  clearTimeout(draftTimer);await draftWrites.catch(()=>{});await NBCAlbumDraft.clear();albumDraft=null;
}
$('discardAlbumDraftBtn').onclick=async()=>{
  if(uploadBusy||!albumDraft||!confirm('¿Descartar este borrador y los archivos de su subida pendiente?'))return;
  readAlbumFields();const keys=[albumDraft.cover.key,...albumDraft.rows.map(row=>row.key),...(albumDraft.cleanupKeys||[])].filter(Boolean);
  const unlock=lockForm('albumUploadForm');
  try{
    // A response might have been lost after publishing; never discard a published album.
    const data=await api('/api/bootstrap');
    if(data.albums.some(album=>album.id===albumDraft.id)){await clearAlbumDraft();closeModal('albumUploadModal',true);await refreshAfterSave();return toast('El álbum ya estaba guardado en la biblioteca.')}
    for(const key of [...new Set(keys)])await api(`/api/files?key=${encodeURIComponent(key)}`,{method:'DELETE'});
    await clearAlbumDraft();closeModal('albumUploadModal',true);loadStorageStatus();toast('Borrador descartado.');
  }catch(error){$('albumUploadStatus').textContent='No se pudo descartar: '+error.message+' El borrador se conserva.'}finally{unlock()}
};
async function submitAlbum(){
  const prepared=albumDraft;
  try{
    if(prepared.commitAttempted){
      const data=await api('/api/bootstrap');
      if(data.albums.some(album=>album.id===prepared.id)){
        await clearAlbumDraft();closeModal('albumUploadModal',true);await refreshAfterSave();
        toast('El álbum ya estaba guardado. No se ha duplicado.');return;
      }
    }
    if(!navigator.onLine)throw new Error('No hay conexión. Puedes continuar cuando vuelva.');
    $('albumUploadStatus').textContent='';
    await persistAlbumDraft();
    if(!prepared.cover.key){
      uploadProgress('Subiendo portada…',2);
      const up=await uploadFile(prepared.cover.file,'cover',fraction=>uploadProgress('Subiendo portada…',fraction*8),prepared.cover.uploadId);
      prepared.cover.key=up.key;prepared.cover.file=null;await persistAlbumDraft();
    }
    for(let i=0;i<prepared.rows.length;i++){
      const row=prepared.rows[i];if(row.key)continue;
      uploadProgress(`Leyendo pista ${i+1}/${prepared.rows.length}…`,8+i/prepared.rows.length*82);
      row.duration=await audioDuration(row.file);
      const up=await uploadFile(row.file,'audio',fraction=>uploadProgress(`Subiendo ${i+1}/${prepared.rows.length}: ${row.title}`,8+(i+fraction)/prepared.rows.length*82),row.uploadId);
      row.key=up.key;row.file=null;await persistAlbumDraft();q('.selected-audio',$$('.album-track',$('albumRows'))[i]).textContent='✓ Audio subido';
    }
    prepared.commitAttempted=true;await persistAlbumDraft();uploadProgress('Guardando álbum…',94);
    await api('/api/albums',{method:'POST',body:JSON.stringify({
      upload_id:prepared.id,title:prepared.title.trim(),cover_key:prepared.cover.key,
      tracks:prepared.rows.map(row=>({title:row.title.trim(),artists:row.artists,audio_key:row.key,duration_seconds:row.duration}))
    })});
    uploadProgress('Álbum listo.',100);
    const leftovers=prepared.cleanupKeys||[],title=prepared.title;
    await clearAlbumDraft();closeModal('albumUploadModal',true);await refreshAfterSave();await rollbackKeys(leftovers);loadStorageStatus();toast(`Álbum “${title}” añadido.`);
  }catch(error){
    await persistAlbumDraft();
    $('albumUploadStatus').textContent=error.message+' Se conserva lo preparado y lo subido. Pulsa Continuar subida para reintentar.';
    $('saveAlbumBtn').textContent='Continuar subida';
  }
}
$('albumUploadForm').onsubmit=async e=>{
  e.preventDefault();if(uploadBusy||!albumDraft)return;readAlbumFields();
  if(!albumDraft.title.trim()||(!albumDraft.cover.key&&!albumDraft.cover.file))return $('albumUploadStatus').textContent='El álbum necesita nombre y portada.';
  for(let i=0;i<albumDraft.rows.length;i++){const row=albumDraft.rows[i];if(!row.title.trim()||!row.artists.length||(!row.key&&!row.file))return $('albumUploadStatus').textContent=`Revisa la pista ${i+1}: título, artistas y audio.`}
  const unlock=lockForm('albumUploadForm');
  try{
    if(navigator.locks)await navigator.locks.request('nbc-album-upload',{ifAvailable:true},async lock=>{if(!lock)throw new Error('Hay otra pestaña subiendo un álbum. Espera a que termine.');await submitAlbum()});
    else await submitAlbum();
  }catch(error){$('albumUploadStatus').textContent=error.message}
  finally{unlock()}
};
function populateAlbumSelect(preselect=null){$('albumEditSelect').innerHTML=albums.map(a=>`<option value="${a.id}" ${a.id===preselect?'selected':''}>${esc(a.title)}</option>`).join('');renderAlbumEdit($('albumEditSelect').value)}
function renderAlbumEdit(id){const a=albumById(id);albumEditFiles=[];albumRemoveIds=new Set();if(!a){$('albumEditFields').innerHTML='<div class="search-empty">No hay álbumes.</div>';return}$('albumEditFields').innerHTML=`<input id="albumEditingId" type="hidden" value="${a.id}"><label>Nombre<input id="albumEditTitle" value="${esc(a.title)}" required></label><label>Nueva portada<input id="albumEditCover" type="file" accept="image/*"></label><div class="section-head"><div><h2 style="font-size:14px">Canciones</h2><p>Edita, reordena o marca canciones para borrar.</p></div></div><div class="album-builder">${a.tracks.map((t,i)=>`<div class="album-track" data-edit-track="${t.id}"><div class="album-track-head"><strong>Pista ${i+1}</strong><div class="album-track-tools"><span>${fmt(t.duration_seconds)}</span><button type="button" class="album-remove-track" onclick="NBCMarkRemove('${t.id}')">Eliminar</button></div></div><div class="two-col"><label>Número<input class="album-edit-number" type="number" min="1" max="999" value="${t.track_number||i+1}"></label><label>Título<input class="album-edit-title" value="${esc(t.title)}" required></label></div><fieldset><legend>Artistas</legend><div class="artist-picker album-edit-artists">${pickerHtml(trackArtists(t))}</div></fieldset></div>`).join('')}</div><div class="content-section"><div class="section-head"><div><h2 style="font-size:14px">Añadir canciones</h2><p>Selecciona varios audios y aparecerán aquí.</p></div></div><label>Audios nuevos<input id="albumEditAddAudio" type="file" accept="audio/*,.mp3,.mpeg,.m4a,.wav,.ogg" multiple></label><div id="albumEditNewRows" class="album-builder"></div></div>`;bindImageCrop($('albumEditCover'));const input=$('albumEditAddAudio');input.onchange=e=>{albumEditFiles=[...e.target.files];$('albumEditNewRows').innerHTML=albumEditFiles.map((f,i)=>`<div class="album-track" data-new-track="${i}"><div class="album-track-head"><strong>Nueva canción ${i+1}</strong><span>${esc(f.name)}</span></div><label>Título<input class="album-new-title" value="${esc(fileBase(f))}" required></label><fieldset><legend>Artistas</legend><div class="artist-picker album-new-artists">${pickerHtml(MEMBERS.slice(0,1))}</div></fieldset></div>`).join('')}}
window.NBCMarkRemove=id=>{const row=q(`[data-edit-track="${CSS.escape(id)}"]`,$('albumEditFields'));if(!row)return;if(albumRemoveIds.has(id))albumRemoveIds.delete(id);else albumRemoveIds.add(id);row.classList.toggle('marked-delete',albumRemoveIds.has(id));q('.album-remove-track',row).textContent=albumRemoveIds.has(id)?'Mantener':'Eliminar'};
function openAlbumManager(id=null){if(!albums.length)return toast('Todavía no hay álbumes.');populateAlbumSelect(id||albums[0].id);$('albumEditStatus').textContent='';openModal('albumEditModal')}$('albumManagerAction').onclick=()=>{closeModal('editMenuModal');openAlbumManager()};$('albumEditSelect').onchange=e=>renderAlbumEdit(e.target.value);window.NBCEditAlbum=id=>openAlbumManager(id);
$('albumEditForm').onsubmit=async e=>{e.preventDefault();if(uploadBusy)return;const id=$('albumEditingId')?.value,a=albumById(id);if(!a)return;const title=$('albumEditTitle').value.trim(),coverFile=selectedImage($('albumEditCover')),existingRows=$$('[data-edit-track]',$('albumEditFields')),newRows=$$('[data-new-track]',$('albumEditFields'));if(!title)return $('albumEditStatus').textContent='Pon un nombre al álbum.';if(existingRows.filter(r=>!albumRemoveIds.has(r.dataset.editTrack)).length+newRows.length<1)return $('albumEditStatus').textContent='Un álbum necesita al menos una canción.';$('albumEditStatus').innerHTML='<span class="spinner"></span>Guardando…';const unlock=lockForm('albumEditForm');const uploaded=[];try{let cover_key=a.cover_key;if(coverFile){const up=await uploadFile(coverFile,'cover');cover_key=up.key;uploaded.push(up.key)}const existing=[];for(const row of existingRows){if(albumRemoveIds.has(row.dataset.editTrack))continue;const titleValue=q('.album-edit-title',row).value.trim(),artistsSel=selectedArtists(q('.album-edit-artists',row)),track_number=Number(q('.album-edit-number',row).value)||1;if(!titleValue||!artistsSel.length)throw new Error('Revisa las canciones existentes.');existing.push({id:row.dataset.editTrack,title:titleValue,artists:artistsSel,track_number})}const add=[];for(let i=0;i<newRows.length;i++){const row=newRows[i],file=albumEditFiles[i],titleValue=q('.album-new-title',row).value.trim(),artistsSel=selectedArtists(q('.album-new-artists',row));if(!file||!titleValue||!artistsSel.length)throw new Error(`Revisa la nueva canción ${i+1}.`);$('albumEditStatus').innerHTML=`<span class="spinner"></span>Subiendo ${i+1}/${newRows.length}: ${esc(titleValue)}`;const duration=await audioDuration(file),up=await uploadFile(file,'audio');uploaded.push(up.key);add.push({title:titleValue,artists:artistsSel,audio_key:up.key,duration_seconds:duration})}await api(`/api/albums/${encodeURIComponent(id)}`,{method:'PUT',body:JSON.stringify({title,cover_key,existing,add,remove_ids:[...albumRemoveIds]})});closeModal('albumEditModal',true);await refreshAfterSave();toast('Álbum actualizado.');$('albumEditStatus').textContent=''}catch(err){await rollbackKeys(uploaded);$('albumEditStatus').textContent=err.message}finally{unlock()}};
$('deleteAlbumBtn').onclick=async()=>{const id=$('albumEditingId')?.value,a=albumById(id);if(!a||!confirm(`¿Borrar el álbum “${a.title}” y todas sus canciones?`))return;try{await api(`/api/albums/${encodeURIComponent(id)}`,{method:'DELETE'});closeModal('albumEditModal');await loadAll();loadStorageStatus();showView('albums');toast('Álbum borrado.')}catch(e){toast(e.message)}};

function fillArtists(){ $('profileArtist').innerHTML='<option value="">Crear artista…</option>'+MEMBERS.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('') }
let profilePreviewUrl='';
function refreshProfile(){
 if(profilePreviewUrl){URL.revokeObjectURL(profilePreviewUrl);profilePreviewUrl=''}
 const name=$('profileArtist').value;creatingArtist=!name;const a=artistByName(name),p=a.photo_key?mediaUrl(a.photo_key):'';
 $('profileModalTitle').textContent=creatingArtist?'Añadir artista':'Editar artista';$('profileName').value=name;$('profileBio').value=a.bio||'';
 $('profilePreview').style.backgroundImage=p?`url("${p}")`:'';$('profilePreview').textContent=p?'':initials(name);
 $('removeProfilePhotoBtn').hidden=creatingArtist||!a.photo_key;$('removeArtistBtn').disabled=creatingArtist||MEMBERS.length<2;
 $('profileSaveBtn').textContent=creatingArtist?'Crear artista':'Guardar artista';
}
function openProfile(name=null){fillArtists();$('profileArtist').value=name&&MEMBERS.includes(name)?name:MEMBERS[0]||'';framedImages.delete($('profilePhoto'));$('profilePhoto').value='';$('profileStatus').textContent='';refreshProfile();openModal('profileModal')}
$('profilesAction').onclick=()=>{closeModal('editMenuModal');openProfile()};
$('profileArtist').onchange=()=>{framedImages.delete($('profilePhoto'));$('profilePhoto').value='';$('profileStatus').textContent='';refreshProfile()};
$('addArtistBtn').onclick=()=>{$('profileArtist').value='';framedImages.delete($('profilePhoto'));$('profilePhoto').value='';$('profileStatus').textContent='';refreshProfile();$('profileName').focus()};
window.NBCEditArtist=e=>openProfile(decodeURIComponent(e));
bindImageCrop($('profilePhoto'),true,file=>{if(profilePreviewUrl)URL.revokeObjectURL(profilePreviewUrl);profilePreviewUrl=URL.createObjectURL(file);$('profilePreview').style.backgroundImage=`url("${profilePreviewUrl}")`;$('profilePreview').textContent=''});
function applyArtistMutation(oldName,nextName,profile=null){
 const rename=list=>[...new Set(list.map(name=>name===oldName?nextName:name).filter(Boolean))];
 if(oldName){
  artists=artists.flatMap(artist=>artist.name===oldName?(profile?[{...artist,...profile,name:nextName}]:[]):[artist]);
  tracks=tracks.map(track=>({...track,artists:rename(trackArtists(track))}));
  if(playback.source.type==='artist'&&playback.source.id===oldName){playback.source=nextName?{type:'artist',id:nextName,name:nextName}:{type:'radio',id:null,name:'Radio de la clika'}}
  if(albumDraft){readAlbumFields();albumDraft.rows.forEach(row=>row.artists=rename(row.artists));MEMBERS=artists.map(artist=>artist.name);renderAlbumDraft();persistAlbumDraft()}
  if(currentArtist===oldName){currentArtist=nextName;if(!profile){showView('artists');history.replaceState({nbc:true,route:{view:'artists'}},'',routeUrl({view:'artists'}))}else if(currentView==='artistDetail'){history.replaceState({nbc:true,route:{view:'artistDetail',artist:nextName}},'',routeUrl({view:'artistDetail',artist:nextName}))}}
 }else if(profile)artists.push({...profile,name:nextName});
 MEMBERS=artists.map(artist=>artist.name);if(currentTrack)currentTrack=trackById(currentTrack.id)||currentTrack;rebuildAlbums();renderAll();
}
$('profileForm').onsubmit=async e=>{
 e.preventDefault();if(uploadBusy)return;
 const oldName=$('profileArtist').value,name=$('profileName').value.trim(),bio=$('profileBio').value.trim(),file=selectedImage($('profilePhoto')),a=artistByName(oldName);
 if(!name||name.length>80)return $('profileStatus').textContent='Escribe un nombre de entre 1 y 80 caracteres.';
 if(MEMBERS.some(n=>n!==oldName&&n.normalize('NFKC').toLocaleLowerCase('es')===name.normalize('NFKC').toLocaleLowerCase('es')))return $('profileStatus').textContent='Ya existe un artista con ese nombre.';
 const unlock=lockForm('profileForm');$('profileStatus').innerHTML='<span class="spinner"></span>Guardando…';const uploaded=[];let committed=false;
 try{
  let photo_key=a.photo_key||null;if(file){const up=await uploadFile(file,'artist');photo_key=up.key;uploaded.push(up.key)}
  const result=await api(oldName?`/api/artists/${artistToken(oldName)}`:'/api/artists',{method:oldName?'PUT':'POST',body:JSON.stringify({name,bio,photo_key})});committed=true;
  applyArtistMutation(oldName,result.name,{bio,photo_key});closeModal('profileModal',true);await refreshAfterSave();
  toast(oldName?(oldName===result.name?'Artista actualizado.':'Nombre actualizado en sus canciones y colaboraciones.'):'Artista añadido.');
 }catch(err){if(!committed)await rollbackKeys(uploaded);$('profileStatus').textContent=err.message}finally{unlock()}
};
$('removeProfilePhotoBtn').onclick=async()=>{
 const name=$('profileArtist').value;if(!name)return;const unlock=lockForm('profileForm');
 try{await api(`/api/artists/${artistToken(name)}`,{method:'PUT',body:JSON.stringify({photo_key:null})});await loadAll();refreshProfile();loadStorageStatus();toast('Foto eliminada.')}catch(e){$('profileStatus').textContent=e.message}finally{unlock()}
};
$('removeArtistBtn').onclick=()=>{
 const name=$('profileArtist').value;if(!name)return;const count=tracks.filter(t=>trackArtists(t).includes(name)).length;
 $('artistRemoveName').value=name;$('artistRemoveText').textContent=count?`“${name}” aparece en ${count} ${count===1?'canción':'canciones'}. Elige quién recibirá sus canciones y colaboraciones.`:`Se quitará el perfil de “${name}”.`;
 $('artistReplacement').innerHTML='<option value="">Selecciona un artista</option>'+MEMBERS.filter(n=>n!==name).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
 $('artistReplacement').required=count>0;$('artistReplacementLabel').hidden=count===0;$('artistRemoveStatus').textContent='';closeModal('profileModal');openModal('artistRemoveModal');
};
$('artistRemoveForm').onsubmit=async e=>{
 e.preventDefault();if(uploadBusy)return;const name=$('artistRemoveName').value,replacement=$('artistReplacement').value;const unlock=lockForm('artistRemoveForm');
 try{await api(`/api/artists/${artistToken(name)}`,{method:'DELETE',body:JSON.stringify({replacement})});applyArtistMutation(name,replacement||null);closeModal('artistRemoveModal',true);await refreshAfterSave();toast('Artista quitado. Las canciones se conservan.')}
 catch(error){$('artistRemoveStatus').textContent=error.message}finally{unlock()}
};
window.addEventListener('beforeunload',e=>{if(uploadBusy){e.preventDefault();e.returnValue=''}});
function isStandalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}function isMobileInstallContext(){return matchMedia('(max-width:760px)').matches||/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)}function refreshInstall(){const b=$('installBtn');if(!b)return;if(isStandalone()){b.style.display='none';return}b.style.display=(deferredPrompt||isMobileInstallContext())?'inline-flex':'none'}function showInstallHelp(){const ios=/iPhone|iPad|iPod/i.test(navigator.userAgent),title=$('installHelpTitle'),text=$('installHelpText');if(ios){title.textContent='Instalar en iPhone / iPad';text.textContent='Abre esta página en Safari, pulsa Compartir y elige “Añadir a pantalla de inicio”.'}else{title.textContent='Instalar en el móvil';text.textContent='Abre el menú de tu navegador y elige “Instalar aplicación” o “Añadir a pantalla de inicio”.'}openModal('installModal')}window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;refreshInstall()});window.addEventListener('appinstalled',()=>{deferredPrompt=null;refreshInstall();toast('New BenifaClika instalada.')});window.addEventListener('pageshow',refreshInstall);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshInstall()});try{matchMedia('(display-mode: standalone)').addEventListener('change',refreshInstall)}catch{}$('installBtn').onclick=async()=>{if(!deferredPrompt){showInstallHelp();return}const p=deferredPrompt;deferredPrompt=null;await p.prompt();refreshInstall()};
$('copyrightYear').textContent=new Date().getFullYear();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});window.addEventListener('online',loadAll);document.addEventListener('keydown',e=>{if($('imageCropDialog').open||e.target.matches('input,textarea,select,button,a,summary'))return;if(e.code==='Space'){e.preventDefault();needsPlaybackResume()?startCurrent():transport.pause()}else if(e.key==='ArrowRight'&&audio.duration)audio.currentTime=Math.min(audio.duration,audio.currentTime+5);else if(e.key==='ArrowLeft')audio.currentTime=Math.max(0,audio.currentTime-5)});
function favoriteButton(track,card=false){
 const saved=favoriteIds.has(track.id), label=saved?'Quitar de favoritos':'Guardar en favoritos';
 return `<button type="button" class="${card?'card-favorite':'circle-btn'} favorite-btn" data-favorite-id="${esc(track.id)}" aria-pressed="${saved}" aria-label="${label}: ${esc(track.title)}" title="${label}"${savingFavorites.has(track.id)?' disabled':''}>${HEART_ICON}</button>`;
}
function favoriteTracks(){return [...favoriteIds].map(trackById).filter(track=>track?.audio_key)}
$('playFavoritesBtn').onclick=()=>{
 if(!listener||!favoriteTracks().length)return;
 buildQueue({type:'favorites',id:null,name:'Favoritos'});
 playTrack(playback.queue[0],{queueIndex:0});
};
function renderFavorites(){
 const count=$('favoritesCount'),list=$('favoritesList'),saved=listener?favoriteTracks():[];
 $('playFavoritesBtn').hidden=!saved.length;
 if(!listener){
  count.textContent='Tu lista personal';
  list.innerHTML='<div class="search-empty"><strong>Guarda las canciones que más te gustan.</strong><button type="button" class="primary" data-listener-account>Entrar o crear una cuenta</button></div>';
  return;
 }
 count.textContent=`${saved.length} ${saved.length===1?'canción guardada':'canciones guardadas'}`;
 list.innerHTML=saved.length?saved.map(t=>trackRow(t)).join(''):'<div class="search-empty">Pulsa el corazón de una canción para guardarla aquí.</div>';
}
function paintFavorite(button,id){
 const saved=favoriteIds.has(id),label=saved?'Quitar de favoritos':'Guardar en favoritos';
 const track=trackById(id);
 button.setAttribute('aria-pressed',String(saved));
 button.setAttribute('aria-label',track?`${label}: ${track.title}`:label);
 button.title=label;button.disabled=savingFavorites.has(id);
}
function syncNowFavorite(){
 const b=$('nowFavoriteBtn');b.hidden=queueVisible||!currentTrack;
 if(currentTrack){b.dataset.favoriteId=currentTrack.id;paintFavorite(b,currentTrack.id)}
}
function syncFavoriteButtons(){
 $$('[data-favorite-id]').forEach(b=>paintFavorite(b,b.dataset.favoriteId));syncNowFavorite();
}
function setListener(data){
 listenerVersion++;savingFavorites.clear();
 listener=data.username?{username:data.username}:null;
 favoriteIds=new Set(Array.isArray(data.favorites)?data.favorites:[]);
 $('listenerAccountBtn').classList.toggle('active',!!listener);
 $('listenerAccountBtn').setAttribute('aria-label',listener?`Mi cuenta: ${listener.username}`:'Mi cuenta');
 renderCurrent();syncFavoriteButtons();
}
async function loadListener(){
 const version=listenerVersion;
 try{const data=await api('/api/listener');if(version===listenerVersion)setListener(data)}catch{}
}
function clearListenerSecrets(){
 $('listenerKey').value='';$('listenerIssuedKey').value='';$('listenerDeleteKey').value='';pendingFavorite=null;
}
function setListenerMode(mode){
 listenerMode=mode;const register=mode==='register';
 $('listenerSignInTab').classList.toggle('active',!register);$('listenerRegisterTab').classList.toggle('active',register);
 $('listenerSignInTab').setAttribute('aria-pressed',String(!register));$('listenerRegisterTab').setAttribute('aria-pressed',String(register));
 $('listenerKeyLabel').hidden=register;$('listenerKey').required=!register;
 $('listenerRegisterHint').hidden=!register;$('listenerSubmit').textContent=register?'Crear cuenta':'Entrar';$('listenerStatus').textContent='';
}
function openListenerAccount(trackId=null){
 clearListenerSecrets();pendingFavorite=trackId;
 $('listenerGuest').hidden=!!listener;$('listenerMember').hidden=!listener;$('listenerNewKey').hidden=true;
 $('listenerDisplayName').textContent=listener?.username||'';
 setListenerMode('login');openModal('listenerModal');
}
function setListenerBusy(value){
 listenerBusy=value;$('listenerModal').dataset.busy=String(value);
 ['listenerSignInTab','listenerRegisterTab','listenerSubmit','listenerLogout'].forEach(id=>{$(id).disabled=value});
 q('button',$('listenerDeleteForm')).disabled=value;
}
async function toggleFavorite(id){
 if(!trackById(id)||savingFavorites.has(id))return;
 if(!listener){openListenerAccount(id);return}
 const version=listenerVersion,next=!favoriteIds.has(id),request={};
 savingFavorites.set(id,request);syncFavoriteButtons();
 try{
  const data=await api('/api/listener/favorites/'+encodeURIComponent(id),{method:next?'PUT':'DELETE'});
  if(version!==listenerVersion)return;
  if(data.favorite)favoriteIds=new Set([id,...favoriteIds]);else favoriteIds.delete(id);
  if(currentView==='favorites')renderCurrent();
 }catch(error){if(version===listenerVersion){if(error.status===401)setListener({username:null,favorites:[]});toast(error.message)}}
 finally{if(savingFavorites.get(id)===request){savingFavorites.delete(id);syncFavoriteButtons()}}
}
$('listenerAccountBtn').onclick=()=>openListenerAccount();
$('listenerSignInTab').onclick=()=>setListenerMode('login');
$('listenerRegisterTab').onclick=()=>setListenerMode('register');
$('listenerForm').onsubmit=async e=>{
 e.preventDefault();if(listenerBusy)return;
 const register=listenerMode==='register',toSave=pendingFavorite;
 const body={username:$('listenerUsername').value};
 if(!register)body.accessKey=$('listenerKey').value;
 setListenerBusy(true);
 $('listenerStatus').textContent=register?'Creando cuenta…':'Entrando…';
 try{
  const data=await api('/api/listener/'+(register?'register':'login'),{method:'POST',body:JSON.stringify(body)});
  setListener(data);clearListenerSecrets();$('listenerStatus').textContent='';
  if(register){
   $('listenerGuest').hidden=true;$('listenerNewKey').hidden=false;
   $('listenerIssuedKey').value=data.accessKey;$('listenerIssuedKey').focus();
  }else{closeModal('listenerModal',true);toast('Sesión iniciada.')}
  if(toSave&&!favoriteIds.has(toSave))void toggleFavorite(toSave);
 }catch(error){$('listenerStatus').textContent=error.message}
 finally{setListenerBusy(false)}
};
$('listenerCopyKey').onclick=async()=>{
 const key=$('listenerIssuedKey');
 try{await navigator.clipboard.writeText(key.value);$('listenerStatus').textContent='Clave copiada.'}
 catch{key.select();$('listenerStatus').textContent='Copia la clave seleccionada.'}
};
$('listenerOpenFavorites').onclick=()=>{closeModal('listenerModal');navigate('favorites')};
async function endListenerSession(remove=false){
 if(listenerBusy)return;
 setListenerBusy(true);$('listenerStatus').textContent=remove?'Eliminando cuenta…':'Cerrando sesión…';
 try{
  await api(remove?'/api/listener':'/api/listener/logout',remove
   ? {method:'DELETE',body:JSON.stringify({accessKey:$('listenerDeleteKey').value})}
   : {method:'POST'});
  setListener({username:null,favorites:[]});closeModal('listenerModal',true);
  toast(remove?'Cuenta y favoritos eliminados.':'Sesión cerrada.');
 }catch(error){$('listenerStatus').textContent=error.message}
 finally{setListenerBusy(false)}
}
$('listenerLogout').onclick=()=>endListenerSession();
$('listenerDeleteForm').onsubmit=e=>{e.preventDefault();endListenerSession(true)};
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-favorite-id]');
 if(b){toggleFavorite(b.dataset.favoriteId);return}
 if(e.target.closest('[data-listener-account]'))openListenerAccount();
});

(async()=>{await Promise.all([loadAll(),authStatus(),loadListener()]);const route=routeFromUrl();history.replaceState({nbc:true,route},'',location.href);applyRoute(route,false);refreshInstall()})();
})();
