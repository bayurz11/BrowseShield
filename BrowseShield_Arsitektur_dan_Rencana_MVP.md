# BrowseShield --- Rencana Produk dan Arsitektur Teknis

**Versi dokumen:** 1.0\
**Tanggal:** 11 Oktober 2026\
**Status:** Rancangan awal / MVP

------------------------------------------------------------------------

## 1. Ringkasan Proyek

**BrowseShield** adalah konsep ekstensi browser yang bertujuan membuat
aktivitas browsing lebih nyaman dengan mengurangi iklan, popup, redirect
yang tidak diinginkan, serta elemen halaman yang menghalangi interaksi
pengguna.

Contoh kasus yang ingin ditangani adalah elemen HTML transparan seperti
`div#dontfoid` yang mungkin menutupi halaman dan menangkap klik.
Keberadaan elemen tersebut saja belum membuktikan bahwa elemen itu
berbahaya; ekstensi harus memeriksa konteksnya sebelum menghapusnya.

### Sasaran MVP

1.  Memblokir permintaan jaringan yang cocok dengan aturan iklan/pelacak
    yang diketahui.
2.  Membantu mendeteksi popup dan redirect yang mencurigakan.
3.  Mendeteksi overlay yang berpotensi menghalangi interaksi.
4.  Menyediakan pembersihan elemen dan pemilih elemen secara manual.
5.  Menyediakan whitelist/pengecualian per situs.
6.  Memberi pengguna kendali untuk mengaktifkan atau menonaktifkan
    perlindungan.
7.  Menampilkan statistik dasar dan informasi tindakan yang dilakukan.

### Prinsip produk

-   Mengutamakan privasi dan pemrosesan lokal.
-   Meminta permission seminimal mungkin.
-   Tidak menghapus semua elemen transparan secara membabi buta.
-   Memulai dari mode diagnosis sebelum mengaktifkan tindakan otomatis.
-   Memberikan pengecualian per situs dan kontrol pengguna.
-   Menjelaskan bahwa pemblokiran tidak dapat menjamin semua iklan,
    popup, atau redirect akan tertangani.

------------------------------------------------------------------------

## 2. Persiapan Pengembangan

### Software dan tools

  -----------------------------------------------------------------------
  Tool                    Kegunaan                Prioritas
  ----------------------- ----------------------- -----------------------
  Google Chrome           Menjalankan dan menguji Wajib
                          ekstensi                

  Visual Studio Code      Editor kode             Wajib

  JavaScript              Bahasa utama MVP        Wajib

  HTML dan CSS            Popup dan halaman       Wajib
                          pengaturan              

  Chrome DevTools         Debugging DOM,          Wajib
                          jaringan, dan ekstensi  

  Git                     Version control         Disarankan

  Node.js dan npm         Formatter, bundler,     Opsional untuk versi
                          serta automated testing awal
                          jika dibutuhkan         
  -----------------------------------------------------------------------

Situs resmi: - Google Chrome: https://www.google.com/chrome/ - Visual
Studio Code: https://code.visualstudio.com/ - Node.js:
https://nodejs.org/ - Git: https://git-scm.com/ - Dokumentasi Chrome
Extensions: https://developer.chrome.com/docs/extensions/

### Rekomendasi awal

Mulai dengan JavaScript biasa tanpa React/Vue agar konsep Manifest V3,
service worker, content scripts, dan API Chrome lebih mudah dipahami.
TypeScript atau framework UI dapat ditambahkan ketika kompleksitas
meningkat.

------------------------------------------------------------------------

## 3. Arsitektur Sistem

BrowseShield menggunakan arsitektur **modular, event-driven, dan
permission-based**.

-   **Modular:** fitur dipisah ke modul yang memiliki tanggung jawab
    jelas.
-   **Event-driven:** komponen bereaksi terhadap event dari Chrome,
    pesan internal, atau perubahan DOM.
-   **Permission-based:** setiap komponen hanya meminta akses yang
    diperlukan.

### Diagram arsitektur

