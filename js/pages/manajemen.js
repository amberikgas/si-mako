/* ============================================================
   MANAJEMEN — Hitung Modal (F-16) · Stok Bahan (F-17) · Keuangan (F-18) · Laporan (F-19)
   ============================================================ */
'use strict';

function monthNav(ym) {
  return '<div class="row card" style="padding:4px;display:inline-flex;max-width:100%"><button class="btn btn-icon" data-m="-1" aria-label="Bulan sebelumnya">' + ic('chevron-left') + '</button>' +
    '<b class="center" style="min-width:140px">' + esc(fmt.month(ym)) + '</b><button class="btn btn-icon" data-m="1" aria-label="Bulan berikutnya" ' + (ym >= today().slice(0, 7) ? 'disabled' : '') + '>' + ic('chevron-right') + '</button></div>';
}
function shiftMonth(ym, d) { const [y, m] = ym.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + d, 1)); return t.toISOString().slice(0, 7); }

/* ============================ HITUNG MODAL ============================ */
const HM_DEFAULT = [['Bahan kain', ''], ['Ongkos jahit', ''], ['Sablon / bordir', ''], ['Aksesoris & kancing', ''], ['Overhead & packing', '']];
const HM = { s: null };
function hmNew() { return { id: '', nama: '', margin: 30, harga: 0, hargaManual: false, rows: HM_DEFAULT.map(r => ({ nama: r[0], ket: r[1], nilai: 0 })) }; }
registerPage('hitung-modal', {
  title: 'Hitung Modal', auth: 'owner', live: false,
  header: () => ({ title: 'Hitung modal & harga', sub: 'Khusus Pemilik', back: 'lainnya' }),
  render(el, p, query) {
    if (needData(el)) return;
    const tab = (query && query.tab) || 'hitung';
    if (!HM.s) HM.s = hmNew();
    el.innerHTML = '<div class="form-narrow">' + pageHead('Hitung modal & harga jual', 'Hitung modal per potong, tentukan margin, simpan sebagai daftar harga untuk form pesanan.') +
      '<div class="seg mb12"><button data-tab="hitung" class="' + (tab === 'hitung' ? 'on' : '') + '">' + 'Hitung modal</button><button data-tab="daftar" class="' + (tab === 'daftar' ? 'on' : '') + '">Daftar harga (' + Data.view().priceRefs.length + ')</button></div><div data-hm></div></div>';
    el.onclick = e => { const t = e.target.closest('[data-tab]'); if (t) { setQuery({ tab: t.dataset.tab }); this.render(el, null, { tab: t.dataset.tab }); } };
    if (tab === 'daftar') hmList($('[data-hm]', el), el, this); else hmCalc($('[data-hm]', el));
  },
  onData() { const el = $('#pages .page[data-page="hitung-modal"]'); if (el && !el.hidden && (Router.query.tab === 'daftar')) this.render(el, null, Router.query); }
});
function hmCalc(box) {
  const s = HM.s;
  const modal = () => s.rows.reduce((a, r) => a + (r.nilai || 0), 0);
  const rec = () => Math.round(modal() * (1 + s.margin / 100));
  const rounded = () => Math.ceil(rec() / 500) * 500;
  const ICONS = ['scissors', 'shirt', 'palette', 'tag', 'package'], TONES = ['amber', '', 'violet', 'green', 'slate'];
  box.innerHTML = '<div class="card card-pad"><div class="field"><label class="req" for="hm-n">Nama barang</label><input id="hm-n" class="input" data-nm value="' + esc(s.nama) + '" placeholder="Contoh: Kaos Polo CVC 24s" maxlength="120"></div></div>' +
    '<div class="card card-pad mt12"><div class="row-between mb12"><h3 class="h-sm row">' + ic('list') + 'Rincian modal per potong</h3><span class="badge blue">' + s.rows.length + ' komponen</span></div><div class="stack-sm">' +
    s.rows.map((r, i) => '<div class="row" style="background:var(--soft);border-radius:12px;padding:8px" data-r="' + i + '"><span class="icon-box sm ' + (TONES[i] || 'slate') + '">' + ic(ICONS[i] || 'circle-dot', 'ico-sm') + '</span>' +
      '<div class="grow"><input class="input" style="min-height:36px;padding:6px 8px;font-size:15px;font-weight:600;background:transparent;border-color:transparent" data-k="nama" value="' + esc(r.nama) + '" aria-label="Nama komponen ' + (i + 1) + '"><input class="input small" style="min-height:30px;padding:2px 8px;font-size:13px;background:transparent;border-color:transparent;color:var(--tx2)" data-k="ket" value="' + esc(r.ket) + '" placeholder="keterangan (opsional)" aria-label="Keterangan"></div>' +
      '<div class="input-group" style="width:128px;flex:none"><span class="prefix" style="font-size:13px">Rp</span><input class="input money" style="padding-left:34px" data-k="nilai" inputmode="numeric" value="' + (r.nilai ? fmt.num(r.nilai) : '') + '" placeholder="0" aria-label="Biaya ' + esc(r.nama) + '"></div>' +
      (s.rows.length > 1 ? '<button class="btn btn-icon btn-sm" data-rm="' + i + '" aria-label="Hapus komponen" style="min-width:32px">' + ic('x', 'ico-sm') + '</button>' : '') + '</div>').join('') +
    '</div><button class="btn btn-ghost btn-sm mt12" data-add>' + ic('plus', 'ico-sm') + 'Tambah komponen</button>' +
    '<div class="row-between mt12" style="background:var(--soft-blue);padding:12px;border-radius:12px"><span class="semi">Total modal</span><span class="money-lg" style="color:var(--pri)" data-modal>' + fmt.rp(modal()) + ' <span class="small muted">/ pcs</span></span></div></div>' +
    '<div class="card card-pad mt12" style="background:linear-gradient(160deg,#2B5BF5,#1E40AF);color:#fff;border:0"><div class="row-between"><span class="overline" style="color:rgba(255,255,255,.8)">Margin keuntungan</span><span class="pill" style="background:rgba(255,255,255,.16);color:#fff" data-mg>' + s.margin + '% · laba ' + fmt.rp(rec() - modal()) + '/pcs</span></div>' +
    '<input type="range" min="0" max="100" step="1" value="' + s.margin + '" data-margin aria-label="Margin" style="width:100%;margin:14px 0 4px;accent-color:#fff">' +
    '<div class="row-between xs" style="color:rgba(255,255,255,.75)"><button class="btn-link btn btn-sm" style="color:#fff" data-pm="10">10% grosir</button><button class="btn-link btn btn-sm" style="color:#fff" data-pm="30">30% standar</button><button class="btn-link btn btn-sm" style="color:#fff" data-pm="50">50% eceran</button></div>' +
    '<div class="overline mt12" style="color:rgba(255,255,255,.8)">Harga jual rekomendasi</div><div style="font-size:34px;font-weight:800;letter-spacing:-.02em" class="num" data-rec>' + fmt.rp(rec()) + '<span style="font-size:14px;font-weight:500"> / pcs</span></div>' +
    '<button class="row mt8" data-round style="background:rgba(255,255,255,.14);border:0;color:#fff;border-radius:12px;padding:10px 12px;width:100%;text-align:left;min-height:44px">' + ic('lightbulb') + '<span class="grow"><b data-rd>Bulatkan ke ' + fmt.rp(rounded()) + '</b><br><span class="small" style="opacity:.8">Kelipatan Rp 500 memudahkan tawar-menawar</span></span></button>' +
    '<div class="field mt12"><label for="hm-h" style="color:rgba(255,255,255,.9)">Harga jual yang dipakai</label><div class="input-group"><span class="prefix">Rp</span><input id="hm-h" class="input money" data-harga inputmode="numeric" value="' + fmt.num(s.hargaManual ? s.harga : rec()) + '"></div></div>' +
    '<button class="btn btn-block btn-lg mt12" style="background:#fff;color:var(--pri)" data-save>' + ic('bookmark-plus') + (s.id ? 'Simpan perubahan' : 'Simpan ke daftar harga') + '</button>' +
    (s.id ? '<button class="btn btn-link btn-block" style="color:#fff" data-new>Mulai hitungan baru</button>' : '') + '</div>';
  const upd = () => {
    $('[data-modal]', box).innerHTML = fmt.rp(modal()) + ' <span class="small muted">/ pcs</span>';
    $('[data-mg]', box).textContent = s.margin + '% · laba ' + fmt.rp(rec() - modal()) + '/pcs';
    $('[data-rec]', box).innerHTML = fmt.rp(rec()) + '<span style="font-size:14px;font-weight:500"> / pcs</span>';
    $('[data-rd]', box).textContent = 'Bulatkan ke ' + fmt.rp(rounded());
    if (!s.hargaManual) $('[data-harga]', box).value = fmt.num(rec());
  };
  box.oninput = e => {
    const t = e.target;
    if (t.dataset.nm != null) { s.nama = t.value; return; }
    if (t.dataset.margin != null) { s.margin = +t.value; s.hargaManual = false; upd(); return; }
    if (t.dataset.harga != null) { const n = parseMoney(t.value); t.value = n ? fmt.num(n) : ''; s.harga = n; s.hargaManual = true; return; }
    const r = t.closest('[data-r]'); if (!r) return;
    const row = s.rows[+r.dataset.r];
    if (t.dataset.k === 'nilai') { const n = parseMoney(t.value); t.value = n ? fmt.num(n) : ''; row.nilai = n; upd(); } else row[t.dataset.k] = t.value;
  };
  box.onclick = async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.pm) { s.margin = +b.dataset.pm; s.hargaManual = false; hmCalc(box); return; }
    if (b.hasAttribute('data-round')) { s.harga = rounded(); s.hargaManual = true; $('[data-harga]', box).value = fmt.num(s.harga); return; }
    if (b.hasAttribute('data-add')) { s.rows.push({ nama: 'Komponen lain', ket: '', nilai: 0 }); hmCalc(box); return; }
    if (b.dataset.rm != null) { s.rows.splice(+b.dataset.rm, 1); hmCalc(box); return; }
    if (b.hasAttribute('data-new')) { HM.s = hmNew(); hmCalc(box); return; }
    if (b.hasAttribute('data-save')) {
      if (!s.nama.trim()) { const n = $('[data-nm]', box); n.classList.add('invalid'); n.focus(); UI.toast('Isi nama barang dulu.', 'err'); return; }
      if (modal() <= 0) { UI.toast('Isi minimal satu biaya modal.', 'err'); return; }
      await UI.busy(b, async () => {
        const r = await api('savePriceRef', { id: s.id, nama: s.nama, margin_persen: s.margin, harga_jual: s.hargaManual ? s.harga : rec(), rincian_modal: s.rows });
        if (!r.success) return UI.toast(r.message, 'err');
        UI.toast(s.nama + ' tersimpan di daftar harga.'); HM.s = hmNew(); go('hitung-modal', null, { tab: 'daftar' });
      });
    }
  };
}
function hmList(box) {
  const V = Data.view();
  box.innerHTML = V.priceRefs.length ? '<div class="card list">' + V.priceRefs.map(p => '<div class="li" style="cursor:default"><div class="grow"><div class="semi ellipsis">' + esc(p.nama) + '</div><div class="small muted">Modal ' + fmt.rp(p.modal_per_pcs) + ' · <span class="pill pay-lunas" style="padding:0 8px">' + fmt.dec(p.margin_persen) + '% margin</span></div></div>' +
    '<div class="right"><div class="xs muted">Harga jual</div><div class="num semi" style="color:var(--pri)">' + fmt.rp(p.harga_jual) + '</div></div><div class="rel"><button class="btn btn-icon btn-ghost" data-p="' + p.id + '" aria-label="Menu">' + ic('ellipsis-vertical') + '</button></div></div>').join('') + '</div>' +
    '<p class="small muted mt12">Daftar ini muncul di form pesanan lewat tombol <b>Daftar harga</b>.</p>'
    : '<div class="card">' + UI.empty('calculator', 'Daftar harga masih kosong', 'Hitung modal sebuah barang lalu simpan ke daftar.') + '</div>';
  box.onclick = e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const p = V.priceRefs.find(x => x.id === b.dataset.p);
    UI.menu(b, [
      { label: 'Ubah hitungan', icon: 'pencil', run: () => { let rin = []; try { rin = JSON.parse(p.rincian_modal || '[]'); } catch (er) {} HM.s = { id: p.id, nama: p.nama, margin: p.margin_persen, harga: p.harga_jual, hargaManual: true, rows: rin.length ? rin : [{ nama: 'Modal', ket: '', nilai: p.modal_per_pcs }] }; go('hitung-modal', null, { tab: 'hitung' }); } },
      { label: 'Hapus dari daftar', icon: 'trash-2', danger: true, run: async () => { if (!(await UI.confirm({ title: 'Hapus ' + p.nama + '?', msg: 'Pesanan lama yang memakai harga ini tidak berubah.', ok: 'Hapus', danger: true }))) return; const r = await api('deletePriceRef', { id: p.id }); UI.toast(r.success ? 'Dihapus.' : r.message, r.success ? 'ok' : 'err'); if (r.success) go('hitung-modal', null, { tab: 'daftar' }); } }
    ]);
  };
}

