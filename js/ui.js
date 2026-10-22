/* ============================================================
   Si-MAKO — komponen tampilan: ikon, toast, lembar (modal), konfirmasi,
   pil status, kerangka aplikasi (menu samping, atas, bawah)
   ============================================================ */
'use strict';

function ic(name, cls) {
  const b = (window.ICONS || {})[name];
  if (!b) { console.warn('Ikon hilang:', name); return '<span class="' + (cls || 'ico') + '"></span>'; }
  return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + b + '</svg>';
}

const UI = {
  /* ---------- toast ---------- */
  toast(msg, type) {
    const box = $('#toasts'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (type || 'ok'); el.setAttribute('role', type === 'err' ? 'alert' : 'status');
    el.innerHTML = ic(type === 'err' ? 'circle-alert' : 'circle-check') + '<div>' + esc(msg) + '</div>';
    box.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 260); }, type === 'err' ? 5000 : 2800);
  },
  /* ---------- lembar bawah / dialog ---------- */
  stack: [],
  sheet(o) {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = '<div class="sheet ' + (o.cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="sh-t">' +
      '<div class="grab"></div>' +
      '<div class="sheet-head"><div class="grow"><h2 id="sh-t">' + (o.icon ? '<span class="row">' + ic(o.icon, 'ico-lg') + esc(o.title) + '</span>' : esc(o.title)) + '</h2>' + (o.sub ? '<p>' + esc(o.sub) + '</p>' : '') + '</div>' +
      '<button class="btn btn-icon btn-soft" data-x aria-label="Tutup">' + ic('x') + '</button></div>' +
      '<div class="sheet-body">' + (o.body || '') + '</div>' +
      (o.foot ? '<div class="sheet-foot">' + o.foot + '</div>' : '') + '</div>';
    document.body.appendChild(ov);
    document.body.classList.add('modal-open');
    const api = {
      el: ov.querySelector('.sheet'), body: ov.querySelector('.sheet-body'), foot: ov.querySelector('.sheet-foot'), closed: false,
      close(val) {
        if (api.closed) return; api.closed = true;
        ov.remove(); UI.stack = UI.stack.filter(x => x !== api);
        if (!UI.stack.length) document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', onKey);
        if (api._prevFocus && api._prevFocus.focus) try { api._prevFocus.focus(); } catch (e) {}
        o.onClose && o.onClose(val);
      }
    };
    api._prevFocus = document.activeElement;
    const onKey = e => { if (e.key === 'Escape' && UI.stack[UI.stack.length - 1] === api) api.close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', e => { if (e.target === ov && o.dismiss !== false) api.close(); });
    ov.querySelector('[data-x]').addEventListener('click', () => api.close());
    UI.stack.push(api);
    setTimeout(() => { const f = ov.querySelector('[autofocus]') || ov.querySelector('[data-x]'); f && f.focus({ preventScroll: true }); }, 30);
    return api;
  },
  closeAll() { UI.stack.slice().forEach(s => s.close()); $$('.menu-pop').forEach(m => m.remove()); },
  confirm(o) {
    return new Promise(res => {
      const s = UI.sheet({ title: o.title, cls: 'dialog', body: '<p>' + (o.html || esc(o.msg || '')) + '</p>',
        foot: '<button class="btn btn-ghost" data-no>' + esc(o.cancel || 'Batal') + '</button><button class="btn ' + (o.danger ? 'btn-danger' : 'btn-primary') + '" data-yes>' + esc(o.ok || 'Ya, lanjutkan') + '</button>',
        onClose: v => res(v === true) });
      s.foot.querySelector('[data-no]').onclick = () => s.close(false);
      s.foot.querySelector('[data-yes]').onclick = () => s.close(true);
    });
  },
  /** Minta satu isian teks pendek. */
  prompt(o) {
    return new Promise(res => {
      const s = UI.sheet({ title: o.title, cls: 'dialog', body: (o.msg ? '<p class="muted mb12">' + esc(o.msg) + '</p>' : '') + '<div class="field"><label for="pr-in">' + esc(o.label || '') + '</label><input id="pr-in" class="input" autofocus value="' + esc(o.value || '') + '" placeholder="' + esc(o.placeholder || '') + '" ' + (o.inputmode ? 'inputmode="' + o.inputmode + '"' : '') + ' maxlength="' + (o.max || 200) + '"><div class="err" data-perr hidden></div></div>',
        foot: '<button class="btn btn-ghost" data-no>Batal</button><button class="btn btn-primary" data-yes>' + esc(o.ok || 'Simpan') + '</button>', onClose: v => res(typeof v === 'string' ? v : null) });
      const inp = s.body.querySelector('input'), err = s.body.querySelector('[data-perr]');
      const done = () => {
        const v = inp.value.trim();
        if (!v && o.required !== false) { inp.classList.add('invalid'); inp.focus(); return; }
        if (o.min && v.length < o.min) { inp.classList.add('invalid'); err.textContent = o.minMsg || ('Minimal ' + o.min + ' karakter.'); err.hidden = false; inp.focus(); return; }
        s.close(v);
      };
      inp.addEventListener('input', () => { inp.classList.remove('invalid'); err.hidden = true; });
      s.foot.querySelector('[data-no]').onclick = () => s.close(null);
      s.foot.querySelector('[data-yes]').onclick = done;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
    });
  },
  /** Menu tarik-turun kecil di dekat tombol. */
  menu(anchor, items) {
    $$('.menu-pop').forEach(m => m.remove());
    const pop = document.createElement('div'); pop.className = 'menu-pop'; pop.setAttribute('role', 'menu');
    pop.innerHTML = items.filter(Boolean).map((it, i) => '<button role="menuitem" data-i="' + i + '" class="' + (it.danger ? 'danger' : '') + '">' + ic(it.icon || 'chevron-right') + esc(it.label) + '</button>').join('');
    const rc = anchor.getBoundingClientRect();
    if (window.innerHeight - rc.bottom < 180 && rc.top > 180) pop.classList.add('up');
    const wrap = anchor.closest('.rel') || anchor.parentElement; wrap.classList.add('rel'); wrap.appendChild(pop);
    const list = items.filter(Boolean);
    pop.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pop.remove(); list[+b.dataset.i].run(); });
    setTimeout(() => document.addEventListener('click', function off(e) { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('click', off); } }), 0);
    pop.querySelector('button') && pop.querySelector('button').focus();
  },
  /** Tombol sibuk selama promise berjalan. */
  async busy(btn, fn) {
    if (!btn || btn.classList.contains('busy')) return;
    const html = btn.innerHTML; btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true');
    btn.innerHTML = '<span class="spin"></span>' + '<span>Menyimpan…</span>';
    try { return await fn(); } finally { btn.classList.remove('busy'); btn.removeAttribute('aria-busy'); if (btn.isConnected) btn.innerHTML = html; }
  },
  errorBox(msg, retry) { return '<div class="empty"><div class="icon-box red">' + ic('wifi-off', 'ico-lg') + '</div><b>Data belum bisa dimuat</b><div>' + esc(msg) + '</div>' + (retry ? '<button class="btn btn-primary mt16" data-retry>' + ic('refresh-cw') + 'Coba lagi</button>' : '') + '</div>'; },
  empty(icon, title, text, action) { return '<div class="empty"><div class="icon-box">' + ic(icon, 'ico-lg') + '</div><b>' + esc(title) + '</b><div>' + esc(text || '') + '</div>' + (action || '') + '</div>'; },
  skeleton(n) { let s = ''; for (let i = 0; i < (n || 3); i++) s += '<div class="sk" style="height:84px;margin-bottom:10px"></div>'; return s; },
  /* ---------- pil ---------- */
  stage(kode, batal) { if (batal) return '<span class="pill st-batal">Dibatalkan</span>'; return '<span class="pill st-' + esc(kode) + '"><span class="dot"></span>' + esc(stageName(kode)) + '</span>'; },
  pay(s) { return '<span class="pill pay-' + esc(s) + '">' + esc(PAY_LABEL[s] || s) + '</span>'; },
  dl(o) { return '<span class="dl ' + o.dl.cls + '">' + esc(o.dl.label) + '</span>'; },
  sizesTags(item) { return item.sizes.map(s => '<span class="tag">' + esc(s.ukuran === 'All size' ? 'All size' : s.ukuran) + ': ' + fmt.num(s.qty) + '</span>').join(' '); },
  waLink(wa, text) { if (!wa) return ''; return 'https://wa.me/' + encodeURIComponent(wa) + (text ? '?text=' + encodeURIComponent(text) : ''); }
};

