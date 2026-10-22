/* ============================================================
   CATAT / UBAH PESANAN — 3 langkah: Pelanggan → Barang → Bayar (F-04, F-05)
   Draf tersimpan otomatis di perangkat; angka akhir tetap dihitung server.
   ============================================================ */
'use strict';

const OF = { s: null };   // state form

function newItem(V) {
  const def = V.sizeTypes.find(j => j.bawaan) || V.sizeTypes[0];
  return { key: uid(), jenis: '', keterangan: '', jenis_ukuran_id: def ? def.id : '', harga_satuan: 0, harga_ref_id: '', qty: {}, extra: [] };
}
function itemSizes(V, it) {
  const t = V.sizeTypeMap[it.jenis_ukuran_id];
  const base = t ? t.sizes : [];
  return base.concat(it.extra.filter(x => base.indexOf(x) < 0));
}
function itemPcs(V, it) { return itemSizes(V, it).reduce((a, s) => a + (parseInt(it.qty[s], 10) || 0), 0); }
function formTotals(V, s) {
  const items = s.items.map(it => { const pcs = itemPcs(V, it); return { pcs, sub: pcs * (it.harga_satuan || 0) }; });
  return { pcs: items.reduce((a, x) => a + x.pcs, 0), total: items.reduce((a, x) => a + x.sub, 0), items };
}
const saveDraft = debounce(() => {
  if (!OF.s || OF.s.mode !== 'new' || OF.s.saved) return;
  const d = JSON.parse(JSON.stringify(OF.s)); if (d.bayar) delete d.bayar.bukti;
  d.savedAt = Date.now(); LS.set('draft', d);
  const st = $('[data-draft-at]'); if (st) st.textContent = 'Draf tersimpan ' + new Date().toTimeString().slice(0, 5);
}, 500);

function initForm(V, mode, orderId, query) {
  if (mode === 'edit') {
    const o = V.ordersById[orderId]; if (!o) return null;
    return {
      mode: 'edit', id: o.id, diubah_pada: o.diubah_pada, step: 2, pelanggan_id: o.pelanggan_id, baru: null,
      tgl_pesan: o.tgl_pesan, tenggat: o.tenggat, pakai_sablon: o.pakai_sablon, catatan_sablon: o.catatan_sablon, catatan: o.catatan,
      items: o.items.map(b => {
        const t = V.sizeTypeMap[b.jenis_ukuran_id], base = t ? t.sizes : [], qty = {}, extra = [];
        b.sizes.forEach(z => { qty[z.ukuran] = z.qty; if (base.indexOf(z.ukuran) < 0) extra.push(z.ukuran); });
        return { key: uid(), jenis: b.jenis, keterangan: b.keterangan, jenis_ukuran_id: b.jenis_ukuran_id, harga_satuan: b.harga_satuan, harga_ref_id: b.harga_ref_id, qty, extra };
      }),
      bayar: { pilih: '0', jumlah: 0, metode: 'tunai' }
    };
  }
  const draft = LS.get('draft');
  if (draft && draft.mode === 'new' && !query.pelanggan && Date.now() - (draft.savedAt || 0) < 7 * 864e5) { draft.restored = true; draft.saved = false; return draft; }
  const s = { mode: 'new', step: 1, pelanggan_id: query.pelanggan || '', baru: null, tgl_pesan: today(), tenggat: '', pakai_sablon: false, catatan_sablon: '', catatan: '',
    items: [newItem(V)], bayar: { pilih: '0', jumlah: 0, metode: 'tunai' } };
  return s;
}

function stepsBar(s) {
  const names = ['Pelanggan', 'Barang', s.mode === 'edit' ? 'Catatan' : 'Bayar'];
  return '<div class="steps" aria-label="Langkah">' + names.map((n, i) => {
    const k = i + 1, cls = k === s.step ? 'on' : k < s.step ? 'done' : '';
    return (i ? '<span class="bar ' + (k <= s.step ? 'done' : '') + '"></span>' : '') + '<button type="button" class="st ' + cls + '" data-goto="' + k + '" style="border:0;background:none;padding:0;min-height:44px" ' + (k > s.step ? 'disabled' : '') + '><span class="n">' + (k < s.step ? ic('check', 'ico-sm') : k) + '</span><span class="' + (k === s.step ? '' : 'only-desk') + '">' + n + '</span></button>';
  }).join('') + '</div>';
}

