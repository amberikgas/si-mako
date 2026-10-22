/* ============================================================
   LAINNYA & PENGATURAN (F-06, F-13, F-15) · AKUN
   ============================================================ */
'use strict';

function hubRow(href, icon, tone, label, right, act) {
  return '<' + (act ? 'button data-act="' + act + '"' : 'a href="' + href + '"') + ' class="li"><span class="icon-box sm ' + tone + '">' + ic(icon, 'ico-sm') + '</span><span class="grow semi">' + esc(label) + '</span>' + (right || '') + ic('chevron-right', 'ico-sm chev') + '</' + (act ? 'button' : 'a') + '>';
}
registerPage('lainnya', {
  title: 'Lainnya',
  header: () => ({ title: 'Lainnya', sub: 'Menu & pengaturan', back: false }),
  render(el) {
    if (needData(el)) return;
    const V = Data.view(), me = Session.me || {}, owner = Session.owner;
    const lock = '<span class="pill st-diterima xs">Khusus Pemilik</span>';
    el.innerHTML = pageHead('Pengaturan', 'Data usaha, nota, ukuran, tahap produksi, dan pengguna.') +
      '<div class="form-narrow stack">' +
      '<div class="card card-pad"><div class="row"><span class="avatar lg">' + esc(fmt.initials(me.nama)) + '</span><div class="grow"><div class="row"><b class="h-sm">' + esc(me.nama) + '</b><span class="pill st-jahit">' + (owner ? 'Pemilik' : 'Admin') + '</span></div><div class="small muted ellipsis">' + esc(me.email) + ' · ' + esc(V.settings.nama_usaha || '') + '</div></div></div>' +
      '<a class="row-between mt12" href="#/akun" style="padding:10px 12px;background:var(--soft);border-radius:10px;color:inherit"><span class="row small">' + ic('key-round', 'ico-sm') + 'Keamanan sandi</span><span class="small semi" style="color:var(--pri)">Ubah sandi →</span></a></div>' +
      '<div class="section-title" style="margin:8px 0 0"><h2 class="overline">Usaha</h2></div><div class="card list">' +
        hubRow('#/produksi', 'kanban', '', 'Papan produksi', '<span class="badge blue">' + V.active.length + ' aktif</span>') +
        hubRow('#/stok', 'boxes', 'amber', 'Stok bahan', V.lowStock.length ? '<span class="badge">' + V.lowStock.length + ' hampir habis</span>' : '') +
        (owner ? hubRow('#/keuangan', 'wallet', 'green', 'Keuangan', lock) + hubRow('#/hitung-modal', 'calculator', 'violet', 'Hitung modal & daftar harga', lock) + hubRow('#/laporan', 'chart-column', 'sky', 'Laporan bulanan', lock) : '') +
      '</div>' +
      (owner ? '<div class="section-title" style="margin:8px 0 0"><h2 class="overline">Pengaturan</h2></div><div class="card list">' +
        hubRow('#/atur/usaha', 'store', 'slate', 'Data usaha & rekening') +
        hubRow('#/atur/nota', 'file-text', 'slate', 'Format nomor nota', '<span class="small muted ellipsis" style="max-width:120px">' + esc((V.numbering || {}).format || '') + '</span>') +
        hubRow('#/atur/ukuran', 'ruler', 'slate', 'Jenis & daftar ukuran', '<span class="small muted">' + V.sizeTypes.length + ' aktif</span>') +
        hubRow('#/atur/tahap', 'workflow', 'slate', 'Tahap produksi', '<span class="small muted">' + V.stages.length + ' tahap</span>') +
        hubRow('#/atur/pengguna', 'users-round', 'slate', 'Kelola pengguna', '<span class="small muted">' + V.users.filter(u => u.aktif).length + ' akun</span>') +
      '</div><div class="section-title" style="margin:8px 0 0"><h2 class="overline">Data</h2></div><div class="card list">' +
        hubRow('', 'cloud-upload', 'green', 'Cadangkan ke Google Drive sekarang', '', 'backup') +
        hubRow('', 'download', 'sky', 'Ekspor semua data (JSON)', '', 'export') +
        hubRow('', 'refresh-cw', 'amber', 'Muat ulang data dari Sheet', '', 'refresh') +
        hubRow('?setup=1', 'wrench', 'slate', 'Menu teknis & kesehatan sistem') +
      '</div>' : '') +
      '<button class="btn btn-danger btn-lg btn-block mt8" data-act="logout">' + ic('log-out') + 'Keluar dari akun</button>' +
      '<p class="small faint center">Si-MAKO v' + APP_VER + ' · data tersimpan di Google Sheet milik Pemilik</p></div>';
    el.onclick = async e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const act = b.dataset.act;
      if (act === 'logout') return logout();
      if (act === 'backup') { UI.toast('Membuat cadangan…'); const r = await api('backupNow', {}, { vers: false }); UI.toast(r.success ? 'Cadangan tersimpan di folder Drive "Cadangan".' : r.message, r.success ? 'ok' : 'err'); }
      if (act === 'export') { UI.toast('Menyiapkan data…'); const r = await api('exportAll', {}, { vers: false }); if (r.success) download('simako-ekspor-' + today() + '.json', JSON.stringify(r.data, null, 1), 'application/json'); else UI.toast(r.message, 'err'); }
      if (act === 'refresh') {
        if (!(await UI.confirm({ title: 'Muat ulang semua data?', msg: 'Pakai ini bila Anda mengubah isi Google Sheet secara langsung. Semua perangkat akan memuat data terbaru.', ok: 'Muat ulang' }))) return;
        const r = await api('refreshAll', {}, { vers: false });
        if (!r.success) return UI.toast(r.message, 'err');
        Data.t = {}; Data.vers = {}; Data.lastSync = 0; await Data.refresh({ force: true }); UI.toast('Data dimuat ulang dari Sheet.');
      }
    };
  }
});

