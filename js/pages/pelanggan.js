/* ============================================================
   PELANGGAN (F-14) — daftar, riwayat pesanan, total utang
   ============================================================ */
'use strict';

function customerForm(c, onSaved) {
  c = c || {};
  const s = UI.sheet({ title: c.id ? 'Ubah pelanggan' : 'Tambah pelanggan', icon: 'user',
    body: '<form class="stack" novalidate data-cf><div class="field"><label class="req" for="cf-n">Nama pelanggan / instansi</label><input id="cf-n" class="input" name="nama" value="' + esc(c.nama || '') + '" maxlength="120" autofocus required></div>' +
      '<div class="field"><label for="cf-w">No. WhatsApp</label><input id="cf-w" class="input" name="wa" inputmode="tel" value="' + esc(fmt.wa(c.wa)) + '" placeholder="0812 3456 7890"></div>' +
      '<div class="field"><label for="cf-a">Alamat</label><input id="cf-a" class="input" name="alamat" value="' + esc(c.alamat || '') + '" maxlength="300"></div>' +
      '<div class="field"><label for="cf-c">Catatan</label><textarea id="cf-c" class="textarea" name="catatan" maxlength="500" placeholder="Contoh: PIC Pak Bambang, langganan seragam sekolah">' + esc(c.catatan || '') + '</textarea></div></form>',
    foot: '<button class="btn btn-ghost" data-x2>Batal</button><button class="btn btn-primary" data-save>Simpan</button>' });
  const reqId = uid();
  s.foot.onclick = async e => {
    if (e.target.closest('[data-x2]')) return s.close();
    const b = e.target.closest('[data-save]'); if (!b) return;
    const f = $('[data-cf]', s.body), d = Object.fromEntries(new FormData(f).entries());
    if (!d.nama.trim()) { f.nama.classList.add('invalid'); f.nama.focus(); return; }
    await UI.busy(b, async () => {
      const r = await api('saveCustomer', Object.assign({ id: c.id }, d), { reqId });
      if (!r.success) { UI.toast(r.message, 'err'); return; }
      s.close(); UI.toast('Data pelanggan tersimpan.'); onSaved && onSaved(r.data.id);
    });
  };
}

registerPage('pelanggan', {
  title: 'Pelanggan',
  header: id => id ? { title: 'Pelanggan', sub: (Data.view().customers[id] || {}).nama || '', back: 'pelanggan' } : null,
  hideNav: id => !!id,
  render(el, id, query) {
    if (needData(el)) { el.dataset.built = ''; return; }
    if (id) { el.dataset.built = ''; return renderCustomer(el, id); }
    const V = Data.view();
    if (el.dataset.built !== '1') {
      el.dataset.built = '1';
      el.innerHTML = pageHead('Pelanggan', 'Daftar pelanggan, riwayat pesanan, dan sisa utang.', '<button class="btn btn-primary" data-add>' + ic('user-plus') + 'Tambah pelanggan</button>') +
        '<div class="row"><div class="search grow">' + ic('search') + '<input class="input" type="search" data-q placeholder="Cari nama atau no. WA" aria-label="Cari pelanggan"></div><button class="btn btn-primary btn-icon only-mob" data-add aria-label="Tambah pelanggan">' + ic('user-plus') + '</button></div>' +
        '<div class="chips mt12"><button class="chip on" data-s="nama">Nama A–Z</button><button class="chip" data-s="utang">Utang terbesar</button><button class="chip" data-s="baru">Pesan terakhir</button></div><div data-list class="mt12"></div>';
      const inp = $('[data-q]', el);
      inp.addEventListener('input', debounce(() => { this.q = inp.value.trim().toLowerCase(); this.update(el); }, 200));
      el.onclick = e => {
        if (e.target.closest('[data-add]')) return customerForm(null, nid => go('pelanggan', nid));
        const s = e.target.closest('[data-s]'); if (s) { this.sort = s.dataset.s; $$('[data-s]', el).forEach(x => x.classList.toggle('on', x === s)); this.update(el); }
      };
    }
    this.update(el);
  },
  update(el) {
    const V = Data.view(), q = this.q || '', qd = q.replace(/\D/g, '').replace(/^0/, '');
    let list = Object.values(V.customers);
    if (q) list = list.filter(c => c.nama.toLowerCase().indexOf(q) > -1 || (qd.length >= 3 && String(c.wa).indexOf(qd) > -1));
    const st = c => V.custStats[c.id] || { count: 0, utang: 0, last: '' };
    const sort = this.sort || 'nama';
    list.sort(sort === 'utang' ? (a, b) => st(b).utang - st(a).utang : sort === 'baru' ? (a, b) => (st(b).last > st(a).last ? 1 : -1) : (a, b) => a.nama.localeCompare(b.nama));
    const totalUtang = list.reduce((a, c) => a + st(c).utang, 0);
    $('[data-list]', el).innerHTML = list.length ?
      '<div class="small muted mb8">' + list.length + ' pelanggan' + (totalUtang ? ' · total utang <b class="danger num">' + fmt.rp(totalUtang) + '</b>' : '') + '</div>' +
      '<div class="card list">' + list.slice(0, 300).map(c => { const s = st(c); return '<a class="li" href="#/pelanggan/' + c.id + '"><span class="avatar" style="background:var(--pri-soft);color:var(--pri)">' + esc(fmt.initials(c.nama)) + '</span><div class="grow"><div class="semi ellipsis">' + esc(c.nama) + '</div><div class="small muted ellipsis">' + esc(fmt.wa(c.wa) || 'Tanpa no. WA') + ' · ' + s.count + ' pesanan</div></div>' +
        (s.utang ? '<div class="right"><div class="small muted">Utang</div><div class="num semi danger">' + fmt.rp(s.utang) + '</div></div>' : '<span class="pill pay-lunas only-desk">Tidak ada utang</span>') + ic('chevron-right', 'ico-sm chev') + '</a>'; }).join('') + '</div>'
      : '<div class="card">' + UI.empty('users', q ? 'Tidak ditemukan' : 'Belum ada pelanggan', q ? 'Coba nama atau nomor lain.' : 'Pelanggan otomatis tersimpan saat mencatat pesanan.') + '</div>';
  }
});