``` text
┌──────────────────────────────────────────────┐
│                 BROWSESHIELD                 │
│              Chrome Extension                │
└──────────────────────┬───────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌───────────────────┐    ┌────────────────────┐
│   USER INTERFACE  │    │   CHROME PLATFORM  │
│                   │    │                    │
│ Popup Dashboard   │    │ Network Filtering  │
│ Settings          │    │ Tabs & Navigation  │
│ Site Whitelist    │    │ Permissions        │
│ Statistics        │    │ Storage            │
└─────────┬─────────┘    └──────────┬─────────┘
          └────────────┬────────────┘
                       ▼
            ┌─────────────────────┐
            │   SERVICE WORKER    │
            │                     │
            │ Background Events   │
            │ Settings Manager    │
            │ Rules Coordinator   │
            │ Message Router      │
            └──────────┬──────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   ┌────────────┐ ┌────────────┐ ┌─────────────┐
   │ Ad Blocker │ │ Navigation │ │ Site Policy │
   │ Rules      │ │ Protection │ │ Manager     │
   └────────────┘ └────────────┘ └─────────────┘
                       │
                       ▼
             ┌────────────────────┐
             │   CONTENT SCRIPTS  │
             │                    │
             │ Overlay Detector   │
             │ Element Picker    │
             │ DOM Cleanup       │
             │ Click Diagnostics │
             └─────────┬──────────┘
                       ▼
             ┌────────────────────┐
             │      WEB PAGE      │
             │      HTML / DOM    │
             └────────────────────┘
```

Diagram ini bersifat konseptual. Tidak semua kotak harus menjadi proses
terpisah. Service worker Manifest V3 dapat dihentikan Chrome ketika
tidak digunakan, sehingga konfigurasi penting tidak boleh hanya disimpan
di memori.

------------------------------------------------------------------------

## 4. Teknologi dan API

  --------------------------------------------------------------------------------
  Komponen                Teknologi/API                    Tanggung jawab
  ----------------------- -------------------------------- -----------------------
  Konfigurasi ekstensi    Manifest V3                      Mendefinisikan entry
                                                           point, permission, dan
                                                           metadata

  Background              `chrome.runtime`                 Event dan komunikasi
                                                           ekstensi

  Pemfilteran jaringan    `chrome.declarativeNetRequest`   Memblokir permintaan
                                                           yang cocok dengan
                                                           aturan

  Manajemen tab           `chrome.tabs`                    Mengelola tab sesuai
                                                           permission

  Monitoring navigasi     `chrome.webNavigation`           Mengamati navigasi yang
                                                           relevan jika diperlukan

  Inspeksi halaman        Content scripts                  Membaca atau
                                                           memodifikasi DOM pada
                                                           halaman yang diizinkan

  Deteksi DOM dinamis     `MutationObserver`               Mendeteksi elemen baru
                                                           atau perubahan DOM

  Penyimpanan lokal       `chrome.storage.local`           Preferensi, whitelist,
                                                           dan aturan pengguna

  Antarmuka               HTML, CSS, JavaScript            Popup dan pengaturan

  Pengujian               Chrome DevTools dan automated    Validasi fungsi dan
                          tests                            regresi
  --------------------------------------------------------------------------------

Dokumentasi: - Chrome Extensions API:
https://developer.chrome.com/docs/extensions/reference/api - Manifest
V3:
https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3 -
Content scripts:
https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts -
Declarative Net Request:
https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest

### Perbedaan mekanisme penting

1.  **Network filtering** bekerja pada permintaan jaringan yang cocok
    dengan aturan.
2.  **Content scripts** bekerja pada DOM dan interaksi halaman yang
    dapat diaksesnya.
3.  Kedua mekanisme saling melengkapi, tetapi tidak menggantikan satu
    sama lain.

------------------------------------------------------------------------

## 5. Struktur Folder yang Disarankan

