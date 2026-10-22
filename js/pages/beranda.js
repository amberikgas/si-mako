/* ============================================================
   BERANDA — HP: panel tugas · Desktop: dasbor (F-02)
   ============================================================ */
'use strict';

function todoList(V) {
  // yang perlu dikerjakan: belum diambil, urut tenggat; yang siap diambil di belakang
  return V.active.slice().sort((a, b) => (a.ready - b.ready) || (a.tenggat < b.tenggat ? -1 : a.tenggat > b.tenggat ? 1 : 0));
}
function orderCard(o, opt) {
  opt = opt || {};
  return '<a class="order-card edge-' + o.dl.tone + '" href="#/pesanan/' + o.id + '">' +
    '<div class="row-between" style="align-items:flex-start"><div class="grow"><div class="row"><span class="nm ellipsis">' + esc(o.cust.nama) + '</span><span class="small faint nowrap">#' + esc(String(o.no_nota).split(/[\/\-]/).pop()) + '</span></div>' +
    '<div class="sub ellipsis">' + esc(o.summary || '-') + ' (' + fmt.num(o.pcs) + ' pcs)</div></div>' + UI.dl(o) + '</div>' +
    '<div class="meta">' + UI.stage(o.tahap, o.batal) + UI.pay(o.status_bayar) +
    '<span class="sisa ' + (o.sisa > 0 ? 'danger' : 'success') + '">' + (o.sisa > 0 ? 'Sisa ' + fmt.rp(o.sisa) : 'Lunas') + '</span></div>' +
    (opt.extra || '') + '</a>';
}
function onTimeStats(V) {
  const done = V.live.filter(o => o.finishedAt);
  const ok = done.filter(o => o.finishedAt <= o.tenggat).length;
  return { total: done.length, ok, pct: done.length ? Math.round(ok / done.length * 100) : null };
}
function gaugeSvg(pct) {
  const p = pct == null ? 0 : pct, r = 70, c = Math.PI * r, off = c * (1 - p / 100);
  const col = p >= 85 ? '#10B981' : p >= 65 ? '#F59E0B' : '#EF4444';
  return '<svg viewBox="0 0 180 104" width="200" height="116" role="img" aria-label="Tepat waktu ' + (pct == null ? 'belum ada data' : p + ' persen') + '">' +
    '<path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="#E7EAF0" stroke-width="14" stroke-linecap="round"/>' +
    '<path d="M20 94 A70 70 0 0 1 160 94" fill="none" stroke="' + col + '" stroke-width="14" stroke-linecap="round" stroke-dasharray="' + c + '" stroke-dashoffset="' + off + '"/>' +
    '<text x="90" y="80" text-anchor="middle" font-size="30" font-weight="800" fill="#0E1838" font-family="inherit">' + (pct == null ? '–' : p + '%') + '</text></svg>';
}
/** Grafik uang masuk 30 hari (SVG ringan, tanpa pustaka). */
function moneyChart(V) {
  const t = today(), days = [], cur = {}, prev = {};
  for (let i = 29; i >= 0; i--) days.push(addDays(t, -i));
  const start = days[0], prevStart = addDays(start, -30);
  V.payments.forEach(p => {
    if (p.tgl >= start && p.tgl <= t) cur[p.tgl] = (cur[p.tgl] || 0) + p.jumlah;
    else if (p.tgl >= prevStart && p.tgl < start) { const k = addDays(p.tgl, 30); prev[k] = (prev[k] || 0) + p.jumlah; }
  });
  const a = days.map(d => cur[d] || 0), b = days.map(d => prev[d] || 0);
  const sumA = a.reduce((x, y) => x + y, 0), sumB = b.reduce((x, y) => x + y, 0);
  const max = Math.max(1, ...a, ...b), W = 640, H = 200, px = i => 8 + i * (W - 16) / 29, py = v => H - 24 - v / max * (H - 44);
  const path = arr => arr.map((v, i) => (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(v).toFixed(1)).join(' ');
  const area = path(a) + ' L' + px(29) + ' ' + (H - 24) + ' L' + px(0) + ' ' + (H - 24) + ' Z';
  const trend = sumB ? Math.round((sumA - sumB) / sumB * 1000) / 10 : null;
  const labels = [0, 7, 14, 21, 29].map(i => '<text x="' + px(i) + '" y="' + (H - 4) + '" text-anchor="' + (i === 0 ? 'start' : i === 29 ? 'end' : 'middle') + '" font-size="11" fill="#94A3B8">' + fmt.dateShort(days[i]) + '</text>').join('');
  const html = '<div class="card"><div class="card-head" style="align-items:flex-start"><div><div class="overline">Uang masuk · 30 hari</div><div class="row mt8"><span class="money-xl">' + fmt.rpShort(sumA) + '</span>' +
    (trend != null ? '<span class="trend ' + (trend >= 0 ? 'up' : 'down') + '">' + (trend >= 0 ? '▲' : '▼') + ' ' + String(Math.abs(trend)).replace('.', ',') + '%</span>' : '') + '</div><div class="small muted">vs ' + fmt.rpShort(sumB) + ' periode sebelumnya</div></div>' +
    '<div class="row small muted nowrap"><span class="row"><i style="width:10px;height:10px;border-radius:50%;background:#2B5BF5;display:inline-block"></i>30 hari ini</span><span class="row"><i style="width:14px;border-top:2px dashed #94A3B8;display:inline-block"></i>sebelumnya</span></div></div>' +
    '<div class="card-body"><div class="rel" data-chart><svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" style="height:200px;overflow:visible" role="img" aria-label="Grafik uang masuk 30 hari">' +
    '<defs><linearGradient id="gA" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2B5BF5" stop-opacity=".22"/><stop offset="1" stop-color="#2B5BF5" stop-opacity="0"/></linearGradient></defs>' +
    [0.25, 0.5, 0.75].map(f => '<line x1="0" x2="' + W + '" y1="' + (20 + f * (H - 44)) + '" y2="' + (20 + f * (H - 44)) + '" stroke="#EEF1F6"/>').join('') +
    '<path d="' + area + '" fill="url(#gA)"/><path d="' + path(b) + '" fill="none" stroke="#94A3B8" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/>' +
    '<path d="' + path(a) + '" fill="none" stroke="#2B5BF5" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' + labels +
    '<line data-cl x1="0" x2="0" y1="10" y2="' + (H - 24) + '" stroke="#2B5BF5" stroke-dasharray="3 3" visibility="hidden"/></svg>' +
    '<div data-tip class="menu-pop" style="position:absolute;top:0;left:0;right:auto;min-width:170px;padding:8px 10px;pointer-events:none;font-size:12px" hidden></div></div></div></div>';
  return { html, bind(root) {
    const box = root.querySelector('[data-chart]'); if (!box) return;
    const svg = box.querySelector('svg'), tip = box.querySelector('[data-tip]'), cl = box.querySelector('[data-cl]');
    const show = e => {
      const rc = svg.getBoundingClientRect(); const x = (e.clientX - rc.left) / rc.width * W;
      const i = Math.max(0, Math.min(29, Math.round((x - 8) / ((W - 16) / 29))));
      cl.setAttribute('x1', px(i)); cl.setAttribute('x2', px(i)); cl.setAttribute('visibility', 'visible');
      tip.hidden = false; tip.innerHTML = '<div class="muted">' + fmt.date(days[i]) + '</div><div class="semi num">' + fmt.rp(a[i]) + '</div><div class="faint num">' + fmt.rp(b[i]) + ' (sebelumnya)</div>';
      const left = Math.min(Math.max(px(i) / W * rc.width - 85, 0), rc.width - 175); tip.style.left = left + 'px'; tip.style.top = '-8px';
    };
    svg.addEventListener('pointermove', show); svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', () => { tip.hidden = true; cl.setAttribute('visibility', 'hidden'); });
  } };
}

registerPage('beranda', {
  title: 'Beranda',
  render(el) {
    if (needData(el)) return;
    const V = Data.view(), me = Session.me || {}, owner = Session.owner, t = today();
    const unpaidSum = V.unpaid.reduce((a, o) => a + o.sisa, 0);
    const nearDue = V.unpaid.filter(o => !o.done).map(o => o.days).sort((a, b) => a - b)[0];
    const ready = V.active.filter(o => o.ready);
    const nearDeadline = V.active.filter(o => !o.ready && o.days <= 3).length;
    const ym = t.slice(0, 7), prevYm = addDays(ym + '-01', -1).slice(0, 7);
    const inMonth = V.payments.filter(p => p.tgl.slice(0, 7) === ym).reduce((a, p) => a + p.jumlah, 0);
    const inPrev = V.payments.filter(p => p.tgl.slice(0, 7) === prevYm).reduce((a, p) => a + p.jumlah, 0);
    const trend = inPrev ? Math.round((inMonth - inPrev) / inPrev * 1000) / 10 : null;
    const todo = todoList(V);
    const stageCounts = V.stages.filter(s => s.kode !== 'diambil').map(s => ({ s, n: V.active.filter(o => o.tahap === s.kode).length }));
    const ot = onTimeStats(V);
    const chart = moneyChart(V);
    const trendHtml = (v, inv) => v == null ? '' : '<span class="trend ' + ((v >= 0) !== !!inv ? 'up' : 'down') + '">' + (v >= 0 ? '▲' : '▼') + ' ' + String(Math.abs(v)).replace('.', ',') + '%</span>';

    el.innerHTML =
      pageHead('Beranda', 'Pantau pesanan, tagihan, dan tahap produksi hari ini.',
        '<button class="btn btn-ghost" data-act="bayar">' + ic('wallet') + 'Terima Bayaran</button><a class="btn btn-primary" href="#/pesanan-baru">' + ic('plus') + 'Catat Pesanan</a>') +
      // ---- HP: sapaan + tombol besar
      '<div class="only-mob stack">' +
        '<div class="row-between"><span class="pill st-diterima">' + ic('calendar', 'ico-sm') + esc(fmt.dateLong(t)) + '</span></div>' +
        '<div><h1 class="h-hero">' + esc(greeting()) + ', ' + esc((me.nama || '').split(' ')[0]) + '</h1><p class="small muted">' + esc(V.settings.nama_usaha || '') + ' · ' + (owner ? 'Pemilik' : 'Admin') + '</p></div>' +
        '<div class="cta-grid"><a class="cta primary" href="#/pesanan-baru"><div class="row-between"><span class="ci">' + ic('plus') + '</span>' + ic('arrow-up-right', 'ico-sm') + '</div><div><b>Catat Pesanan</b><span>Buat pesanan baru</span></div></a>' +
        '<button class="cta" data-act="bayar"><div class="row-between" style="width:100%"><span class="ci">' + ic('wallet') + '</span>' + ic('arrow-up-right', 'ico-sm') + '</div><div><b>Terima Bayaran</b><span>Uang muka / pelunasan</span></div></button></div>' +
        '<a class="card card-pad" href="#/pesanan?f=belum" style="color:inherit"><div class="row-between"><span class="row small semi muted"><span class="icon-box sm red">' + ic('receipt', 'ico-sm') + '</span>Belum dibayar</span><span class="small semi" style="color:var(--pri)">Lihat tagihan →</span></div>' +
        '<div class="money-xl mt12">' + fmt.rp(unpaidSum) + '</div><div class="small muted mt8">dari ' + V.unpaid.length + ' pesanan' + (nearDue != null ? ' · tenggat terdekat ' + (nearDue < 0 ? 'sudah lewat ' + (-nearDue) + ' hari' : nearDue === 0 ? 'hari ini' : nearDue + ' hari lagi') : '') + '</div></a>' +
      '</div>' +
      // ---- Desktop: kartu angka
      '<div class="kpi-grid only-desk grid">' +
        '<a class="card kpi" href="#/pesanan?f=belum" style="color:inherit"><div class="top"><span class="lbl">Belum dibayar</span><span class="icon-box sm red">' + ic('receipt', 'ico-sm') + '</span></div><div class="val">' + fmt.rp(unpaidSum) + '</div><div class="foot">dari ' + V.unpaid.length + ' pesanan</div></a>' +
        '<a class="card kpi" href="#/pesanan" style="color:inherit"><div class="top"><span class="lbl">Pesanan aktif</span><span class="icon-box sm">' + ic('package-open', 'ico-sm') + '</span></div><div class="val">' + V.active.length + '</div><div class="foot ' + (nearDeadline ? 'warnc semi' : '') + '">' + nearDeadline + ' mendekati / lewat tenggat</div></a>' +
        '<a class="card kpi" href="' + (owner ? '#/keuangan?tab=masuk' : '#/pesanan') + '" style="color:inherit"><div class="top"><span class="lbl">Uang masuk ' + BULAN[+ym.slice(5) - 1] + '</span><span class="icon-box sm green">' + ic('trending-up', 'ico-sm') + '</span></div><div class="val">' + fmt.rp(inMonth) + '</div><div class="foot row">' + trendHtml(trend) + '<span>vs ' + fmt.rpShort(inPrev) + ' bln lalu</span></div></a>' +
        '<a class="card kpi" href="#/produksi?tahap=' + V.readyStage + '" style="color:inherit"><div class="top"><span class="lbl">Siap diambil</span><span class="icon-box sm green">' + ic('circle-check', 'ico-sm') + '</span></div><div class="val">' + ready.length + '</div><div class="foot">menunggu diambil pelanggan</div></a>' +
      '</div>' +
      // ---- peringatan
      '<div class="stack mt12">' +
        (ready.length ? '<a class="banner green" href="#/produksi?tahap=' + V.readyStage + '" style="color:inherit"><span class="icon-box sm green">' + ic('circle-check', 'ico-sm') + '</span><div class="grow"><b>' + ready.length + ' pesanan siap diambil</b><span>' + esc(ready.slice(0, 2).map(o => o.cust.nama).join(', ')) + (ready.length > 2 ? ', …' : '') + '</span></div><span class="btn btn-sm btn-ghost">Lihat</span></a>' : '') +
        (V.lowStock.length ? '<a class="banner amber" href="#/stok" style="color:inherit"><span class="icon-box sm amber">' + ic('triangle-alert', 'ico-sm') + '</span><div class="grow"><b>Stok bahan hampir habis</b><span class="ellipsis">' + esc(V.lowStock.map(b => b.nama + ' sisa ' + fmt.dec(b.stok) + ' ' + b.satuan).join(' · ')) + '</span></div><span class="btn btn-sm btn-ghost">Lihat</span></a>' : '') +
      '</div>' +
      // ---- grafik + tahap
      '<div class="dash-grid mt16"><div class="stack">' +
        '<div class="only-desk block">' + chart.html + '</div>' +
        '<div class="card"><div class="card-head"><h3>Pesanan per tahap</h3><a class="small semi" href="#/produksi">' + V.active.length + ' aktif · Papan →</a></div><div class="card-body"><div class="stage-tiles">' +
          stageCounts.map(x => '<a class="stage-tile st-' + x.s.kode + '" href="#/produksi?tahap=' + x.s.kode + '"><span>' + esc(STAGE_SHORT[x.s.kode] || x.s.nama) + '</span><b>' + x.n + '</b><small>pesanan</small></a>').join('') +
        '</div></div></div>' +
      '</div><div class="stack only-desk flex" style="flex-direction:column">' +
        '<div class="card"><div class="card-head"><h3>Selesai tepat waktu</h3></div><div class="card-body center"><div class="gauge-wrap">' + gaugeSvg(ot.pct) + '</div><div class="small muted">' + (ot.total ? ot.ok + ' dari ' + ot.total + ' pesanan selesai sebelum tenggat' : 'Belum ada pesanan selesai') + '</div></div></div>' +
        '<div class="card"><div class="card-head"><h3>Stok bahan</h3><a class="small semi" href="#/stok">Semua →</a></div>' +
          (V.materials.length ? '<div class="list">' + V.materials.slice().sort((a, b) => (a.stok / (a.minimum || 1)) - (b.stok / (b.minimum || 1))).slice(0, 4).map(b => '<a class="li" href="#/stok"><div class="grow"><div class="semi ellipsis">' + esc(b.nama) + '</div><div class="small muted">min. ' + fmt.dec(b.minimum) + ' ' + esc(b.satuan) + '</div></div><span class="pill ' + (b.stok <= b.minimum ? 'pay-belum_bayar' : 'pay-lunas') + ' num">' + fmt.dec(b.stok) + ' ' + esc(b.satuan) + '</span></a>').join('') + '</div>'
            : '<div class="card-body small muted">Belum ada data bahan.</div>') + '</div>' +
      '</div></div>' +
      // ---- yang perlu dikerjakan
      '<div class="section-title"><h2>Yang perlu dikerjakan <span class="badge blue">' + todo.length + '</span></h2><a class="small semi" href="#/pesanan">Semua →</a></div>' +
      (todo.length ? '<div class="only-mob">' + todo.slice(0, 6).map(o => orderCard(o)).join('') + (todo.length > 6 ? '<a class="btn btn-ghost btn-block mt12" href="#/pesanan">Lihat ' + (todo.length - 6) + ' pesanan lainnya</a>' : '') + '</div>' +
        '<div class="card only-desk block"><div class="table-wrap"><table class="table"><thead><tr><th>No. nota</th><th>Pelanggan</th><th class="r">Pcs</th><th>Tahap</th><th>Status bayar</th><th class="r">Sisa tagihan</th><th>Tenggat</th></tr></thead><tbody>' +
        todo.slice(0, 10).map(o => '<tr data-href="#/pesanan/' + o.id + '"><td class="semi nowrap ' + (o.dl.tone === 'late' ? 'late' : '') + '">' + esc(o.no_nota) + '</td><td><div class="semi">' + esc(o.cust.nama) + '</div><div class="small muted ellipsis" style="max-width:260px">' + esc(o.summary) + '</div></td><td class="r num">' + fmt.num(o.pcs) + '</td><td>' + UI.stage(o.tahap) + '</td><td>' + UI.pay(o.status_bayar) + '</td><td class="r num semi ' + (o.sisa > 0 ? 'danger' : 'success') + '">' + fmt.rp(o.sisa) + '</td><td>' + UI.dl(o) + '</td></tr>').join('') +
        '</tbody></table></div></div>'
        : '<div class="card">' + UI.empty('party-popper', 'Tidak ada pekerjaan tertunda', 'Semua pesanan sudah selesai. Catat pesanan baru untuk memulai.', '<a class="btn btn-primary mt16" href="#/pesanan-baru">' + ic('plus') + 'Catat Pesanan</a>') + '</div>') +
      // ---- HP: tepat waktu
      (ot.total ? '<a class="banner only-mob mt16" href="#/laporan" style="background:var(--soft-blue);border-color:#DCE5FF;color:inherit"><span class="icon-box sm">' + ic('award', 'ico-sm') + '</span><div class="grow"><b>Tepat waktu ' + ot.pct + '%</b><span>' + ot.ok + ' dari ' + ot.total + ' pesanan selesai sebelum tenggat</span></div></a>' : '') +
      '<div style="height:8px"></div>';
    chart.bind(el);
    el.onclick = e => {
      const a = e.target.closest('[data-act]');
      if (a && a.dataset.act === 'bayar') { e.preventDefault(); openPayment(); return; }
      const tr = e.target.closest('tr[data-href]'); if (tr) location.hash = tr.dataset.href;
    };
  }
});
