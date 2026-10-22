import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import Database from 'better-sqlite3';
import { buildIndex, analyze } from './analyzer.js';

const db = new Database(process.env.DB_FILE || 'data.db');
db.exec(`
CREATE TABLE IF NOT EXISTS claims(id INTEGER PRIMARY KEY, claim TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK(verdict IN ('hoaks','fakta')), explanation TEXT, source_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY, text TEXT NOT NULL, url TEXT,
  status TEXT NOT NULL DEFAULT 'baru', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS stats(period TEXT, category TEXT, total INTEGER, source TEXT);
`);

// Seed: statistik asli dari Komdigi; klaim di bawah hanyalah CONTOH DEMO.
if (!db.prepare('SELECT 1 FROM stats').get()) {
  const s = db.prepare('INSERT INTO stats VALUES (?,?,?,?)');
  const A = '2024 (Jan–Des)', B = '22 Okt 2024 – 20 Okt 2025';
  const srcA = 'Komdigi via Antara (2025)', srcB = 'Komdigi via JawaPos (2026)';
  [['Penipuan', 890, 589], ['Politik', 237, 166], ['Pemerintahan', 214, 341], ['Kesehatan', 163, 87], ['Kebencanaan', 145, 68]]
    .forEach(([c, a, b]) => { s.run(A, c, a, srcA); s.run(B, c, b, srcB); });
}
if (!db.prepare('SELECT 1 FROM claims').get()) {
  const c = db.prepare('INSERT INTO claims(claim,verdict,explanation) VALUES (?,?,?)');
  c.run('Pemerintah membagikan saldo dana gratis Rp500 ribu lewat tautan berikut', 'hoaks', '[DEMO] Modus penipuan umum. Ganti dengan hasil verifikasi nyata.');
  c.run('Minum air rebusan daun tertentu menyembuhkan semua jenis kanker dalam seminggu', 'hoaks', '[DEMO] Klaim kesehatan tanpa bukti ilmiah. Ganti dengan hasil verifikasi nyata.');
  c.run('Kode OTP bersifat rahasia dan tidak boleh dibagikan kepada siapa pun', 'fakta', '[DEMO] Prinsip keamanan akun. Ganti dengan hasil verifikasi nyata.');
}

let index = buildIndex(db.prepare('SELECT * FROM claims').all());
const clean = (s, n) => String(s ?? '').trim().slice(0, n);
const httpUrl = (s) => { try { const u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };

const app = express();
app.use(helmet({ contentSecurityPolicy: { useDefaults: true, directives: {
  styleSrc: ["'self'", 'https://fonts.googleapis.com'], fontSrc: ['https://fonts.gstatic.com'],
  upgradeInsecureRequests: null } } }));
app.use(express.json({ limit: '20kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 30 }));

app.post('/api/check', (req, res) => {
  const text = clean(req.body?.text, 5000);
  if (text.length < 10) return res.status(400).json({ error: 'Tempel pesan minimal 10 karakter.' });
  res.json(analyze(text, index));
});

app.post('/api/reports', (req, res) => {
  const text = clean(req.body?.text, 5000);
  if (text.length < 10) return res.status(400).json({ error: 'Isi laporan minimal 10 karakter.' });
  db.prepare('INSERT INTO reports(text,url) VALUES (?,?)').run(text, httpUrl(clean(req.body?.url, 500)));
  res.status(201).json({ ok: true });
});

app.get('/api/stats', (_req, res) => res.json(db.prepare('SELECT period,category,total,source FROM stats').all()));

const admin = (req, res, next) =>
  process.env.ADMIN_TOKEN && req.get('x-admin-token') === process.env.ADMIN_TOKEN
    ? next() : res.status(401).json({ error: 'Token admin salah atau belum diatur.' });

app.get('/api/admin/reports', admin, (_req, res) =>
  res.json(db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 200').all()));

app.patch('/api/admin/reports/:id', admin, (req, res) => {
  const status = req.body?.status;
  if (!['baru', 'diperiksa', 'selesai'].includes(status)) return res.status(400).json({ error: 'Status tidak valid.' });
  db.prepare('UPDATE reports SET status=? WHERE id=?').run(status, req.params.id);
  res.json({ ok: true });
});

app.post('/api/admin/claims', admin, (req, res) => {
  const claim = clean(req.body?.claim, 1000), verdict = req.body?.verdict;
  if (claim.length < 10 || !['hoaks', 'fakta'].includes(verdict)) return res.status(400).json({ error: 'claim (min 10 karakter) dan verdict (hoaks/fakta) wajib.' });
  db.prepare('INSERT INTO claims(claim,verdict,explanation,source_url) VALUES (?,?,?,?)')
    .run(claim, verdict, clean(req.body?.explanation, 1000), httpUrl(clean(req.body?.source_url, 500)));
  index = buildIndex(db.prepare('SELECT * FROM claims').all());
  res.status(201).json({ ok: true });
});

app.use(express.static('public'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`http://localhost:${port}`));
