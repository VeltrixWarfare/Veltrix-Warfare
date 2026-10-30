VELTRIX WARFARE — PAYMENT INTEGRATION (SANDBOX FIRST)

Isi:
- api/payment/create.ts       Membuat transaksi Midtrans Snap QRIS di server.
- api/payment/webhook.ts      Memverifikasi signature + status langsung ke Midtrans, lalu mengaktifkan membership.
- api/payment/transactions.ts Riwayat transaksi hanya untuk user yang login.
- supabase/payment_integration.sql Membuat tabel transaksi dan RPC aktivasi membership.
- src/payment/checkout-snippet.tsx Potongan UI yang perlu dipasang ke src/App.tsx.

PENTING:
1. Integrasi ini tidak punya biaya langganan dari kode. Midtrans tetap dapat mengenakan biaya per transaksi ketika LIVE.
2. Jangan aktifkan LIVE sampai akun merchant disetujui, kredensial LIVE tersedia, dan harga paket dikonfirmasi.
3. Harga pada kode server sekarang menyalin harga contoh yang tampil di website: Essential 79.000/758.000; Advanced 149.000/1.430.000; Private 299.000/2.870.000. Pastikan harga final sebelum transaksi nyata.
4. Membership hanya aktif dari webhook yang signature-nya valid dan statusnya diverifikasi langsung lewat Midtrans.
5. Jalankan SQL hanya setelah memastikan tabel public.memberships memiliki kolom user_id, plan, status, starts_at, ends_at, payment_reference dan UNIQUE constraint pada user_id. Jika tidak, sesuaikan SQL terlebih dahulu.
6. Jangan pernah memasukkan SUPABASE_SERVICE_ROLE_KEY atau MIDTRANS_SERVER_KEY ke variabel VITE_* atau frontend.
7. Saya tidak bisa mengirim commit langsung ke GitHub karena integrasi repo menolak izin tulis (403). File ini perlu diunggah ke repo.

A. SUPABASE
- Buka Supabase > SQL Editor.
- Jalankan supabase/payment_integration.sql.
- Pastikan sukses; jangan lanjut jika muncul error terkait skema memberships.

B. GITHUB
Unggah tiga file API ke path yang sama di repo:
- api/payment/create.ts
- api/payment/webhook.ts
- api/payment/transactions.ts

Unggah SQL dan checkout snippet sebagai file dokumentasi bila diperlukan.
Tambahkan handler checkout dari src/payment/checkout-snippet.tsx ke dalam function App() di src/App.tsx. Pada tombol setiap paket, panggil handleCheckout(p.name, billing). Ini satu perubahan frontend yang diperlukan agar tombol harga benar-benar membuka checkout.

C. VERCEL ENVIRONMENT VARIABLES
Tambahkan di Project > Settings > Environment Variables:
- SUPABASE_URL = URL proyek Supabase
- SUPABASE_ANON_KEY = publishable/anon key Supabase
- SUPABASE_SERVICE_ROLE_KEY = secret service role key (server only)
- MIDTRANS_SERVER_KEY = Server Key dari MIDTRANS SANDBOX
- MIDTRANS_IS_PRODUCTION = false

Bisa juga pakai VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY yang sudah ada, tetapi service role dan Midtrans server key harus tanpa awalan VITE_.
Set environment variables untuk Preview terlebih dahulu, lalu redeploy.

D. MIDTRANS SANDBOX
- Buat akun merchant yang memenuhi ketentuan provider dan gunakan kredensial sandbox.
- Di pengaturan notifikasi Midtrans, set Payment Notification URL ke:
  https://veltrix-warfare.vercel.app/api/payment/webhook
- Pastikan QRIS tersedia/diaktifkan untuk akun sandbox.
- Tes dengan simulasi pembayaran sandbox saja. Jangan pakai uang asli saat MIDTRANS_IS_PRODUCTION=false.

E. UJI SEBELUM LIVE
- Checkout hanya dapat dimulai setelah login.
- Membuka URL sukses sendiri tidak mengaktifkan membership.
- Webhook valid dengan status settlement harus mengubah transaksi menjadi paid dan mengaktifkan membership.
- Webhook duplikat tidak boleh memperpanjang membership lagi.
- Tes gagal/expired/pending dan pastikan membership tidak aktif.
- Periksa schema tabel memberships dan coba SQL di staging jika tersedia.

Status: backend scaffold siap untuk integrasi sandbox, belum bisa disebut live/teruji sampai kredensial provider, SQL, webhook URL, dan build Vercel diverifikasi.
