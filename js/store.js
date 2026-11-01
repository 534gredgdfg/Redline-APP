// On-device data store. Replaces the old Node/SQLite server: same "routes", same state shape,
// but everything lives in this browser — data in localStorage, bike photos in IndexedDB.
import { SCHEDULE, DEFAULT_SETTINGS, STATS, PROFILES } from './schedule.js';

const KEY = 'redline-garage:data';
const BRANDS = ['honda', 'yamaha', 'ktm'];
const TABLES = ['hour_log', 'items', 'services', 'service_items', 'tracks', 'sessions', 'laps'];

const today = () => new Date().toLocaleDateString('en-CA');
const clone = o => JSON.parse(JSON.stringify(o));
function bad(msg) { return new Error(msg); }

// ─── persistence ───────────────────────────────────────────────────
let D = null;
const images = {}; // brand -> dataURL (custom uploads)

function emptyDb() {
  const d = { version: 2, settings: clone(DEFAULT_SETTINGS), seq: {} };
  delete d.settings.apiKey;
  TABLES.forEach(t => (d[t] = []));
  return d;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(D)); }
  catch { throw bad('Couldn\'t save — this phone\'s browser storage is full or blocked (private browsing?). Export a backup from Settings.'); }
}
const nextId = t => (D.seq[t] = Math.max(D.seq[t] || 0, ...D[t].map(r => r.id || 0)) + 1);

// IndexedDB for photos (localStorage is too small for images)
let idbP = null;
function idb() {
  idbP ??= new Promise((res, rej) => {
    const r = indexedDB.open('redline-garage', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('images');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return idbP;
}
async function idbOp(mode, fn) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction('images', mode);
    const req = fn(tx.objectStore('images'));
    tx.oncomplete = () => res(req?.result);
    tx.onerror = () => rej(tx.error);
  });
}

export async function init() {
  try { D = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { D = null; }
  if (!D || !Array.isArray(D.items)) D = emptyDb();
  TABLES.forEach(t => (D[t] ??= []));
  D.seq ??= {};
  seed();
  save();
  try { for (const b of BRANDS) { const v = await idbOp('readonly', s => s.get(b)); if (v) images[b] = v; } }
  catch (e) { console.warn('IndexedDB unavailable', e); }
  // ask the browser not to evict our data (granted for home-screen apps on most phones)
  try { await navigator.storage?.persist?.(); } catch { /* ignore */ }
}

// ─── settings ──────────────────────────────────────────────────────
function getSettings() {
  const merged = clone(DEFAULT_SETTINGS);
  delete merged.apiKey;
  for (const [k, v] of Object.entries(D.settings || {})) {
    if (k === 'apiKey') continue;
    merged[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...merged[k], ...v } : v;
  }
  return merged;
}
function saveSettings(patch) {
  const cur = getSettings();
  for (const [k, v] of Object.entries(patch || {})) {
    cur[k] = (v && typeof v === 'object' && !Array.isArray(v)) ? { ...cur[k], ...v } : v;
  }
  D.settings = cur;
}

// ─── seed / migrate the schedule ───────────────────────────────────
const profileVals = (s, profile) => {
  const v = profile === 'honda' ? (s.honda || s.trail) : s.trail;
  return { h: v.hours ?? null, m: v.months ?? null };
};
function seed() {
  const profile = getSettings().profile;
  SCHEDULE.forEach((s, i) => {
    const v = profileVals(s, profile);
    const stock = { manual_hours: s.honda?.hours ?? null, manual_months: s.honda?.months ?? null,
      trail_hours: s.trail.hours ?? null, trail_months: s.trail.months ?? null };
    const fixed = { name: s.name, action: s.action, system: s.system, grp: s.group || null, lube: s.lube ? 1 : 0,
      ref: s.ref, how: s.how, why: s.why || '', sort: i, ...stock };
    const row = D.items.find(r => r.key === s.key);
    if (!row) {
      D.items.push({ id: nextId('items'), key: s.key, ...fixed, interval_hours: v.h, interval_months: v.m,
        note: '', enabled: 1, custom: 0 });
    } else {
      const wasStock = (row.interval_hours === row.manual_hours && row.interval_months === row.manual_months) ||
        ((row.trail_hours != null || row.trail_months != null) && row.interval_hours === row.trail_hours && row.interval_months === row.trail_months);
      Object.assign(row, fixed);
      if (wasStock) { row.interval_hours = v.h; row.interval_months = v.m; }
    }
  });
  const keys = new Set(SCHEDULE.map(s => s.key));
  D.items = D.items.filter(r => {
    if (r.custom || keys.has(r.key)) return true;
    if (D.service_items.some(si => si.item_id === r.id)) { r.enabled = 0; r.sort = 900; return true; }
    return false;
  });
  if (!D.hour_log.length) {
    D.hour_log.push({ id: nextId('hour_log'), date: today(), hours: 32.0, note: 'Starting point: 30 h from previous owner + 2 h mine', source: 'seed' });
  }
}

// ─── derived state ─────────────────────────────────────────────────
function currentHours() {
  const r = [...D.hour_log].sort((a, b) => b.hours - a.hours || b.date.localeCompare(a.date) || b.id - a.id)[0];
  return r ? { hours: r.hours, date: r.date } : { hours: 0, date: null };
}
function addMonths(iso, m) {
  const d = new Date(iso + 'T12:00:00Z');
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + m);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}
const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);

