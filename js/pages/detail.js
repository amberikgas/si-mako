/* ============================================================
   DETAIL PESANAN (F-09) · TERIMA BAYARAN (F-10, Alur B)
   ============================================================ */
'use strict';

function waOrderText(o) {
  const V = Data.view(), biz = V.settings.nama_usaha || 'Konveksi';
  const status = o.ready ? 'sudah *siap diambil*' : o.tahap === 'diambil' ? 'sudah diambil' : 'sedang di tahap *' + stageName(o.tahap) + '*';
  return 'Halo ' + o.cust.nama + ',\n\nPesanan ' + o.no_nota + ' (' + o.summary + ', ' + fmt.num(o.pcs) + ' pcs) ' + status + '.\n' +
    'Total: ' + fmt.rp(o.total) + '\nSudah dibayar: ' + fmt.rp(o.dibayar) + '\n' + (o.sisa > 0 ? 'Sisa tagihan: *' + fmt.rp(o.sisa) + '*\n' : 'Status: *Lunas*\n') +
    (o.sisa > 0 && (V.settings.rekeningList || []).length ? '\nPembayaran ke:\n' + V.settings.rekeningList.map(r => r.bank + ' ' + r.no + ' a.n ' + r.nama).join('\n') + '\n' : '') +
    '\nTerima kasih,\n' + biz;
}
function prodStepper(o) {
  const V = Data.view(), list = V.stages, cur = list.findIndex(s => s.kode === o.tahap);
  return '<div class="prod-steps" role="list">' + list.map((s, i) => {
    const skip = s.kode === 'sablon' && !o.pakai_sablon;
    const cls = skip ? 'skip' : i < cur ? 'done' : i === cur ? 'on' : '';
    return '<div class="ps ' + cls + '" role="listitem" aria-current="' + (i === cur ? 'step' : 'false') + '"><span class="c">' + (skip ? ic('minus', 'ico-sm') : i < cur ? ic('check', 'ico-sm') : ic(STAGE_ICON[s.kode] || 'circle', 'ico-sm')) + '</span><span>' + esc(STAGE_SHORT[s.kode] || s.nama) + '</span>' + (skip ? '<small>dilewati</small>' : '') + '</div>';
  }).join('') + '</div>';
}
function orderMenu(o, anchor) {
  const owner = Session.owner;
  UI.menu(anchor, [
    !o.batal && { label: 'Ubah pesanan', icon: 'pencil', run: () => { OF.s = null; go('pesanan-ubah', o.id); } },
    !o.batal && { label: 'Pindah tahap…', icon: 'git-branch', run: () => moveStageMenu(o) },
    { label: 'Cetak / unduh nota', icon: 'printer', run: () => go('nota', o.id) },
    o.cust.wa && { label: 'Kirim kabar via WhatsApp', icon: 'message-circle', run: () => window.open(UI.waLink(o.cust.wa, waOrderText(o)), '_blank') },
    !o.batal && { label: 'Batalkan pesanan', icon: 'ban', danger: true, run: () => cancelOrder(o) }
  ]);
  if (!owner && o.dibayar > 0) { /* server tetap memeriksa */ }
}
async function cancelOrder(o) {
  if (o.dibayar > 0 && !Session.owner) { UI.toast('Pesanan yang sudah dibayar hanya bisa dibatalkan Pemilik.', 'err'); return; }
  // Bila belum ada uang masuk, cukup minta alasan pembatalan
  if (o.dibayar <= 0) {
    const alasan = await UI.prompt({ title: 'Batalkan pesanan?', msg: o.no_nota + ' — ' + o.cust.nama + '. Pesanan tidak dihapus, hanya ditandai batal.', label: 'Alasan pembatalan', placeholder: 'Contoh: pelanggan membatalkan', ok: 'Batalkan pesanan' });
    if (alasan == null) return;
    const r = await api('cancelOrder', { id: o.id, alasan });
    UI.toast(r.success ? 'Pesanan dibatalkan.' : r.message, r.success ? 'ok' : 'err');
    return;
  }
  // P1: bila sudah ada pembayaran (DP), Pemilik memilih apakah DP dikembalikan atau hangus
  let opsiDp = 'kembalikan';
  const reqId = uid();
  const s = UI.sheet({
    title: 'Batalkan pesanan?',
    icon: 'ban',
    cls: 'dialog',
    body: '<p class="muted mb12">' + esc(o.no_nota) + ' — <b>' + esc(o.cust.nama) + '</b> sudah membayar <b>' + fmt.rp(o.dibayar) + '</b>.</p>' +
      '<div class="field mb12"><span class="lbl">Perlakuan uang yang sudah masuk</span>' +
      '<div class="stack-sm">' +
        '<button type="button" class="choice on" data-dp="kembalikan" style="align-items:flex-start;text-align:left;padding:10px 12px"><b>Kembalikan ke pelanggan (Refund)</b><small>Pembayaran ' + fmt.rp(o.dibayar) + ' ditandai batal & dikeluarkan dari kas masuk.</small></button>' +
        '<button type="button" class="choice" data-dp="hangus" style="align-items:flex-start;text-align:left;padding:10px 12px"><b>Uang muka hangus (Tetap di kas)</b><small>Pembayaran ' + fmt.rp(o.dibayar) + ' tetap tercatat sebagai pemasukan kas.</small></button>' +
      '</div></div>' +
      '<div class="field"><label class="req" for="co-alasan">Alasan pembatalan</label><input id="co-alasan" class="input" placeholder="Contoh: pelanggan membatalkan pesanan" maxlength="200" autofocus><div class="err" data-cerr hidden>Isi alasan pembatalan.</div></div>',
    foot: '<button class="btn btn-ghost" data-no>Kembali</button><button class="btn btn-danger" data-yes>Batalkan pesanan</button>'
  });
  s.body.onclick = e => {
    const b = e.target.closest('[data-dp]');
    if (!b) return;
    opsiDp = b.dataset.dp;
    $$('[data-dp]', s.body).forEach(x => x.classList.toggle('on', x === b));
  };
  const inp = $('#co-alasan', s.body), err = $('[data-cerr]', s.body);
  inp.oninput = () => { inp.classList.remove('invalid'); err.hidden = true; };
  s.foot.querySelector('[data-no]').onclick = () => s.close();
  s.foot.querySelector('[data-yes]').onclick = async e => {
    const alasan = inp.value.trim();
    if (!alasan) { inp.classList.add('invalid'); err.hidden = false; inp.focus(); return; }
    await UI.busy(e.currentTarget, async () => {
      const r = await api('cancelOrder', { id: o.id, alasan, opsi_dp: opsiDp }, { reqId });
      if (!r.success) { UI.toast(r.message, 'err'); return; }
      s.close();
      UI.toast('Pesanan dibatalkan (' + (opsiDp === 'kembalikan' ? 'DP dikembalikan' : 'DP hangus') + ').');
    });
  };
}
async function voidPayment(p) {
  const alasan = await UI.prompt({ title: 'Batalkan pembayaran ini?', msg: fmt.rp(p.jumlah) + ' pada ' + fmt.date(p.tgl) + '. Sisa tagihan akan dihitung ulang.', label: 'Alasan', placeholder: 'Contoh: salah input jumlah', ok: 'Batalkan pembayaran' });
  if (alasan == null) return;
  const r = await api('voidPayment', { id: p.id, alasan });
  UI.toast(r.success ? 'Pembayaran dibatalkan.' : r.message, r.success ? 'ok' : 'err');
}
function methodLabel(m) { m = String(m || ''); if (m === 'tunai') return 'Tunai'; if (m === 'qris') return 'QRIS'; if (m.indexOf('transfer') === 0) return 'Transfer' + (m.split(':')[1] ? ' ' + m.split(':')[1] : ''); return m; }
function methodIcon(m) { m = String(m || ''); return m === 'tunai' ? 'banknote' : m === 'qris' ? 'qr-code' : 'landmark'; }

