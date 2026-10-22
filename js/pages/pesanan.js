/* ============================================================
   PESANAN — daftar (F-03) & papan produksi (F-08)
   ============================================================ */
'use strict';

const PER_PAGE = 50;
function setQuery(q) {
  const { name, param } = parseHash();
  const qs = new URLSearchParams(Object.entries(q).filter(([, v]) => v !== '' && v != null)).toString();
  history.replaceState(null, '', '#/' + name + (param ? '/' + encodeURIComponent(param) : '') + (qs ? '?' + qs : ''));
  Router.query = q; Router.curHash = location.hash;
}
function viewSwitch(on) {
  return '<div class="seg" style="max-width:360px"><button data-view="pesanan" class="' + (on === 'pesanan' ? 'on' : '') + '">' + '<span class="row" style="justify-content:center">' + ic('list', 'ico-sm') + 'Daftar</span></button>' +
    '<button data-view="produksi" class="' + (on === 'produksi' ? 'on' : '') + '"><span class="row" style="justify-content:center">' + ic('kanban', 'ico-sm') + 'Papan produksi</span></button></div>';
}
function filterOrders(V, q) {
  let list = q.f === 'batal' ? V.orders.filter(o => o.batal) : V.live;
  if (q.f === 'belum') list = list.filter(o => o.sisa > 0);
  else if (q.f === 'aktif') list = list.filter(o => o.tahap !== 'diambil');
  else if (q.f && q.f !== 'semua' && q.f !== 'batal') list = list.filter(o => o.tahap === q.f);
  if (q.q) { const s = q.q.toLowerCase(); list = list.filter(o => o.search.indexOf(s) > -1); }
  const sort = q.s || (q.f === 'belum' ? 'sisa' : 'baru');
  const cmp = {
    baru: (a, b) => (a.tgl_pesan + a.dibuat_pada < b.tgl_pesan + b.dibuat_pada ? 1 : -1),
    tenggat: (a, b) => (a.tenggat < b.tenggat ? -1 : a.tenggat > b.tenggat ? 1 : 0),
    sisa: (a, b) => b.sisa - a.sisa
  }[sort] || (() => 0);
  return list.slice().sort(cmp);
}

