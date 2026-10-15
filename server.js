const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const sessions = new Map();
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

async function database() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { return JSON.parse(await fs.readFile(DB_FILE, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; const db = { users: [], applications: [] }; await save(db); return db; }
}
async function save(db) { await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2)); }
function send(res, status, data) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }); res.end(JSON.stringify(data)); }
function readBody(req) { return new Promise((resolve, reject) => { let raw=''; req.on('data', chunk => { raw += chunk; if (raw.length > 1_000_000) reject(new Error('Request too large')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('Invalid JSON')); } }); req.on('error', reject); }); }
function clean(value, max=160) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function currentUser(req) { const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, ''); return token ? sessions.get(token) : null; }
function publicUser(user) { return { id:user.id, name:user.name, email:user.email }; }
function applicationInput(body) {
  const company = clean(body.company), role = clean(body.role), status = clean(body.status, 40) || 'Wishlist';
  if (!company || !role) throw new Error('Company and role are required.');
  if (!['Wishlist','Applied','Interview','Offer','Rejected'].includes(status)) throw new Error('Choose a valid status.');
  return { company, role, status, location:clean(body.location), link:clean(body.link, 500), appliedDate:clean(body.appliedDate, 20), notes:clean(body.notes, 2000) };
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      const db = await database();
      if (url.pathname === '/api/health' && req.method === 'GET') return send(res, 200, { ok:true, service:'Internship Tracker API' });
      if (url.pathname === '/api/auth/register' && req.method === 'POST') {
        const body = await readBody(req), name = clean(body.name), email = clean(body.email, 254).toLowerCase(), password = typeof body.password === 'string' ? body.password : '';
        if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8) return send(res, 400, { error:'Enter a name, valid email, and password with at least 8 characters.' });
        if (db.users.some(u => u.email === email)) return send(res, 409, { error:'An account with this email already exists.' });
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = await new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, (e, key) => e ? reject(e) : resolve(key.toString('hex'))));
        const user = { id:crypto.randomUUID(), name, email, salt, hash, createdAt:new Date().toISOString() };
        db.users.push(user); await save(db); const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id);
        return send(res, 201, { token, user:publicUser(user) });
      }
      if (url.pathname === '/api/auth/login' && req.method === 'POST') {
        const body = await readBody(req), email = clean(body.email, 254).toLowerCase(), password = typeof body.password === 'string' ? body.password : '';
        const user = db.users.find(u => u.email === email);
        if (!user) return send(res, 401, { error:'Email or password is incorrect.' });
        const hash = await new Promise((resolve, reject) => crypto.scrypt(password, user.salt, 64, (e, key) => e ? reject(e) : resolve(key.toString('hex'))));
        if (!crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'))) return send(res, 401, { error:'Email or password is incorrect.' });
        const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, user.id); return send(res, 200, { token, user:publicUser(user) });
      }
      if (url.pathname === '/api/auth/logout' && req.method === 'POST') { const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,''); sessions.delete(token); return send(res, 200, { ok:true }); }
      const userId = currentUser(req);
      if (!userId) return send(res, 401, { error:'Please sign in to continue.' });
      const user = db.users.find(u => u.id === userId);
      if (url.pathname === '/api/auth/me' && req.method === 'GET') return send(res, 200, { user:publicUser(user) });
      if (url.pathname === '/api/applications' && req.method === 'GET') {
        const items = db.applications.filter(a => a.userId === userId).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
        return send(res, 200, { applications:items });
      }
      if (url.pathname === '/api/applications' && req.method === 'POST') {
        const item = { id:crypto.randomUUID(), userId, ...applicationInput(await readBody(req)), createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() };
        db.applications.push(item); await save(db); return send(res, 201, { application:item });
      }
      const match = url.pathname.match(/^\/api\/applications\/([\w-]+)$/);
      if (match) {
        const index = db.applications.findIndex(a => a.id === match[1] && a.userId === userId);
        if (index < 0) return send(res, 404, { error:'Application not found.' });
        if (req.method === 'PUT') { db.applications[index] = { ...db.applications[index], ...applicationInput(await readBody(req)), updatedAt:new Date().toISOString() }; await save(db); return send(res, 200, { application:db.applications[index] }); }
        if (req.method === 'DELETE') { db.applications.splice(index, 1); await save(db); return send(res, 200, { ok:true }); }
      }
      return send(res, 404, { error:'API route not found.' });
    }
    const requested = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = path.resolve(PUBLIC_DIR, requested);
    if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, { error:'Forbidden' });
    try { const body = await fs.readFile(file); res.writeHead(200, { 'Content-Type':mime[path.extname(file)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404, { 'Content-Type':'text/plain; charset=utf-8' }); res.end('Page not found'); }
  } catch (error) { send(res, 400, { error:error.message || 'Request failed.' }); }
}

http.createServer(handle).listen(PORT, () => console.log(`Internship Tracker is running at http://localhost:${PORT}`));