/* ---------------- Langkah 1: pelanggan & tanggal ---------------- */
function step1(V, s) {
  const c = s.pelanggan_id && V.customers[s.pelanggan_id];
  let custHtml;
  if (c) {
    const st = V.custStats[c.id];
    custHtml = '<div class="row" style="align-items:flex-start"><div class="avatar lg">' + esc(fmt.initials(c.nama)) + '</div><div class="grow"><span class="pill pay-lunas">Pelanggan dipilih</span><div class="h-sm mt8">' + esc(c.nama) + '</div>' +
      '<div class="small muted">' + esc(fmt.wa(c.wa) || 'Tanpa no. WA') + (st ? ' · ' + st.count + ' pesanan' + (st.utang ? ' · <span class="danger semi">utang ' + fmt.rp(st.utang) + '</span>' : '') : '') + '</div></div>' +
      '<button type="button" class="btn btn-soft btn-sm" data-act="ganti">Ganti</button></div>';
  } else if (s.baru) {
    custHtml = '<div class="row-between mb12"><span class="pill st-jahit">' + ic('user-plus', 'ico-sm') + 'Pelanggan baru</span><button type="button" class="btn-link btn" data-act="cari">Cari yang sudah ada</button></div>' +
      '<div class="stack"><div class="field"><label class="req" for="nb-nama">Nama pelanggan / instansi</label><input id="nb-nama" class="input" data-nb="nama" value="' + esc(s.baru.nama) + '" maxlength="120" placeholder="Contoh: SMKN 1 Malang" autocomplete="off"><div class="err" data-err="nama" hidden></div></div>' +
      '<div class="field"><label for="nb-wa">No. WhatsApp</label><input id="nb-wa" class="input" data-nb="wa" value="' + esc(s.baru.wa) + '" inputmode="tel" placeholder="0812 3456 7890" autocomplete="off"><div class="hint">Untuk kirim nota & kabar pesanan.</div></div>' +
      '<div class="field"><label for="nb-al">Alamat <span class="faint">(opsional)</span></label><input id="nb-al" class="input" data-nb="alamat" value="' + esc(s.baru.alamat || '') + '" maxlength="300"></div></div>';
  } else {
    custHtml = '<div class="search">' + ic('search') + '<input class="input" data-cq placeholder="Ketik nama atau no. WA pelanggan" autocomplete="off" aria-label="Cari pelanggan"></div><div data-cres class="mt8"></div>' +
      '<button type="button" class="btn btn-soft btn-block mt12" data-act="baru">' + ic('user-plus') + 'Tambah pelanggan baru</button><div class="err mt8" data-err="cust" hidden></div>';
  }
  const quick = [7, 14, 21, 30].map(n => '<button type="button" class="chip ' + (s.tenggat === addDays(s.tgl_pesan || today(), n) ? 'on' : '') + '" data-tg="' + n + '">+' + n + ' hari</button>').join('');
  return '<div class="card card-pad"><h2 class="h-sm row mb12"><span class="icon-box sm">' + ic('user') + '</span>Pelanggan</h2>' + custHtml + '</div>' +
    '<div class="card card-pad mt12"><h2 class="h-sm row mb12"><span class="icon-box sm amber">' + ic('calendar-clock') + '</span>Tanggal</h2>' +
    '<div class="grid2"><div class="field"><label for="f-tgl">Tanggal pesan</label><input id="f-tgl" type="date" class="input" data-f="tgl_pesan" value="' + esc(s.tgl_pesan) + '"></div>' +
    '<div class="field"><label class="req" for="f-tg">Tenggat selesai</label><input id="f-tg" type="date" class="input" data-f="tenggat" value="' + esc(s.tenggat) + '" min="' + esc(s.tgl_pesan) + '"></div></div>' +
    '<div class="chips mt12" aria-label="Pilih tenggat cepat">' + quick + '</div><div class="err" data-err="tenggat" hidden></div>' +
    (s.tenggat ? '<div class="small muted mt8">Selesai ' + esc(fmt.dateLong(s.tenggat)) + ' · ' + daysBetween(s.tgl_pesan, s.tenggat) + ' hari kerja kalender</div>' : '') + '</div>';
}
function custResults(V, q) {
  q = q.trim().toLowerCase(); const qd = q.replace(/\D/g, '').replace(/^0/, '');
  let list = Object.values(V.customers);
  if (q) list = list.filter(c => c.nama.toLowerCase().indexOf(q) > -1 || (qd.length >= 3 && String(c.wa).indexOf(qd) > -1));
  else list = list.sort((a, b) => ((V.custStats[b.id] || {}).last || '') > ((V.custStats[a.id] || {}).last || '') ? 1 : -1);
  list = list.slice(0, 6);
  if (!list.length) return q ? '<div class="small muted" style="padding:8px 4px">Belum ada pelanggan "' + esc(q) + '". Tekan <b>Tambah pelanggan baru</b>.</div>' : '';
  return (q ? '' : '<div class="overline" style="padding:4px">Pelanggan terakhir</div>') + '<div class="card list">' + list.map(c => '<button type="button" class="li" data-pick="' + c.id + '"><span class="avatar" style="width:36px;height:36px;font-size:12px">' + esc(fmt.initials(c.nama)) + '</span><span class="grow"><span class="semi ellipsis" style="display:block">' + esc(c.nama) + '</span><span class="small muted">' + esc(fmt.wa(c.wa) || 'Tanpa no. WA') + '</span></span>' + ic('chevron-right', 'ico-sm chev') + '</button>').join('') + '</div>';
}