registerPage('pesanan', {
  title: 'Pesanan', nav: 'pesanan',
  render(el, param, query) {
    if (needData(el)) { el.dataset.built = ''; return; }
    const V = Data.view();
    const q = Object.assign({ f: 'semua', q: '', p: '1' }, query || {});
    if (el.dataset.built !== '1') {
      el.dataset.built = '1';
      el.innerHTML = pageHead('Pesanan', 'Semua pesanan, rincian ukuran, dan status pembayaran.',
        '<button class="btn btn-ghost" data-act="csv">' + ic('download') + 'Ekspor Excel</button><a class="btn btn-primary" href="#/pesanan-baru">' + ic('plus') + 'Catat Pesanan</a>') +
        '<div class="stack">' + viewSwitch('pesanan') +
        '<div class="row"><div class="search grow">' + ic('search') + '<input class="input" type="search" data-q placeholder="Cari nama, no. nota, atau barang" aria-label="Cari pesanan"></div>' +
        '<div class="rel"><button class="btn btn-ghost btn-icon" data-act="sort" aria-label="Urutkan">' + ic('arrow-down-up') + '</button></div></div>' +
        '<div class="chips" data-chips role="tablist" aria-label="Saring pesanan"></div></div>' +
        '<div data-list class="mt12"></div>' +
        '<a class="btn btn-primary btn-lg only-mob" href="#/pesanan-baru" style="position:fixed;right:16px;bottom:calc(var(--bnav) + var(--safe-b) + 16px);z-index:25;border-radius:28px;box-shadow:0 10px 24px -8px rgba(43,91,245,.7)">' + ic('plus') + 'Catat</a>';
      const inp = $('[data-q]', el);
      inp.value = q.q || '';
      inp.addEventListener('input', debounce(() => { const nq = Object.assign({}, Router.query, { q: inp.value.trim(), p: '1' }); setQuery(nq); this.update(el, nq); }, 250));
      el.onclick = e => {
        const c = e.target.closest('[data-f]'); if (c) { const nq = Object.assign({}, Router.query, { f: c.dataset.f, p: '1' }); setQuery(nq); this.update(el, nq); return; }
        const pg = e.target.closest('[data-page]'); if (pg) { const nq = Object.assign({}, Router.query, { p: pg.dataset.page }); setQuery(nq); this.update(el, nq); window.scrollTo(0, 0); return; }
        const v = e.target.closest('[data-view]'); if (v) { go(v.dataset.view); return; }
        const tr = e.target.closest('tr[data-href]'); if (tr) { location.hash = tr.dataset.href; return; }
        const a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'csv') exportOrdersCsv(filterOrders(Data.view(), Object.assign({ f: 'semua' }, Router.query)));
        if (a.dataset.act === 'sort') UI.menu(a, [
          { label: 'Terbaru dicatat', icon: 'clock', run: () => { const nq = Object.assign({}, Router.query, { s: 'baru' }); setQuery(nq); this.update(el, nq); } },
          { label: 'Tenggat terdekat', icon: 'calendar-clock', run: () => { const nq = Object.assign({}, Router.query, { s: 'tenggat' }); setQuery(nq); this.update(el, nq); } },
          { label: 'Sisa tagihan terbesar', icon: 'banknote', run: () => { const nq = Object.assign({}, Router.query, { s: 'sisa' }); setQuery(nq); this.update(el, nq); } }
        ]);
      };
    } else if ($('[data-q]', el) && document.activeElement !== $('[data-q]', el)) $('[data-q]', el).value = q.q || '';
    this.update(el, q);
  },
  update(el, q) {
    q = Object.assign({ f: 'semua', q: '', p: '1' }, q);
    const V = Data.view();
    const counts = { semua: V.live.length, belum: V.unpaid.length, batal: V.orders.filter(o => o.batal).length };
    V.stages.forEach(s => { counts[s.kode] = V.live.filter(o => o.tahap === s.kode).length; });
    const chips = [['semua', 'Semua'], ['belum', 'Belum lunas']].concat(V.stages.map(s => [s.kode, s.nama])).concat(counts.batal ? [['batal', 'Dibatalkan']] : []);
    $('[data-chips]', el).innerHTML = chips.map(([k, l]) => '<button class="chip ' + (q.f === k ? 'on' : '') + '" data-f="' + k + '" role="tab" aria-selected="' + (q.f === k) + '">' + esc(l) + ' <span class="cnt">' + (counts[k] || 0) + '</span></button>').join('');
    const all = filterOrders(V, q);
    const pages = Math.max(1, Math.ceil(all.length / PER_PAGE)), p = Math.min(Math.max(1, +q.p || 1), pages);
    const list = all.slice((p - 1) * PER_PAGE, p * PER_PAGE);
    const box = $('[data-list]', el);
    if (!all.length) {
      box.innerHTML = '<div class="card">' + (q.q ? UI.empty('search-x', 'Tidak ditemukan', 'Coba kata lain, misalnya nama pelanggan atau nomor nota.') :
        UI.empty('inbox', 'Belum ada pesanan di sini', 'Pesanan yang dicatat akan muncul di daftar ini.', '<a class="btn btn-primary mt16" href="#/pesanan-baru">' + ic('plus') + 'Catat Pesanan</a>')) + '</div>';
      return;
    }
    const pager = pages > 1 ? '<div class="pager"><span class="small muted">Menampilkan ' + ((p - 1) * PER_PAGE + 1) + '–' + Math.min(p * PER_PAGE, all.length) + ' dari ' + all.length + '</span><div class="row">' +
      '<button class="btn btn-ghost btn-sm" data-page="' + (p - 1) + '" ' + (p <= 1 ? 'disabled' : '') + '>' + ic('chevron-left', 'ico-sm') + 'Sebelumnya</button>' +
      '<button class="btn btn-ghost btn-sm" data-page="' + (p + 1) + '" ' + (p >= pages ? 'disabled' : '') + '>Berikutnya' + ic('chevron-right', 'ico-sm') + '</button></div></div>' : '';
    const totalSisa = all.reduce((a, o) => a + o.sisa, 0);
    box.innerHTML =
      '<div class="small muted mb8">' + all.length + ' pesanan' + (totalSisa ? ' · sisa tagihan <b class="danger num">' + fmt.rp(totalSisa) + '</b>' : '') + '</div>' +
      '<div class="only-mob">' + list.map(o => orderCard(o)).join('') + (pager ? '<div class="card mt12">' + pager + '</div>' : '') + '</div>' +
      '<div class="card only-desk block"><div class="table-wrap"><table class="table"><thead><tr><th>No. nota</th><th>Pelanggan</th><th>Barang</th><th>Rincian ukuran</th><th class="r">Pcs</th><th>Tahap</th><th>Bayar</th><th class="r">Total & sisa</th><th>Tenggat</th></tr></thead><tbody>' +
      list.map(o => '<tr data-href="#/pesanan/' + o.id + '"><td class="' + (o.dl.tone === 'late' ? 'late' : '') + '"><div class="semi nowrap" style="color:var(--pri)">' + esc(o.no_nota) + '</div><div class="small muted">' + fmt.date(o.tgl_pesan) + '</div></td>' +
        '<td><div class="semi">' + esc(o.cust.nama) + '</div><div class="small muted nowrap">' + esc(fmt.wa(o.cust.wa)) + '</div></td>' +
        '<td style="max-width:220px"><div class="ellipsis">' + esc(o.summary) + '</div>' + (o.items.length > 1 ? '<div class="small muted">' + o.items.length + ' barang</div>' : '') + '</td>' +
        '<td style="max-width:220px"><div class="row wrap" style="gap:4px">' + o.items.slice(0, 1).map(i => UI.sizesTags(i)).join('') + (o.items.length > 1 ? '<span class="tag">+' + (o.items.length - 1) + ' barang</span>' : '') + '</div></td>' +
        '<td class="r num semi">' + fmt.num(o.pcs) + '</td><td>' + UI.stage(o.tahap, o.batal) + '</td><td>' + UI.pay(o.status_bayar) + '</td>' +
        '<td class="r nowrap"><div class="num semi">' + fmt.rp(o.total) + '</div><div class="small num ' + (o.sisa > 0 ? 'danger' : 'success') + '">' + (o.sisa > 0 ? 'Sisa ' + fmt.rp(o.sisa) : 'Lunas') + '</div></td><td>' + UI.dl(o) + '<div class="small muted mt8 nowrap">' + fmt.date(o.tenggat) + '</div></td></tr>').join('') +
      '</tbody></table></div>' + pager + '</div><div style="height:72px" class="only-mob"></div>';
  }
});
function exportOrdersCsv(list) {
  const rows = [['No nota', 'Tanggal', 'Tenggat', 'Pelanggan', 'WA', 'Barang', 'Rincian ukuran', 'Pcs', 'Tahap', 'Status bayar', 'Total', 'Dibayar', 'Sisa']];
  list.forEach(o => rows.push([o.no_nota, o.tgl_pesan, o.tenggat, o.cust.nama, o.cust.wa, o.summary, o.items.map(i => i.jenis + ': ' + i.sizes.map(s => s.ukuran + ' ' + s.qty).join(', ')).join(' | '), o.pcs, stageName(o.tahap), PAY_LABEL[o.status_bayar], o.total, o.dibayar, o.sisa]));
  const csv = '﻿' + rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[";,\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\n');
  download('pesanan-' + today() + '.csv', csv, 'text/csv;charset=utf-8');
  UI.toast('File CSV diunduh — bisa dibuka di Excel.');
}

/* ============================ PAPAN PRODUKSI ============================ */
async function advanceStage(o, btn, explicitTo) {
  const to = explicitTo || nextStageOf(o);
  if (!to) return;
  const go2 = async (extra) => {
    // optimistic: tampilan berubah dulu, dibatalkan bila server menolak
    const prev = Data.patchLocal('Pesanan', o.id, { tahap: to });
    const r = await api('moveStage', Object.assign({ pesanan_id: o.id, dari: o.tahap, ke: to }, extra || {}));
    if (r.success) { UI.toast(o.cust.nama + ' → ' + stageName(to)); return true; }
    if (prev && !r.sync) Data.patchLocal('Pesanan', o.id, { tahap: prev.tahap });
    if (r.code === 'CONFIRM_AMBIL') {
      const ok = await UI.confirm({ title: 'Belum lunas', msg: r.message, ok: 'Izinkan ambil dulu' });
      if (ok) return go2({ ambil_dulu: true });
      return false;
    }
    if (r.code === 'NEED_OWNER') {
      const ok = await UI.confirm({ title: 'Belum lunas', msg: r.message, ok: 'Terima pelunasan', cancel: 'Nanti' });
      if (ok) openPayment(o.id);
      return false;
    }
    UI.toast(r.message, 'err');
    return false;
  };
  if (to === 'diambil' && o.sisa <= 0) {
    const ok = await UI.confirm({ title: 'Tandai sudah diambil?', msg: o.cust.nama + ' — ' + o.no_nota + ' sudah diserahkan ke pelanggan.', ok: 'Ya, sudah diambil' });
    if (!ok) return;
  }
  if (btn) return UI.busy(btn, () => go2());
  return go2();
}
function moveStageMenu(o) {
  const V = Data.view();
  const s = UI.sheet({ title: 'Pindah tahap', sub: o.cust.nama + ' · ' + o.no_nota, body: '<p class="small muted mb12">Pilih tahap yang benar bila ada yang terlewat atau salah tekan.</p><div class="list card">' +
    V.stages.map(st => '<button class="li" data-to="' + st.kode + '" ' + (st.kode === o.tahap ? 'disabled' : '') + '>' + UI.stage(st.kode) + '<span class="grow"></span>' + (st.kode === o.tahap ? '<span class="small muted">Saat ini</span>' : ic('chevron-right', 'ico-sm chev')) + '</button>').join('') + '</div>' });
  s.body.onclick = e => { const b = e.target.closest('[data-to]'); if (!b) return; s.close(); advanceStage(o, null, b.dataset.to); };
}
function prodCard(o) {
  const nx = nextStageOf(o);
  return '<div class="kcard" data-id="' + o.id + '">' +
    '<div class="row-between"><span class="small faint semi">' + esc(o.no_nota) + '</span>' + UI.dl(o) + '</div>' +
    '<a href="#/pesanan/' + o.id + '" style="color:inherit"><div class="semi mt8" style="font-size:15px">' + esc(o.cust.nama) + '</div>' +
    '<div class="row-between mt8"><span class="small muted ellipsis">' + esc(o.summary) + '</span><span class="pill st-jahit num">' + fmt.num(o.pcs) + ' pcs</span></div></a>' +
    '<div class="sizes">' + o.items.map(i => (o.items.length > 1 ? '<span class="it ellipsis">' + esc(i.jenis) + '</span>' : '') + UI.sizesTags(i)).join('') + '</div>' +
    '<div class="row wrap mt8">' + (o.pakai_sablon ? '<span class="pill st-sablon">' + ic('palette', 'ico-sm') + 'Sablon/Bordir</span>' : '<span class="pill st-diterima">Tanpa sablon</span>') + UI.pay(o.status_bayar) + '</div>' +
    (nx ? '<button class="btn btn-primary btn-block mt12" data-next="' + o.id + '">' + (nx === 'diambil' ? 'Tandai sudah diambil' : 'Lanjut ke ' + esc(stageName(nx))) + ic('arrow-right', 'ico-sm') + '</button>' : '') +
    '</div>';
}
registerPage('produksi', {
  title: 'Produksi', nav: () => (matchMedia('(min-width:768px)').matches ? 'produksi' : 'pesanan'),
  header: () => ({ title: 'Papan produksi', sub: 'Tekan Lanjut untuk memindahkan tahap', back: 'pesanan' }),
  render(el, param, query) {
    if (needData(el)) return;
    const V = Data.view();
    const cols = V.stages.filter(s => s.kode !== 'diambil');
    let cur = (query && query.tahap) || LS.get('prodTab') || cols[0].kode;
    if (!cols.some(c => c.kode === cur)) cur = cols[0].kode;
    const by = {}; cols.forEach(c => { by[c.kode] = V.active.filter(o => o.tahap === c.kode).sort((a, b) => (a.tenggat < b.tenggat ? -1 : 1)); });
    const totalPcs = V.active.reduce((a, o) => a + o.pcs, 0);
    el.innerHTML = pageHead('Papan produksi', V.active.length + ' pesanan aktif · ' + fmt.num(totalPcs) + ' pcs sedang dikerjakan', '<a class="btn btn-primary" href="#/pesanan-baru">' + ic('plus') + 'Catat Pesanan</a>') +
      '<div class="only-mob stack">' + viewSwitch('produksi') +
        '<div class="chips" role="tablist">' + cols.map((c, i) => '<button class="chip ' + (c.kode === cur ? 'on' : '') + '" data-tab="' + c.kode + '" role="tab" aria-selected="' + (c.kode === cur) + '">' + (i + 1) + '. ' + esc(c.nama) + ' <span class="cnt">' + by[c.kode].length + '</span></button>').join('') + '</div>' +
        '<div class="row-between"><h2 class="h-sm row">' + UI.stage(cur) + ' ' + by[cur].length + ' pesanan</h2><span class="small muted num">' + fmt.num(by[cur].reduce((a, o) => a + o.pcs, 0)) + ' pcs</span></div>' +
        '<div class="stack-sm">' + (by[cur].length ? by[cur].map(prodCard).join('') : '<div class="card">' + UI.empty('inbox', 'Kosong', 'Tidak ada pesanan di tahap ini.') + '</div>') + '</div>' +
      '</div>' +
      '<div class="kanban only-desk flex">' + cols.map(c => '<div class="kcol"><div class="kcol-head">' + UI.stage(c.kode) + '<span class="badge blue">' + by[c.kode].length + '</span></div><div class="kcol-body">' +
        (by[c.kode].length ? by[c.kode].map(prodCard).join('') : '<div class="small faint center" style="padding:20px 8px">Kosong</div>') + '</div></div>').join('') + '</div>';
    el.onclick = async e => {
      const t = e.target.closest('[data-tab]'); if (t) { LS.set('prodTab', t.dataset.tab); setQuery({ tahap: t.dataset.tab }); this.render(el, null, { tahap: t.dataset.tab }); return; }
      const v = e.target.closest('[data-view]'); if (v) { go(v.dataset.view); return; }
      const n = e.target.closest('[data-next]'); if (n) { const o = Data.view().ordersById[n.dataset.next]; if (o) advanceStage(o, n); }
    };
  }
});
