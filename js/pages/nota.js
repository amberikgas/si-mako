/* ============================================================
   NOTA siap cetak & PDF (F-12)
   ============================================================ */
'use strict';

function notaHtml(o) {
  const V = Data.view(), S = V.settings, banks = S.rekeningList || [];
  const paid = o.pays.filter(p => !p.batal);
  return '<article class="nota" id="nota-doc">' +
    '<div class="n-head">' + (safeUrl(S.logo) ? '<img class="logo" src="' + safeUrl(S.logo) + '" alt="Logo">' : '<div class="logo">' + esc(fmt.initials(S.nama_usaha)) + '</div>') +
    '<div class="grow"><div class="h-md" style="font-weight:800">' + esc(S.nama_usaha || 'Konveksi') + '</div>' + (S.tagline ? '<div class="overline" style="color:#334155">' + esc(S.tagline) + '</div>' : '') +
    (S.alamat ? '<div class="small muted mt8">' + esc(S.alamat) + '</div>' : '') + (S.wa ? '<div class="small muted">WA ' + esc(fmt.wa(S.wa)) + '</div>' : '') + '</div></div>' +
    '<div class="title-bar"><span>NOTA PESANAN</span><span class="num">' + esc(o.no_nota) + '</span></div>' +
    '<div class="grid2 small"><div><div class="muted">Tanggal pesan</div><div class="semi">' + fmt.date(o.tgl_pesan) + '</div></div><div class="right"><div class="muted">Tenggat selesai</div><div class="semi">' + fmt.date(o.tenggat) + '</div></div></div>' +
    '<div class="box mt12"><div class="overline">Kepada</div><div class="semi mt8" style="font-size:16px">' + esc(o.cust.nama) + '</div>' + (o.cust.wa ? '<div class="small">WA ' + esc(fmt.wa(o.cust.wa)) + '</div>' : '') + (o.cust.alamat ? '<div class="small muted">' + esc(o.cust.alamat) + '</div>' : '') + '</div>' +
    '<div class="mt16"><div class="row-between overline" style="border-bottom:2px solid #0F172A;padding-bottom:6px"><span>Barang & rincian ukuran</span><span>Subtotal</span></div>' +
    o.items.map((b, i) => '<div class="item"><div class="row-between" style="align-items:flex-start"><div class="grow"><div class="semi">' + (i + 1) + '. ' + esc(b.jenis) + '</div>' + (b.keterangan ? '<div class="small muted">' + esc(b.keterangan) + '</div>' : '') +
      '<div class="small mt8 num">' + fmt.num(b.qty_total) + ' pcs × ' + fmt.rp(b.harga_satuan) + '</div></div><div class="semi num nowrap">' + fmt.rp(b.subtotal) + '</div></div>' +
      '<div class="row wrap mt8" style="gap:4px">' + b.sizes.map(z => '<span class="tag" style="background:#F1F5F9">' + esc(z.ukuran) + ': ' + fmt.num(z.qty) + '</span>').join('') + '</div></div>').join('') + '</div>' +
    (o.pakai_sablon ? '<div class="small mt8"><b>Sablon/bordir:</b> ' + esc(o.catatan_sablon || 'Ya') + '</div>' : '') +
    '<div class="ledger mt16" style="border-top:1px solid #CBD5E1;padding-top:8px">' +
    '<div class="row-between"><span class="muted">Total (' + fmt.num(o.pcs) + ' pcs)</span><span class="bold num" style="font-size:16px">' + fmt.rp(o.total) + '</span></div>' +
    paid.map(p => '<div class="row-between small"><span class="muted">Dibayar ' + fmt.dateShort(p.tgl) + ' · ' + esc(methodLabel(p.metode)) + '</span><span class="num success">' + fmt.rp(p.jumlah) + '</span></div>').join('') +
    '<div class="row-between"><span class="muted">Sudah dibayar</span><span class="semi num success">' + fmt.rp(o.dibayar) + '</span></div></div>' +
    '<div class="sisa-box mt12 ' + (o.sisa > 0 ? '' : 'lunas') + '"><div class="row-between"><div><div class="overline" style="color:' + (o.sisa > 0 ? '#B91C1C' : '#047857') + '">' + (o.sisa > 0 ? 'Sisa tagihan' : 'Status') + '</div>' +
    (o.sisa > 0 ? '<div class="small muted">Mohon dilunasi sebelum barang diambil</div>' : '') + '</div><div class="money-lg" style="color:' + (o.sisa > 0 ? '#B91C1C' : '#047857') + '">' + (o.sisa > 0 ? fmt.rp(o.sisa) : 'LUNAS') + '</div></div></div>' +
    (banks.length && o.sisa > 0 ? '<div class="box mt12"><div class="overline">Pembayaran transfer</div>' + banks.map(r => '<div class="mt8"><b>' + esc(r.bank) + ' ' + esc(r.no) + '</b><div class="small muted">a.n ' + esc(r.nama) + '</div></div>').join('') + '</div>' : '') +
    (S.syarat_nota ? '<div class="small muted mt12" style="line-height:1.5"><b style="color:#334155">Syarat & ketentuan:</b> ' + esc(S.syarat_nota) + '</div>' : '') +
    '<div class="sign"><div><div class="muted">Pemesan</div><div class="ln"></div><b>' + esc(o.cust.nama) + '</b></div><div><div class="muted">Hormat kami</div><div class="ln" style="display:grid;place-items:center">' +
    (o.sisa <= 0 ? '<span class="stamp" style="color:#059669">LUNAS</span>' : o.dibayar > 0 ? '<span class="stamp" style="color:#D97706">UANG MUKA</span>' : '') + '</div><b>' + esc(S.ttd_nama || S.nama_usaha || '') + '</b></div></div>' +
    '<div class="xs faint center mt16">Dicetak ' + esc(fmt.dateTime(new Date().toISOString())) + ' · Si-MAKO</div></article>';
}
async function notaPdf(o, btn) {
  await UI.busy(btn, async () => {
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
      const elDoc = $('#nota-doc');
      await window.html2pdf().set({ margin: 8, filename: 'Nota-' + o.no_nota.replace(/[\/\\]/g, '-') + '.pdf', image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'mm', format: 'a5', orientation: 'portrait' } }).from(elDoc).save();
      UI.toast('PDF nota diunduh.');
    } catch (e) {
      UI.toast('PDF tidak bisa dibuat di perangkat ini. Pakai Cetak → Simpan sebagai PDF.', 'err');
      window.print();
    }
  });
}
registerPage('nota', {
  title: 'Nota', nav: 'pesanan', hideNav: true,
  header: id => ({ title: 'Nota pesanan', sub: (Data.view().ordersById[id] || {}).no_nota || '', back: 'pesanan' }),
  render(el, id, query) {
    if (needData(el)) return;
    const o = Data.view().ordersById[id];
    if (!o) { el.innerHTML = UI.errorBox('Pesanan tidak ditemukan.'); return; }
    el.innerHTML = '<div class="no-print row wrap mb12" style="max-width:720px;margin:0 auto 12px;gap:8px">' +
      '<a class="btn btn-ghost only-desk flex" href="#/pesanan/' + o.id + '">' + ic('arrow-left') + 'Kembali</a><span class="grow only-desk block"></span>' +
      '<button class="btn btn-ghost grow" data-print>' + ic('printer') + 'Cetak</button><button class="btn btn-primary grow" data-pdf>' + ic('download') + 'Unduh PDF</button></div>' +
      notaHtml(o) +
      (o.cust.wa ? '<div class="no-print card card-pad mt12 row" style="max-width:720px;margin:12px auto 0"><span class="icon-box green">' + ic('message-circle') + '</span><div class="grow"><b>Kirim ringkasan ke WhatsApp</b><div class="small muted">Ke ' + esc(o.cust.nama) + ' (' + esc(fmt.wa(o.cust.wa)) + '). Lampirkan PDF nota secara manual bila perlu.</div></div><a class="btn btn-success" target="_blank" rel="noopener" href="' + UI.waLink(o.cust.wa, waOrderText(o)) + '">Kirim</a></div>' : '') +
      '<div style="height:24px"></div>';
    el.onclick = e => { if (e.target.closest('[data-print]')) window.print(); const b = e.target.closest('[data-pdf]'); if (b) notaPdf(o, b); };
    if (query && query.cetak) { setQuery({}); setTimeout(() => window.print(), 400); }
  }
});