/* ---------------- Langkah 2: barang & ukuran ---------------- */
function itemCard(V, s, it, idx) {
  const sizes = itemSizes(V, it), t = V.sizeTypeMap[it.jenis_ukuran_id], single = sizes.length === 1;
  const pcs = itemPcs(V, it);
  return '<div class="card card-pad" data-item="' + it.key + '">' +
    '<div class="row-between mb12"><h3 class="h-sm row"><span class="pill st-jahit">Barang #' + (idx + 1) + '</span></h3>' +
    (s.items.length > 1 ? '<button type="button" class="btn btn-icon btn-ghost" data-del="' + it.key + '" aria-label="Hapus barang ' + (idx + 1) + '">' + ic('trash-2') + '</button>' : '') + '</div>' +
    '<div class="stack">' +
    '<div class="field"><div class="row-between"><label class="req" for="j-' + it.key + '">Nama barang</label>' + (V.priceRefs.length ? '<button type="button" class="btn-link btn btn-sm" data-ref="' + it.key + '">' + ic('tag', 'ico-sm') + 'Daftar harga</button>' : '') + '</div>' +
    '<input id="j-' + it.key + '" class="input" data-it="jenis" value="' + esc(it.jenis) + '" placeholder="Contoh: Kaos Polo CVC 24s" maxlength="120" autocomplete="off" enterkeyhint="next"><div class="err" data-err="jenis-' + it.key + '" hidden></div></div>' +
    '<div class="field"><label for="k-' + it.key + '">Warna / bahan / model <span class="faint">(opsional)</span></label><input id="k-' + it.key + '" class="input" data-it="keterangan" value="' + esc(it.keterangan) + '" placeholder="Contoh: Navy, kerah putih" maxlength="300" enterkeyhint="next"></div>' +
    '<div class="field"><span class="lbl">Jenis ukuran</span><div class="seg" role="radiogroup">' + V.sizeTypes.map(j => '<button type="button" role="radio" aria-checked="' + (j.id === it.jenis_ukuran_id) + '" class="' + (j.id === it.jenis_ukuran_id ? 'on' : '') + '" data-jt="' + j.id + '">' + esc(j.nama) + (j.sizes.length > 1 ? '<br><span class="xs faint">' + esc(j.sizes[0] + '–' + j.sizes[j.sizes.length - 1]) + '</span>' : '') + '</button>').join('') + '</div></div>' +
    '<div class="field"><div class="row-between"><span class="lbl">Jumlah per ukuran</span><span class="small muted">satuan pcs</span></div>' +
    (single && t && t.sizes.length === 1 && !it.extra.length
      ? '<div class="input-group"><input class="input num" style="font-size:20px;font-weight:700;text-align:center" data-qty="' + esc(sizes[0]) + '" inputmode="numeric" pattern="[0-9]*" value="' + (it.qty[sizes[0]] || '') + '" placeholder="0" aria-label="Jumlah ' + esc(sizes[0]) + '"></div>'
      : '<div class="size-grid">' + sizes.map(z => '<div class="size-cell ' + ((+it.qty[z] || 0) > 0 ? 'filled' : '') + '"><label for="q-' + it.key + '-' + esc(z) + '">' + esc(z) + '</label><input id="q-' + it.key + '-' + esc(z) + '" data-qty="' + esc(z) + '" inputmode="numeric" pattern="[0-9]*" enterkeyhint="next" value="' + (it.qty[z] || '') + '" placeholder="0" autocomplete="off">' +
        (it.extra.indexOf(z) > -1 ? '<button type="button" class="x" data-rmsize="' + esc(z) + '" aria-label="Hapus ukuran ' + esc(z) + '">' + ic('x', 'ico-sm') + '</button>' : '') + '</div>').join('') + '</div>') +
    '<button type="button" class="btn btn-ghost btn-sm mt8" data-addsize>' + ic('plus', 'ico-sm') + 'Tambah ukuran lain (3XL, 4XL, …)</button><div class="err" data-err="qty-' + it.key + '" hidden></div></div>' +
    '<div class="total-pcs"><span class="row semi">' + ic('shirt', 'ico-sm') + 'Total barang ini</span><span class="big" data-pcs>' + fmt.num(pcs) + ' pcs</span></div>' +
    '<div class="grid2"><div class="field"><label for="h-' + it.key + '">Harga satuan</label><div class="input-group"><span class="prefix">Rp</span><input id="h-' + it.key + '" class="input money" data-money inputmode="numeric" value="' + (it.harga_satuan ? fmt.num(it.harga_satuan) : '') + '" placeholder="0"></div></div>' +
    '<div class="field"><span class="lbl">Subtotal</span><div class="input money num" style="background:var(--soft-blue);border-color:#DCE5FF;display:flex;align-items:center;justify-content:flex-end;color:var(--pri)" data-sub>' + fmt.rp(pcs * (it.harga_satuan || 0)) + '</div></div></div>' +
    '</div></div>';
}
function step2(V, s) {
  const tot = formTotals(V, s);
  return '<div class="stack">' + s.items.map((it, i) => itemCard(V, s, it, i)).join('') + '</div>' +
    '<button type="button" class="btn btn-soft btn-block btn-lg mt12" data-act="additem">' + ic('plus') + 'Tambah barang lain</button>' +
    '<div class="card card-pad mt12"><label class="check"><input type="checkbox" data-f="pakai_sablon" ' + (s.pakai_sablon ? 'checked' : '') + '><span><b>Ada sablon / bordir</b><br><span class="small muted">Pesanan akan melewati tahap Sablon/Bordir. Bila tidak dicentang, tahap itu dilewati otomatis.</span></span></label>' +
    (s.pakai_sablon ? '<div class="field mt12"><label for="f-cs">Posisi & desain sablon/bordir</label><textarea id="f-cs" class="textarea" data-f="catatan_sablon" maxlength="500" placeholder="Contoh: Bordir logo dada kiri, sablon nama di punggung">' + esc(s.catatan_sablon) + '</textarea></div>' : '') + '</div>' +
    '<div class="card card-pad mt12" style="background:var(--soft-blue);border-color:#DCE5FF"><div class="row-between"><span class="semi">Total ' + s.items.length + ' barang</span><span class="semi num" data-tpcs>' + fmt.num(tot.pcs) + ' pcs</span></div>' +
    '<div class="row-between mt8"><span class="muted">Total harga</span><span class="money-lg" data-ttotal>' + fmt.rp(tot.total) + '</span></div></div>';
}