``` text
browseshield/
├── manifest.json
├── README.md
├── LICENSE
├── .gitignore
├── src/
│   ├── background/
│   │   ├── service-worker.js
│   │   ├── message-router.js
│   │   └── event-handlers.js
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── content/
│   │   ├── content.js
│   │   ├── overlay-detector.js
│   │   ├── element-picker.js
│   │   ├── dom-cleaner.js
│   │   └── click-diagnostics.js
│   ├── rules/
│   │   ├── default-rules.json
│   │   └── site-exceptions.json
│   ├── shared/
│   │   ├── constants.js
│   │   ├── messages.js
│   │   └── validators.js
│   └── assets/
│       └── icons/
└── tests/
    ├── rules.test.js
    ├── overlay.test.js
    └── settings.test.js
```

Struktur ini merupakan struktur sumber yang diusulkan. Untuk memuat
ekstensi di Chrome, `manifest.json` harus menunjuk ke file yang
benar-benar tersedia. Jika menggunakan bundler, hasil build dapat
ditempatkan di folder `dist/`.

------------------------------------------------------------------------

## 6. Modul dan Tanggung Jawab

### 6.1 Service Worker

File: `src/background/service-worker.js`

Tugas: - Menerima pesan dari popup dan content scripts. - Mengelola
pengaturan global. - Mengatur status perlindungan. - Mengelola aturan
jaringan. - Menangani event Chrome yang relevan.

Ketentuan: - Jangan mengandalkan variabel memori untuk menyimpan status
permanen. - Daftarkan event listeners dengan benar. - Simpan preferensi
penting di `chrome.storage`. - Pastikan komunikasi antarmodul
divalidasi.

### 6.2 Ad Blocker

File terkait: `src/rules/default-rules.json`

Tugas: - Mengelola aturan pemblokiran jaringan. - Menggunakan daftar
filter yang dapat dipercaya. - Mendukung pengecualian situs. -
Menghindari pemblokiran resource penting secara tidak sengaja.

Contoh aturan konseptual (domain contoh, bukan domain iklan nyata):

``` json
{
  "id": 1,
  "priority": 1,
  "action": {
    "type": "block"
  },
  "condition": {
    "urlFilter": "||ads.example.com^",
    "resourceTypes": [
      "script",
      "image",
      "xmlhttprequest",
      "sub_frame"
    ]
  }
}
```

Aturan ini hanya ilustrasi. Implementasi sebenarnya perlu mengelola ID
unik, validasi aturan, pengecualian, dan batas API Chrome. Jangan
memblokir domain hanya berdasarkan kata seperti `ads`, karena satu
domain dapat melayani iklan sekaligus fungsi utama situs.

### 6.3 Overlay Detector

File: `src/content/overlay-detector.js`

Indikator yang dapat diperiksa: - `position: fixed` atau
`position: absolute`. - Ukuran elemen dibandingkan viewport. -
`z-index`. - Transparansi. - Posisi elemen terhadap konten. -
`pointer-events`. - Apakah elemen benar-benar menutupi atau menangkap
interaksi.

Indikator-indikator tersebut bukan bukti tunggal bahwa elemen berbahaya.
Overlay yang sah juga digunakan oleh dialog login, menu, cookie consent,
dan pemutar video.

Rekomendasi: 1. Mulai dari mode diagnosis. 2. Hitung tingkat keyakinan
berdasarkan beberapa indikator. 3. Tampilkan alasan elemen dicurigai. 4.
Tawarkan pembersihan kepada pengguna. 5. Aktifkan penghapusan otomatis
hanya untuk aturan yang sudah teruji dan dapat dikonfigurasi.

### 6.4 Element Picker

File: `src/content/element-picker.js`

Alur: 1. Pengguna mengaktifkan mode pemilihan. 2. Kursor diarahkan ke
elemen. 3. Elemen diberi penanda visual. 4. Pengguna memilih elemen. 5.
Ekstensi menawarkan tindakan, misalnya menyembunyikan elemen. 6.
Pengguna dapat membatalkan atau memulihkan perubahan jika memungkinkan.

Pemilih elemen membantu ketika deteksi otomatis tidak yakin apakah
elemen tersebut merupakan iklan atau komponen penting situs.

### 6.5 DOM Cleaner

File: `src/content/dom-cleaner.js`