/* ---------------- akun: ubah sandi ---------------- */
registerPage('akun', {
  title: 'Ubah sandi', nav: 'lainnya', live: false,
  header: () => ({ title: 'Ubah sandi', back: 'lainnya' }),
  render(el) {
    el.innerHTML = '<div class="form-narrow">' + pageHead('Ubah sandi', 'Sandi baru minimal 6 karakter. Perangkat lain akan diminta masuk lagi.') +
      '<form class="card card-pad stack" data-pf novalidate><div class="field"><label for="pw-o">Sandi sekarang</label><input id="pw-o" class="input" type="password" name="lama" autocomplete="current-password"></div>' +
      '<div class="field"><label for="pw-n">Sandi baru</label><input id="pw-n" class="input" type="password" name="baru" autocomplete="new-password" minlength="6"></div>' +
      '<div class="field"><label for="pw-c">Ulangi sandi baru</label><input id="pw-c" class="input" type="password" name="ulang" autocomplete="new-password"></div>' +
      '<div class="err" data-e hidden></div><button class="btn btn-primary btn-lg">Simpan sandi baru</button></form></div>';
    $('[data-pf]', el).onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target).entries()), err = $('[data-e]', el);
      const fail = m => { err.textContent = m; err.hidden = false; };
      if (!d.lama) return fail('Isi sandi sekarang.');
      if (d.baru.length < 6) return fail('Sandi baru minimal 6 karakter.');
      if (d.baru !== d.ulang) return fail('Ulangan sandi baru tidak sama.');
      await UI.busy(e.submitter, async () => {
        const r = await api('changePassword', { lama: d.lama, baru: d.baru }, { vers: false });
        if (!r.success) return fail(r.message);
        Session.setToken(r.data.token); UI.toast('Sandi berhasil diganti.'); go('lainnya');
      });
    };
  }
});

