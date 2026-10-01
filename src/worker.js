const SESSION_COOKIE = 'nbc_session';
const DEFAULT_SESSION_DAYS = 30;
const DEFAULT_STORAGE_SOFT_LIMIT = 9 * 1024 * 1024 * 1024; // 9 GiB guardrail
const MAX_UPLOAD_BYTES = 95 * 1024 * 1024; // below Free plan 100 MB request body cap
const ARTISTS = ['Neggoneko', 'erizo eskizo', 'xAMMO', 'TGT', 'Perrancos'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith('/media/')) return handleMedia(request, env, url);
      if (url.pathname.startsWith('/api/')) return handleApi(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(error);
      return json({ error: 'Error interno del servidor.' }, 500);
    }
  },
};

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method.toUpperCase();

  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true, service: 'new-benifaclika-cloudflare', database: 'D1', media: 'R2' });
  }
  if (path === '/api/auth/status' && method === 'GET') {
    return json({ authenticated: await isAuthenticated(request, env) });
  }
  if (path === '/api/auth/login' && method === 'POST') return login(request, env);
  if (path === '/api/auth/logout' && method === 'POST') return logout();
  if (path === '/api/bootstrap' && method === 'GET') return bootstrap(env);

  const authenticated = await isAuthenticated(request, env);
  if (!authenticated) return json({ error: 'Inicia sesión para editar.' }, 401);

  if (path === '/api/storage' && method === 'GET') return storageStatus(env);
  if (path === '/api/storage/recount' && method === 'POST') return recountStorage(env);
  if (path === '/api/upload' && method === 'POST') return uploadFile(request, env, url);
  if (path === '/api/files' && method === 'DELETE') return deleteFileEndpoint(env, url);

  if (path === '/api/tracks' && method === 'POST') return createTrack(request, env);
  const trackMatch = path.match(/^\/api\/tracks\/([^/]+)$/);
  if (trackMatch && method === 'PUT') return updateTrack(request, env, decodeURIComponent(trackMatch[1]));
  if (trackMatch && method === 'DELETE') return deleteTrack(env, decodeURIComponent(trackMatch[1]));

  if (path === '/api/albums' && method === 'POST') return createAlbum(request, env);
  const albumMatch = path.match(/^\/api\/albums\/([^/]+)$/);
  if (albumMatch && method === 'PUT') return updateAlbum(request, env, decodeURIComponent(albumMatch[1]));
  if (albumMatch && method === 'DELETE') return deleteAlbum(env, decodeURIComponent(albumMatch[1]));

  const artistMatch = path.match(/^\/api\/artists\/(.+)$/);
  if (artistMatch && method === 'PUT') return updateArtist(request, env, decodeURIComponent(artistMatch[1]));

  return json({ error: 'Ruta no encontrada.' }, 404);
}

async function login(request, env) {
  if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
    return json({ error: 'Faltan ADMIN_PASSWORD o SESSION_SECRET en Cloudflare.' }, 503);
  }
  const body = await readJson(request);
  const supplied = String(body.password || '');
  if (!supplied || !(await safeEqual(supplied, env.ADMIN_PASSWORD))) {
    await sleep(180);
    return json({ error: 'Contraseña incorrecta.' }, 401);
  }
  const days = Math.max(1, Math.min(90, Number(env.SESSION_DAYS || DEFAULT_SESSION_DAYS)));
  const exp = Math.floor(Date.now() / 1000) + days * 86400;
  const payload = b64url(JSON.stringify({ exp, nonce: crypto.randomUUID() }));
  const signature = await sign(payload, env.SESSION_SECRET);
  const token = `${payload}.${signature}`;
  const response = json({ ok: true, expires_at: exp });
  response.headers.append('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${days * 86400}; HttpOnly; Secure; SameSite=Strict`);
  return response;
}