/* ---------------- Langkah 3: bayar ---------------- */
function step3(V, s) {
  const tot = formTotals(V, s);
  const sum = '<div class="card card-pad"><h2 class="h-sm row mb12"><span class="icon-box sm">' + ic('list-checks') + '</span>Ringkasan pesanan</h2>' +
    '<div class="small muted mb8">' + esc(s.pelanggan_id ? (V.customers[s.pelanggan_id] || {}).nama : (s.baru || {}).nama) + ' · tenggat ' + esc(fmt.date(s.tenggat)) + '</div>' +
    s.items.map((it, i) => '<div class="row-between" style="padding:6px 0;border-top:1px solid var(--line)"><div class="grow"><div class="semi ellipsis">' + esc(it.jenis || 'Barang #' + (i + 1)) + '</div><div class="small muted">' + fmt.num(tot.items[i].pcs) + ' pcs × ' + fmt.rp(it.harga_satuan) + '</div></div><div class="num semi">' + fmt.rp(tot.items[i].sub) + '</div></div>').join('') +
    '<div class="row-between mt8" style="padding-top:8px;border-top:1px solid var(--line)"><span class="semi">Total (' + fmt.num(tot.pcs) + ' pcs)</span><span class="money-lg">' + fmt.rp(tot.total) + '</span></div></div>';
  if (s.mode === 'edit') {
    return sum + '<div class="card card-pad mt12"><div class="field"><label for="f-cat">Catatan pesanan / SPK produksi</label><textarea id="f-cat" class="textarea" data-f="catatan" maxlength="1000">' + esc(s.catatan) + '</textarea></div>' +
      '<p class="small muted mt12">Pembayaran dicatat lewat tombol <b>Terima Bayaran</b> di detail pesanan.</p></div>';
  }
  const b = s.bayar, half = Math.round(tot.total / 2);
  return sum +
    '<div class="card card-pad mt12"><h2 class="h-sm row mb12"><span class="icon-box sm green">' + ic('wallet') + '</span>Uang muka</h2>' +
    '<div class="choice-grid" role="radiogroup">' +
      [['0', 'Belum bayar', '0%'], ['50', 'Uang muka 50%', fmt.rpShort(half)], ['lunas', 'Lunas', fmt.rpShort(tot.total)]].map(([k, l, sub]) => '<button type="button" role="radio" aria-checked="' + (b.pilih === k) + '" class="choice ' + (b.pilih === k ? 'on' : '') + '" data-pay="' + k + '">' + l + '<small>' + sub + '</small></button>').join('') +
    '</div>' +
    '<div class="field mt12"><label for="f-dp">Atau ketik jumlah lain</label><div class="input-group"><span class="prefix">Rp</span><input id="f-dp" class="input money" data-dp inputmode="numeric" value="' + (b.pilih === 'custom' && b.jumlah ? fmt.num(b.jumlah) : '') + '" placeholder="0"></div><div class="err" data-err="dp" hidden></div></div>' +
    '<div data-paybox>' + payBox(V, s) + '</div></div>' +
    '<div class="card card-pad mt12"><div class="field"><label for="f-cat">Catatan pesanan / SPK produksi <span class="faint">(opsional)</span></label><textarea id="f-cat" class="textarea" data-f="catatan" maxlength="1000" placeholder="Contoh: kain dicuci dulu sebelum dipotong, packing polybag per pcs">' + esc(s.catatan) + '</textarea></div></div>';
}