function ridingPace() {
  const rows = [...D.hour_log].sort((a, b) => a.date.localeCompare(b.date) || a.hours - b.hours);
  if (rows.length < 2) return null;
  const last = rows[rows.length - 1];
  const cutoff = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const first = rows.find(r => r.date >= cutoff) || rows[0];
  const days = daysBetween(first.date, last.date);
  const h = last.hours - first.hours;
  if (days < 7 || h <= 0) return null;
  return { hoursPerWeek: h / (days / 7), basisDays: days };
}

function computeItems() {
  const s = getSettings(), cur = currentHours(), now = today(), pace = ridingPace();
  const svcById = new Map(D.services.map(x => [x.id, x]));
  return [...D.items].sort((a, b) => a.sort - b.sort || a.id - b.id).map(it => {
    const done = D.service_items.filter(si => si.item_id === it.id).map(si => svcById.get(si.service_id)).filter(Boolean);
    done.sort((a, b) => (b.hours ?? -1) - (a.hours ?? -1) || b.date.localeCompare(a.date) || b.id - a.id);
    const last = done[0] ? { id: done[0].id, date: done[0].date, hours: done[0].hours } : null;
    const out = { ...it, enabled: !!it.enabled, custom: !!it.custom, lube: !!it.lube, last, timesDone: done.length };
    let dueHours = null, dueDate = null, remH = null, remD = null;
    if (last) {
      if (it.interval_hours && last.hours != null) { dueHours = +(last.hours + it.interval_hours).toFixed(2); remH = +(dueHours - cur.hours).toFixed(2); }
      if (it.interval_months) { dueDate = addMonths(last.date, it.interval_months); remD = daysBetween(now, dueDate); }
    }
    let status;
    if (!it.enabled) status = 'off';
    else if (!last) status = 'nodata';
    else if ((remH != null && remH < 0) || (remD != null && remD < 0)) status = 'overdue';
    else if ((remH != null && remH <= s.alerts.soonHours) || (remD != null && remD <= s.alerts.soonDays)) status = 'soon';
    else status = 'ok';
    let eta = null;
    if (remH != null && remH > 0 && pace && pace.hoursPerWeek > 0) {
      eta = new Date(Date.now() + (remH / pace.hoursPerWeek) * 7 * 86400000).toLocaleDateString('en-CA');
    }
    let score = 1e9;
    if (status === 'nodata') score = -1e6 + (it.interval_hours ?? 100);
    else if (status !== 'off') {
      const a = remH != null ? remH : Infinity;
      const b = remD != null ? remD * (pace ? pace.hoursPerWeek / 7 : 0.1) : Infinity;
      score = Math.min(a, b);
    }
    return { ...out, dueHours, dueDate, remH, remD, eta, status, score };
  });
}

function getServices() {
  return [...D.services]
    .sort((a, b) => b.date.localeCompare(a.date) || (b.hours ?? 0) - (a.hours ?? 0) || b.id - a.id)
    .map(r => ({ ...r, itemIds: D.service_items.filter(si => si.service_id === r.id).map(si => si.item_id) }));
}