function renderCustomer(el, id) {
  const V = Data.view(), c = V.customers[id];
  if (!c) { el.innerHTML = UI.errorBox('Pelanggan tidak ditemukan.'); return; }
  const orders = V.orders.filter(o => o.pelanggan_id === id).sort((a, b) => (a.tgl_pesan < b.tgl_pesan ? 1 : -1));
  const s = V.custStats[id] || { count: 0, utang: 0, total: 0 };
  el.innerHTML = pageHead(c.nama, 'Pelanggan', '<button class="btn btn-ghost" data-edit>' + ic('pencil') + 'Ubah</button><a class="btn btn-primary" href="#/pesanan-baru?pelanggan=' + c.id + '">' + ic('plus') + 'Catat pesanan</a>') +
    '<div class="grid-detail"><div class="stack"><div class="card card-pad"><div class="row" style="align-items:flex-start"><span class="avatar lg">' + esc(fmt.initials(c.nama)) + '</span><div class="grow"><h2 class="h-lg">' + esc(c.nama) + '</h2>' +
    (c.wa ? '<a class="semi" href="' + UI.waLink(c.wa) + '" target="_blank" rel="noopener">' + esc(fmt.wa(c.wa)) + '</a>' : '<span class="muted">Tanpa no. WA</span>') + (c.alamat ? '<div class="small muted mt8">' + esc(c.alamat) + '</div>' : '') +
    (c.catatan ? '<div class="small mt8" style="white-space:pre-line">' + esc(c.catatan) + '</div>' : '') + '</div><button class="btn btn-icon btn-ghost only-mob" data-edit aria-label="Ubah pelanggan">' + ic('pencil') + '</button></div>' +
    '<div class="sum3 mt16"><div><small>Pesanan</small><b>' + s.count + '</b></div><div><small>Total belanja</small><b>' + fmt.rpShort(s.total) + '</b></div><div><small class="danger">Utang</small><b class="' + (s.utang ? 'danger' : 'success') + '">' + fmt.rp(s.utang) + '</b></div></div>' +
    '<div class="row mt16">' + (c.wa ? '<a class="btn btn-success grow" target="_blank" rel="noopener" href="' + UI.waLink(c.wa) + '">' + ic('message-circle') + 'WhatsApp</a>' : '') + '<a class="btn btn-primary grow only-mob flex" href="#/pesanan-baru?pelanggan=' + c.id + '">' + ic('plus') + 'Pesanan baru</a></div></div></div>' +
    '<div class="stack"><div class="section-title" style="margin-top:0"><h2>Riwayat pesanan</h2></div>' +
    (orders.length ? orders.map(o => orderCard(o)).join('') : '<div class="card">' + UI.empty('inbox', 'Belum ada pesanan', '') + '</div>') + '</div></div><div style="height:16px"></div>';
  el.onclick = e => { if (e.target.closest('[data-edit]')) customerForm(c); };
}