function payBox(V, s) {
  const tot = formTotals(V, s), b = s.bayar, jumlah = formPayAmount(V, s);
  const banks = V.settings.rekeningList || [];
  const methods = [['tunai', 'Tunai', 'banknote', '']].concat(banks.length ? banks.map(r => ['transfer:' + r.bank, 'Transfer ' + r.bank, 'landmark', r.no]) : [['transfer', 'Transfer bank', 'landmark', '']]).concat([['qris', 'QRIS', 'qr-code', '']]);
  return (jumlah > 0 ? '<div class="field mt12"><span class="lbl">Dibayar lewat</span><div class="choice-grid">' + methods.map(m => '<button type="button" class="choice ' + (b.metode === m[0] ? 'on' : '') + '" data-met="' + esc(m[0]) + '">' + ic(m[2]) + esc(m[1]) + (m[3] ? '<small class="num">' + esc(m[3]) + '</small>' : '') + '</button>').join('') + '</div></div>' +
      '<div class="field mt12"><span class="lbl">Foto bukti bayar <span class="faint">(opsional, maks. 5 MB)</span></span>' +
      (b.bukti ? '<div class="row card" style="padding:8px">' + (b.bukti.dataUrl ? '<img src="' + b.bukti.dataUrl + '" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:8px">' : ic('file-text', 'ico-lg')) + '<div class="grow small"><div class="semi ellipsis">' + esc(b.bukti.name) + '</div><div class="muted">' + Math.round(b.bukti.size / 1024) + ' KB</div></div><button type="button" class="btn btn-icon btn-ghost" data-act="rmbukti" aria-label="Hapus foto">' + ic('x') + '</button></div>'
        : '<label class="btn btn-ghost btn-block" style="cursor:pointer">' + ic('camera') + 'Pilih / ambil foto<input type="file" accept="image/*,application/pdf" data-bukti hidden></label>') + '</div>' : '') +
    '<div class="row-between mt16" style="padding:12px;border-radius:12px;background:' + (tot.total - jumlah > 0 ? 'var(--warn-soft)' : 'var(--ok-soft)') + '"><span class="semi">Sisa tagihan</span><span class="money-lg ' + (tot.total - jumlah > 0 ? 'warnc' : 'success') + '">' + fmt.rp(Math.max(tot.total - jumlah, 0)) + '</span></div>';
}
function formPayAmount(V, s) {
  const tot = formTotals(V, s).total, b = s.bayar;
  return b.pilih === '0' ? 0 : b.pilih === '50' ? Math.round(tot / 2) : b.pilih === 'lunas' ? tot : b.jumlah;
}
function showErr(el, key, msg) { const e = $('[data-err="' + key + '"]', el); if (e) { e.textContent = msg; e.hidden = !msg; } }

function validateStep(V, s, el) {
  if (s.step === 1) {
    let ok = true;
    if (!s.pelanggan_id) {
      if (s.baru) { if (!String(s.baru.nama || '').trim()) { showErr(el, 'nama', 'Isi nama pelanggan.'); $('#nb-nama', el).focus(); ok = false; } }
      else { showErr(el, 'cust', 'Pilih pelanggan atau tambah pelanggan baru.'); ok = false; }
    }
    if (!s.tenggat) { showErr(el, 'tenggat', 'Pilih tanggal tenggat.'); ok = false; }
    else if (s.tenggat < s.tgl_pesan) { showErr(el, 'tenggat', 'Tenggat tidak boleh sebelum tanggal pesan.'); ok = false; }
    return ok;
  }
  if (s.step === 2) {
    let first = null;
    s.items.forEach(it => {
      showErr(el, 'jenis-' + it.key, ''); showErr(el, 'qty-' + it.key, '');
      if (!it.jenis.trim()) { showErr(el, 'jenis-' + it.key, 'Isi nama barang.'); first = first || $('#j-' + it.key, el); }
      if (itemPcs(V, it) <= 0) { showErr(el, 'qty-' + it.key, 'Isi jumlah minimal 1 pcs.'); first = first || $('[data-item="' + it.key + '"] [data-qty]', el); }
    });
    if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
    return true;
  }
  if (s.step === 3 && s.mode === 'new') {
    const tot = formTotals(V, s).total, j = formPayAmount(V, s);
    if (j > tot) { showErr(el, 'dp', 'Uang muka melebihi total (' + fmt.rp(tot) + ').'); return false; }
  }
  return true;
}