/* ---------------- pengaturan (khusus pemilik) ---------------- */
const SETTINGS = {
  usaha: { title: 'Data usaha & rekening', render: renderBizSettings },
  nota: { title: 'Format nomor nota', render: renderNumbering },
  ukuran: { title: 'Jenis & daftar ukuran', render: renderSizeTypes },
  tahap: { title: 'Tahap produksi', render: renderStages },
  pengguna: { title: 'Kelola pengguna', render: renderUsers }
};
registerPage('atur', {
  auth: 'owner', nav: 'lainnya', live: false, hideNav: true,
  title: k => (SETTINGS[k] || {}).title || 'Pengaturan',
  header: k => ({ title: (SETTINGS[k] || {}).title || 'Pengaturan', back: 'lainnya' }),
  render(el, k) {
    if (needData(el)) return;
    const S = SETTINGS[k]; if (!S) { go('lainnya'); return; }
    S.render(el);
  },
  onData() { const k = Router.param; if (k === 'pengguna') renderUsers($('#pages .page[data-page="atur"]')); }
});
function settingsFoot(label) { return '<div class="foot-bar"><button type="button" class="btn btn-ghost" onclick="back(\'lainnya\')">Batal</button><button type="submit" class="btn btn-primary">' + ic('check') + esc(label || 'Simpan') + '</button></div>'; }