function getLapData() {
  const sess = [...D.sessions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).map(s => {
    const laps = D.laps.filter(l => l.session_id === s.id).sort((a, b) => a.lap_no - b.lap_no).map(l => ({ lap_no: l.lap_no, ms: l.ms }));
    const ms = laps.map(l => l.ms);
    return { ...s, setup: s.setup || {}, laps, best: ms.length ? Math.min(...ms) : null,
      avg: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null };
  });
  const tracks = [...D.tracks].sort((a, b) => a.name.localeCompare(b.name)).map(t => {
    const ss = sess.filter(s => s.track_id === t.id);
    const bests = ss.map(s => s.best).filter(Boolean);
    return { ...t, sessions: ss.length, best: bests.length ? Math.min(...bests) : null, lastVisit: ss[0]?.date || null };
  });
  return { tracks, sessions: sess };
}

function imageInfo() {
  const out = {};
  for (const b of BRANDS) {
    out[b] = images[b] ? { url: images[b], custom: true } : b === 'honda' ? { url: 'bikes/honda.webp', custom: false } : null;
  }
  return out;
}

function state() {
  return {
    settings: getSettings(),
    hours: { ...currentHours(), log: [...D.hour_log].sort((a, b) => b.date.localeCompare(a.date) || b.hours - a.hours || b.id - a.id).slice(0, 300), pace: ridingPace() },
    items: computeItems(),
    services: getServices(),
    ...getLapData(),
    stats: STATS,
    profiles: PROFILES,
    images: imageInfo(),
    today: today(),
    backup: D.lastExport || null,
  };
}

// ─── validation helpers ────────────────────────────────────────────
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const num = (v, { min = -Infinity, max = Infinity, nullable = true } = {}) => {
  if (v === null || v === undefined || v === '') { if (nullable) return null; throw bad('Number required.'); }
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw bad(`Invalid number: ${v}`);
  return n;
};
const str = (v, max = 2000) => (v == null ? '' : String(v).slice(0, max));

// ─── routes (same paths the UI used with the server) ──────────────
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/state', () => state());

route('POST', '/api/hours', b => {
  const cur = currentHours().hours;
  let h = b.add != null ? cur + num(b.add, { min: -50, max: 50, nullable: false }) : num(b.hours, { min: 0, max: 100000, nullable: false });
  h = Math.round(h * 100) / 100;
  if (h < cur - 1e-9) throw bad(`New reading ${h} h is below current ${cur} h. Delete the wrong entry in Settings first if you need to go back.`);
  D.hour_log.push({ id: nextId('hour_log'), date: isDate(b.date) ? b.date : today(), hours: h, note: str(b.note, 300), source: 'manual' });
  return state();
});
route('DELETE', '/api/hours/:id', (_, p) => {
  if (D.hour_log.length <= 1) throw bad('Keep at least one hour reading.');
  D.hour_log = D.hour_log.filter(r => r.id !== Number(p.id));
  return state();
});

function writeService(id, b) {
  const date = isDate(b.date) ? b.date : today();
  const hours = num(b.hours, { min: 0, max: 100000 });
  const itemIds = Array.isArray(b.itemIds) ? [...new Set(b.itemIds.map(Number).filter(Number.isInteger))] : [];
  let title = str(b.title, 200).trim();
  if (!title && !itemIds.length) throw bad('Give the entry a title or tick at least one schedule item.');
  if (!title) title = itemIds.map(i => D.items.find(x => x.id === i)).filter(Boolean)
    .map(it => it.name + ({ replace: ' (replace)', clean: ' (clean)', lube: ' (lube)' }[it.action] || '')).join(', ');
  const row = { date, hours, title, notes: str(b.notes, 5000), cost: num(b.cost, { min: 0, max: 1e7 }), parts: str(b.parts, 2000) };
  if (id) {
    const r = D.services.find(s => s.id === id); if (!r) throw bad('Entry not found.');
    Object.assign(r, row);
    D.service_items = D.service_items.filter(si => si.service_id !== id);
  } else {
    id = nextId('services');
    D.services.push({ id, ...row, created_at: new Date().toISOString() });
  }
  itemIds.forEach(i => D.service_items.push({ service_id: id, item_id: i }));
}
route('POST', '/api/services', b => { writeService(null, b); return state(); });
route('PUT', '/api/services/:id', (b, p) => { writeService(Number(p.id), b); return state(); });
route('DELETE', '/api/services/:id', (_, p) => {
  const id = Number(p.id);
  D.services = D.services.filter(s => s.id !== id);
  D.service_items = D.service_items.filter(si => si.service_id !== id);
  return state();
});

