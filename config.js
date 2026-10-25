/**
 * Si-MAKO — satu-satunya file yang perlu diubah di frontend.
 * Isi API_URL dengan URL Web App Apps Script (berakhiran /exec).
 * Tampilan tidak tahu apa pun tentang Google Sheet — bila kelak pindah database,
 * cukup ganti alamat ini ke server baru yang memenuhi kontrak API yang sama.
 */
window.SIMAKO_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbz_ebIu4z0UxVtqGk0VWA4Vbk4pN5CUW1jekTLYoHD1QILwG89DUdCZuwRlRX8NwmgE/exec',            // contoh: 'https://script.google.com/macros/s/AKfycb.../exec'
  APP_NAME: 'Si-MAKO'
};