function renderBizSettings(el) {
  const S = Data.view().settings;
  let banks = (S.rekeningList || []).slice(); let logo = S.logo || '';
  const bankRows = () => banks.map((r, i) => '<div class="card card-pad" style="background:var(--soft)" data-bank="' + i + '"><div class="row-between mb8"><span class="semi small">Rekening ' + (i + 1) + '</span><button type="button" class="btn btn-icon btn-sm" data-rmbank="' + i + '" aria-label="Hapus rekening">' + ic('trash-2', 'ico-sm') + '</button></div>' +
    '<div class="grid2"><div class="field"><label>Bank</label><input class="input" data-b="bank" value="' + esc(r.bank) + '" placeholder="BCA" maxlength="30"></div><div class="field"><label>No. rekening</label><input class="input" data-b="no" value="' + esc(r.no) + '" inputmode="numeric" maxlength="40"></div></div>' +
    '<div class="field mt8"><label>Atas nama</label><input class="input" data-b="nama" value="' + esc(r.nama) + '" maxlength="80"></div></div>').join('');
  el.innerHTML = '<div class="form-narrow">' + pageHead('Data usaha & rekening', 'Tampil di nota dan pesan WhatsApp.') +
    '<form class="stack" data-sf novalidate><div class="card card-pad stack">' +
    '<div class="row"><div data-logo>' + (logo ? '<img src="' + esc(logo) + '" alt="Logo" style="width:64px;height:64px;border-radius:12px;object-fit:contain;background:var(--soft)">' : '<div class="logo-mark" style="width:64px;height:64px">' + esc(fmt.initials(S.nama_usaha)) + '</div>') + '</div>' +
    '<div class="grow"><label class="btn btn-ghost btn-sm" style="cursor:pointer">' + ic('image-up', 'ico-sm') + 'Ganti logo<input type="file" accept="image/*" data-logofile hidden></label>' + (logo ? ' <button type="button" class="btn btn-sm btn-link danger" data-rmlogo>Hapus</button>' : '') + '<div class="small muted mt8">Gambar persegi, otomatis dikecilkan.</div></div></div>' +
    '<div class="field"><label class="req" for="bz-n">Nama usaha</label><input id="bz-n" class="input" name="nama_usaha" value="' + esc(S.nama_usaha) + '" maxlength="80"></div>' +
    '<div class="field"><label for="bz-t">Keterangan singkat</label><input id="bz-t" class="input" name="tagline" value="' + esc(S.tagline) + '" placeholder="Konveksi & Garment Malang" maxlength="80"></div>' +
    '<div class="field"><label for="bz-a">Alamat</label><textarea id="bz-a" class="textarea" name="alamat" maxlength="300">' + esc(S.alamat) + '</textarea></div>' +
    '<div class="grid2"><div class="field"><label for="bz-w">No. WhatsApp usaha</label><input id="bz-w" class="input" name="wa" inputmode="tel" value="' + esc(fmt.wa(S.wa)) + '"></div><div class="field"><label for="bz-s">Nama di tanda tangan nota</label><input id="bz-s" class="input" name="ttd_nama" value="' + esc(S.ttd_nama) + '" maxlength="80"></div></div>' +
    '</div><div class="card card-pad stack"><div class="row-between"><h3 class="h-sm">Rekening bank</h3><button type="button" class="btn btn-soft btn-sm" data-addbank>' + ic('plus', 'ico-sm') + 'Tambah</button></div><div class="stack" data-banks>' + bankRows() + '</div>' +
    '<p class="small muted">Rekening muncul sebagai pilihan saat menerima transfer dan di nota.</p></div>' +
    '<div class="card card-pad stack"><div class="field"><label for="bz-sy">Syarat & ketentuan di nota</label><textarea id="bz-sy" class="textarea" name="syarat_nota" maxlength="1000">' + esc(S.syarat_nota) + '</textarea></div>' +
    '<div class="field"><label for="bz-k">Kategori uang keluar</label><input id="bz-k" class="input" name="kategori_keluar" value="' + esc(S.kategori_keluar || '') + '"><div class="hint">Pisahkan dengan koma.</div></div></div>' +
    settingsFoot('Simpan') + '</form></div>';
  const f = $('[data-sf]', el);
  const sync = () => { $$('[data-bank]', el).forEach(c => { const i = +c.dataset.bank; $$('[data-b]', c).forEach(x => { banks[i][x.dataset.b] = x.value; }); }); };
  el.onclick = async e => {
    if (e.target.closest('[data-addbank]')) { sync(); banks.push({ bank: '', no: '', nama: S.nama_usaha || '' }); $('[data-banks]', el).innerHTML = bankRows(); return; }
    const rb = e.target.closest('[data-rmbank]'); if (rb) { sync(); banks.splice(+rb.dataset.rmbank, 1); $('[data-banks]', el).innerHTML = bankRows(); return; }
    if (e.target.closest('[data-rmlogo]')) { logo = ''; $('[data-logo]', el).innerHTML = '<div class="logo-mark" style="width:64px;height:64px">-</div>'; }
  };
  $('[data-logofile]', el).onchange = async e => {
    try { const img = await readImage(e.target.files[0], 240, 0.85); logo = img.dataUrl; if (logo.length > 45000) { const im2 = await readImage(e.target.files[0], 160, 0.7); logo = im2.dataUrl; } $('[data-logo]', el).innerHTML = '<img src="' + logo + '" alt="Logo" style="width:64px;height:64px;border-radius:12px;object-fit:contain">'; }
    catch (er) { UI.toast(er.message, 'err'); }
  };
  f.onsubmit = async e => {
    e.preventDefault(); sync();
    const d = Object.fromEntries(new FormData(f).entries());
    if (!d.nama_usaha.trim()) { f.nama_usaha.classList.add('invalid'); f.nama_usaha.focus(); return; }
    d.logo = logo; d.rekening = banks.filter(b => b.bank.trim() && b.no.trim());
    await UI.busy(e.submitter, async () => { const r = await api('saveSettings', d); if (!r.success) return UI.toast(r.message, 'err'); UI.toast('Data usaha tersimpan.'); go('lainnya'); });
  };
}