async function submitForm(V, s, btn) {
  const payload = {
    tgl_pesan: s.tgl_pesan, tenggat: s.tenggat, pakai_sablon: s.pakai_sablon, catatan_sablon: s.pakai_sablon ? s.catatan_sablon : '', catatan: s.catatan,
    items: s.items.map(it => ({ jenis: it.jenis.trim(), keterangan: it.keterangan.trim(), jenis_ukuran_id: it.jenis_ukuran_id, harga_satuan: it.harga_satuan, harga_ref_id: it.harga_ref_id,
      ukuran: itemSizes(V, it).map(z => ({ ukuran: z, qty: parseInt(it.qty[z], 10) || 0 })).filter(z => z.qty > 0) }))
  };
  if (s.pelanggan_id) payload.pelanggan_id = s.pelanggan_id; else payload.pelanggan = s.baru;
  s.reqId = s.reqId || uid();          // ketukan ganda / koneksi putus → server tidak menyimpan dobel
  if (s.mode === 'edit') {
    payload.id = s.id; payload.diubah_pada = s.diubah_pada;
    return UI.busy(btn, async () => {
      const r = await api('updateOrder', payload, { reqId: s.reqId });
      if (!r.success) { s.reqId = null; UI.toast(r.message, 'err'); return; }
      UI.toast('Perubahan pesanan tersimpan.'); OF.s = null; go('pesanan', s.id);
    });
  }
  const jumlah = formPayAmount(V, s);
  payload.bayar = { jumlah, metode: s.bayar.metode, bukti: jumlah > 0 && s.bayar.bukti ? { name: s.bayar.bukti.name, mime: s.bayar.bukti.mime, b64: s.bayar.bukti.b64 } : null };
  return UI.busy(btn, async () => {
    const r = await api('createOrder', payload, { reqId: s.reqId });
    if (!r.success) { if (!r.network) s.reqId = null; UI.toast(r.message, 'err'); return; }
    s.saved = true; LS.del('draft'); OF.s = null;
    const o = Data.view().ordersById[r.data.id];
    const sh = UI.sheet({ title: 'Pesanan tersimpan', icon: 'circle-check', dismiss: false,
      body: '<div class="center"><div class="icon-box green" style="width:64px;height:64px;border-radius:50%;margin:0 auto">' + ic('check', 'ico-lg') + '</div>' +
        '<div class="h-lg mt12">' + esc(r.data.no_nota) + '</div><div class="muted">' + esc(o ? o.cust.nama : '') + '</div>' +
        (o ? '<div class="sum3 mt16"><div><small>Total</small><b>' + fmt.rp(o.total) + '</b></div><div><small>Dibayar</small><b class="success">' + fmt.rp(o.dibayar) + '</b></div><div><small>Sisa</small><b class="danger">' + fmt.rp(o.sisa) + '</b></div></div>' : '') + '</div>',
      foot: '<button class="btn btn-ghost" data-a="lagi">' + ic('plus') + 'Catat lagi</button><button class="btn btn-ghost" data-a="nota">' + ic('printer') + 'Nota</button><button class="btn btn-primary" data-a="buka">Lihat pesanan</button>' });
    sh.foot.onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; sh.close(); if (b.dataset.a === 'lagi') { OF.s = null; go('pesanan-baru'); route(); } if (b.dataset.a === 'nota') go('nota', r.data.id); if (b.dataset.a === 'buka') go('pesanan', r.data.id); };
  });
}

function renderForm(el) {
  const V = Data.view(), s = OF.s;
  const title = s.mode === 'edit' ? 'Ubah pesanan' : 'Catat pesanan baru';
  el.innerHTML = '<div class="form-narrow">' + pageHead(title, s.mode === 'edit' ? (V.ordersById[s.id] || {}).no_nota : 'Isi 3 langkah singkat. Draf tersimpan otomatis.') +
    '<div class="card" style="padding:4px 12px;margin-bottom:12px">' + stepsBar(s) + '</div>' +
    (s.restored && s.step === 1 ? '<div class="banner amber mb12"><span class="icon-box sm amber">' + ic('history', 'ico-sm') + '</span><div class="grow"><b>Melanjutkan draf terakhir</b><span>Isian sebelumnya dipulihkan.</span></div><button type="button" class="btn btn-sm btn-ghost" data-act="reset">Mulai baru</button></div>' : '') +
    '<form data-form novalidate>' + (s.step === 1 ? step1(V, s) : s.step === 2 ? step2(V, s) : step3(V, s)) + '</form>' +
    (s.mode === 'new' ? '<div class="small faint center mt12" data-draft-at></div>' : '') +
    '<div class="foot-bar">' + (s.step > 1 ? '<button type="button" class="btn btn-ghost" data-act="prev">' + ic('arrow-left') + 'Kembali</button>' : '<button type="button" class="btn btn-ghost" data-act="cancel">Batal</button>') +
    (s.step < 3 ? '<button type="button" class="btn btn-primary" data-act="next">Lanjut' + ic('arrow-right') + '</button>' : '<button type="button" class="btn btn-primary" data-act="save">' + ic('check') + (s.mode === 'edit' ? 'Simpan perubahan' : 'Simpan pesanan') + '</button>') + '</div></div>';
  bindForm(el);
  const cq = $('[data-cq]', el); if (cq) { $('[data-cres]', el).innerHTML = custResults(V, ''); }
}