function logout() {
  const response = json({ ok: true });
  response.headers.append('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
  return response;
}

async function isAuthenticated(request, env) {
  if (!env.SESSION_SECRET) return false;
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies[SESSION_COOKIE];
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = await sign(payload, env.SESSION_SECRET);
  if (!(await safeEqual(signature, expected))) return false;
  try {
    const data = JSON.parse(fromB64url(payload));
    return Number(data.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

async function bootstrap(env) {
  const [trackResult, albumResult, artistResult] = await Promise.all([
    env.DB.prepare(`
      SELECT t.id, t.title, t.album_id, t.track_number, t.duration_seconds,
             t.audio_key, t.cover_key, t.created_at, t.updated_at,
             ta.artist_name, ta.position
      FROM tracks t
      LEFT JOIN track_artists ta ON ta.track_id = t.id
      ORDER BY t.created_at DESC, ta.position ASC
    `).all(),
    env.DB.prepare(`SELECT id, title, cover_key, created_at, updated_at FROM albums ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT name, photo_key, bio, sort_order FROM artists ORDER BY sort_order, name`).all(),
  ]);

  const map = new Map();
  for (const row of trackResult.results || []) {
    if (!map.has(row.id)) {
      map.set(row.id, {
        id: row.id,
        title: row.title,
        album_id: row.album_id,
        track_number: row.track_number,
        duration_seconds: row.duration_seconds,
        audio_key: row.audio_key,
        cover_key: row.cover_key,
        created_at: row.created_at,
        updated_at: row.updated_at,
        artists: [],
      });
    }
    if (row.artist_name) map.get(row.id).artists.push(row.artist_name);
  }

  return json({
    tracks: [...map.values()],
    albums: albumResult.results || [],
    artists: artistResult.results || [],
  }, 200, { 'Cache-Control': 'no-store' });
}

async function storageStatus(env) {
  const current = await getStorageBytes(env);
  const limit = getStorageLimit(env);
  return json({
    bytes: current,
    limit_bytes: limit,
    percent: limit ? Math.min(100, (current / limit) * 100) : 0,
    free_tier_reference_bytes: 10 * 1024 * 1024 * 1024,
  });
}

async function recountStorage(env) {
  let cursor;
  let total = 0;
  let objects = 0;
  do {
    const page = await env.MEDIA.list({ limit: 1000, cursor });
    for (const object of page.objects) {
      total += object.size;
      objects += 1;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await setStorageBytes(env, total);
  return json({ ok: true, bytes: total, objects, limit_bytes: getStorageLimit(env) });
}

async function uploadFile(request, env, url) {
  const kind = url.searchParams.get('kind');
  if (!['audio', 'cover', 'artist'].includes(kind)) return json({ error: 'Tipo de archivo no válido.' }, 400);

  const fileSize = Number(request.headers.get('X-File-Size') || request.headers.get('Content-Length') || 0);
  if (!Number.isFinite(fileSize) || fileSize <= 0) return json({ error: 'No se pudo determinar el tamaño del archivo.' }, 400);
  if (fileSize > MAX_UPLOAD_BYTES) return json({ error: 'El archivo supera el máximo de 95 MB.' }, 413);

  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';
  if (kind === 'audio' && !contentType.startsWith('audio/')) return json({ error: 'El archivo no parece ser audio.' }, 415);
  if (kind !== 'audio' && !contentType.startsWith('image/')) return json({ error: 'El archivo no parece ser una imagen.' }, 415);

  const used = await getStorageBytes(env);
  const limit = getStorageLimit(env);
  if (used + fileSize > limit) {
    return json({
      error: 'La subida superaría el límite de almacenamiento configurado para mantener la app dentro del nivel gratuito.',
      used_bytes: used,
      requested_bytes: fileSize,
      limit_bytes: limit,
    }, 507);
  }

  const original = sanitizeFilename(url.searchParams.get('name') || 'file');
  const ext = extensionFromName(original, contentType);
  const prefix = kind === 'audio' ? 'audio' : kind === 'artist' ? 'artists' : 'covers';
  const key = `${prefix}/${crypto.randomUUID()}${ext}`;

  const object = await env.MEDIA.put(key, request.body, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: { originalName: original },
  });
  if (!object) return json({ error: 'R2 no pudo guardar el archivo.' }, 500);
  await setStorageBytes(env, used + fileSize);
  return json({ key, size: fileSize, url: `/media/${encodeKey(key)}` });
}

async function deleteFileEndpoint(env, url) {
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'Falta key.' }, 400);
  const inUse = await fileIsReferenced(env, key);
  if (inUse) return json({ error: 'El archivo sigue en uso por la biblioteca.' }, 409);
  await deleteR2Object(env, key);
  return json({ ok: true });
}

async function handleMedia(request, env, url) {
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method Not Allowed', { status: 405 });
  const key = decodeKey(url.pathname.slice('/media/'.length));
  if (!key) return new Response('Not Found', { status: 404 });

  if (request.method === 'HEAD') {
    const object = await env.MEDIA.head(key);
    if (!object) return new Response('Not Found', { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('ETag', object.httpEtag);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(object.size));
    headers.set('Cache-Control', headers.get('Cache-Control') || 'public, max-age=31536000, immutable');
    return new Response(null, { status: 200, headers });
  }

  const object = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
  if (!object) return new Response('Not Found', { status: 404 });
  if (!('body' in object)) return new Response(null, { status: 412, headers: { ETag: object.httpEtag } });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', headers.get('Cache-Control') || 'public, max-age=31536000, immutable');
  let status = 200;
  if (object.range && Number.isFinite(object.range.offset) && Number.isFinite(object.range.length)) {
    const start = object.range.offset;
    const end = start + object.range.length - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
    headers.set('Content-Length', String(object.range.length));
    status = 206;
  } else {
    headers.set('Content-Length', String(object.size));
  }
  return new Response(object.body, { status, headers });
}

async function createTrack(request, env) {
  const body = await readJson(request);
  const title = cleanText(body.title, 120);
  const artists = validateArtists(body.artists);
  const audioKey = cleanKey(body.audio_key);
  const coverKey = body.cover_key ? cleanKey(body.cover_key) : null;
  const duration = cleanDuration(body.duration_seconds);
  if (!title || !artists.length || !audioKey) return json({ error: 'Faltan título, artistas o audio.' }, 400);

  const duplicate = await findDuplicate(env, title, null, artists);
  if (duplicate) return json({ error: 'Ya existe una canción con ese título y esos artistas.' }, 409);

  const id = crypto.randomUUID();
  const statements = [
    env.DB.prepare(`INSERT INTO tracks(id,title,album_id,track_number,duration_seconds,audio_key,cover_key) VALUES(?,?,?,?,?,?,?)`)
      .bind(id, title, null, null, duration, audioKey, coverKey),
    ...artistInsertStatements(env, id, artists),
  ];
  await env.DB.batch(statements);
  return json({ ok: true, id }, 201);
}

async function updateTrack(request, env, id) {
  const old = await env.DB.prepare(`SELECT * FROM tracks WHERE id=?`).bind(id).first();
  if (!old) return json({ error: 'Canción no encontrada.' }, 404);
  const body = await readJson(request);
  const title = cleanText(body.title, 120);
  const artists = validateArtists(body.artists);
  if (!title || !artists.length) return json({ error: 'Faltan título o artistas.' }, 400);

  const audioKey = body.audio_key ? cleanKey(body.audio_key) : old.audio_key;
  const coverKey = old.album_id ? null : (body.cover_key === null ? null : body.cover_key ? cleanKey(body.cover_key) : old.cover_key);
  const duration = body.duration_seconds == null ? old.duration_seconds : cleanDuration(body.duration_seconds);

  const duplicate = await findDuplicate(env, title, old.album_id, artists, id);
  if (duplicate) return json({ error: 'Ya existe una canción con ese título y esos artistas.' }, 409);

  const statements = [
    env.DB.prepare(`UPDATE tracks SET title=?,duration_seconds=?,audio_key=?,cover_key=?,updated_at=datetime('now') WHERE id=?`)
      .bind(title, duration, audioKey, coverKey, id),
    env.DB.prepare(`DELETE FROM track_artists WHERE track_id=?`).bind(id),
    ...artistInsertStatements(env, id, artists),
  ];
  await env.DB.batch(statements);
  if (old.audio_key !== audioKey) await deleteIfUnused(env, old.audio_key);
  if (old.cover_key && old.cover_key !== coverKey) await deleteIfUnused(env, old.cover_key);
  return json({ ok: true });
}

async function deleteTrack(env, id) {
  const old = await env.DB.prepare(`SELECT * FROM tracks WHERE id=?`).bind(id).first();
  if (!old) return json({ error: 'Canción no encontrada.' }, 404);
  await env.DB.batch([env.DB.prepare(`DELETE FROM track_artists WHERE track_id=?`).bind(id),env.DB.prepare(`DELETE FROM tracks WHERE id=?`).bind(id)]);
  await deleteIfUnused(env, old.audio_key);
  if (old.cover_key) await deleteIfUnused(env, old.cover_key);
  return json({ ok: true });
}

async function createAlbum(request, env) {
  const body = await readJson(request);
  const title = cleanText(body.title, 120);
  const coverKey = body.cover_key ? cleanKey(body.cover_key) : null;
  const list = Array.isArray(body.tracks) ? body.tracks : [];
  if (!title || !coverKey || !list.length) return json({ error: 'El álbum necesita nombre, portada y canciones.' }, 400);
  if (list.length > 50) return json({ error: 'Máximo 50 canciones por álbum.' }, 400);

  const id = crypto.randomUUID();
  const statements = [env.DB.prepare(`INSERT INTO albums(id,title,cover_key) VALUES(?,?,?)`).bind(id, title, coverKey)];
  const created = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i] || {};
    const trackTitle = cleanText(item.title, 120);
    const artists = validateArtists(item.artists);
    const audioKey = cleanKey(item.audio_key);
    if (!trackTitle || !artists.length || !audioKey) return json({ error: `La pista ${i + 1} no está completa.` }, 400);
    const tid = crypto.randomUUID();
    created.push(tid);
    statements.push(env.DB.prepare(`INSERT INTO tracks(id,title,album_id,track_number,duration_seconds,audio_key,cover_key) VALUES(?,?,?,?,?,?,NULL)`)
      .bind(tid, trackTitle, id, i + 1, cleanDuration(item.duration_seconds), audioKey));
    statements.push(...artistInsertStatements(env, tid, artists));
  }
  await env.DB.batch(statements);
  return json({ ok: true, id, track_ids: created }, 201);
}

async function updateAlbum(request, env, id) {
  const oldAlbum = await env.DB.prepare(`SELECT * FROM albums WHERE id=?`).bind(id).first();
  if (!oldAlbum) return json({ error: 'Álbum no encontrado.' }, 404);
  const oldTracks = (await env.DB.prepare(`SELECT * FROM tracks WHERE album_id=? ORDER BY track_number`).bind(id).all()).results || [];
  const oldById = new Map(oldTracks.map(t => [t.id, t]));

  const body = await readJson(request);
  const title = cleanText(body.title, 120);
  const coverKey = body.cover_key ? cleanKey(body.cover_key) : oldAlbum.cover_key;
  const existing = Array.isArray(body.existing) ? body.existing : [];
  const additions = Array.isArray(body.add) ? body.add : [];
  const removeIds = new Set(Array.isArray(body.remove_ids) ? body.remove_ids.map(String) : []);
  if (!title) return json({ error: 'El álbum necesita un nombre.' }, 400);

  const statements = [
    env.DB.prepare(`UPDATE albums SET title=?,cover_key=?,updated_at=datetime('now') WHERE id=?`).bind(title, coverKey, id),
  ];

  for (const row of existing) {
    const tid = String(row.id || '');
    if (!oldById.has(tid) || removeIds.has(tid)) continue;
    const trackTitle = cleanText(row.title, 120);
    const artists = validateArtists(row.artists);
    const number = Math.max(1, Math.min(999, Number(row.track_number) || 1));
    if (!trackTitle || !artists.length) return json({ error: 'Todas las canciones necesitan título y artista.' }, 400);
    statements.push(env.DB.prepare(`UPDATE tracks SET title=?,track_number=?,updated_at=datetime('now') WHERE id=? AND album_id=?`).bind(trackTitle, number, tid, id));
    statements.push(env.DB.prepare(`DELETE FROM track_artists WHERE track_id=?`).bind(tid));
    statements.push(...artistInsertStatements(env, tid, artists));
  }

  const addedIds = [];
  let nextNumber = Math.max(0, ...existing.filter(r => !removeIds.has(String(r.id))).map(r => Number(r.track_number) || 0));
  for (let i = 0; i < additions.length; i++) {
    const item = additions[i] || {};
    const trackTitle = cleanText(item.title, 120);
    const artists = validateArtists(item.artists);
    const audioKey = cleanKey(item.audio_key);
    if (!trackTitle || !artists.length || !audioKey) return json({ error: `La nueva pista ${i + 1} no está completa.` }, 400);
    const tid = crypto.randomUUID();
    addedIds.push(tid);
    const trackNumber = Number(item.track_number) || ++nextNumber;
    statements.push(env.DB.prepare(`INSERT INTO tracks(id,title,album_id,track_number,duration_seconds,audio_key,cover_key) VALUES(?,?,?,?,?,?,NULL)`)
      .bind(tid, trackTitle, id, trackNumber, cleanDuration(item.duration_seconds), audioKey));
    statements.push(...artistInsertStatements(env, tid, artists));
  }

  for (const tid of removeIds) {
    if (oldById.has(tid)) { statements.push(env.DB.prepare(`DELETE FROM track_artists WHERE track_id=?`).bind(tid)); statements.push(env.DB.prepare(`DELETE FROM tracks WHERE id=? AND album_id=?`).bind(tid, id)); }
  }

  if (existing.filter(r => !removeIds.has(String(r.id))).length + additions.length < 1) {
    return json({ error: 'Un álbum debe conservar al menos una canción.' }, 400);
  }

  await env.DB.batch(statements);
  for (const tid of removeIds) {
    const t = oldById.get(tid);
    if (t) await deleteIfUnused(env, t.audio_key);
  }
  if (oldAlbum.cover_key && oldAlbum.cover_key !== coverKey) await deleteIfUnused(env, oldAlbum.cover_key);
  return json({ ok: true, added_ids: addedIds });
}

async function deleteAlbum(env, id) {
  const album = await env.DB.prepare(`SELECT * FROM albums WHERE id=?`).bind(id).first();
  if (!album) return json({ error: 'Álbum no encontrado.' }, 404);
  const tracks = (await env.DB.prepare(`SELECT id,audio_key FROM tracks WHERE album_id=?`).bind(id).all()).results || [];
  const deleteStatements = [];
  for (const track of tracks) deleteStatements.push(env.DB.prepare(`DELETE FROM track_artists WHERE track_id=?`).bind(track.id));
  deleteStatements.push(env.DB.prepare(`DELETE FROM tracks WHERE album_id=?`).bind(id));
  deleteStatements.push(env.DB.prepare(`DELETE FROM albums WHERE id=?`).bind(id));
  await env.DB.batch(deleteStatements);
  for (const track of tracks) await deleteIfUnused(env, track.audio_key);
  if (album.cover_key) await deleteIfUnused(env, album.cover_key);
  return json({ ok: true });
}

async function updateArtist(request, env, name) {
  if (!ARTISTS.includes(name)) return json({ error: 'Artista no válido.' }, 400);
  const old = await env.DB.prepare(`SELECT * FROM artists WHERE name=?`).bind(name).first();
  if (!old) return json({ error: 'Artista no encontrado.' }, 404);
  const body = await readJson(request);
  const bio = cleanText(body.bio || '', 800) || null;
  const photoKey = body.photo_key === null ? null : body.photo_key ? cleanKey(body.photo_key) : old.photo_key;
  await env.DB.prepare(`UPDATE artists SET photo_key=?,bio=?,updated_at=datetime('now') WHERE name=?`).bind(photoKey, bio, name).run();
  if (old.photo_key && old.photo_key !== photoKey) await deleteIfUnused(env, old.photo_key);
  return json({ ok: true });
}

async function findDuplicate(env, title, albumId, artists, excludeId = null) {
  const normalized = title.trim().toLowerCase();
  const result = await env.DB.prepare(`
    SELECT t.id, t.title
    FROM tracks t
    WHERE lower(trim(t.title)) = ?
      AND ((? IS NULL AND t.album_id IS NULL) OR t.album_id = ?)
      ${excludeId ? 'AND t.id <> ?' : ''}
  `).bind(...(excludeId ? [normalized, albumId, albumId, excludeId] : [normalized, albumId, albumId])).all();
  for (const row of result.results || []) {
    const a = (await env.DB.prepare(`SELECT artist_name FROM track_artists WHERE track_id=? ORDER BY position`).bind(row.id).all()).results.map(x => x.artist_name);
    if (sameSet(a, artists)) return row.id;
  }
  return null;
}

function artistInsertStatements(env, trackId, artists) {
  return artists.map((artist, i) => env.DB.prepare(`INSERT INTO track_artists(track_id,artist_name,position) VALUES(?,?,?)`).bind(trackId, artist, i));
}

function validateArtists(value) {
  if (!Array.isArray(value)) return [];
  const unique = [...new Set(value.map(x => String(x || '').trim()).filter(x => ARTISTS.includes(x)))];
  return unique.slice(0, ARTISTS.length);
}

async function fileIsReferenced(env, key) {
  const row = await env.DB.prepare(`
    SELECT 1 AS used FROM tracks WHERE audio_key=? OR cover_key=?
    UNION ALL SELECT 1 FROM albums WHERE cover_key=?
    UNION ALL SELECT 1 FROM artists WHERE photo_key=?
    LIMIT 1
  `).bind(key, key, key, key).first();
  return !!row;
}

async function deleteIfUnused(env, key) {
  if (!key) return;
  if (await fileIsReferenced(env, key)) return;
  await deleteR2Object(env, key);
}

async function deleteR2Object(env, key) {
  const object = await env.MEDIA.head(key);
  if (!object) return;
  await env.MEDIA.delete(key);
  const used = await getStorageBytes(env);
  await setStorageBytes(env, Math.max(0, used - object.size));
}

async function getStorageBytes(env) {
  const row = await env.DB.prepare(`SELECT value FROM app_settings WHERE key='storage_bytes'`).first();
  return Math.max(0, Number(row?.value || 0));
}

async function setStorageBytes(env, bytes) {
  await env.DB.prepare(`INSERT INTO app_settings(key,value) VALUES('storage_bytes',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`)
    .bind(String(Math.max(0, Math.floor(bytes)))).run();
}

function getStorageLimit(env) {
  const n = Number(env.STORAGE_SOFT_LIMIT_BYTES || DEFAULT_STORAGE_SOFT_LIMIT);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STORAGE_SOFT_LIMIT;
}

function cleanText(value, max) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ');
  return s.slice(0, max);
}
function cleanKey(value) {
  const s = String(value || '').trim();
  if (!s || s.includes('..') || s.startsWith('/') || !/^(audio|covers|artists)\//.test(s)) return '';
  return s.slice(0, 512);
}
function cleanDuration(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 && n < 24 * 3600 ? n : null;
}
function sanitizeFilename(name) {
  return String(name || 'file').replace(/[\r\n]/g, '').replace(/[^\p{L}\p{N}._ -]+/gu, '_').slice(-160) || 'file';
}
function extensionFromName(name, type) {
  const match = String(name).match(/(\.[a-zA-Z0-9]{1,6})$/);
  if (match) return match[1].toLowerCase();
  const map = { 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/ogg': '.ogg', 'audio/wav': '.wav', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
  return map[type] || '';
}
function encodeKey(key) { return key.split('/').map(encodeURIComponent).join('/'); }
function decodeKey(key) { return key.split('/').map(x => decodeURIComponent(x)).join('/'); }
function parseCookies(header) {
  return Object.fromEntries(header.split(';').map(v => v.trim()).filter(Boolean).map(v => {
    const i = v.indexOf('=');
    return i < 0 ? [v, ''] : [v.slice(0, i), v.slice(i + 1)];
  }));
}
async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
function json(data, status = 200, extraHeaders = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  return new Response(JSON.stringify(data), { status, headers });
}
function sameSet(a, b) {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function b64url(value) {
  const bytes = new TextEncoder().encode(value);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromB64url(value) {
  const base = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base + '='.repeat((4 - base.length % 4) % 4);
  const raw = atob(padded);
  const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
async function sign(payload, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  let raw = '';
  for (const b of sig) raw += String.fromCharCode(b);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
async function safeEqual(a, b) {
  const ha = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(a))));
  const hb = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(b))));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}