function previewNo(fmtStr, n) {
  const p = jkParts(new Date());
  return String(fmtStr || '').replace(/\{TAHUN\}/g, p.year).replace(/\{TH\}/g, p.year.slice(2)).replace(/\{(BULAN|BLN)\}/g, p.month).replace(/\{HARI\}/g, p.day)
    .replace(/\{URUT(?::(\d+))?\}/g, (m, d) => String(n).padStart(Math.min(+(d || 4), 10), '0'));
}
function renderNumbering(el) {
  const N = Data.view().numbering || { format: 'INV/{TAHUN}/{BULAN}/{URUT:4}', reset: 'bulan', urut_terakhir: 0, periode_terakhir: '' };
  const codes = [['{TAHUN}', 'Tahun 4 digit'], ['{TH}', 'Tahun 2 digit'], ['{BULAN}', 'Bulan 01–12'], ['{HARI}', 'Tanggal 01–31'], ['{URUT:4}', 'Nomor urut 4 digit']];
  const presets = ['INV/{TAHUN}/{BULAN}/{URUT:4}', 'NOTA-{TH}{BULAN}-{URUT:3}', 'BM/{URUT:5}'];
  el.innerHTML = '<div class="form-narrow">' + pageHead('Format nomor nota', 'Nomor dibuat server dan dijamin tidak kembar.') +
    '<form class="stack" data-nf novalidate><div class="card card-pad stack">' +
    '<div class="field"><label for="nf-f">Format</label><input id="nf-f" class="input" name="format" value="' + esc(N.format) + '" style="font-family:ui-monospace,monospace" maxlength="80"><div class="err" data-e hidden></div></div>' +
    '<div><div class="small semi mb8">Ketuk kode untuk menambahkan:</div><div class="row wrap">' + codes.map(c => '<button type="button" class="chip" data-code="' + c[0] + '" title="' + c[1] + '">' + c[0] + '</button>').join('') + '</div></div>' +
    '<div><div class="small semi mb8">Contoh siap pakai:</div><div class="row wrap">' + presets.map(p => '<button type="button" class="chip" data-preset="' + esc(p) + '">' + esc(p) + '</button>').join('') + '</div></div>' +
    '<div class="field"><span class="lbl">Nomor urut diulang dari 1 setiap</span><div class="seg" data-reset>' + [['bulan', 'Bulan baru'], ['tahun', 'Tahun baru'], ['tidak', 'Tidak pernah']].map(r => '<button type="button" data-r="' + r[0] + '" class="' + (N.reset === r[0] ? 'on' : '') + '">' + r[1] + '</button>').join('') + '</div></div>' +
    '<div class="banner" style="background:var(--soft-blue);border-color:#DCE5FF"><div>' + ic('eye') + '</div><div><span>Pratinjau nomor berikutnya</span><b class="num" style="font-size:18px" data-prev></b></div></div></div>' +
    settingsFoot('Simpan format') + '</form></div>';
  let reset = N.reset;
  const inp = $('[name=format]', el);
  const upd = () => {
    const per = reset === 'bulan' ? today().slice(0, 7) : reset === 'tahun' ? today().slice(0, 4) : 'semua';
    const n = (N.periode_terakhir === per && N.reset === reset ? N.urut_terakhir : 0) + 1;
    $('[data-prev]', el).textContent = previewNo(inp.value, n);
    const bad = (inp.value.match(/\{[^}]*\}/g) || []).filter(x => !/^\{(TAHUN|TH|BULAN|BLN|HARI|URUT(:\d+)?)\}$/.test(x));
    const err = $('[data-e]', el); err.hidden = true;
    if (bad.length) { err.textContent = 'Kode tidak dikenal: ' + bad.join(', '); err.hidden = false; }
    else if (!/\{URUT(:\d+)?\}/.test(inp.value)) { err.textContent = 'Wajib memuat {URUT:n} agar nomor tidak kembar.'; err.hidden = false; }
  };
  inp.oninput = upd; upd();
  el.onclick = e => {
    const c = e.target.closest('[data-code]'); if (c) { const p = inp.selectionStart || inp.value.length; inp.value = inp.value.slice(0, p) + c.dataset.code + inp.value.slice(p); inp.focus(); upd(); return; }
    const pr = e.target.closest('[data-preset]'); if (pr) { inp.value = pr.dataset.preset; upd(); return; }
    const r = e.target.closest('[data-r]'); if (r) { reset = r.dataset.r; $$('[data-r]', el).forEach(x => x.classList.toggle('on', x === r)); upd(); }
  };
  $('[data-nf]', el).onsubmit = async e => {
    e.preventDefault(); upd(); if (!$('[data-e]', el).hidden) return;
    await UI.busy(e.submitter, async () => { const r = await api('saveNumbering', { format: inp.value.trim(), reset }); if (!r.success) return UI.toast(r.message, 'err'); UI.toast('Format tersimpan. Nomor berikutnya: ' + r.data.preview); go('lainnya'); });
  };
}