function bindForm(el) {
  const V = Data.view(), s = OF.s;
  const rerender = () => { renderForm(el); saveDraft(); };
  const updateTotals = () => {
    const tot = formTotals(V, s);
    s.items.forEach((it, i) => { const card = $('[data-item="' + it.key + '"]', el); if (!card) return; $('[data-pcs]', card).textContent = fmt.num(tot.items[i].pcs) + ' pcs'; $('[data-sub]', card).textContent = fmt.rp(tot.items[i].sub); });
    const tp = $('[data-tpcs]', el); if (tp) tp.textContent = fmt.num(tot.pcs) + ' pcs';
    const tt = $('[data-ttotal]', el); if (tt) tt.textContent = fmt.rp(tot.total);
  };
  const itemOf = node => { const c = node.closest('[data-item]'); return c ? s.items.find(i => i.key === c.dataset.item) : null; };

  el.oninput = e => {
    const t = e.target;
    if (t.dataset.f) { s[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.f === 'tenggat') showErr(el, 'tenggat', ''); saveDraft(); return; }
    if (t.dataset.nb) { s.baru[t.dataset.nb] = t.value; showErr(el, 'nama', ''); saveDraft(); return; }
    if (t.dataset.cq != null) { $('[data-cres]', el).innerHTML = custResults(V, t.value); return; }
    const it = itemOf(t);
    if (it && t.dataset.it) { it[t.dataset.it] = t.value; if (t.dataset.it === 'jenis') { it.harga_ref_id = ''; showErr(el, 'jenis-' + it.key, ''); } saveDraft(); return; }
    if (it && t.dataset.qty != null) {
      const v = t.value.replace(/\D/g, '').slice(0, 6); if (t.value !== v) t.value = v;
      it.qty[t.dataset.qty] = v ? parseInt(v, 10) : 0;
      const cell = t.closest('.size-cell'); if (cell) cell.classList.toggle('filled', !!+v);
      showErr(el, 'qty-' + it.key, ''); updateTotals(); saveDraft(); return;
    }
    if (it && t.dataset.money != null) { const n = parseMoney(t.value); t.value = n ? fmt.num(n) : ''; it.harga_satuan = n; updateTotals(); saveDraft(); return; }
    if (t.dataset.dp != null) {
      const n = parseMoney(t.value); t.value = n ? fmt.num(n) : ''; s.bayar.pilih = n ? 'custom' : '0'; s.bayar.jumlah = n; showErr(el, 'dp', '');
      $$('[data-pay]', el).forEach(b => { b.classList.remove('on'); b.setAttribute('aria-checked', 'false'); });
      $('[data-paybox]', el).innerHTML = payBox(V, s); saveDraft(); return;
    }
  };
  el.onchange = async e => {
    const t = e.target;
    if (t.dataset.f === 'pakai_sablon') { s.pakai_sablon = t.checked; rerender(); return; }
    if (t.dataset.f === 'tgl_pesan' || t.dataset.f === 'tenggat') { s[t.dataset.f] = t.value; rerender(); return; }
    if (t.dataset.bukti != null && t.files[0]) {
      try { s.bayar.bukti = await readImage(t.files[0], 1600, 0.8); renderForm(el); } catch (er) { UI.toast(er.message, 'err'); }
    }
  };
  el.onkeydown = e => {
    // Enter di kotak jumlah → pindah ke kotak berikutnya (cepat di HP)
    if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox])')) {
      e.preventDefault();
      const all = $$('input:not([type=hidden]):not([type=file]):not([type=checkbox]), textarea', el).filter(x => x.offsetParent);
      const i = all.indexOf(e.target); if (all[i + 1]) all[i + 1].focus();
    }
  };
  el.onclick = async e => {
    const t = e.target.closest('button, [data-pick]'); if (!t) return;
    const it = itemOf(t);
    if (t.dataset.goto) { const k = +t.dataset.goto; if (k < s.step) { s.step = k; rerender(); window.scrollTo(0, 0); } return; }
    if (t.dataset.pick) { s.pelanggan_id = t.dataset.pick; s.baru = null; rerender(); return; }
    if (t.dataset.tg) { s.tenggat = addDays(s.tgl_pesan || today(), +t.dataset.tg); rerender(); return; }
    if (t.dataset.jt && it) { it.jenis_ukuran_id = t.dataset.jt; rerender(); const card = $('[data-item="' + it.key + '"] [data-qty]', el); card && card.focus(); return; }
    if (t.dataset.del) {
      const victim = s.items.find(i => i.key === t.dataset.del);
      if ((victim.jenis || itemPcs(V, victim)) && !(await UI.confirm({ title: 'Hapus barang ini?', msg: (victim.jenis || 'Barang') + ' akan dihapus dari pesanan.', ok: 'Hapus', danger: true }))) return;
      s.items = s.items.filter(i => i.key !== t.dataset.del); rerender(); return;
    }
    if (t.hasAttribute('data-addsize') && it) {
      const name = await UI.prompt({ title: 'Tambah ukuran', label: 'Nama ukuran', placeholder: 'Contoh: 3XL', max: 16, ok: 'Tambah' });
      const nm = (name || '').trim();
      if (nm && itemSizes(V, it).indexOf(nm) < 0) it.extra.push(nm);
      if (nm) { rerender(); const inp = $('#q-' + it.key + '-' + CSS.escape(nm), el); inp && inp.focus(); }
      return;
    }
    if (t.dataset.rmsize && it) { it.extra = it.extra.filter(x => x !== t.dataset.rmsize); delete it.qty[t.dataset.rmsize]; rerender(); return; }
    if (t.dataset.ref && it) { pickPriceRef(V, ref => { it.jenis = ref.nama; it.harga_satuan = ref.harga_jual; it.harga_ref_id = ref.id; rerender(); }); return; }
    if (t.dataset.pay) { s.bayar.pilih = t.dataset.pay; s.bayar.jumlah = 0; if (s.bayar.pilih !== '0' && !s.bayar.metode) s.bayar.metode = 'tunai'; rerender(); return; }
    if (t.dataset.met) { s.bayar.metode = t.dataset.met; rerender(); return; }
    switch (t.dataset.act) {
      case 'ganti': case 'cari': s.pelanggan_id = ''; s.baru = null; rerender(); setTimeout(() => { const q = $('[data-cq]', el); q && q.focus(); }, 30); break;
      case 'baru': { const q = $('[data-cq]', el); s.baru = { nama: q && !/^\d/.test(q.value.trim()) ? q.value.trim() : '', wa: q && /^[\d\s+-]+$/.test(q.value.trim()) ? q.value.trim() : '', alamat: '' }; rerender(); setTimeout(() => { const n = $('#nb-nama', el); n && n.focus(); }, 30); break; }
      case 'additem': s.items.push(newItem(V)); rerender(); setTimeout(() => { const last = s.items[s.items.length - 1]; const n = $('#j-' + last.key, el); if (n) { n.focus(); n.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 30); break;
      case 'rmbukti': s.bayar.bukti = null; rerender(); break;
      case 'reset': if (await UI.confirm({ title: 'Mulai pesanan baru?', msg: 'Isian draf sebelumnya akan dihapus.', ok: 'Mulai baru', danger: true })) { LS.del('draft'); OF.s = initForm(V, 'new', null, {}); OF.s.restored = false; renderForm(el); } break;
      case 'cancel': if (s.mode === 'new' && (s.pelanggan_id || s.baru) && !(await UI.confirm({ title: 'Tinggalkan form?', msg: 'Draf tetap tersimpan di perangkat ini dan bisa dilanjutkan nanti.', ok: 'Tinggalkan' }))) break; OF.s = null; back(s.mode === 'edit' ? 'pesanan' : 'beranda'); break;
      case 'prev': s.step--; s.restored = false; rerender(); window.scrollTo(0, 0); break;
      case 'next': if (!validateStep(V, s, el)) return; s.step++; s.restored = false; rerender(); window.scrollTo(0, 0);
        if (s.step === 2) { const f = s.items[0] && $('#j-' + s.items[0].key, el); if (f && !s.items[0].jenis) setTimeout(() => f.focus(), 50); } break;
      case 'save': if (!validateStep(V, s, el)) return; submitForm(V, s, t); break;
    }
  };
}
function pickPriceRef(V, cb) {
  const s = UI.sheet({ title: 'Pilih dari daftar harga', body: '<div class="search mb12">' + ic('search') + '<input class="input" data-q placeholder="Cari barang" autofocus></div><div data-l></div>' });
  const draw = q => { q = (q || '').toLowerCase(); const list = V.priceRefs.filter(p => p.nama.toLowerCase().indexOf(q) > -1);
    s.body.querySelector('[data-l]').innerHTML = list.length ? '<div class="card list">' + list.map(p => '<button class="li" data-id="' + p.id + '"><span class="grow semi">' + esc(p.nama) + '</span><span class="num semi" style="color:var(--pri)">' + fmt.rp(p.harga_jual) + '</span></button>').join('') + '</div>' : '<div class="small muted">Tidak ada.</div>'; };
  draw('');
  s.body.querySelector('[data-q]').oninput = e => draw(e.target.value);
  s.body.onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; s.close(); cb(V.priceRefs.find(p => p.id === b.dataset.id)); };
}