Tugas: - Melakukan tindakan terhadap elemen yang sudah dipilih atau
lolos aturan. - Mencatat tindakan untuk tampilan statistik lokal. -
Menghindari penghapusan elemen penting. - Mendukung pemulihan sebisa
mungkin.

Untuk kasus tertentu, menyembunyikan elemen dengan CSS lebih mudah
dibatalkan daripada menghapus node DOM secara permanen. Pilihan tindakan
perlu disesuaikan dengan kasus.

### 6.6 Click Diagnostics dan Navigation Protection

File: `src/content/click-diagnostics.js`

Tugas: - Membantu menganalisis klik yang tidak berfungsi. -
Mengidentifikasi kemungkinan overlay yang berada di atas tombol. -
Memantau navigasi atau popup yang relevan. - Mengarahkan pengguna ke
tindakan perlindungan yang tersedia.

Batasan: - Ekstensi tidak dapat mencegah setiap perilaku klik atau
navigasi pada semua situs. - Sebagian perilaku dipengaruhi oleh
kebijakan browser dan implementasi situs. - Utamakan pemblokiran sumber
yang diketahui, diagnosis, dan kontrol pengguna daripada mencoba
mengubah semua event klik.

### 6.7 Settings dan Site Policy Manager

Tugas: - Menyimpan pengaturan global. - Menyediakan whitelist per
situs. - Menyimpan preferensi pembersihan. - Memastikan pengecualian
diterapkan secara konsisten pada modul terkait.

------------------------------------------------------------------------

## 7. Penyimpanan dan Model Konfigurasi

Untuk MVP, gunakan `chrome.storage.local`. Database dan backend belum
diperlukan.

Contoh konfigurasi:

``` json
{
  "protectionEnabled": true,
  "adBlockingEnabled": true,
  "overlayProtectionEnabled": true,
  "popupProtectionEnabled": true,
  "trackingProtectionEnabled": false,
  "autoCleanupEnabled": false,
  "whitelist": [],
  "customHiddenSelectors": {}
}
```

Ini adalah contoh skema awal, bukan implementasi final.

  -----------------------------------------------------------------------
  Data                                Penyimpanan
  ----------------------------------- -----------------------------------
  Status perlindungan                 `chrome.storage.local`

  Whitelist situs                     `chrome.storage.local`

  Preferensi pengguna                 `chrome.storage.local`

  Selector khusus pengguna            `chrome.storage.local`

  Aturan jaringan aktif               Chrome Declarative Net Request

  Status sementara per halaman        Memori content script atau
                                      mekanisme sementara yang sesuai
  -----------------------------------------------------------------------

Backend baru dipertimbangkan jika produk membutuhkan sinkronisasi lintas
perangkat, akun pengguna, atau distribusi filter melalui server sendiri.

------------------------------------------------------------------------

## 8. Permission dan Keamanan

Contoh `manifest.json` awal:

``` json
{
  "manifest_version": 3,
  "name": "BrowseShield",
  "version": "0.1.0",
  "description": "Perlindungan browsing dan pembersihan elemen pengganggu.",
  "permissions": [
    "storage",
    "declarativeNetRequest"
  ],
  "action": {
    "default_popup": "src/popup/popup.html"
  }
}
```

Ini hanya konfigurasi awal, belum ekstensi lengkap. Implementasi
berikutnya mungkin memerlukan deklarasi service worker, content scripts,
host permissions atau optional permissions sesuai fitur yang benar-benar
dibutuhkan.

Prinsip keamanan: 1. Jangan menjalankan JavaScript dari sumber
eksternal. 2. Jangan mengumpulkan riwayat browsing tanpa kebutuhan dan
persetujuan yang jelas. 3. Simpan preferensi secara lokal jika
memungkinkan. 4. Jangan mengirim data situs yang dikunjungi ke server
tanpa penjelasan dan persetujuan yang sesuai. 5. Minta permission
seminimal mungkin. 6. Sediakan whitelist dan kontrol per situs. 7.
Hindari pembersihan DOM agresif. 8. Validasi pesan antarbagian ekstensi.
9. Dokumentasikan fungsi setiap permission. 10. Tinjau kebijakan Chrome
Web Store sebelum publikasi.