function renderSizeTypes(el) {
  const V = Data.view();
  let list = V.sizeTypesAll.filter(j => j.aktif).map(j => ({ id: j.id, nama: j.nama, daftar_ukuran: j.daftar_ukuran, bawaan: j.bawaan, aktif: true }));
  const draw = () => {
    $('[data-st]', el).innerHTML = list.map((j, i) => '<div class="card card-pad stack-sm" data-j="' + i + '"><div class="row-between"><span class="semi">' + (i + 1) + '. ' + esc(j.nama || 'Jenis baru') + '</span><div class="row" style="gap:4px">' +
      '<button type="button" class="btn btn-icon btn-sm btn-ghost" data-up="' + i + '" aria-label="Naikkan" ' + (i ? '' : 'disabled') + '>' + ic('arrow-up', 'ico-sm') + '</button><button type="button" class="btn btn-icon btn-sm btn-ghost" data-down="' + i + '" aria-label="Turunkan" ' + (i < list.length - 1 ? '' : 'disabled') + '>' + ic('arrow-down', 'ico-sm') + '</button>' +
      '<button type="button" class="btn btn-icon btn-sm btn-ghost" data-rm="' + i + '" aria-label="Hapus">' + ic('trash-2', 'ico-sm') + '</button></div></div>' +
      '<div class="grid2"><div class="field"><label>Nama</label><input class="input" data-k="nama" value="' + esc(j.nama) + '" maxlength="40"></div><div class="field"><label>Daftar ukuran</label><input class="input" data-k="daftar_ukuran" value="' + esc(j.daftar_ukuran) + '" placeholder="S,M,L,XL"></div></div>' +
      '<label class="row small" style="min-height:36px"><input type="radio" name="bawaan" data-def="' + i + '" ' + (j.bawaan ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:var(--pri)"> Dipilih otomatis di form pesanan</label></div>').join('');
  };
  el.innerHTML = '<div class="form-narrow">' + pageHead('Jenis & daftar ukuran', 'Ukuran muncul sebagai kotak isian di form pesanan.') +
    '<form data-sf novalidate><p class="small muted mb12">Pisahkan ukuran dengan koma. Jenis yang dihapus tidak memengaruhi pesanan lama.</p><div class="stack" data-st></div>' +
    '<button type="button" class="btn btn-soft btn-block mt12" data-add>' + ic('plus') + 'Tambah jenis ukuran</button>' + settingsFoot('Simpan') + '</form></div>';
  draw();
  el.oninput = e => { const c = e.target.closest('[data-j]'); if (c && e.target.dataset.k) list[+c.dataset.j][e.target.dataset.k] = e.target.value; };
  el.onchange = e => { if (e.target.dataset.def != null) list.forEach((j, i) => { j.bawaan = i === +e.target.dataset.def; }); };
  el.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-add')) { list.push({ nama: '', daftar_ukuran: '', bawaan: false, aktif: true }); draw(); const ins = $$('[data-k="nama"]', el); ins[ins.length - 1].focus(); }
    if (b.dataset.rm != null) { if (list.length <= 1) return UI.toast('Minimal satu jenis ukuran.', 'err'); list.splice(+b.dataset.rm, 1); draw(); }
    if (b.dataset.up != null) { const i = +b.dataset.up; [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); }
    if (b.dataset.down != null) { const i = +b.dataset.down; [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); }
  };
  $('[data-sf]', el).onsubmit = async e => {
    e.preventDefault();
    await UI.busy(e.submitter, async () => { const r = await api('saveSizeTypes', { list }); if (!r.success) return UI.toast(r.message, 'err'); UI.toast('Jenis ukuran tersimpan.'); go('lainnya'); });
  };
}

function renderStages(el) {
  const V = Data.view();
  const list = V.stagesAll.map(s => ({ id: s.id, kode: s.kode, nama: s.nama, aktif: s.aktif }));
  el.innerHTML = '<div class="form-narrow">' + pageHead('Tahap produksi', 'Urutan tetap. Matikan tahap yang tidak dipakai konveksi Anda.') +
    '<form data-sf novalidate><div class="card list">' + list.map((s, i) => {
      const fixed = s.kode === 'diterima' || s.kode === 'diambil';
      return '<div class="li" style="cursor:default"><span class="pill st-' + s.kode + '" style="min-width:28px;justify-content:center">' + (i + 1) + '</span><input class="input grow" data-n="' + i + '" value="' + esc(s.nama) + '" maxlength="30" aria-label="Nama tahap ' + (i + 1) + '">' +
        '<label class="row small" style="min-width:84px"><input type="checkbox" data-a="' + i + '" ' + (s.aktif ? 'checked' : '') + ' ' + (fixed ? 'disabled' : '') + ' style="width:22px;height:22px;accent-color:var(--pri)">' + (fixed ? 'Wajib' : 'Aktif') + '</label></div>';
    }).join('') + '</div><p class="small muted mt12">Tahap Sablon/Bordir otomatis dilewati untuk pesanan tanpa sablon. Setiap perpindahan tahap tercatat (siapa & kapan).</p>' + settingsFoot('Simpan') + '</form></div>';
  el.oninput = e => { if (e.target.dataset.n != null) list[+e.target.dataset.n].nama = e.target.value; };
  el.onchange = e => { if (e.target.dataset.a != null) list[+e.target.dataset.a].aktif = e.target.checked; };
  $('[data-sf]', el).onsubmit = async e => {
    e.preventDefault();
    await UI.busy(e.submitter, async () => { const r = await api('saveStages', { list }); if (!r.success) return UI.toast(r.message, 'err'); UI.toast('Tahap produksi tersimpan.'); go('lainnya'); });
  };
}

function renderUsers(el) {
  if (!el) return;
  const V = Data.view(), me = Session.me || {};
  const users = V.users.slice().sort((a, b) => (b.aktif - a.aktif) || (a.peran === 'pemilik' ? -1 : 1));
  el.innerHTML = '<div class="form-narrow">' + pageHead('Kelola pengguna', 'Admin bisa mencatat pesanan, menerima bayaran, dan mengubah tahap. Admin tidak melihat modal, laba, dan pengeluaran.', '<button class="btn btn-primary" data-add>' + ic('user-plus') + 'Tambah pengguna</button>') +
    '<div class="card list">' + users.map(u => '<div class="li" style="cursor:default;' + (u.aktif ? '' : 'opacity:.55') + '"><span class="avatar" style="background:var(--pri-soft);color:var(--pri)">' + esc(fmt.initials(u.nama)) + '</span><div class="grow"><div class="row"><span class="semi ellipsis">' + esc(u.nama) + '</span><span class="pill ' + (u.peran === 'pemilik' ? 'st-jahit' : 'st-diterima') + '">' + (u.peran === 'pemilik' ? 'Pemilik' : 'Admin') + '</span>' + (u.aktif ? '' : '<span class="pill st-batal">Nonaktif</span>') + '</div>' +
      '<div class="small muted ellipsis">' + esc(u.email) + (u.terakhir_masuk ? ' · masuk ' + esc(fmt.dateTime(u.terakhir_masuk)) : '') + '</div></div><div class="rel"><button class="btn btn-icon btn-ghost" data-u="' + u.id + '" aria-label="Menu ' + esc(u.nama) + '">' + ic('ellipsis-vertical') + '</button></div></div>').join('') + '</div>' +
    '<button class="btn btn-soft btn-block mt12 only-mob flex" data-add>' + ic('user-plus') + 'Tambah pengguna</button></div>';
  el.onclick = e => {
    if (e.target.closest('[data-add]')) return userForm();
    const b = e.target.closest('[data-u]'); if (!b) return;
    const u = V.users.find(x => x.id === b.dataset.u);
    UI.menu(b, [
      { label: 'Ubah nama / peran', icon: 'pencil', run: () => userForm(u) },
      { label: 'Atur sandi baru', icon: 'key-round', run: () => resetPw(u) },
      u.email !== me.email && { label: u.aktif ? 'Nonaktifkan' : 'Aktifkan lagi', icon: u.aktif ? 'user-x' : 'user-check', danger: u.aktif, run: async () => {
        if (u.aktif && !(await UI.confirm({ title: 'Nonaktifkan ' + u.nama + '?', msg: 'Pengguna ini langsung keluar dari semua perangkat dan tidak bisa masuk.', ok: 'Nonaktifkan', danger: true }))) return;
        const r = await api('saveUser', { id: u.id, nama: u.nama, peran: u.peran, aktif: !u.aktif }); UI.toast(r.success ? 'Tersimpan.' : r.message, r.success ? 'ok' : 'err');
      } }
    ]);
  };
}
function userForm(u) {
  u = u || {};
  const s = UI.sheet({ title: u.id ? 'Ubah pengguna' : 'Tambah pengguna', icon: 'user-plus',
    body: '<form class="stack" data-uf novalidate>' + (u.id ? '<div class="small muted">' + esc(u.email) + '</div>' : '<div class="field"><label class="req" for="uf-e">Email</label><input id="uf-e" class="input" name="email" type="email" inputmode="email" autocomplete="off" autofocus></div>') +
      '<div class="field"><label class="req" for="uf-n">Nama</label><input id="uf-n" class="input" name="nama" value="' + esc(u.nama || '') + '" maxlength="80"></div>' +
      '<div class="field"><span class="lbl">Peran</span><div class="seg"><button type="button" data-p="admin" class="' + (u.peran !== 'pemilik' ? 'on' : '') + '">Admin</button><button type="button" data-p="pemilik" class="' + (u.peran === 'pemilik' ? 'on' : '') + '">Pemilik</button></div><div class="hint">Admin: pesanan, bayaran, produksi, pelanggan, stok. Pemilik: semua menu.</div></div>' +
      (u.id ? '' : '<div class="field"><label class="req" for="uf-p">Sandi awal</label><input id="uf-p" class="input" name="sandi" type="text" autocomplete="off" minlength="6"><div class="hint">Minimal 6 karakter. Berikan ke pengguna, minta diganti setelah masuk.</div></div>') +
      '<div class="err" data-e hidden></div></form>',
    foot: '<button class="btn btn-ghost" data-c>Batal</button><button class="btn btn-primary" data-s>Simpan</button>' });
  let peran = u.peran || 'admin'; const reqId = uid();
  s.body.onclick = e => { const p = e.target.closest('[data-p]'); if (p) { peran = p.dataset.p; $$('[data-p]', s.body).forEach(x => x.classList.toggle('on', x === p)); } };
  s.foot.onclick = async e => {
    if (e.target.closest('[data-c]')) return s.close();
    const b = e.target.closest('[data-s]'); if (!b) return;
    const d = Object.fromEntries(new FormData($('[data-uf]', s.body)).entries()), err = $('[data-e]', s.body);
    const payload = { id: u.id, nama: d.nama, peran, aktif: u.id ? u.aktif : true, email: d.email, sandi: d.sandi };
    await UI.busy(b, async () => { const r = await api('saveUser', payload, { reqId }); if (!r.success) { err.textContent = r.message; err.hidden = false; return; } s.close(); UI.toast('Pengguna tersimpan.'); });
  };
}
async function resetPw(u) {
  const pw = await UI.prompt({ title: 'Sandi baru untuk ' + u.nama, msg: 'Pengguna akan keluar dari semua perangkat dan masuk dengan sandi ini.', label: 'Sandi baru (min. 6 karakter)', ok: 'Simpan sandi' });
  if (pw == null) return;
  const r = await api('resetPassword', { email: u.email, sandi: pw }, { vers: false });
  UI.toast(r.success ? 'Sandi ' + u.nama + ' diganti.' : r.message, r.success ? 'ok' : 'err');
}