/* ---------- isian uang: titik ribuan otomatis ---------- */
function bindMoney(input, onChange) {
  const f = () => {
    const pos = input.value.length - input.selectionStart;
    const n = parseMoney(input.value);
    input.value = n ? fmt.num(n) : '';
    try { const p = Math.max(input.value.length - pos, 0); input.setSelectionRange(p, p); } catch (e) {}
    onChange && onChange(n);
  };
  input.addEventListener('input', f);
}
/* ---------- kompres foto sebelum diunggah ---------- */
async function readImage(file, maxSide, quality) {
  if (!file) return null;
  if (file.type === 'application/pdf') {
    if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran PDF lebih dari 5 MB.');
    return { name: file.name, mime: file.type, b64: await new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.onerror = j; fr.readAsDataURL(file); }), size: file.size };
  }
  if (!/^image\//.test(file.type)) throw new Error('Pilih foto (JPG/PNG) atau PDF.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((r, j) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => j(new Error('Foto tidak bisa dibaca.')); im.src = url; });
    const sc = Math.min(1, (maxSide || 1600) / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    const isPng = file.type === 'image/png' && maxSide && maxSide <= 400;
    const dataUrl = c.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality || 0.8);
    const b64 = dataUrl.split(',')[1];
    if (b64.length * 0.75 > 5 * 1024 * 1024) throw new Error('Ukuran foto lebih dari 5 MB.');
    return { name: file.name.replace(/\.\w+$/, '') + (isPng ? '.png' : '.jpg'), mime: isPng ? 'image/png' : 'image/jpeg', b64, dataUrl, size: Math.round(b64.length * 0.75) };
  } finally { URL.revokeObjectURL(url); }
}
function loadScript(src) {
  return new Promise((res, rej) => {
    if ($('script[src="' + src + '"]')) return res();
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src)); document.head.appendChild(s);
  });
}
function download(name, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

/* ============================================================
   KERANGKA APLIKASI
   ============================================================ */
const NAV = [
  { sec: 'Operasional' },
  { id: 'beranda', label: 'Beranda', icon: 'layout-dashboard', href: '#/beranda' },
  { id: 'pesanan', label: 'Pesanan', icon: 'receipt-text', href: '#/pesanan', badge: 'active' },
  { id: 'produksi', label: 'Produksi', icon: 'kanban', href: '#/produksi' },
  { id: 'pelanggan', label: 'Pelanggan', icon: 'users', href: '#/pelanggan' },
  { sec: 'Manajemen' },
  { id: 'keuangan', label: 'Keuangan', icon: 'wallet', href: '#/keuangan', owner: true },
  { id: 'hitung-modal', label: 'Hitung Modal', icon: 'calculator', href: '#/hitung-modal', owner: true },
  { id: 'stok', label: 'Stok Bahan', icon: 'boxes', href: '#/stok', badge: 'stock' },
  { id: 'laporan', label: 'Laporan', icon: 'chart-column', href: '#/laporan', owner: true }
];
const BNAV = [
  { id: 'beranda', label: 'Beranda', icon: 'house', href: '#/beranda' },
  { id: 'pesanan', label: 'Pesanan', icon: 'receipt-text', href: '#/pesanan', badge: 'active' },
  { id: 'pelanggan', label: 'Pelanggan', icon: 'users', href: '#/pelanggan' },
  { id: 'lainnya', label: 'Lainnya', icon: 'layout-grid', href: '#/lainnya' }
];

const Shell = {
  built: false,
  build() {
    const app = $('#app');
    app.innerHTML =
      '<aside class="sidebar" aria-label="Menu utama"><div class="side-brand"><div class="logo-mark">SM</div><div class="bt"><b>Si-MAKO</b><span id="side-biz">Konveksi</span></div>' +
      '<button class="btn btn-icon side-toggle" id="side-toggle" aria-label="Lebarkan menu">' + ic('panel-left') + '</button></div>' +
      '<nav id="side-nav"></nav><div class="side-foot"><nav class="side-nav">' +
      '<a href="#/lainnya" data-nav="lainnya">' + ic('settings') + '<span>Pengaturan</span></a>' +
      '<a href="#" class="danger" id="side-logout">' + ic('log-out') + '<span>Keluar</span></a></nav></div></aside>' +
      '<div class="main"><div id="offline" class="offline" hidden>Tidak ada internet — menampilkan data tersimpan di perangkat.</div>' +
      '<header class="topbar"><div class="search rel" style="flex:1;max-width:520px">' + ic('search') + '<input id="gsearch" class="input" type="search" placeholder="Cari pesanan, nota, pelanggan…" autocomplete="off" aria-label="Cari"></div>' +
      '<div class="rel" style="margin-left:auto"><button class="user-chip" id="user-chip"><span class="avatar" id="u-av">?</span><span><b id="u-nm">-</b><span id="u-rl">-</span></span>' + ic('chevron-down', 'ico-sm') + '</button></div></header>' +
      '<header class="mtop m-only" id="mtop"></header><div id="pages"></div></div>' +
      '<nav class="bnav" id="bnav" aria-label="Menu bawah"></nav>';
    $('#side-logout').onclick = e => { e.preventDefault(); logout(); };
    $('#side-toggle').onclick = () => { app.classList.toggle('side-open'); LS.set('sideOpen', app.classList.contains('side-open')); };
    if (LS.get('sideOpen')) app.classList.add('side-open');
    $('#user-chip').onclick = e => UI.menu(e.currentTarget, [
      { label: 'Ubah sandi', icon: 'key-round', run: () => go('akun') },
      { label: 'Pengaturan', icon: 'settings', run: () => go('lainnya') },
      { label: 'Keluar', icon: 'log-out', danger: true, run: logout }
    ]);
    bindGlobalSearch($('#gsearch'));
    Net.listeners.push(v => { $('#offline').hidden = v; });
    $('#offline').hidden = Net.online;
    this.built = true;
  },
  render(pname, def) {
    const app = $('#app');
    if (def.auth === 'guest' || def.bare) { if (this.built || !$('#pages')) app.innerHTML = '<div id="pages"></div>'; this.built = false; app.className = 'app bare'; return; }
    if (!this.built) this.build();
    app.classList.remove('bare');
    app.classList.toggle('no-bnav', !!(typeof def.hideNav === 'function' ? def.hideNav(Router.param) : def.hideNav));
    const owner = Session.owner, me = Session.me || {};
    const V = Data.view();
    let nav = '', open = false;
    const items = NAV.filter(n => !n.owner || owner);
    items.forEach((n, i) => {
      if (n.sec) { if (open) nav += '</nav>'; open = false; if (items[i + 1] && !items[i + 1].sec) { nav += '<div class="side-sec">' + n.sec + '</div><nav class="side-nav">'; open = true; } return; }
      nav += '<a href="' + n.href + '" data-nav="' + n.id + '" title="' + n.label + '">' + ic(n.icon) + '<span>' + n.label + '</span>' + (n.badge ? '<em class="badge ' + (n.badge === 'active' ? 'blue' : '') + '" data-badge="' + n.badge + '" hidden></em>' : '') + '</a>';
    });
    if (open) nav += '</nav>';
    $('#side-nav').innerHTML = nav;
    $('#bnav').innerHTML = BNAV.map(n => '<a href="' + n.href + '" data-nav="' + n.id + '"><span class="pillwrap">' + ic(n.icon) + '</span>' + n.label + (n.badge ? '<em class="badge" data-badge="' + n.badge + '" hidden></em>' : '') + '</a>').join('');
    const navId = typeof def.nav === 'function' ? def.nav() : def.nav;
    $$('[data-nav]').forEach(a => { a.classList.toggle('on', a.dataset.nav === navId); if (a.dataset.nav === navId) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#u-av').textContent = fmt.initials(me.nama); $('#u-nm').textContent = me.nama || '-'; $('#u-rl').textContent = me.peran === 'pemilik' ? 'Pemilik' : 'Admin';
    $('#side-biz').textContent = V.settings.nama_usaha || 'Konveksi';
    // header HP
    const h = def.header ? def.header(Router.param) : null;
    const mt = $('#mtop');
    if (h) {
      mt.innerHTML = (h.back !== false ? '<button class="btn btn-icon" data-back aria-label="Kembali">' + ic('arrow-left') + '</button>' : '') +
        '<div class="title"><b>' + esc(h.title) + '</b>' + (h.sub ? '<span>' + esc(h.sub) + '</span>' : '') + '</div>' + (h.actions || '');
      const b = mt.querySelector('[data-back]'); if (b) b.onclick = () => back(h.back || 'beranda');
    } else {
      mt.innerHTML = '<div class="title brand"><b>Si-MAKO</b><span>' + esc(V.settings.nama_usaha || 'Konveksi') + '</span></div>' +
        '<button class="btn btn-icon" data-gsearch aria-label="Cari">' + ic('search') + '</button>' +
        '<a class="avatar" href="#/lainnya" aria-label="Akun">' + esc(fmt.initials(me.nama)) + '</a>';
      mt.querySelector('[data-gsearch]').onclick = () => openSearchSheet();
    }
    this.updateBadges();
  },
  updateBadges() {
    if (!this.built) return;
    const V = Data.view();
    const vals = { active: V.active.length, stock: V.lowStock.length };
    $$('[data-badge]').forEach(b => { const v = vals[b.dataset.badge] || 0; b.hidden = !v; b.textContent = v > 99 ? '99+' : v; });
  }
};

/* ---------- pencarian global ---------- */
function searchAll(q) {
  q = q.trim().toLowerCase(); if (!q) return { orders: [], customers: [] };
  const V = Data.view();
  const orders = V.orders.filter(o => o.search.indexOf(q) > -1).sort((a, b) => (a.tgl_pesan < b.tgl_pesan ? 1 : -1)).slice(0, 6);
  const qd = q.replace(/\D/g, '');
  const customers = Object.values(V.customers).filter(c => c.nama.toLowerCase().indexOf(q) > -1 || (qd.length > 3 && String(c.wa).indexOf(qd.replace(/^0/, '')) > -1)).slice(0, 4);
  return { orders, customers };
}
function searchResultsHtml(r) {
  if (!r.orders.length && !r.customers.length) return '<div class="empty" style="padding:20px">Tidak ditemukan.</div>';
  return '<div class="list">' +
    r.orders.map(o => '<a class="li" href="#/pesanan/' + o.id + '"><div class="icon-box sm">' + ic('receipt-text', 'ico-sm') + '</div><div class="grow"><div class="semi ellipsis">' + esc(o.cust.nama) + '</div><div class="small muted ellipsis">' + esc(o.no_nota) + ' · ' + esc(o.summary) + '</div></div>' + UI.stage(o.tahap, o.batal) + '</a>').join('') +
    r.customers.map(c => '<a class="li" href="#/pelanggan/' + c.id + '"><div class="icon-box sm green">' + ic('user', 'ico-sm') + '</div><div class="grow"><div class="semi ellipsis">' + esc(c.nama) + '</div><div class="small muted">' + esc(fmt.wa(c.wa) || 'Tanpa no. WA') + '</div></div></a>').join('') + '</div>';
}
function bindGlobalSearch(inp) {
  let pop;
  const close = () => { if (pop) { pop.remove(); pop = null; } };
  inp.addEventListener('input', debounce(() => {
    close(); if (!inp.value.trim()) return;
    pop = document.createElement('div'); pop.className = 'menu-pop'; pop.style.left = '0'; pop.style.right = 'auto'; pop.style.width = '100%'; pop.style.padding = '0';
    pop.innerHTML = searchResultsHtml(searchAll(inp.value));
    inp.parentElement.appendChild(pop);
    pop.addEventListener('click', e => { if (e.target.closest('a')) { inp.value = ''; close(); } });
  }, 200));
  inp.addEventListener('keydown', e => { if (e.key === 'Escape') { inp.value = ''; close(); } if (e.key === 'Enter') { go('pesanan', null, { q: inp.value.trim() }); inp.value = ''; close(); } });
  document.addEventListener('click', e => { if (pop && !inp.parentElement.contains(e.target)) close(); });
}
function openSearchSheet() {
  const s = UI.sheet({ title: 'Cari', body: '<div class="search">' + ic('search') + '<input class="input" type="search" placeholder="Nama, no. nota, atau no. WA" autofocus id="ss-in"></div><div id="ss-res" class="mt12"></div>' });
  const inp = s.body.querySelector('#ss-in'), out = s.body.querySelector('#ss-res');
  inp.addEventListener('input', debounce(() => { out.innerHTML = inp.value.trim() ? '<div class="card">' + searchResultsHtml(searchAll(inp.value)) + '</div>' : ''; }, 150));
  out.addEventListener('click', e => { if (e.target.closest('a')) s.close(); });
}
async function logout() {
  const ok = await UI.confirm({ title: 'Keluar dari akun?', msg: 'Data tersimpan di perangkat ini akan dihapus. Anda perlu masuk lagi dengan email dan sandi.', ok: 'Keluar', danger: true });
  if (!ok) return;
  const me = Session.me;
  Session.clear(); Data.reset();
  if (me) IDB.del('data:' + me.email);
  LS.del('draft');
  go('login');
}