Dokumentasi Manifest V3:
https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3

------------------------------------------------------------------------

## 9. Rancangan Antarmuka

Popup yang disarankan:

``` text
┌─────────────────────────────────┐
│  BrowseShield                   │
│  Perlindungan browsing          │
├─────────────────────────────────┤
│  Perlindungan       [ ON / OFF ]│
│                                 │
│  Iklan diblokir              128│
│  Tracker diblokir             24│
│  Overlay ditangani              7│
├─────────────────────────────────┤
│  [ Bersihkan Halaman ]          │
│  [ Pilih Elemen ]               │
│  [ Lihat Aktivitas ]            │
├─────────────────────────────────┤
│  Situs ini: Diizinkan/Dibatasi  │
│  [ Tambahkan ke Whitelist ]     │
│  [ Pengaturan ]                 │
└─────────────────────────────────┘
```

Angka di atas hanya ilustrasi, bukan hasil pengukuran nyata.

Fitur UI: - Toggle perlindungan global. - Toggle per fitur. - Tombol
diagnosis/pembersihan halaman. - Mode pemilih elemen. - Status situs
saat ini. - Whitelist. - Statistik lokal. - Halaman pengaturan.

------------------------------------------------------------------------

## 10. Strategi Pengujian

  -----------------------------------------------------------------------
  Skenario                            Tujuan
  ----------------------------------- -----------------------------------
  Situs tanpa iklan                   Memastikan halaman tidak rusak

  Situs dengan iklan pihak ketiga     Menguji filter jaringan

  Halaman dengan overlay transparan   Menguji deteksi elemen pengganggu

  Dialog login atau cookie consent    Memastikan overlay sah tidak
                                      dihapus

  Pemutar video                       Memastikan kontrol tetap berfungsi

  Aplikasi SPA                        Menguji navigasi tanpa reload penuh

  DOM dinamis                         Menguji `MutationObserver`

  Situs dalam whitelist               Memastikan pengecualian bekerja

  Aturan filter tidak valid           Memastikan error ditangani

  Service worker dimulai ulang        Memastikan konfigurasi tetap
                                      konsisten
  -----------------------------------------------------------------------

Mulai dengan mode diagnosis sebelum mengaktifkan penghapusan otomatis.
Catat hasil pengujian dan lakukan regresi setelah perubahan aturan.

------------------------------------------------------------------------

## 11. Roadmap Pengembangan

### Tahap 1 --- Foundation

-   Membuat repository Git.
-   Menyiapkan struktur folder.
-   Membuat `manifest.json`.
-   Membuat popup dasar.
-   Memuat ekstensi melalui `chrome://extensions`.

**Kriteria selesai:** ekstensi berhasil dimuat dan popup tampil.

### Tahap 2 --- Basic Ad Blocker

-   Mengimplementasikan `declarativeNetRequest`.
-   Menambahkan aturan filter awal.
-   Menambahkan whitelist.
-   Menambahkan toggle aktif/nonaktif.
-   Menguji aturan dan pengecualian.

**Kriteria selesai:** aturan jaringan bekerja sesuai konfigurasi dan
tidak merusak situs uji.

### Tahap 3 --- Anti-Overlay

-   Membuat overlay detector.
-   Menyediakan mode diagnosis.
-   Membuat tombol pembersihan.
-   Mengimplementasikan element picker.
-   Menyediakan pemulihan jika memungkinkan.

**Kriteria selesai:** pengguna dapat mengidentifikasi dan menangani
overlay uji dengan kontrol yang jelas.

### Tahap 4 --- Popup dan Click Protection

-   Memantau event navigasi yang relevan.
-   Menguji sumber popup dan redirect.
-   Menambahkan diagnostik klik.
-   Membuat pengaturan per situs.

**Kriteria selesai:** gangguan yang tercakup oleh aturan uji dapat
ditangani dengan hasil yang dapat diperiksa.

### Tahap 5 --- Stabilization

-   Menguji beragam situs.
-   Memperbaiki konflik filter.
-   Mengoptimalkan CPU dan memori.
-   Menambahkan statistik.
-   Menyiapkan dokumentasi dan paket distribusi.

