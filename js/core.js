/* ============================================================
   Si-MAKO — inti aplikasi (tanpa framework)
   - api(): fetch ke Apps Script, timeout, ulang otomatis, reqId untuk tulis
   - Data: salinan tabel di perangkat (IndexedDB) + sinkron delta dari server
   - View: data turunan siap tampil (dihitung sekali per perubahan)
   - Router: hash (#/halaman/param), halaman dibuat sekali lalu disembunyikan
   ============================================================ */
'use strict';

const CFG = Object.assign({ API_URL: '', APP_NAME: 'Si-MAKO' }, window.SIMAKO_CONFIG || {});
const APP_VER = '1.0.0';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const debounce = (fn, ms) => { let t; return function (...a) { const self = this; clearTimeout(t); t = setTimeout(() => fn.apply(self, a), ms); }; };

/* ---------------- format ---------------- */
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const fmt = {
  num: n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
  dec: n => { const x = Math.round((Number(n) || 0) * 100) / 100; const [a, b] = String(x).split('.'); return fmt.num(a) + (b ? ',' + b : ''); },
  rp: n => (Number(n) < 0 ? '-Rp ' : 'Rp ') + fmt.num(Math.abs(Number(n) || 0)),
  rpShort: n => { n = Number(n) || 0; const a = Math.abs(n); if (a >= 1e9) return 'Rp ' + fmt.dec(n / 1e9).replace(/,(\d)\d*/, ',$1') + ' M'; if (a >= 1e6) return 'Rp ' + (Math.round(n / 1e5) / 10).toString().replace('.', ',') + ' jt'; if (a >= 1e3) return 'Rp ' + Math.round(n / 1e3) + ' rb'; return fmt.rp(n); },
  parseDate: s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; },
  date: s => { const d = fmt.parseDate(s); return d ? d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : '-'; },
  dateShort: s => { const d = fmt.parseDate(s); return d ? d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] : '-'; },
  dateLong: s => { const d = fmt.parseDate(s); return d ? HARI[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear() : '-'; },
  dateTime: iso => { if (!iso) return '-'; const d = new Date(iso); const p = jkParts(d); return +p.day + ' ' + BULAN[+p.month - 1] + ' ' + p.year + ' · ' + p.hour + '.' + p.minute; },
  month: ym => { const [y, m] = String(ym).split('-'); return BULAN_PANJANG[+m - 1] + ' ' + y; },
  wa: w => { w = String(w || ''); if (!w) return ''; let d = w.indexOf('62') === 0 ? '0' + w.slice(2) : w; return d.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3'); },
  initials: n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase()
};
function jkParts(d) {
  const o = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d || new Date()).forEach(p => { o[p.type] = p.value; });
  if (o.hour === '24') o.hour = '00';
  return o;
}
function today() { const p = jkParts(new Date()); return p.year + '-' + p.month + '-' + p.day; }
function addDays(ymd, n) { const d = fmt.parseDate(ymd); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function daysBetween(a, b) { const x = fmt.parseDate(a), y = fmt.parseDate(b); return x && y ? Math.round((y - x) / 864e5) : 0; }
function parseMoney(s) { const n = parseInt(String(s == null ? '' : s).replace(/[^\d]/g, ''), 10); return isFinite(n) ? n : 0; }
function greeting() { const h = +jkParts().hour; return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; }

/* ---------------- penyimpanan perangkat ---------------- */
const IDB = {
  db: null, mem: new Map(),
  open() {
    if (this._p) return this._p;
    this._p = new Promise(res => {
      try {
        const rq = indexedDB.open('simako', 1);
        rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
        rq.onsuccess = () => { this.db = rq.result; res(this.db); };
        rq.onerror = () => res(null);
      } catch (e) { res(null); }
    });
    return this._p;
  },
  async get(k) { const db = await this.open(); if (!db) return this.mem.get(k); return new Promise(res => { try { const rq = db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(undefined); } catch (e) { res(undefined); } }); },
  async set(k, v) { const db = await this.open(); if (!db) { this.mem.set(k, v); return; } return new Promise(res => { try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch (e) { res(); } }); },
  async del(k) { const db = await this.open(); if (!db) { this.mem.delete(k); return; } return new Promise(res => { try { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch (e) { res(); } }); }
};
const LS = {
  get(k, d) { try { const v = localStorage.getItem('simako:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('simako:' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('simako:' + k); } catch (e) {} }
};

/* ---------------- sesi ---------------- */
const Session = {
  get token() { return (LS.get('sess') || {}).token || ''; },
  get me() { return (LS.get('sess') || {}).me || null; },
  set(token, me) { LS.set('sess', { token, me, at: Date.now() }); },
  setToken(token) { const s = LS.get('sess') || {}; s.token = token; LS.set('sess', s); },
  clear() { LS.del('sess'); },
  get owner() { return (this.me || {}).peran === 'pemilik'; }
};

/* ---------------- pengukur kecepatan ---------------- */
const Perf = {
  rows: [],
  add(action, total, server, cached) { this.rows.push({ action, total, server: server == null ? null : server, net: server == null ? null : total - server, at: new Date().toLocaleTimeString() }); if (this.rows.length > 200) this.rows.shift(); },
  table() { console.table(this.rows.slice(-30)); },
  summary() { const g = {}; this.rows.forEach(r => { (g[r.action] = g[r.action] || []).push(r.total); }); console.table(Object.keys(g).map(a => ({ aksi: a, kali: g[a].length, rata_ms: Math.round(g[a].reduce((x, y) => x + y, 0) / g[a].length) }))); }
};
window.Perf = Perf;

/* ---------------- API ---------------- */
const READ_ACTIONS = /^(sync|health|previewNumber|systemStatus|exportAll)$/;
const Net = { online: navigator.onLine !== false, listeners: [] };
function setOnline(v) { if (Net.online === v) return; Net.online = v; Net.listeners.forEach(f => f(v)); }
addEventListener('online', () => setOnline(true));
addEventListener('offline', () => setOnline(false));

async function apiOnce(body, timeout) {
  const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), timeout), t0 = performance.now();
  try {
    const res = await fetch(CFG.API_URL, {
      method: 'POST', redirect: 'follow', cache: 'no-store', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // tanpa CORS preflight
      body: JSON.stringify(body)
    });
    const text = await res.text();
    setOnline(true);
    try { const j = JSON.parse(text); Perf.add(body.action, Math.round(performance.now() - t0), j.ms); return j; }
    catch (e) { return { success: false, network: true, retryable: res.status >= 500 || res.status === 429, message: 'Server membalas tidak wajar (HTTP ' + res.status + '). Periksa alamat API di config.js.' }; }
  } catch (err) {
    if (navigator.onLine === false) setOnline(false);
    return { success: false, network: true, retryable: true, message: err.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Tidak ada koneksi internet.' };
  } finally { clearTimeout(timer); }
}
function waitOnline(ms) { return new Promise(r => { if (navigator.onLine !== false) return r(); const t = setTimeout(done, ms); function done() { clearTimeout(t); removeEventListener('online', done); r(); } addEventListener('online', done); }); }

/**
 * Panggil API. Aksi tulis otomatis membawa reqId (aman diulang) dan versi tabel
 * sehingga jawaban langsung berisi data terbaru → tampilan diperbarui tanpa panggilan kedua.
 */
async function api(action, data, opt = {}) {
  if (!CFG.API_URL) return { success: false, message: 'Alamat API belum diisi di config.js.', code: 'CONFIG' };
  const isRead = READ_ACTIONS.test(action);
  const body = { action, token: opt.token != null ? opt.token : Session.token, data: data || {} };
  if (!isRead) body.reqId = opt.reqId || uid();
  if (opt.vers !== false && Session.token && action !== 'login') body.vers = Data.versPayload();
  const tries = isRead ? 3 : 2;
  let res;
  for (let i = 0; i < tries; i++) {
    if (i) { await sleep(1200 * i); if (navigator.onLine === false) await waitOnline(15000); }
    res = await apiOnce(body, isRead ? (i ? 40000 : 25000) : 90000);
    if (res.success || !res.retryable) break;
  }
  if (res.sync) Data.apply(res.sync);
  if (!res.success && res.code === 'AUTH' && action !== 'login') onSessionExpired();
  return res;
}
function warmUpServer() {
  if (!CFG.API_URL) return;
  const k = 'warm_at'; let last = 0;
  try { last = +sessionStorage.getItem(k) || 0; } catch (e) {}
  if (Date.now() - last < 240000) return;
  try { sessionStorage.setItem(k, Date.now()); } catch (e) {}
  fetch(CFG.API_URL + (CFG.API_URL.indexOf('?') > -1 ? '&' : '?') + 'w=1&t=' + Date.now(), { mode: 'no-cors', cache: 'no-store' }).catch(() => {});
}
function onSessionExpired() {
  if (!Session.token) return;
  Session.clear(); Data.reset();
  UI.toast('Sesi berakhir. Silakan masuk lagi.', 'err');
  go('login');
}

/* ============================================================
   DATA — salinan tabel + sinkron delta
   ============================================================ */
const Data = {
  t: {},            // { tabel: { cols:[], rows: Map(id → objek) } }
  vers: {},         // { tabel: { v: versi, s: cap waktu terbaru } }
  rev: 0, key: '', loaded: false, lastSync: 0, syncing: null,
  listeners: [],
  onChange(fn) { this.listeners.push(fn); },
  reset() { this.t = {}; this.vers = {}; this.rev++; this.loaded = false; this._view = null; this.lastSync = 0; },
  rows(name) { const t = this.t[name]; return t ? Array.from(t.rows.values()) : []; },
  get(name, id) { const t = this.t[name]; return (t && t.rows.get(id)) || null; },
  versPayload() { const o = {}; Object.keys(this.vers).forEach(k => { o[k] = this.vers[k]; }); return o; },
  async load(email) {
    this.key = 'data:' + email;
    const saved = await IDB.get(this.key);
    this.t = {}; this.vers = {};
    if (saved && saved.app === 'simako1' && saved.tables) {
      Object.keys(saved.tables).forEach(name => {
        const tb = saved.tables[name], rows = new Map();
        tb.rows.forEach(r => { const o = {}; tb.cols.forEach((c, i) => { o[c] = r[i]; }); rows.set(o.id, o); });
        this.t[name] = { cols: tb.cols, rows };
      });
      this.vers = saved.vers || {};
    }
    this.loaded = true; this.rev++; this._view = null;
    return !!saved;
  },
  save: debounce(function () {
    if (!this.key) return;
    const tables = {};
    Object.keys(this.t).forEach(name => { const tb = this.t[name]; tables[name] = { cols: tb.cols, rows: Array.from(tb.rows.values()).map(o => tb.cols.map(c => o[c])) }; });
    IDB.set(this.key, { app: 'simako1', at: Date.now(), vers: this.vers, tables });
  }, 600),
  /** Gabungkan jawaban sinkron server. */
  apply(sync) {
    if (!sync || !sync.tables) return;
    let changed = false;
    Object.keys(sync.tables).forEach(name => {
      const tb = sync.tables[name];
      let cur = this.t[name];
      if (tb.mode === 'full' || !cur) { cur = this.t[name] = { cols: tb.cols, rows: new Map() }; }
      const iu = tb.cols.indexOf('diubah_pada');
      let maxS = tb.mode === 'full' ? '' : ((this.vers[name] || {}).s || '');
      tb.rows.forEach(r => {
        const o = cur.rows.get(r[0]) || {};
        tb.cols.forEach((c, i) => { o[c] = r[i]; });
        cur.rows.set(o.id, o);
        if (iu > -1 && r[iu] > maxS) maxS = r[iu];
      });
      cur.cols = tb.cols;
      this.vers[name] = { v: sync.vers[name], s: maxS };
      changed = true;
    });
    Object.keys(sync.vers || {}).forEach(name => { if (this.vers[name]) this.vers[name].v = sync.vers[name]; else this.vers[name] = { v: sync.vers[name], s: '' }; });
    // tabel yang tidak lagi boleh dilihat peran ini → buang
    Object.keys(this.t).forEach(name => { if (!(name in (sync.vers || {}))) { delete this.t[name]; delete this.vers[name]; changed = true; } });
    this.lastSync = Date.now();
    if (changed) { this.rev++; this._view = null; this.save(); this.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); }
  },
  /** Ambil perubahan dari server. fresh = umur maksimum data (ms). */
  async refresh(opt = {}) {
    if (!Session.token) return;
    if (!opt.force && Date.now() - this.lastSync < (opt.fresh || 30000)) return;
    if (this.syncing) return this.syncing;
    this.syncing = api('sync', {}).finally(() => { this.syncing = null; });
    const r = await this.syncing;
    if (r && r.success && r.data && r.data.me) { Session.set(Session.token, r.data.me); }
    return r;
  },
  /** Ubah lokal sementara (optimistic) — dipakai untuk pindah tahap. */
  patchLocal(name, id, patch) { const o = this.get(name, id); if (!o) return null; const prev = Object.assign({}, o); Object.assign(o, patch); this.rev++; this._view = null; this.listeners.forEach(f => f()); return prev; },
  view() { if (!this._view) this._view = buildView(); return this._view; }
};

/* ---------------- data turunan ---------------- */
const STAGE_SHORT = { diterima: 'Diterima', potong: 'Potong', jahit: 'Jahit', sablon: 'Sablon', qc: 'QC', packing: 'Packing', diambil: 'Diambil' };
const STAGE_ICON = { diterima: 'clipboard-list', potong: 'scissors', jahit: 'shirt', sablon: 'palette', qc: 'badge-check', packing: 'package', diambil: 'hand-helping' };
const PAY_LABEL = { belum_bayar: 'Belum bayar', uang_muka: 'Uang muka', lunas: 'Lunas' };

function buildView() {
  const T = n => Data.rows(n);
  const settings = {}; T('Pengaturan').forEach(r => { settings[r.kunci] = r.nilai; });
  try { settings.rekeningList = JSON.parse(settings.rekening || '[]'); } catch (e) { settings.rekeningList = []; }
  const stagesAll = T('Tahap').sort((a, b) => a.urut - b.urut);
  const stages = stagesAll.filter(s => s.aktif);
  const stageMap = {}; stagesAll.forEach(s => { stageMap[s.kode] = s; });
  const readyStage = (() => { const i = stages.findIndex(s => s.kode === 'diambil'); return i > 0 ? stages[i - 1].kode : 'packing'; })();
  const sizeTypesAll = T('JenisUkuran').sort((a, b) => a.urut - b.urut);
  const sizeTypes = sizeTypesAll.filter(j => j.aktif);
  const sizeTypeMap = {}; sizeTypesAll.forEach(j => { j.sizes = String(j.daftar_ukuran || '').split(',').map(s => s.trim()).filter(Boolean); sizeTypeMap[j.id] = j; });
  const customers = {}; T('Pelanggan').forEach(c => { customers[c.id] = c; });
  const ukByBarang = {}; T('PesananUkuran').forEach(u => { if (!u.dihapus) (ukByBarang[u.barang_id] = ukByBarang[u.barang_id] || []).push(u); });
  const brByOrder = {}; T('PesananBarang').forEach(b => { if (!b.dihapus) (brByOrder[b.pesanan_id] = brByOrder[b.pesanan_id] || []).push(b); });
  const payByOrder = {}; T('Pembayaran').forEach(p => { (payByOrder[p.pesanan_id] = payByOrder[p.pesanan_id] || []).push(p); });
  const histByOrder = {}; T('RiwayatTahap').forEach(h => { (histByOrder[h.pesanan_id] = histByOrder[h.pesanan_id] || []).push(h); });
  const t0 = today();
  const orders = T('Pesanan').map(o => {
    const items = (brByOrder[o.id] || []).sort((a, b) => a.urut - b.urut).map(b => Object.assign({}, b, { sizes: (ukByBarang[b.id] || []).sort((a, c) => a.urut - c.urut), sizeType: sizeTypeMap[b.jenis_ukuran_id] }));
    const pcs = items.reduce((a, b) => a + (b.qty_total || 0), 0);
    const pays = (payByOrder[o.id] || []).slice().sort((a, b) => (a.tgl + a.dibuat_pada < b.tgl + b.dibuat_pada ? -1 : 1));
    const hist = (histByOrder[o.id] || []).slice().sort((a, b) => (a.waktu < b.waktu ? 1 : -1));
    const done = o.tahap === 'diambil' || o.batal;
    const ready = o.tahap === readyStage;
    const days = daysBetween(t0, o.tenggat);
    let dl;
    if (o.batal) dl = { cls: 'dl-ok', label: 'Dibatalkan', tone: 'ok' };
    else if (o.tahap === 'diambil') dl = { cls: 'dl-done', label: 'Selesai', tone: 'done' };
    else if (ready) dl = { cls: 'dl-done', label: 'Siap diambil', tone: 'done' };
    else if (days < 0) dl = { cls: 'dl-late', label: 'Telat ' + (-days) + ' hari', tone: 'late' };
    else if (days === 0) dl = { cls: 'dl-today', label: 'Hari ini', tone: 'today' };
    else if (days === 1) dl = { cls: 'dl-soon', label: 'Besok', tone: 'soon' };
    else if (days <= 3) dl = { cls: 'dl-soon', label: days + ' hari lagi', tone: 'soon' };
    else dl = { cls: 'dl-ok', label: days + ' hari lagi', tone: 'ok' };
    const finishH = hist.find(h => h.ke_tahap === readyStage || h.ke_tahap === 'diambil');
    const summary = items.map(b => b.jenis).join(', ');
    return Object.assign({}, o, { cust: customers[o.pelanggan_id] || { nama: '(pelanggan dihapus)', wa: '' }, items, pcs, pays, hist, days, dl, done, ready, summary,
      finishedAt: finishH ? finishH.waktu.slice(0, 10) : '', search: (o.no_nota + ' ' + ((customers[o.pelanggan_id] || {}).nama || '') + ' ' + ((customers[o.pelanggan_id] || {}).wa || '') + ' ' + summary).toLowerCase() });
  });
  const ordersById = {}; orders.forEach(o => { ordersById[o.id] = o; });
  const live = orders.filter(o => !o.batal);
  const active = live.filter(o => o.tahap !== 'diambil');
  const unpaid = live.filter(o => o.sisa > 0);
  const custStats = {};
  live.forEach(o => { const s = custStats[o.pelanggan_id] = custStats[o.pelanggan_id] || { count: 0, utang: 0, total: 0, last: '' }; s.count++; s.utang += o.sisa; s.total += o.total; if (o.tgl_pesan > s.last) s.last = o.tgl_pesan; });
  const materials = T('Bahan').filter(b => b.aktif).sort((a, b) => a.nama.localeCompare(b.nama));
  const lowStock = materials.filter(b => b.stok <= b.minimum);
  return {
    settings, stages, stagesAll, stageMap, readyStage, sizeTypes, sizeTypesAll, sizeTypeMap, customers, custStats,
    orders, ordersById, live, active, unpaid, materials, lowStock,
    priceRefs: T('DaftarHarga').filter(p => p.aktif).sort((a, b) => a.nama.localeCompare(b.nama)),
    users: T('Pengguna'),
    payments: T('Pembayaran').filter(p => !p.batal && ordersById[p.pesanan_id] && !ordersById[p.pesanan_id].batal),
    expenses: T('UangKeluar').filter(x => !x.batal),
    numbering: T('Penomoran').find(n => n.kunci === 'nota')
  };
}
function stageName(kode) { const s = Data.view().stageMap[kode]; return s ? s.nama : (STAGE_SHORT[kode] || kode); }
function nextStageOf(o) {
  const V = Data.view(), list = V.stages, i = list.findIndex(s => s.kode === o.tahap);
  for (let j = i + 1; j < list.length; j++) { if (list[j].kode === 'sablon' && !o.pakai_sablon) continue; return list[j].kode; }
  return null;
}

/* ============================================================
   ROUTER
   ============================================================ */
const Pages = {};
const Router = { cur: null, param: null, query: {}, prevHash: '' };
function registerPage(name, def) { Pages[name] = Object.assign({ auth: 'user', nav: name, live: true }, def); }
function go(name, param, query) {
  let h = '#/' + name + (param ? '/' + encodeURIComponent(param) : '');
  if (query) { const q = new URLSearchParams(query).toString(); if (q) h += '?' + q; }
  if (location.hash === h) route(); else location.hash = h;
}
function back(fallback) { if (history.length > 1 && Router.prevHash) history.back(); else go(fallback || 'beranda'); }
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const [name, ...rest] = path.split('/');
  return { name: name || '', param: rest.length ? decodeURIComponent(rest.join('/')) : null, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}
function route() {
  UI.closeAll();
  const { name, param, query } = parseHash();
  const logged = !!Session.token;
  let pname = Pages[name] ? name : (logged ? 'beranda' : 'login');
  let def = Pages[pname];
  if (def.auth !== 'guest' && !logged) { pname = 'login'; def = Pages.login; }
  if (def.auth === 'guest' && logged && pname === 'login') { pname = 'beranda'; def = Pages.beranda; }
  if (def.auth === 'owner' && !Session.owner) { UI.toast('Menu ini khusus Pemilik.', 'err'); pname = 'beranda'; def = Pages.beranda; }
  const samePage = Router.cur === pname && Router.param === param;
  Router.prevHash = Router.curHash || ''; Router.curHash = location.hash;
  Router.cur = pname; Router.param = param; Router.query = query;
  Shell.render(pname, def);
  const host = $('#pages');
  let el = host.querySelector('.page[data-page="' + pname + '"]');
  if (!el) { el = document.createElement('section'); el.className = 'page' + (def.flush ? ' flush' : ''); el.dataset.page = pname; host.appendChild(el); }
  $$('.page', host).forEach(p => { p.hidden = p !== el; });
  try { def.render(el, param, query); } catch (e) { console.error(e); el.innerHTML = UI.errorBox('Halaman gagal ditampilkan: ' + e.message); }
  def._dirty = false;
  if (!samePage) window.scrollTo(0, 0);
  document.title = (def.title ? (typeof def.title === 'function' ? def.title(param) : def.title) + ' · ' : '') + CFG.APP_NAME;
}
/** Data berubah → render ulang halaman yang tampil (kecuali halaman form). */
Data.onChange(() => {
  const def = Pages[Router.cur];
  Shell.updateBadges();
  if (!def) return;
  if (def.live === false) { if (def.onData) def.onData(); return; }
  const el = $('#pages .page[data-page="' + Router.cur + '"]');
  if (!el || el.hidden) return;
  const y = window.scrollY;
  try { def.render(el, Router.param, Router.query); } catch (e) { console.error(e); }
  window.scrollTo(0, y);
});
addEventListener('hashchange', route);

/* ---------------- aktivitas & sinkron berkala ---------------- */
const Activity = {
  at: Date.now(),
  init() { ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(ev => addEventListener(ev, () => { this.at = Date.now(); }, { passive: true })); },
  idle() { return Date.now() - this.at > 120000; }
};
function startBackgroundSync() {
  setInterval(() => {
    if (!Session.token || document.visibilityState !== 'visible') return;
    Data.refresh({ fresh: Activity.idle() ? 300000 : 60000 });   // aktif: tiap 1 menit, diam: tiap 5 menit
  }, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && Session.token) Data.refresh({ fresh: 30000 }); });
}