Pages.pesanan._render = Pages.pesanan.render;
Pages.pesanan.render = function (el, param, query) {
  // #/pesanan/<id> → detail, #/pesanan → daftar
  if (param) return renderDetail(el, param);
  el.classList.remove('is-detail');
  if (el.dataset.mode === 'detail') { el.dataset.built = ''; el.dataset.mode = ''; }
  return Pages.pesanan._render.call(Pages.pesanan, el, param, query);
};
Pages.pesanan.header = param => param ? { title: 'Detail pesanan', sub: (Data.view().ordersById[param] || {}).no_nota || '', back: 'pesanan', actions: '<div class="rel"><button class="btn btn-icon" data-omenu aria-label="Menu pesanan">' + ic('ellipsis-vertical') + '</button></div>' } : null;
Pages.pesanan.hideNav = param => !!param;   // detail: menu bawah diganti tombol aksi

function renderDetail(el, id) {
  el.dataset.mode = 'detail'; el.dataset.built = '';
  if (needData(el)) return;
  const V = Data.view(), o = V.ordersById[id];
  const mt = $('#mtop [data-omenu]'); if (mt) mt.onclick = e => o && orderMenu(o, e.currentTarget);
  if (!o) { el.innerHTML = UI.empty('search-x', 'Pesanan tidak ditemukan', 'Mungkin sudah dihapus atau nomor salah.', '<a class="btn btn-ghost mt16" href="#/pesanan">Kembali ke daftar</a>'); return; }
  const nx = nextStageOf(o), pct = o.total ? Math.min(100, Math.round(o.dibayar / o.total * 100)) : 100;
  const curIdx = V.stages.findIndex(s => s.kode === o.tahap);
  const head = '<div class="card card-pad"><div class="row-between" style="align-items:flex-start"><div class="grow"><div class="small semi faint num">' + esc(o.no_nota) + '</div><h2 class="h-lg">' + esc(o.cust.nama) + '</h2>' +
    (o.cust.wa ? '<a class="small semi" href="' + UI.waLink(o.cust.wa) + '" target="_blank" rel="noopener">' + esc(fmt.wa(o.cust.wa)) + '</a>' : '<span class="small muted">Tanpa no. WA</span>') + '</div>' +
    (o.cust.wa ? '<a class="btn btn-icon btn-success" style="border-radius:50%" href="' + UI.waLink(o.cust.wa, waOrderText(o)) + '" target="_blank" rel="noopener" aria-label="Kirim kabar via WhatsApp">' + ic('message-circle') + '</a>' : '') + '</div>' +
    '<div class="row wrap mt12 small muted">' + ic('calendar', 'ico-sm') + fmt.date(o.tgl_pesan) + ' <span class="faint">·</span> ' + ic('calendar-check', 'ico-sm') + 'Tenggat ' + fmt.date(o.tenggat) + ' ' + UI.dl(o) + '</div>' +
    '<div class="row wrap mt12">' + UI.stage(o.tahap, o.batal) + UI.pay(o.status_bayar) + (o.ambil_dulu ? '<span class="pill pay-uang_muka">Ambil dulu, bayar nanti</span>' : '') + '</div>' +
    (o.batal ? '<div class="banner red mt12"><div>' + ic('ban') + '</div><div><b>Pesanan dibatalkan</b><span>' + esc((o.catatan.match(/Dibatalkan:.*$/m) || [''])[0]) + '</span></div></div>' : '') + '</div>';
  const prod = o.batal ? '' : '<div class="card card-pad"><div class="row-between mb12"><h3 class="h-sm row">' + ic('factory') + 'Progres produksi</h3><span class="badge blue" style="padding:0 10px">Tahap ' + (curIdx + 1) + ' dari ' + V.stages.length + '</span></div>' +
    prodStepper(o) +
    (nx ? '<button class="btn btn-primary btn-lg btn-block mt16" data-next>' + (nx === 'diambil' ? ic('hand-helping') + 'Tandai sudah diambil' : 'Lanjut ke ' + esc(stageName(nx)) + ic('arrow-right')) + '</button>' : '<div class="banner green mt16"><div>' + ic('circle-check') + '</div><div><b>Pesanan selesai</b><span>Sudah diambil pelanggan.</span></div></div>') +
    '<button class="btn btn-link btn-block btn-sm" data-move>Pindah ke tahap lain…</button></div>';
  const items = '<div class="card card-pad"><div class="row-between mb12"><h3 class="h-sm row">' + ic('shirt') + 'Rincian barang</h3><span class="badge blue" style="padding:0 10px">' + o.items.length + ' barang · ' + fmt.num(o.pcs) + ' pcs</span></div>' +
    o.items.map((b, i) => '<div class="' + (i ? 'mt16' : '') + '"><div class="row" style="align-items:flex-start"><span class="icon-box sm">' + ic('shirt', 'ico-sm') + '</span><div class="grow"><div class="semi">' + esc(b.jenis) + '</div><div class="small muted">' + esc([b.keterangan, b.sizeType ? 'Ukuran ' + b.sizeType.nama : ''].filter(Boolean).join(' · ')) + '</div></div><div class="right"><div class="num semi">' + fmt.rp(b.subtotal) + '</div><div class="small muted num">' + fmt.num(b.qty_total) + ' × ' + fmt.rp(b.harga_satuan) + '</div></div></div>' +
      '<div class="table-wrap mt8" style="background:var(--soft);border-radius:12px;padding:4px 12px"><table class="table" style="font-size:14px"><thead><tr><th style="background:none;padding:8px 0">Ukuran</th><th class="r" style="background:none;padding:8px 0">Jumlah</th></tr></thead><tbody>' +
      b.sizes.map(z => '<tr style="cursor:default"><td style="padding:8px 0">' + esc(z.ukuran) + '</td><td class="r num semi" style="padding:8px 0">' + fmt.num(z.qty) + ' pcs</td></tr>').join('') +
      '<tr style="cursor:default"><td style="padding:10px 0" class="semi">Total</td><td class="r num bold" style="padding:10px 0;color:var(--pri)">' + fmt.num(b.qty_total) + ' pcs</td></tr></tbody></table></div></div>').join('') +
    (o.pakai_sablon ? '<div class="banner mt16" style="background:#F5F3FF;border-color:#DDD6FE"><div style="color:#7C3AED">' + ic('palette') + '</div><div><b style="color:#6D28D9">Sablon / bordir</b><span>' + esc(o.catatan_sablon || 'Ada sablon/bordir') + '</span></div></div>' : '') +
    (o.catatan && !o.batal ? '<div class="banner amber mt12"><div>' + ic('notebook-pen') + '</div><div><b>Catatan / SPK</b><span style="white-space:pre-line">' + esc(o.catatan) + '</span></div></div>' : '') + '</div>';
  const pays = o.pays;
  const payCard = '<div class="card card-pad"><div class="row-between mb12"><h3 class="h-sm row">' + ic('wallet') + 'Pembayaran</h3>' + UI.pay(o.status_bayar) + '</div>' +
    '<div class="sum3"><div><small>Total</small><b>' + fmt.rp(o.total) + '</b></div><div><small class="success">Dibayar</small><b class="success">' + fmt.rp(o.dibayar) + '</b></div><div><small class="danger">Sisa</small><b class="danger">' + fmt.rp(o.sisa) + '</b></div></div>' +
    '<div class="row-between mt12 small"><span class="muted semi">Pelunasan</span><span class="semi success">' + pct + '% terbayar</span></div><div class="bar-progress mt8"><i style="width:' + pct + '%"></i></div>' +
    '<div class="overline mt16 mb8">Riwayat pembayaran</div>' +
    (pays.length ? '<div class="stack-sm">' + pays.map(p => '<div class="row" style="padding:8px 0;border-top:1px solid var(--line);' + (p.batal ? 'opacity:.5' : '') + '"><span class="icon-box sm ' + (p.batal ? 'slate' : 'green') + '">' + ic(methodIcon(p.metode), 'ico-sm') + '</span><div class="grow"><div class="semi">' + esc(methodLabel(p.metode)) + (p.batal ? ' <span class="pill st-batal">dibatalkan</span>' : '') + '</div><div class="small muted">' + fmt.date(p.tgl) + ' · ' + esc(p.jenis) + (p.catatan ? ' · ' + esc(p.catatan) : '') + '</div>' +
      (safeUrl(p.bukti_url) ? '<a class="small semi" href="' + safeUrl(p.bukti_url) + '" target="_blank" rel="noopener">' + ic('image', 'ico-sm') + ' Lihat bukti</a>' : '') + '</div><div class="right"><div class="num semi">' + fmt.rp(p.jumlah) + '</div>' +
      (Session.owner && !p.batal ? '<button class="btn-link btn btn-sm danger" data-void="' + p.id + '" style="min-height:32px">Batalkan</button>' : '') + '</div></div>').join('') + '</div>' : '<div class="small muted">Belum ada pembayaran.</div>') +
    (!o.batal && o.sisa > 0 ? '<button class="btn btn-soft btn-block mt12 only-desk flex" data-pay>' + ic('wallet') + 'Terima bayaran</button>' : '') + '</div>';
  const hist = '<details class="card fold" ' + (matchMedia('(min-width:1024px)').matches ? 'open' : '') + '><summary class="card-head"><h3>' + ic('history') + 'Riwayat tahap <span class="badge blue">' + o.hist.length + '</span></h3>' + ic('chevron-down', 'ico fold-ico') + '</summary><div class="card-body"><div class="timeline">' +
    o.hist.map(h => '<div class="tl"><i></i><div><div class="semi">' + (h.dari_tahap ? esc(stageName(h.dari_tahap)) + ' → ' : '') + esc(stageName(h.ke_tahap)) + '</div><div class="small muted">' + esc(fmt.dateTime(h.waktu)) + ' · oleh ' + esc(h.oleh) + (h.catatan ? ' · ' + esc(h.catatan) : '') + '</div></div></div>').join('') + '</div></div></details>';

  el.innerHTML = pageHead(o.no_nota, o.cust.nama + ' · ' + o.summary,
    '<a class="btn btn-ghost" href="#/nota/' + o.id + '">' + ic('printer') + 'Cetak nota</a>' + (!o.batal && o.sisa > 0 ? '<button class="btn btn-primary" data-pay>' + ic('wallet') + 'Terima bayaran</button>' : '') +
    '<div class="rel"><button class="btn btn-ghost btn-icon" data-omenu aria-label="Menu pesanan">' + ic('ellipsis-vertical') + '</button></div>') +
    '<div class="grid-detail"><div class="stack">' + head + prod + items + '</div><div class="stack">' + payCard + hist + '</div></div>' +
    '<div class="foot-bar only-mob"><a class="btn btn-ghost" href="#/nota/' + o.id + '">' + ic('printer') + 'Nota</a>' +
    (!o.batal && o.sisa > 0 ? '<button class="btn btn-primary" data-pay>' + ic('wallet') + 'Terima bayaran</button>' : (o.cust.wa ? '<a class="btn btn-success" href="' + UI.waLink(o.cust.wa, waOrderText(o)) + '" target="_blank" rel="noopener">' + ic('message-circle') + 'Kirim WA</a>' : '')) + '</div>';
  el.onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.hasAttribute('data-next')) advanceStage(o, t);
    else if (t.hasAttribute('data-move')) moveStageMenu(o);
    else if (t.hasAttribute('data-pay')) openPayment(o.id);
    else if (t.hasAttribute('data-omenu')) orderMenu(o, t);
    else if (t.dataset.void) voidPayment(o.pays.find(p => p.id === t.dataset.void));
  };
}