**Kriteria selesai:** fitur inti stabil pada kumpulan situs uji dan
keterbatasannya terdokumentasi.

------------------------------------------------------------------------

## 12. Keputusan Teknis yang Direkomendasikan

  -----------------------------------------------------------------------
  Area                                Keputusan MVP
  ----------------------------------- -----------------------------------
  Browser target                      Google Chrome terlebih dahulu

  Arsitektur                          Modular, event-driven

  Manifest                            Manifest V3

  Bahasa                              JavaScript

  UI                                  HTML + CSS + JavaScript

  Network filtering                   `declarativeNetRequest`

  DOM inspection                      Content scripts

  Dynamic DOM                         `MutationObserver`

  Storage                             `chrome.storage.local`

  Backend                             Tidak diperlukan untuk MVP

  Framework UI                        Belum diperlukan

  Overlay mode                        Diagnosis dahulu, lalu tindakan
                                      yang dikonfirmasi pengguna

  Filter                              Daftar publik yang ditinjau +
                                      aturan khusus

  Pengujian                           Chrome DevTools dan automated tests

  Version control                     Git
  -----------------------------------------------------------------------

### Keputusan produk yang perlu dikonfirmasi

1.  Apakah target awal hanya Chrome, atau juga browser Chromium lainnya?
2.  Apakah overlay mencurigakan harus selalu dikonfirmasi pengguna, atau
    boleh dihapus otomatis jika cocok dengan aturan yang sudah teruji?
3.  Apakah filter akan menggunakan daftar publik yang sudah tersedia dan
    ditambah aturan khusus?

Rekomendasi awal: **Chrome saja, diagnosis dengan opsi pembersihan,
serta daftar filter publik yang ditinjau ditambah aturan khusus**.

------------------------------------------------------------------------

## 13. Risiko dan Batasan

-   Tidak semua iklan dapat diblokir berdasarkan domain.
-   Iklan yang disajikan dari domain yang sama dengan konten utama
    mungkin membutuhkan pendekatan lain.
-   Elemen transparan tidak selalu berbahaya.
-   Menghapus elemen DOM dapat merusak fungsi halaman.
-   Popup dan redirect tidak selalu dapat dicegah sepenuhnya.
-   Permission Chrome membatasi akses ekstensi pada halaman dan konteks
    tertentu.
-   Filter yang terlalu agresif dapat menyebabkan situs tidak berfungsi.
-   Daftar filter perlu diperbarui dan diuji.
-   Statistik harus menjelaskan apa yang dihitung agar tidak memberi
    kesan perlindungan yang berlebihan.

Karena itu, produk perlu menyediakan whitelist, mode diagnosis,
pencatatan tindakan yang proporsional, serta cara menonaktifkan
perlindungan per situs.

------------------------------------------------------------------------

## 14. Referensi Resmi

-   Chrome Extensions: https://developer.chrome.com/docs/extensions/
-   Chrome Extensions API:
    https://developer.chrome.com/docs/extensions/reference/api
-   Manifest V3:
    https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3
-   Content Scripts:
    https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts
-   Declarative Net Request:
    https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest
-   Google Chrome: https://www.google.com/chrome/
-   Visual Studio Code: https://code.visualstudio.com/
-   Node.js: https://nodejs.org/
-   Git: https://git-scm.com/

------------------------------------------------------------------------

## 15. Kesimpulan

BrowseShield sebaiknya dimulai sebagai ekstensi lokal yang sederhana,
modular, dan aman. Fokus MVP adalah pemblokiran jaringan dasar,
diagnosis overlay, pembersihan yang dikendalikan pengguna, perlindungan
navigasi yang realistis, serta whitelist.

Kita tidak perlu membangun backend atau database pada tahap awal.
Setelah fungsi inti terbukti stabil, proyek dapat dikembangkan dengan
TypeScript, pengelolaan filter yang lebih matang, statistik, dan
distribusi melalui Chrome Web Store.

**Prinsip utama:** lindungi pengalaman browsing tanpa merusak fungsi
situs atau mengambil alih kendali pengguna.
