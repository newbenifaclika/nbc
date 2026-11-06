const COOKIE = '__Host-nbc_listener';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const readiness = new WeakMap();
const encoder = new TextEncoder();
const keyPattern = /^NBC-[A-Za-z0-9_-]{32}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
const fail = (error, status) => json({ error }, status);

function initialize(db) {
  if (!readiness.has(db)) {
    const tables = [
      `CREATE TABLE IF NOT EXISTS listener_accounts (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, access_hash TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS listener_sessions (
        token_hash TEXT PRIMARY KEY, listener_id TEXT NOT NULL REFERENCES listener_accounts(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS listener_sessions_expiry ON listener_sessions(expires_at)`,
      `CREATE INDEX IF NOT EXISTS listener_sessions_account ON listener_sessions(listener_id)`,
      `CREATE TABLE IF NOT EXISTS listener_favorites (
        listener_id TEXT NOT NULL REFERENCES listener_accounts(id) ON DELETE CASCADE,
        track_id TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
        added_at INTEGER NOT NULL,
        PRIMARY KEY (listener_id, track_id)
      )`,
      `CREATE INDEX IF NOT EXISTS listener_favorites_track ON listener_favorites(track_id)`,
    ];
    readiness.set(db, db.batch(tables.map(sql => db.prepare(sql))).catch(error => {
      readiness.delete(db);
      throw error;
    }));
  }
  return readiness.get(db);
}
function randomToken(bytes) {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(bytes))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
}
function cookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}
function sessionToken(request) {
  const token = (request.headers.get('Cookie') || '').split(';')
    .map(v => v.trim()).find(v => v.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  return tokenPattern.test(token || '') ? token : null;
}
function usernameOf(value) {
  if (typeof value !== 'string') return '';
  const name = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(name) ? name : '';
}
async function smallJson(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '')) return null;
  const reader = request.body?.getReader();
  if (!reader) return null;
  let text = '', size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); return null; }
      text += decoder.decode(value, { stream: true });
    }
    const data = JSON.parse(text + decoder.decode());
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch { return null; }
}
async function identify(db, tokenHash) {
  return db.prepare(`
    SELECT a.id, a.username FROM listener_sessions s
    JOIN listener_accounts a ON a.id=s.listener_id
    WHERE s.token_hash=? AND s.expires_at>?
  `).bind(tokenHash, Date.now()).first();
}
async function favorites(db, id) {
  const { results } = await db.prepare(
    'SELECT track_id FROM listener_favorites WHERE listener_id=? ORDER BY added_at DESC, track_id'
  ).bind(id).all();
  return (results || []).map(row => row.track_id);
}
async function startSession(db, account, previousHash, accessKey = null) {
  const token = randomToken(32), now = Date.now();
  const statements = [db.prepare('DELETE FROM listener_sessions WHERE expires_at<=?').bind(now)];
  if (previousHash) statements.push(db.prepare('DELETE FROM listener_sessions WHERE token_hash=?').bind(previousHash));
  if (accessKey) statements.push(db.prepare('INSERT INTO listener_accounts(id, username, access_hash) VALUES(?,?,?)')
    .bind(account.id, account.username, await digest(accessKey)));
  statements.push(db.prepare('INSERT INTO listener_sessions(token_hash, listener_id, expires_at) VALUES(?,?,?)')
    .bind(await digest(token), account.id, now + SESSION_SECONDS * 1000));
  await db.batch(statements);
  const data = { username: account.username, favorites: accessKey ? [] : await favorites(db, account.id) };
  if (accessKey) data.accessKey = accessKey;
  return json(data, accessKey ? 201 : 200, { 'Set-Cookie': cookie(token, SESSION_SECONDS) });
}

export async function handleListener(request, env, url) {
  const method = request.method, path = url.pathname;
  if (method !== 'GET' && request.headers.get('Origin') !== url.origin) return fail('Solicitud no autorizada.', 403);
  const db = env.DB, token = sessionToken(request);
  if (path === '/api/listener' && method === 'GET' && !token) return json({ username: null, favorites: [] });

  const register = path === '/api/listener/register' && method === 'POST';
  const login = path === '/api/listener/login' && method === 'POST';
  const logout = path === '/api/listener/logout' && method === 'POST';
  const remove = path === '/api/listener' && method === 'DELETE';
  const status = path === '/api/listener' && method === 'GET';
  const favorite = path.match(/^\/api\/listener\/favorites\/([\w-]{1,100})$/);
  if (!register && !login && !logout && !remove && !status && !(favorite && ['PUT','DELETE'].includes(method))) {
    return fail('Ruta no encontrada.', 404);
  }

  if (register || login || remove) {
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    if (env.LISTENER_AUTH_LIMIT && !(await env.LISTENER_AUTH_LIMIT.limit({ key: ip })).success) {
      return json({ error: 'Demasiados intentos. Espera un minuto.' }, 429, { 'Retry-After': '60' });
    }
  }
  await initialize(db);
  const tokenHash = token ? await digest(token) : null;

  if (logout) {
    if (tokenHash) await db.prepare('DELETE FROM listener_sessions WHERE token_hash=?').bind(tokenHash).run();
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  if (register || login) {
    const data = await smallJson(request), username = usernameOf(data?.username);
    if (!username) return fail('Usa de 3 a 24 caracteres: letras, números, puntos, guiones o guiones bajos.', 400);
    if (register) {
      try {
        return await startSession(db, { id: crypto.randomUUID(), username }, tokenHash, 'NBC-' + randomToken(24));
      } catch (error) {
        if (/UNIQUE constraint failed: listener_accounts.username/i.test(String(error?.message))) {
          return fail('Ese nombre de usuario ya está ocupado.', 409);
        }
        throw error;
      }
    }
    const key = typeof data?.accessKey === 'string' ? data.accessKey.trim() : '';
    if (!keyPattern.test(key)) return fail('Usuario o clave de acceso incorrectos.', 401);
    const account = await db.prepare('SELECT id, username FROM listener_accounts WHERE username=? AND access_hash=?')
      .bind(username, await digest(key)).first();
    if (!account) return fail('Usuario o clave de acceso incorrectos.', 401);
    return startSession(db, account, tokenHash);
  }
  const account = tokenHash ? await identify(db, tokenHash) : null;
  if (status) return json(account
    ? { username: account.username, favorites: await favorites(db, account.id) }
    : { username: null, favorites: [] });
  if (!account) return fail('Entra en tu cuenta para guardar favoritos.', 401);
  if (remove) {
    const data = await smallJson(request);
    const key = typeof data?.accessKey === 'string' ? data.accessKey.trim() : '';
    if (!keyPattern.test(key)) return fail('La clave de acceso no coincide.', 403);
    const result = await db.prepare('DELETE FROM listener_accounts WHERE id=? AND access_hash=?')
      .bind(account.id, await digest(key)).run();
    if (!result.meta.changes) return fail('La clave de acceso no coincide.', 403);
    return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  const trackId = favorite[1];
  if (method === 'PUT') {
    const result = await db.prepare(`
      INSERT OR IGNORE INTO listener_favorites(listener_id,track_id,added_at)
      SELECT ?, id, ? FROM tracks WHERE id=?
    `).bind(account.id, Date.now(), trackId).run();
    if (!result.meta.changes && !await db.prepare('SELECT id FROM tracks WHERE id=?').bind(trackId).first()) {
      return fail('La canción ya no está disponible.', 404);
    }
  } else {
    await db.prepare('DELETE FROM listener_favorites WHERE listener_id=? AND track_id=?').bind(account.id, trackId).run();
  }
  return json({ favorite: method === 'PUT' });
}
