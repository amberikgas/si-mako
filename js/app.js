/* ============================================================
   Si-MAKO — boot, login, menu teknis (?setup=1), pembantu halaman
   ============================================================ */
'use strict';

function pageHead(title, sub, acts) {
  return '<div class="page-head"><div><h1>' + esc(title) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div>';
}
/** true bila data belum ada sama sekali (perangkat baru) → tampilkan kerangka/galat. */
function needData(el) {
  if (Data.t.Pesanan) return false;
  if (Data.syncing || !Data.lastSync) {
    el.innerHTML = '<div class="sk" style="height:28px;width:50%;margin-bottom:16px"></div>' + UI.skeleton(4);
    if (!Data.syncing) Data.refresh({ force: true }).then(r => { if (r && !r.success && !Data.t.Pesanan) { el.innerHTML = UI.errorBox(r.message, true); el.querySelector('[data-retry]').onclick = () => { Data.lastSync = 0; route(); }; } });
    return true;
  }
  return false;
}

/* ============================ LOGIN ============================ */
registerPage('login', {
  auth: 'guest', title: 'Masuk', live: false,
  render(el) {
    warmUpServer();
    el.className = 'page flush';
    el.innerHTML = '<div class="login-wrap"><div class="card login-card">' +
      '<div class="logo-mark">SM</div>' +
      '<h1 class="h-hero mt16">Masuk ke Si-MAKO</h1><p class="muted mt8">Catat pesanan, pembayaran, dan tahap produksi konveksi.</p>' +
      '<form id="lf" class="stack mt24" novalidate>' +
      '<div class="field"><label for="l-email">Email</label><input id="l-email" class="input" type="email" autocomplete="username" inputmode="email" placeholder="nama@email.com" required></div>' +
      '<div class="field"><label for="l-pw">Sandi</label><div class="input-group"><input id="l-pw" class="input" type="password" autocomplete="current-password" required style="padding-right:52px">' +
      '<button type="button" class="btn btn-icon suffix" id="l-eye" aria-label="Tampilkan sandi">' + ic('eye') + '</button></div></div>' +
      '<div id="l-err" class="banner red" hidden role="alert"></div>' +
      '<button class="btn btn-primary btn-lg btn-block" id="l-btn" type="submit">Masuk</button>' +
      '<p class="small muted center">Lupa sandi? Minta Pemilik me-reset sandi Anda di menu Kelola Pengguna.</p></form>' +
      (CFG.API_URL ? '' : '<div class="banner amber mt16"><div>' + ic('triangle-alert') + '</div><div><b>Alamat API belum diisi</b><span>Buka file config.js lalu isi API_URL dengan URL /exec dari Apps Script.</span></div></div>') +
      '</div></div>';
    const last = LS.get('lastEmail'); if (last) $('#l-email', el).value = last;
    $('#l-eye', el).onclick = () => { const p = $('#l-pw', el); p.type = p.type === 'password' ? 'text' : 'password'; $('#l-eye', el).innerHTML = ic(p.type === 'password' ? 'eye' : 'eye-off'); };
    $('#lf', el).onsubmit = async e => {
      e.preventDefault();
      const email = $('#l-email', el).value.trim().toLowerCase(), sandi = $('#l-pw', el).value, err = $('#l-err', el);
      err.hidden = true;
      if (!email || !sandi) { err.innerHTML = '<div><b>Isi email dan sandi.</b></div>'; err.hidden = false; return; }
      await UI.busy($('#l-btn', el), async () => {
        const r = await api('login', { email, sandi, vers: {} }, { token: '' });
        if (!r.success) { err.innerHTML = '<div>' + ic('circle-alert') + '</div><div><b>' + esc(r.message) + '</b></div>'; err.hidden = false; return; }
        LS.set('lastEmail', email);
        Session.set(r.data.token, r.data.me);
        await Data.load(r.data.me.email);
        Data.apply(r.data.sync);
        go('beranda');
        UI.toast('Selamat datang, ' + r.data.me.nama + '.');
      });
    };
    setTimeout(() => { const f = $('#l-email', el).value ? $('#l-pw', el) : $('#l-email', el); f.focus(); }, 50);
  }
});

