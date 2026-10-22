# Viral belum tentu valid

Website pengecek hoaks: Node.js + Express + SQLite, frontend HTML/CSS/JS tanpa build.

## Menjalankan
```bash
npm install
ADMIN_TOKEN=token-rahasia-anda npm start   # buka http://localhost:3000
```

## Endpoint
| Method | Path | Keterangan |
|---|---|---|
| POST | /api/check | `{text}` → vonis, skor risiko, klaim serupa, sinyal |
| POST | /api/reports | `{text, url?}` kirim laporan hoaks |
| GET | /api/stats | statistik Komdigi untuk grafik |
| GET/PATCH | /api/admin/reports | daftar / ubah status laporan (header `x-admin-token`) |
| POST | /api/admin/claims | `{claim, verdict, explanation, source_url}` tambah klaim terverifikasi |

Contoh tambah klaim:
```bash
curl -X POST localhost:3000/api/admin/claims -H "x-admin-token: token-rahasia-anda" \
  -H "Content-Type: application/json" \
  -d '{"claim":"isi klaim yang sudah diperiksa","verdict":"hoaks","explanation":"alasan","source_url":"https://turnbackhoax.id/..."}'
```

## Catatan penting
- Tiga klaim awal bertanda **[DEMO]**. Ganti dengan hasil verifikasi nyata (misalnya dari turnbackhoax.id) sebelum dipakai publik.
- Daftar domain rujukan ada di `analyzer.js` (TRUSTED, FACTCHECK, SHORT). Sesuaikan dengan kebijakan tim.
- Server tidak mengunduh isi tautan (menghindari risiko SSRF); hanya domain yang dianalisis.
- Statistik bersumber dari Komdigi (via Antara dan JawaPos). Periodenya berbeda, jadi cantumkan periode di infografis.