route('PUT', '/api/items/:id', (b, p) => {
  const it = D.items.find(i => i.id === Number(p.id)); if (!it) throw bad('Item not found.');
  const f = {
    interval_hours: 'interval_hours' in b ? num(b.interval_hours, { min: 0.1, max: 5000 }) : it.interval_hours,
    interval_months: 'interval_months' in b ? num(b.interval_months, { min: 1, max: 240 }) : it.interval_months,
    note: 'note' in b ? str(b.note) : it.note,
    enabled: 'enabled' in b ? (b.enabled ? 1 : 0) : it.enabled,
  };
  if (it.custom) Object.assign(f, {
    name: 'name' in b ? str(b.name, 120) : it.name, how: 'how' in b ? str(b.how) : it.how,
    system: 'system' in b ? str(b.system, 40) : it.system, action: 'action' in b ? str(b.action, 20) : it.action,
  });
  if (f.interval_hours == null && f.interval_months == null) throw bad('Need an hour or month interval.');
  Object.assign(it, f);
  return state();
});
route('POST', '/api/items/:id/reset', (_, p) => {
  const it = D.items.find(i => i.id === Number(p.id));
  const s = it && SCHEDULE.find(x => x.key === it.key);
  if (s) { const v = profileVals(s, getSettings().profile); it.interval_hours = v.h; it.interval_months = v.m; }
  return state();
});
route('POST', '/api/items', b => {
  const ih = num(b.interval_hours, { min: 0.1, max: 5000 }), im = num(b.interval_months, { min: 1, max: 240 });
  if (ih == null && im == null) throw bad('Need an hour or month interval.');
  const name = str(b.name, 120).trim(); if (!name) throw bad('Name required.');
  D.items.push({ id: nextId('items'), key: 'custom-' + Date.now().toString(36), name, action: str(b.action || 'inspect', 20),
    system: str(b.system || 'Custom', 40), grp: null, lube: 0, interval_hours: ih, interval_months: im,
    manual_hours: null, manual_months: null, trail_hours: null, trail_months: null,
    ref: '', how: str(b.how), why: '', note: str(b.note), enabled: 1, custom: 1, sort: 1000 });
  return state();
});
route('DELETE', '/api/items/:id', (_, p) => {
  const id = Number(p.id), it = D.items.find(i => i.id === id);
  if (!it) throw bad('Item not found.');
  if (!it.custom) throw bad('Built-in items can be disabled, not deleted.');
  D.items = D.items.filter(i => i.id !== id);
  D.service_items = D.service_items.filter(si => si.item_id !== id);
  return state();
});
route('POST', '/api/schedule/profile', b => {
  if (!PROFILES[b.profile]) throw bad('Unknown schedule profile.');
  saveSettings({ profile: b.profile });
  D.items.filter(i => !i.custom).forEach(it => {
    const s = SCHEDULE.find(x => x.key === it.key); if (!s) return;
    const v = profileVals(s, b.profile); it.interval_hours = v.h; it.interval_months = v.m;
  });
  return state();
});