/* ============================ MENU TEKNIS (?setup=1) ============================ */
registerPage('teknis', {
  auth: 'guest', bare: true, title: 'Menu teknis', live: false,
  async render(el) {
    el.className = 'page';
    el.innerHTML = '<div class="form-narrow stack" style="max-width:720px;margin:0 auto;padding-bottom:40px">' +
      '<div class="row"><div class="logo-mark">SM</div><div><h1 class="h-lg">Menu Teknis</h1><p class="muted">Untuk Pengelola yang memasang & merawat aplikasi.</p></div></div>' +
      '<div class="card card-pad stack" id="tk-health"><b>Memeriksa server…</b></div>' +
      '<div class="card card-pad stack-sm"><h3 class="h-sm">Langkah pemasangan</h3><ol class="small" style="margin:0;padding-left:18px;line-height:1.9">' +
      '<li>Tempel semua file <code>.gs</code> ke proyek Apps Script, simpan.</li>' +
      '<li>Jalankan fungsi <b>setupAplikasi</b> sekali → catat email & sandi Pemilik di log.</li>' +
      '<li>Deploy → New deployment → Web app · Execute as: <b>Me</b> · Who has access: <b>Anyone</b>.</li>' +
      '<li>Salin URL <code>/exec</code> ke <code>config.js</code> (API_URL), unggah frontend ke Vercel/GitHub Pages.</li>' +
      '<li>Opsional: jalankan <b>isiDataContoh</b> untuk latihan.</li></ol></div>' +
      '<div class="card card-pad stack-sm"><h3 class="h-sm">Fungsi editor Apps Script</h3><div class="small muted" style="line-height:1.9">' +
      '<b>resetSandiPemilik</b> — sandi baru untuk Pemilik · <b>cekPerforma</b> — status cache & pemicu · <b>bersihkanCache</b> — setelah edit manual di Sheet · <b>cadanganSekarang</b> — salin Sheet ke Drive · <b>matikanKeepWarm</b>/<b>nyalakanKeepWarm</b></div></div>' +
      '<div id="tk-sys"></div>' +
      '<a class="btn btn-ghost" href="' + (Session.token ? '#/lainnya' : '#/beranda') + '">' + ic('arrow-left') + 'Kembali ke aplikasi</a></div>';
    const box = $('#tk-health', el);
    if (!CFG.API_URL) { box.innerHTML = '<div class="banner red"><div>' + ic('circle-alert') + '</div><div><b>API_URL kosong</b><span>Isi config.js dengan URL /exec.</span></div></div>'; return; }
    const t0 = performance.now();
    const r = await api('health', {}, { vers: false });
    const ms = Math.round(performance.now() - t0);
    box.innerHTML = r.success
      ? '<div class="banner ' + (r.data.ready ? 'green' : 'amber') + '"><div>' + ic(r.data.ready ? 'circle-check' : 'triangle-alert') + '</div><div><b>' + (r.data.ready ? 'Server siap' : 'Server terhubung, tapi setupAplikasi() belum dijalankan') + '</b><span>Versi ' + esc(r.data.v) + ' · kontrak ' + esc(r.data.contract) + ' · ' + ms + ' ms</span></div></div><div class="small muted" style="word-break:break-all">API: ' + esc(CFG.API_URL) + '</div>'
      : '<div class="banner red"><div>' + ic('circle-alert') + '</div><div><b>Server tidak bisa dihubungi</b><span>' + esc(r.message) + '</span></div></div><div class="small muted">Periksa: URL berakhiran /exec · akses "Anyone" · sudah Deploy versi terbaru.</div>';
    if (Session.owner) {
      const s = await api('systemStatus', {}, { vers: false });
      if (s.success) {
        const d = s.data;
        $('#tk-sys', el).innerHTML = '<div class="card"><div class="card-head"><h3>Kesehatan sistem</h3><span class="small muted">Properties ' + d.properties_kb + ' KB</span></div><div class="card-body small">' +
          '<div class="mb8">Pemicu: ' + esc(d.triggers.join(', ') || '(belum ada — jalankan setupAplikasi)') + ' · keepWarm ' + (d.keep_warm ? 'ON' + (d.work_hours ? ' (' + esc(d.work_hours) + ')' : '') : 'OFF') + ' · antrean log ' + d.log_queue + '</div>' +
          '<div class="mb8">Cadangan terakhir: ' + esc(d.last_backup ? fmt.dateTime(d.last_backup) : 'belum ada') + '</div>' +
          '<table class="table"><thead><tr><th>Tabel</th><th class="r">Baris</th><th>Cache</th></tr></thead><tbody>' + d.tables.map(t => '<tr><td>' + t.tabel + '</td><td class="r num">' + fmt.num(t.baris) + '</td><td>' + t.cache + '</td></tr>').join('') + '</tbody></table></div></div>';
      }
    }
  }
});

/* ============================ BOOT ============================ */
async function boot() {
  Activity.init();
  if (new URLSearchParams(location.search).has('setup')) {
    history.replaceState(null, '', location.pathname + '#/teknis');
  }
  if (Session.token && Session.me) await Data.load(Session.me.email);
  route();
  if (Session.token) Data.refresh({ force: true });
  startBackgroundSync();
  if ('serviceWorker' in navigator && CFG.SW !== false && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
}
document.addEventListener('DOMContentLoaded', boot);