/* ============================ STOK BAHAN ============================ */
function materialForm(b) {
  b = b || {};
  const s = UI.sheet({ title: b.id ? 'Ubah bahan' : 'Tambah bahan', icon: 'boxes',
    body: '<form class="stack" data-mf novalidate><div class="field"><label class="req" for="mf-n">Nama bahan</label><input id="mf-n" class="input" name="nama" value="' + esc(b.nama || '') + '" placeholder="Contoh: Cotton Combed 30s Hitam" maxlength="120" autofocus></div>' +
      '<div class="grid2"><div class="field"><label for="mf-s">Satuan</label><select id="mf-s" class="select" name="satuan">' + ['kg', 'meter', 'roll', 'yard', 'pcs', 'lusin'].map(u => '<option ' + (b.satuan === u ? 'selected' : '') + '>' + u + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mf-m">Batas minimum</label><input id="mf-m" class="input" name="minimum" inputmode="decimal" value="' + (b.minimum != null ? b.minimum : '') + '" placeholder="0"><div class="hint">Muncul peringatan bila stok ≤ batas ini.</div></div></div>' +
      (b.id ? '' : '<div class="field"><label for="mf-a">Stok awal</label><input id="mf-a" class="input" name="stok_awal" inputmode="decimal" placeholder="0"></div>') + '</form>',
    foot: '<button class="btn btn-ghost" data-c>Batal</button><button class="btn btn-primary" data-s>Simpan</button>' });
  const reqId = uid();
  s.foot.onclick = async e => {
    if (e.target.closest('[data-c]')) return s.close();
    const btn = e.target.closest('[data-s]'); if (!btn) return;
    const d = Object.fromEntries(new FormData($('[data-mf]', s.body)).entries());
    ['minimum', 'stok_awal'].forEach(k => { if (d[k] != null) d[k] = parseFloat(String(d[k]).replace(',', '.')) || 0; });
    if (!d.nama.trim()) return UI.toast('Isi nama bahan.', 'err');
    await UI.busy(btn, async () => { const r = await api('saveMaterial', Object.assign({ id: b.id }, d), { reqId }); if (!r.success) return UI.toast(r.message, 'err'); s.close(); UI.toast('Bahan tersimpan.'); });
  };
}
function materialMove(b, dir) {
  const V = Data.view();
  const s = UI.sheet({ title: (dir === 'masuk' ? 'Catat bahan masuk' : 'Catat bahan keluar'), sub: b.nama + ' · stok ' + fmt.dec(b.stok) + ' ' + b.satuan, icon: dir === 'masuk' ? 'package-plus' : 'package-minus',
    body: '<form class="stack" data-mv novalidate><div class="seg"><button type="button" data-d="masuk" class="' + (dir === 'masuk' ? 'on' : '') + '">Masuk (beli)</button><button type="button" data-d="keluar" class="' + (dir === 'keluar' ? 'on' : '') + '">Keluar (dipakai)</button></div>' +
      '<div class="field"><label class="req" for="mv-j">Jumlah (' + esc(b.satuan) + ')</label><input id="mv-j" class="input" name="jumlah" inputmode="decimal" autofocus style="font-size:20px;font-weight:700"></div>' +
      '<div class="field"><label for="mv-t">Tanggal</label><input id="mv-t" class="input" type="date" name="tgl" value="' + today() + '" max="' + today() + '"></div>' +
      '<div class="field" data-forord ' + (dir === 'keluar' ? '' : 'hidden') + '><label for="mv-o">Untuk pesanan <span class="faint">(opsional)</span></label><select id="mv-o" class="select" name="pesanan_id"><option value="">—</option>' + V.active.map(o => '<option value="' + o.id + '">' + esc(o.no_nota + ' · ' + o.cust.nama) + '</option>').join('') + '</select></div>' +
      '<div class="field"><label for="mv-k">Keterangan</label><input id="mv-k" class="input" name="keterangan" maxlength="200" placeholder="Contoh: beli di Toko Kain Jaya"></div></form>',
    foot: '<button class="btn btn-ghost" data-c>Batal</button><button class="btn btn-primary" data-s>Simpan</button>' });
  const reqId = uid();
  s.body.onclick = e => { const d = e.target.closest('[data-d]'); if (d) { dir = d.dataset.d; $$('[data-d]', s.body).forEach(x => x.classList.toggle('on', x === d)); $('[data-forord]', s.body).hidden = dir !== 'keluar'; $('#sh-t', s.el).textContent = dir === 'masuk' ? 'Catat bahan masuk' : 'Catat bahan keluar'; } };
  s.foot.onclick = async e => {
    if (e.target.closest('[data-c]')) return s.close();
    const btn = e.target.closest('[data-s]'); if (!btn) return;
    const d = Object.fromEntries(new FormData($('[data-mv]', s.body)).entries());
    const n = parseFloat(String(d.jumlah).replace(',', '.')) || 0;
    if (n <= 0) { $('#mv-j', s.body).classList.add('invalid'); return UI.toast('Isi jumlah.', 'err'); }
    await UI.busy(btn, async () => {
      const r = await api('materialMove', { bahan_id: b.id, masuk: dir === 'masuk' ? n : 0, keluar: dir === 'keluar' ? n : 0, tgl: d.tgl, keterangan: d.keterangan, pesanan_id: dir === 'keluar' ? d.pesanan_id : '' }, { reqId });
      if (!r.success) return UI.toast(r.message, 'err');
      s.close(); UI.toast(b.nama + ': stok sekarang ' + fmt.dec(r.data.stok) + ' ' + b.satuan);
    });
  };
}
registerPage('stok', {
  title: 'Stok Bahan',
  header: () => ({ title: 'Stok bahan', sub: 'Catat bahan masuk & keluar', back: 'lainnya' }),
  render(el) {
    if (needData(el)) return;
    const V = Data.view(), owner = Session.owner;
    const moves = Data.rows('MutasiBahan').sort((a, b) => (a.tgl + a.dibuat_pada < b.tgl + b.dibuat_pada ? 1 : -1));
    el.innerHTML = pageHead('Stok bahan', 'Pantau sisa bahan baku dan catat pemakaian.', owner ? '<button class="btn btn-primary" data-add>' + ic('plus') + 'Tambah bahan</button>' : '') +
      (V.lowStock.length ? '<div class="banner amber mb12"><span class="icon-box sm amber">' + ic('triangle-alert', 'ico-sm') + '</span><div><b>' + V.lowStock.length + ' bahan hampir habis</b><span>' + esc(V.lowStock.map(b => b.nama).join(', ')) + '</span></div></div>' : '') +
      (V.materials.length ? '<div class="stack">' + V.materials.map(b => {
        const low = b.stok <= b.minimum, mv = moves.filter(m => m.bahan_id === b.id);
        const pct = b.minimum ? Math.min(100, Math.round(b.stok / (b.minimum * 3) * 100)) : 100;
        return '<div class="card card-pad"><div class="row-between" style="align-items:flex-start"><div class="grow"><div class="semi">' + esc(b.nama) + '</div><div class="small muted">Batas minimum ' + fmt.dec(b.minimum) + ' ' + esc(b.satuan) + '</div></div>' +
          '<div class="right"><div class="money-lg ' + (low ? 'danger' : '') + '">' + fmt.dec(b.stok) + ' <span class="small muted">' + esc(b.satuan) + '</span></div>' + (low ? '<span class="pill pay-belum_bayar">Hampir habis</span>' : '<span class="pill pay-lunas">Aman</span>') + '</div></div>' +
          '<div class="bar-progress mt12"><i style="width:' + pct + '%;background:' + (low ? 'var(--bad)' : 'var(--ok)') + '"></i></div>' +
          '<div class="row mt12"><button class="btn btn-soft grow" data-mv="' + b.id + '" data-dir="masuk">' + ic('package-plus') + 'Masuk</button><button class="btn btn-ghost grow" data-mv="' + b.id + '" data-dir="keluar">' + ic('package-minus') + 'Keluar</button>' +
          (owner ? '<button class="btn btn-icon btn-ghost" data-ed="' + b.id + '" aria-label="Ubah bahan">' + ic('pencil') + '</button>' : '') + '</div>' +
          (mv.length ? '<details class="fold mt12"><summary class="row-between small semi muted" style="min-height:40px">Riwayat (' + mv.length + ')' + ic('chevron-down', 'ico-sm fold-ico') + '</summary><div class="stack-sm mt8">' +
            mv.slice(0, 15).map(m => '<div class="row-between small" style="border-top:1px solid var(--line);padding-top:6px"><div class="grow"><div>' + esc(m.keterangan || (m.masuk ? 'Masuk' : 'Keluar')) + '</div><div class="muted xs">' + fmt.date(m.tgl) + (m.pesanan_id && V.ordersById[m.pesanan_id] ? ' · ' + esc(V.ordersById[m.pesanan_id].no_nota) : '') + '</div></div><span class="num semi ' + (m.masuk ? 'success' : 'danger') + '">' + (m.masuk ? '+' + fmt.dec(m.masuk) : '−' + fmt.dec(m.keluar)) + '</span></div>').join('') + '</div></details>' : '') + '</div>';
      }).join('') + '</div>' : '<div class="card">' + UI.empty('boxes', 'Belum ada data bahan', owner ? 'Tambahkan bahan baku yang ingin dipantau stoknya.' : 'Minta Pemilik menambahkan daftar bahan.', owner ? '<button class="btn btn-primary mt16" data-add>' + ic('plus') + 'Tambah bahan</button>' : '') + '</div>') +
      (owner && V.materials.length ? '<button class="btn btn-soft btn-block mt12 only-mob flex" data-add>' + ic('plus') + 'Tambah bahan</button>' : '');
    el.onclick = e => {
      if (e.target.closest('[data-add]')) return materialForm();
      const m = e.target.closest('[data-mv]'); if (m) return materialMove(Data.get('Bahan', m.dataset.mv), m.dataset.dir);
      const ed = e.target.closest('[data-ed]'); if (ed) return materialForm(Data.get('Bahan', ed.dataset.ed));
    };
  }
});

/* ============================ KEUANGAN ============================ */
function expenseForm(x) {
  x = x || {};
  const cats = String(Data.view().settings.kategori_keluar || 'Bahan,Lain-lain').split(',').map(s => s.trim()).filter(Boolean);
  const s = UI.sheet({ title: x.id ? 'Ubah uang keluar' : 'Catat uang keluar', icon: 'arrow-up-right',
    body: '<form class="stack" data-xf novalidate><div class="field"><label class="req" for="xf-j">Jumlah</label><div class="input-group"><span class="prefix">Rp</span><input id="xf-j" class="input money" name="jumlah" inputmode="numeric" value="' + (x.jumlah ? fmt.num(x.jumlah) : '') + '" autofocus style="font-size:20px"></div></div>' +
      '<div class="field"><span class="lbl">Kategori</span><div class="row wrap">' + cats.map(c => '<button type="button" class="chip ' + ((x.kategori || cats[0]) === c ? 'on' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div></div>' +
      '<div class="field"><label for="xf-t">Tanggal</label><input id="xf-t" class="input" type="date" name="tgl" value="' + esc(x.tgl || today()) + '"></div>' +
      '<div class="field"><label for="xf-k">Keterangan</label><input id="xf-k" class="input" name="keterangan" value="' + esc(x.keterangan || '') + '" maxlength="300" placeholder="Contoh: kain CVC 50 kg"></div>' +
      '<div class="field"><span class="lbl">Foto nota <span class="faint">(opsional)</span></span><label class="btn btn-ghost" style="cursor:pointer" data-flab>' + ic('camera') + '<span>Pilih foto</span><input type="file" accept="image/*,application/pdf" data-file hidden></label></div></form>',
    foot: '<button class="btn btn-ghost" data-c>Batal</button><button class="btn btn-primary" data-s>Simpan</button>' });
  let cat = x.kategori || cats[0], bukti = null; const reqId = uid();
  bindMoney($('#xf-j', s.body));
  s.body.onclick = e => { const c = e.target.closest('[data-cat]'); if (c) { cat = c.dataset.cat; $$('[data-cat]', s.body).forEach(z => z.classList.toggle('on', z === c)); } };
  $('[data-file]', s.body).onchange = async e => { try { bukti = await readImage(e.target.files[0], 1600, 0.8); $('[data-flab] span', s.body).textContent = bukti.name; } catch (er) { UI.toast(er.message, 'err'); } };
  s.foot.onclick = async e => {
    if (e.target.closest('[data-c]')) return s.close();
    const btn = e.target.closest('[data-s]'); if (!btn) return;
    const d = Object.fromEntries(new FormData($('[data-xf]', s.body)).entries());
    const jumlah = parseMoney(d.jumlah); if (!jumlah) return UI.toast('Isi jumlah.', 'err');
    await UI.busy(btn, async () => { const r = await api('saveExpense', { id: x.id, jumlah, kategori: cat, tgl: d.tgl, keterangan: d.keterangan, bukti: bukti && { name: bukti.name, mime: bukti.mime, b64: bukti.b64 } }, { reqId }); if (!r.success) return UI.toast(r.message, 'err'); s.close(); UI.toast('Uang keluar tersimpan.'); });
  };
}
registerPage('keuangan', {
  title: 'Keuangan', auth: 'owner',
  header: () => ({ title: 'Keuangan', sub: 'Tagihan · uang masuk · uang keluar', back: 'lainnya' }),
  render(el, p, query) {
    if (needData(el)) return;
    const V = Data.view(), q = Object.assign({ tab: 'tagihan', m: today().slice(0, 7) }, query || {});
    const pIn = V.payments.filter(x => x.tgl.slice(0, 7) === q.m).sort((a, b) => (a.tgl < b.tgl ? 1 : -1));
    const pOut = V.expenses.filter(x => x.tgl.slice(0, 7) === q.m).sort((a, b) => (a.tgl < b.tgl ? 1 : -1));
    const sIn = pIn.reduce((a, x) => a + x.jumlah, 0), sOut = pOut.reduce((a, x) => a + x.jumlah, 0), sUnpaid = V.unpaid.reduce((a, o) => a + o.sisa, 0);
    const tabs = [['tagihan', 'Tagihan', sUnpaid], ['masuk', 'Uang masuk', sIn], ['keluar', 'Uang keluar', sOut]];
    let body = '';
    if (q.tab === 'tagihan') {
      const list = V.unpaid.slice().sort((a, b) => b.sisa - a.sisa);
      body = list.length ? '<div class="card list">' + list.map(o => '<div class="li"><a class="grow" href="#/pesanan/' + o.id + '" style="color:inherit;min-width:0"><div class="semi ellipsis">' + esc(o.cust.nama) + '</div><div class="small muted ellipsis">' + esc(o.no_nota) + ' · ' + UI.dl(o) + '</div></a><div class="right"><div class="num semi danger">' + fmt.rp(o.sisa) + '</div><div class="xs muted">dari ' + fmt.rp(o.total) + '</div></div><button class="btn btn-soft btn-sm" data-pay="' + o.id + '">Terima</button></div>').join('') + '</div>'
        : '<div class="card">' + UI.empty('party-popper', 'Tidak ada tagihan', 'Semua pesanan sudah lunas.') + '</div>';
    } else if (q.tab === 'masuk') {
      const byM = {}; pIn.forEach(x => { const k = methodLabel(x.metode); byM[k] = (byM[k] || 0) + x.jumlah; });
      body = '<div class="row wrap mb12">' + Object.keys(byM).map(k => '<span class="tag">' + esc(k) + ': ' + fmt.rp(byM[k]) + '</span>').join('') + '</div>' +
        (pIn.length ? '<div class="card list">' + pIn.map(x => { const o = V.ordersById[x.pesanan_id]; return '<a class="li" href="#/pesanan/' + x.pesanan_id + '"><span class="icon-box sm green">' + ic(methodIcon(x.metode), 'ico-sm') + '</span><div class="grow"><div class="semi ellipsis">' + esc(o ? o.cust.nama : '-') + '</div><div class="small muted ellipsis">' + fmt.date(x.tgl) + ' · ' + esc(methodLabel(x.metode)) + ' · ' + esc(x.jenis) + '</div></div><span class="num semi success">+' + fmt.rp(x.jumlah) + '</span></a>'; }).join('') + '</div>'
          : '<div class="card">' + UI.empty('inbox', 'Belum ada uang masuk bulan ini', '') + '</div>');
    } else {
      const byC = {}; pOut.forEach(x => { byC[x.kategori] = (byC[x.kategori] || 0) + x.jumlah; });
      body = '<div class="row-between mb12"><div class="row wrap">' + Object.keys(byC).map(k => '<span class="tag">' + esc(k) + ': ' + fmt.rp(byC[k]) + '</span>').join('') + '</div><button class="btn btn-primary btn-sm" data-addx>' + ic('plus', 'ico-sm') + 'Catat</button></div>' +
        (pOut.length ? '<div class="card list">' + pOut.map(x => '<div class="li"><span class="icon-box sm red">' + ic('arrow-up-right', 'ico-sm') + '</span><div class="grow"><div class="semi ellipsis">' + esc(x.keterangan || x.kategori) + '</div><div class="small muted">' + fmt.date(x.tgl) + ' · ' + esc(x.kategori) + (safeUrl(x.bukti_url) ? ' · <a href="' + safeUrl(x.bukti_url) + '" target="_blank" rel="noopener">bukti</a>' : '') + '</div></div><span class="num semi danger">−' + fmt.rp(x.jumlah) + '</span><div class="rel"><button class="btn btn-icon btn-sm" data-xm="' + x.id + '" aria-label="Menu">' + ic('ellipsis-vertical', 'ico-sm') + '</button></div></div>').join('') + '</div>'
          : '<div class="card">' + UI.empty('wallet', 'Belum ada uang keluar bulan ini', 'Catat belanja bahan, gaji, listrik, dan lainnya.', '<button class="btn btn-primary mt16" data-addx>' + ic('plus') + 'Catat uang keluar</button>') + '</div>');
    }
    el.innerHTML = pageHead('Keuangan', 'Tagihan, uang masuk, dan uang keluar per bulan.', '<button class="btn btn-primary" data-addx>' + ic('plus') + 'Catat uang keluar</button>') +
      '<div class="row-between wrap mb12">' + monthNav(q.m) + '</div>' +
      '<div class="kpi-grid mb12"><div class="card kpi"><div class="lbl">Uang masuk</div><div class="val success">' + fmt.rp(sIn) + '</div></div><div class="card kpi"><div class="lbl">Uang keluar</div><div class="val danger">' + fmt.rp(sOut) + '</div></div>' +
      '<div class="card kpi"><div class="lbl">Selisih kas</div><div class="val ' + (sIn - sOut >= 0 ? '' : 'danger') + '">' + fmt.rp(sIn - sOut) + '</div></div><div class="card kpi"><div class="lbl">Total tagihan</div><div class="val warnc">' + fmt.rp(sUnpaid) + '</div><div class="foot">' + V.unpaid.length + ' pesanan</div></div></div>' +
      '<div class="seg mb12">' + tabs.map(t => '<button data-tab="' + t[0] + '" class="' + (q.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div>' + body;
    el.onclick = e => {
      const t = e.target.closest('[data-tab]'); if (t) { go('keuangan', null, Object.assign({}, q, { tab: t.dataset.tab })); return; }
      const m = e.target.closest('[data-m]'); if (m) { go('keuangan', null, Object.assign({}, q, { m: shiftMonth(q.m, +m.dataset.m) })); return; }
      const pb = e.target.closest('[data-pay]'); if (pb) { openPayment(pb.dataset.pay); return; }
      if (e.target.closest('[data-addx]')) { expenseForm(); return; }
      const xm = e.target.closest('[data-xm]'); if (xm) { const x = V.expenses.find(z => z.id === xm.dataset.xm); UI.menu(xm, [{ label: 'Ubah', icon: 'pencil', run: () => expenseForm(x) }, { label: 'Hapus', icon: 'trash-2', danger: true, run: async () => { if (!(await UI.confirm({ title: 'Hapus pengeluaran ini?', msg: fmt.rp(x.jumlah) + ' · ' + x.kategori, ok: 'Hapus', danger: true }))) return; const r = await api('voidExpense', { id: x.id }); UI.toast(r.success ? 'Dihapus.' : r.message, r.success ? 'ok' : 'err'); } }]); }
    };
  }
});

/* ============================ LAPORAN ============================ */
function monthReport(V, ym) {
  const orders = V.live.filter(o => o.tgl_pesan.slice(0, 7) === ym);
  const pays = V.payments.filter(p => p.tgl.slice(0, 7) === ym), outs = V.expenses.filter(x => x.tgl.slice(0, 7) === ym);
  const [y, m] = ym.split('-').map(Number), nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length: nd }, (_, i) => ym + '-' + String(i + 1).padStart(2, '0'));
  const inMap = {}, outMap = {};
  pays.forEach(p => { inMap[p.tgl] = (inMap[p.tgl] || 0) + p.jumlah; });
  outs.forEach(x => { outMap[x.tgl] = (outMap[x.tgl] || 0) + x.jumlah; });
  const inDay = days.map(d => inMap[d] || 0);
  const outDay = days.map(d => outMap[d] || 0);
  const sizes = {}; orders.forEach(o => o.items.forEach(b => b.sizes.forEach(z => { sizes[z.ukuran] = (sizes[z.ukuran] || 0) + z.qty; })));
  const custs = {}; orders.forEach(o => { custs[o.cust.nama] = (custs[o.cust.nama] || 0) + o.total; });
  const items = {}; orders.forEach(o => o.items.forEach(b => { const k = b.jenis; items[k] = items[k] || { pcs: 0, total: 0 }; items[k].pcs += b.qty_total; items[k].total += b.subtotal; }));
  return { orders, pays, outs, days, inDay, outDay, sizes, custs, items,
    sales: orders.reduce((a, o) => a + o.total, 0), pcs: orders.reduce((a, o) => a + o.pcs, 0),
    sIn: pays.reduce((a, p) => a + p.jumlah, 0), sOut: outs.reduce((a, p) => a + p.jumlah, 0) };
}
registerPage('laporan', {
  title: 'Laporan', auth: 'owner',
  header: () => ({ title: 'Laporan bulanan', sub: 'Khusus Pemilik', back: 'lainnya' }),
  render(el, p, query) {
    if (needData(el)) return;
    const V = Data.view(), ym = (query && query.m) || today().slice(0, 7), R = monthReport(V, ym);
    const sizeKeys = Object.keys(R.sizes).sort((a, b) => R.sizes[b] - R.sizes[a]);
    const topC = Object.entries(R.custs).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topI = Object.entries(R.items).sort((a, b) => b[1].pcs - a[1].pcs).slice(0, 6);
    const stageNow = V.stages.map(s => [s, V.live.filter(o => o.tahap === s.kode).length]);
    el.innerHTML = pageHead('Laporan bulanan', 'Penjualan, kas, produksi, dan ukuran terlaris.', '<button class="btn btn-ghost" data-xls>' + ic('file-spreadsheet') + 'Unduh Excel</button>') +
      '<div class="row-between wrap mb12">' + monthNav(ym) + '<button class="btn btn-ghost only-mob flex" data-xls>' + ic('file-spreadsheet') + 'Excel</button></div>' +
      '<div class="kpi-grid"><div class="card kpi"><div class="lbl">Penjualan (pesanan baru)</div><div class="val">' + fmt.rp(R.sales) + '</div><div class="foot">' + R.orders.length + ' pesanan · ' + fmt.num(R.pcs) + ' pcs</div></div>' +
      '<div class="card kpi"><div class="lbl">Uang masuk</div><div class="val success">' + fmt.rp(R.sIn) + '</div></div><div class="card kpi"><div class="lbl">Uang keluar</div><div class="val danger">' + fmt.rp(R.sOut) + '</div></div>' +
      '<div class="card kpi"><div class="lbl">Selisih kas</div><div class="val">' + fmt.rp(R.sIn - R.sOut) + '</div></div></div>' +
      '<div class="card mt16"><div class="card-head"><h3>' + ic('chart-column') + 'Uang masuk vs keluar per hari</h3></div><div class="card-body"><div style="position:relative;height:240px"><canvas data-chart aria-label="Grafik uang masuk dan keluar"></canvas><div data-chart-fb class="small muted" hidden></div></div></div></div>' +
      '<div class="dash-grid mt16"><div class="stack">' +
      '<div class="card"><div class="card-head"><h3>' + ic('ruler') + 'Pcs per ukuran</h3><span class="small muted">' + fmt.num(R.pcs) + ' pcs</span></div><div class="card-body">' + (sizeKeys.length ? '<div class="stack-sm">' + sizeKeys.map(k => { const w = Math.round(R.sizes[k] / R.sizes[sizeKeys[0]] * 100); return '<div class="row"><span class="tag" style="min-width:64px;justify-content:center">' + esc(k) + '</span><div class="grow bar-progress" style="height:10px"><i style="width:' + w + '%;background:var(--pri)"></i></div><span class="num semi" style="min-width:64px;text-align:right">' + fmt.num(R.sizes[k]) + '</span></div>'; }).join('') + '</div>' : '<div class="small muted">Belum ada pesanan bulan ini.</div>') + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>' + ic('shirt') + 'Barang terlaris</h3></div><div class="table-wrap"><table class="table"><thead><tr><th>Barang</th><th class="r">Pcs</th><th class="r">Nilai</th></tr></thead><tbody>' + (topI.length ? topI.map(([k, v]) => '<tr style="cursor:default"><td>' + esc(k) + '</td><td class="r num">' + fmt.num(v.pcs) + '</td><td class="r num">' + fmt.rp(v.total) + '</td></tr>').join('') : '<tr><td colspan="3" class="muted">-</td></tr>') + '</tbody></table></div></div>' +
      '</div><div class="stack"><div class="card"><div class="card-head"><h3>' + ic('kanban') + 'Pesanan per tahap (saat ini)</h3></div><div class="list">' + stageNow.map(([s, n]) => '<div class="li" style="cursor:default">' + UI.stage(s.kode) + '<span class="grow"></span><b class="num">' + n + '</b></div>').join('') + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>' + ic('users') + 'Pelanggan terbesar</h3></div><div class="list">' + (topC.length ? topC.map(([k, v]) => '<div class="li" style="cursor:default"><span class="grow ellipsis">' + esc(k) + '</span><b class="num">' + fmt.rp(v) + '</b></div>').join('') : '<div class="li small muted">-</div>') + '</div></div></div></div><div style="height:16px"></div>';
    el.onclick = e => {
      const m = e.target.closest('[data-m]'); if (m) { go('laporan', null, { m: shiftMonth(ym, +m.dataset.m) }); return; }
      const x = e.target.closest('[data-xls]'); if (x) exportReport(ym, R, x);
    };
    drawReportChart(el, R);
  }
});
async function drawReportChart(el, R) {
  const cv = $('[data-chart]', el), fb = $('[data-chart-fb]', el);
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js');   // dimuat hanya di halaman Laporan
    if (!cv.isConnected) return;
    if (cv._chart) cv._chart.destroy();
    cv._chart = new window.Chart(cv, {
      type: 'bar',
      data: { labels: R.days.map(d => +d.slice(8)), datasets: [{ label: 'Uang masuk', data: R.inDay, backgroundColor: '#10B981', borderRadius: 4 }, { label: 'Uang keluar', data: R.outDay, backgroundColor: '#EF4444', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { title: it => 'Tanggal ' + it[0].label, label: c => c.dataset.label + ': ' + fmt.rp(c.raw) } } },
        scales: { y: { ticks: { callback: v => fmt.rpShort(v) } }, x: { grid: { display: false } } } }
    });
  } catch (e) {
    cv.hidden = true; fb.hidden = false;
    fb.innerHTML = 'Grafik tidak bisa dimuat (offline). Ringkasan: masuk ' + fmt.rp(R.sIn) + ', keluar ' + fmt.rp(R.sOut) + '.';
  }
}
async function exportReport(ym, R, btn) {
  const sheets = {
    Ringkasan: [['Bulan', fmt.month(ym)], ['Penjualan', R.sales], ['Jumlah pesanan', R.orders.length], ['Total pcs', R.pcs], ['Uang masuk', R.sIn], ['Uang keluar', R.sOut], ['Selisih kas', R.sIn - R.sOut]],
    Pesanan: [['No nota', 'Tanggal', 'Pelanggan', 'Barang', 'Pcs', 'Tahap', 'Total', 'Dibayar', 'Sisa']].concat(R.orders.map(o => [o.no_nota, o.tgl_pesan, o.cust.nama, o.summary, o.pcs, stageName(o.tahap), o.total, o.dibayar, o.sisa])),
    'Uang masuk': [['Tanggal', 'No nota', 'Pelanggan', 'Metode', 'Jumlah']].concat(R.pays.map(p => { const o = Data.view().ordersById[p.pesanan_id]; return [p.tgl, o ? o.no_nota : '', o ? o.cust.nama : '', methodLabel(p.metode), p.jumlah]; })),
    'Uang keluar': [['Tanggal', 'Kategori', 'Keterangan', 'Jumlah']].concat(R.outs.map(x => [x.tgl, x.kategori, x.keterangan, x.jumlah])),
    'Pcs per ukuran': [['Ukuran', 'Pcs']].concat(Object.entries(R.sizes))
  };
  await UI.busy(btn, async () => {
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
      const wb = window.XLSX.utils.book_new();
      Object.keys(sheets).forEach(n => window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(sheets[n]), n));
      window.XLSX.writeFile(wb, 'Laporan-Si-MAKO-' + ym + '.xlsx');
    } catch (e) {
      const csv = '﻿' + Object.keys(sheets).map(n => '## ' + n + '\n' + sheets[n].map(r => r.map(v => { v = String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';')).join('\n')).join('\n\n');
      download('Laporan-Si-MAKO-' + ym + '.csv', csv, 'text/csv;charset=utf-8');
    }
    UI.toast('Laporan ' + fmt.month(ym) + ' diunduh.');
  });
}