route('POST', '/api/tracks', b => {
  const name = str(b.name, 120).trim(); if (!name) throw bad('Track name required.');
  D.tracks.push({ id: nextId('tracks'), name, location: str(b.location, 200), kind: str(b.kind || 'MX', 20), length_m: num(b.length_m, { min: 0, max: 1e6 }), notes: str(b.notes) });
  return state();
});
route('PUT', '/api/tracks/:id', (b, p) => {
  const t = D.tracks.find(x => x.id === Number(p.id)); if (!t) throw bad('Track not found.');
  const name = str(b.name, 120).trim(); if (!name) throw bad('Track name required.');
  Object.assign(t, { name, location: str(b.location, 200), kind: str(b.kind || 'MX', 20), length_m: num(b.length_m, { min: 0, max: 1e6 }), notes: str(b.notes) });
  return state();
});
route('DELETE', '/api/tracks/:id', (_, p) => {
  const id = Number(p.id);
  const sids = D.sessions.filter(s => s.track_id === id).map(s => s.id);
  D.tracks = D.tracks.filter(t => t.id !== id);
  D.sessions = D.sessions.filter(s => s.track_id !== id);
  D.laps = D.laps.filter(l => !sids.includes(l.session_id));
  return state();
});
function writeSession(id, b) {
  const track = Number(b.track_id);
  if (!D.tracks.some(t => t.id === track)) throw bad('Pick a track.');
  const laps = (Array.isArray(b.laps) ? b.laps : []).map(Number).filter(n => Number.isFinite(n) && n > 0 && n < 36e5);
  const row = { track_id: track, date: isDate(b.date) ? b.date : today(), hours: num(b.hours, { min: 0, max: 100000 }),
    conditions: str(b.conditions, 300), notes: str(b.notes, 5000), setup: b.setup && typeof b.setup === 'object' ? b.setup : {} };
  if (id) { const s = D.sessions.find(x => x.id === id); if (!s) throw bad('Session not found.'); Object.assign(s, row); D.laps = D.laps.filter(l => l.session_id !== id); }
  else { id = nextId('sessions'); D.sessions.push({ id, ...row }); }
  laps.forEach((ms, i) => D.laps.push({ id: nextId('laps'), session_id: id, lap_no: i + 1, ms: Math.round(ms) }));
}
route('POST', '/api/sessions', b => { writeSession(null, b); return state(); });
route('PUT', '/api/sessions/:id', (b, p) => { writeSession(Number(p.id), b); return state(); });
route('DELETE', '/api/sessions/:id', (_, p) => {
  const id = Number(p.id);
  D.sessions = D.sessions.filter(s => s.id !== id);
  D.laps = D.laps.filter(l => l.session_id !== id);
  return state();
});

route('PUT', '/api/settings', b => { saveSettings(b); return state(); });

route('POST', '/api/bike-image/:brand', async (b, p) => {
  if (!BRANDS.includes(p.brand)) throw bad('Unknown look.');
  const url = String(b.dataUrl || '');
  if (!/^data:image\/(png|webp|jpeg);base64,/.test(url)) throw bad('Use a PNG, WebP or JPEG image.');
  if (url.length > 11e6) throw bad('Image too large.');
  await idbOp('readwrite', s => s.put(url, p.brand));
  images[p.brand] = url;
  return state();
});
route('DELETE', '/api/bike-image/:brand', async (_, p) => {
  await idbOp('readwrite', s => s.delete(p.brand));
  delete images[p.brand];
  return state();
});

// Backup: everything, including your photos, in one JSON file
route('GET', '/api/export', () => {
  D.lastExport = today();
  const out = { app: 'redline-garage', version: 2, exported: new Date().toISOString(), settings: getSettings(), images: { ...images } };
  TABLES.forEach(t => (out[t] = D[t]));
  return out;
});
route('POST', '/api/import', async b => {
  if (b?.app !== 'redline-garage') throw bad('That isn\'t a Redline Garage backup file.');
  const next = emptyDb();
  next.settings = { ...next.settings, ...(b.settings || {}) };
  delete next.settings.apiKey;
  for (const t of TABLES) {
    next[t] = (b[t] || []).map(r => {
      const row = { ...r };
      if (t === 'sessions' && typeof row.setup === 'string') { try { row.setup = JSON.parse(row.setup); } catch { row.setup = {}; } }
      return row;
    });
  }
  next.lastExport = today();
  D = next;
  seed();
  for (const br of BRANDS) {
    const url = b.images?.[br];
    if (url) { await idbOp('readwrite', s => s.put(url, br)); images[br] = url; }
  }
  return state();
});

// ─── dispatcher ────────────────────────────────────────────────────
export async function handle(method, path, body) {
  const r = routes.find(x => x.method === method && x.re.test(path));
  if (!r) throw bad(`Unknown action: ${method} ${path}`);
  const before = JSON.stringify(D);
  try {
    const out = await r.fn(body || {}, path.match(r.re).groups || {});
    if (method !== 'GET' || path === '/api/export') save();
    return clone(out);
  } catch (e) {
    D = JSON.parse(before); // roll back a half-applied change
    throw e;
  }
}