/* ============================ TERIMA BAYARAN ============================ */
function openPayment(orderId) {
  const st = { id: orderId || '', jumlah: 0, metode: 'tunai', tgl: today(), catatan: '', bukti: null, reqId: uid(), q: '' };
  const s = UI.sheet({ title: 'Terima bayaran', icon: 'wallet', sub: 'Catat uang muka atau pelunasan pesanan', cls: 'wide', body: '<div data-pb></div>', foot: '<div data-pf style="display:flex;gap:8px;width:100%;flex-wrap:wrap"></div>' });
  const draw = () => {
    const V = Data.view(), o = st.id && V.ordersById[st.id];
    const body = $('[data-pb]', s.body), foot = $('[data-pf]', s.foot);
    if (!o) {
      const drawList = () => {
        const list = Data.view().unpaid.filter(x => !st.q || x.search.indexOf(st.q.toLowerCase()) > -1).sort((a, b) => b.sisa - a.sisa);
        const box = $('[data-plist]', body); if (!box) return;
        box.innerHTML = list.length ? '<div class="card list">' + list.slice(0, 40).map(x => '<button class="li" data-pick="' + x.id + '"><div class="grow"><div class="semi ellipsis">' + esc(x.cust.nama) + '</div><div class="small muted ellipsis">' + esc(x.no_nota) + ' · ' + esc(x.summary) + '</div></div><div class="right"><div class="num semi danger">' + fmt.rp(x.sisa) + '</div>' + UI.pay(x.status_bayar) + '</div></button>').join('') + '</div>'
          : UI.empty('party-popper', 'Semua pesanan sudah lunas', st.q ? 'Tidak ada yang cocok dengan pencarian.' : 'Tidak ada tagihan tertunda.');
      };
      body.innerHTML = '<div class="overline mb8">1. Pilih pesanan yang belum lunas</div><div class="search mb12">' + ic('search') + '<input class="input" data-pq placeholder="Cari nama atau no. nota" value="' + esc(st.q) + '"></div><div data-plist></div>';
      foot.innerHTML = '<button class="btn btn-ghost btn-block" data-close>Tutup</button>';
      drawList();
      const pq = $('[data-pq]', body); pq.oninput = debounce(() => { st.q = pq.value; drawList(); }, 150);
      return;
    }
    const half = Math.round(o.sisa / 2), after = Math.max(o.sisa - st.jumlah, 0);
    const banks = V.settings.rekeningList || [];
    const methods = [['tunai', 'Tunai', 'banknote']].concat(banks.length ? banks.map(r => ['transfer:' + r.bank, 'Transfer ' + r.bank, 'landmark']) : [['transfer', 'Transfer', 'landmark']]).concat([['qris', 'QRIS', 'qr-code']]);
    const bank = st.metode.indexOf('transfer:') === 0 ? banks.find(r => 'transfer:' + r.bank === st.metode) : null;
    body.innerHTML =
      '<div class="row-between"><div class="overline">1. Pesanan</div>' + (orderId ? '' : '<button class="btn-link btn btn-sm" data-change>' + ic('arrow-left-right', 'ico-sm') + 'Ganti pesanan</button>') + '</div>' +
      '<div class="card card-pad mt8" style="background:var(--soft)"><div class="row-between"><div class="grow"><div class="semi ellipsis">' + esc(o.cust.nama) + '</div><div class="small muted ellipsis">' + esc(o.no_nota) + ' · ' + esc(o.summary) + '</div></div>' + UI.pay(o.status_bayar) + '</div>' +
      '<div class="sum3 mt12"><div style="background:#fff"><small>Total</small><b>' + fmt.rp(o.total) + '</b></div><div style="background:#fff"><small>Dibayar</small><b class="success">' + fmt.rp(o.dibayar) + '</b></div><div style="background:#fff"><small>Sisa</small><b class="danger">' + fmt.rp(o.sisa) + '</b></div></div></div>' +
      '<div class="overline mt16 mb8">2. Jumlah dibayar</div>' +
      '<div class="input-group"><span class="prefix">Rp</span><input class="input money" style="font-size:22px;min-height:56px" data-amt inputmode="numeric" placeholder="0" value="' + (st.jumlah ? fmt.num(st.jumlah) : '') + '" aria-label="Jumlah dibayar"></div>' +
      '<div class="choice-grid mt8"><button class="choice ' + (st.jumlah === half && half !== o.sisa ? 'on' : '') + '" data-q="' + half + '">50% sisa<small class="num">' + fmt.rp(half) + '</small></button><button class="choice ' + (st.jumlah === o.sisa ? 'on' : '') + '" data-q="' + o.sisa + '">Lunas<small class="num">' + fmt.rp(o.sisa) + '</small></button><button class="choice" data-q="0">Kosongkan<small>&nbsp;</small></button></div>' +
      '<div class="err mt8" data-aerr hidden></div>' +
      '<div class="row-between mt12" data-after style="padding:10px 12px;border-radius:12px;background:' + (after ? 'var(--warn-soft)' : 'var(--ok-soft)') + '"><span class="small semi">' + ic('badge-check', 'ico-sm') + ' Sisa setelah pembayaran</span><span class="semi num ' + (after ? 'warnc' : 'success') + '">' + (st.jumlah ? (after ? fmt.rp(after) : 'Rp 0 (Lunas)') : fmt.rp(o.sisa)) + '</span></div>' +
      '<div class="overline mt16 mb8">3. Dibayar lewat</div><div class="choice-grid">' + methods.map(m => '<button class="choice ' + (st.metode === m[0] ? 'on' : '') + '" data-met="' + esc(m[0]) + '">' + ic(m[2]) + esc(m[1]) + '</button>').join('') + '</div>' +
      (bank ? '<div class="row card mt8" style="padding:10px 12px;background:var(--soft-blue);border-color:#DCE5FF"><span class="tag" style="background:#fff;color:var(--pri)">' + esc(bank.bank) + '</span><div class="grow"><div class="semi num">' + esc(bank.no) + '</div><div class="small muted">a.n ' + esc(bank.nama) + '</div></div><button class="btn btn-sm btn-ghost" data-copy="' + esc(bank.no) + '">' + ic('copy', 'ico-sm') + 'Salin</button></div>' : '') +
      '<div class="grid2 mt16"><div class="field"><label for="pb-tgl">Tanggal bayar</label><input id="pb-tgl" type="date" class="input" data-tgl value="' + esc(st.tgl) + '" max="' + today() + '"></div>' +
      '<div class="field"><span class="lbl">Foto bukti <span class="faint">(opsional)</span></span>' + (st.bukti ? '<div class="row card" style="padding:6px 8px;min-height:44px">' + (st.bukti.dataUrl ? '<img src="' + st.bukti.dataUrl + '" alt="" style="width:32px;height:32px;object-fit:cover;border-radius:6px">' : ic('file-text')) + '<span class="grow small ellipsis">' + esc(st.bukti.name) + '</span><button class="btn btn-icon btn-sm" data-rmb aria-label="Hapus foto" style="min-height:32px;min-width:32px">' + ic('x', 'ico-sm') + '</button></div>' : '<label class="btn btn-ghost" style="cursor:pointer">' + ic('camera') + 'Foto<input type="file" accept="image/*,application/pdf" data-bukti hidden></label>') + '</div></div>' +
      '<div class="field mt12"><label for="pb-cat">Catatan <span class="faint">(opsional)</span></label><input id="pb-cat" class="input" data-cat maxlength="300" value="' + esc(st.catatan) + '" placeholder="Contoh: dibayar oleh Pak Bambang"></div>';
    foot.innerHTML = '<button class="btn btn-ghost" data-save="0">Simpan saja</button><button class="btn btn-primary" data-save="1" style="flex:1.6">' + ic('printer') + 'Simpan & cetak nota</button>';
    const amt = $('[data-amt]', body);
    amt.oninput = () => {
      st.jumlah = parseMoney(amt.value); amt.value = st.jumlah ? fmt.num(st.jumlah) : '';
      const e2 = $('[data-aerr]', body); e2.hidden = !(st.jumlah > o.sisa); e2.textContent = 'Melebihi sisa tagihan ' + fmt.rp(o.sisa) + '.';
      const af = Math.max(o.sisa - st.jumlah, 0), box = $('[data-after]', body);
      box.style.background = af ? 'var(--warn-soft)' : 'var(--ok-soft)';
      box.lastElementChild.className = 'semi num ' + (af ? 'warnc' : 'success');
      box.lastElementChild.textContent = st.jumlah ? (af ? fmt.rp(af) : 'Rp 0 (Lunas)') : fmt.rp(o.sisa);
      $$('[data-q]', body).forEach(b => b.classList.toggle('on', +b.dataset.q === st.jumlah && st.jumlah > 0));
    };
    $('[data-tgl]', body).onchange = e => { st.tgl = e.target.value; };
    $('[data-cat]', body).oninput = e => { st.catatan = e.target.value; };
    const fb = $('[data-bukti]', body); if (fb) fb.onchange = async () => { try { st.bukti = await readImage(fb.files[0], 1600, 0.8); draw(); } catch (er) { UI.toast(er.message, 'err'); } };
  };
  s.el.addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.pick) { st.id = t.dataset.pick; st.jumlah = 0; draw(); s.body.scrollTop = 0; return; }
    if (t.hasAttribute('data-change')) { st.id = ''; draw(); return; }
    if (t.dataset.q != null) { st.jumlah = +t.dataset.q; draw(); return; }
    if (t.dataset.met) { st.metode = t.dataset.met; draw(); return; }
    if (t.dataset.copy) { try { await navigator.clipboard.writeText(t.dataset.copy); UI.toast('Nomor rekening disalin.'); } catch (er) {} return; }
    if (t.hasAttribute('data-rmb')) { st.bukti = null; draw(); return; }
    if (t.hasAttribute('data-close')) { s.close(); return; }
    if (t.dataset.save != null) {
      const o = Data.view().ordersById[st.id];
      if (!st.jumlah) { const e2 = $('[data-aerr]', s.body); e2.textContent = 'Isi jumlah yang dibayar.'; e2.hidden = false; $('[data-amt]', s.body).focus(); return; }
      if (st.jumlah > o.sisa) return;
      await UI.busy(t, async () => {
        const r = await api('addPayment', { pesanan_id: st.id, jumlah: st.jumlah, metode: st.metode, tgl: st.tgl, catatan: st.catatan, bukti: st.bukti ? { name: st.bukti.name, mime: st.bukti.mime, b64: st.bukti.b64 } : null }, { reqId: st.reqId });
        if (!r.success) { if (!r.network) st.reqId = uid(); UI.toast(r.message, 'err'); return; }
        s.close();
        UI.toast('Pembayaran ' + fmt.rp(st.jumlah) + ' tersimpan' + (r.data.status_bayar === 'lunas' ? ' — LUNAS.' : '. Sisa ' + fmt.rp(r.data.sisa) + '.'));
        if (t.dataset.save === '1') go('nota', st.id, { cetak: 1 });
      });
    }
  });
  draw();
}