registerPage('pesanan-baru', {
  title: 'Catat Pesanan', nav: 'pesanan', hideNav: true, live: false,
  header: () => ({ title: 'Catat pesanan baru', sub: OF.s ? 'Langkah ' + OF.s.step + ' dari 3 · ' + ['Pelanggan', 'Barang', 'Bayar'][OF.s.step - 1] : '', back: 'beranda' }),
  render(el, param, query) {
    if (needData(el)) return;
    const V = Data.view();
    if (!V.sizeTypes.length) { el.innerHTML = UI.errorBox('Belum ada jenis ukuran aktif. Pemilik perlu mengaturnya di Pengaturan.'); return; }
    if (!OF.s || OF.s.mode !== 'new') OF.s = initForm(V, 'new', null, query || {});
    renderForm(el);
    Shell.render('pesanan-baru', Pages['pesanan-baru']);
  },
  onData() { /* data pelanggan/harga baru masuk — form tidak dirender ulang agar isian tidak hilang */ }
});
registerPage('pesanan-ubah', {
  title: 'Ubah Pesanan', nav: 'pesanan', hideNav: true, live: false,
  header: () => ({ title: 'Ubah pesanan', sub: OF.s ? 'Langkah ' + OF.s.step + ' dari 3' : '', back: 'pesanan' }),
  render(el, id) {
    if (needData(el)) return;
    const V = Data.view(), o = V.ordersById[id];
    if (!o) { el.innerHTML = UI.errorBox('Pesanan tidak ditemukan.'); return; }
    if (o.batal) { el.innerHTML = UI.errorBox('Pesanan yang dibatalkan tidak bisa diubah.'); return; }
    if (!OF.s || OF.s.id !== id) OF.s = initForm(V, 'edit', id);
    renderForm(el);
  }
});
// perbarui judul header HP saat pindah langkah
const _renderForm = renderForm;
renderForm = function (el) { _renderForm(el); const def = Pages[Router.cur]; if (def && def.header && $('#mtop')) { const h = def.header(); const sub = $('#mtop .title span'); if (sub) sub.textContent = h.sub; } };
