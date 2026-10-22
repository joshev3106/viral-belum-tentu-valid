// Mesin analisis: pencocokan klaim (TF-IDF + cosine) dan sinyal risiko berbasis aturan.
const STOP = new Set('yang dan di ke dari ini itu untuk dengan pada adalah akan juga atau karena sudah telah tidak bahwa dalam oleh para saya kami kita ada agar jika ketika sebuah serta lebih dapat bisa'.split(' '));

const tokens = (t) => t.toLowerCase().replace(/https?:\/\/\S+/g, ' ')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
const grams = (t) => { const w = tokens(t); return [...w, ...w.slice(1).map((x, i) => w[i] + '_' + x)]; };

export function buildIndex(claims) {
  const docs = claims.map((c) => grams(c.claim));
  const df = new Map();
  docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
  const N = docs.length;
  const idf = (t) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
  const vec = (g) => {
    const v = new Map(); g.forEach((t) => v.set(t, (v.get(t) || 0) + 1));
    let n = 0; for (const [t, c] of v) { const w = c * idf(t); v.set(t, w); n += w * w; }
    return { v, n: Math.sqrt(n) || 1 };
  };
  const vs = docs.map(vec);
  return {
    search(text, k = 3) {
      const q = vec(grams(text));
      return vs.map((d, i) => {
        let dot = 0; for (const [t, w] of q.v) { const x = d.v.get(t); if (x) dot += w * x; }
        return { claim: claims[i], score: dot / (q.n * d.n) };
      }).filter((r) => r.score > 0.2).sort((a, b) => b.score - a.score).slice(0, k);
    },
  };
}

// Daftar rujukan awal: sesuaikan sendiri sesuai kebijakan tim.
const TRUSTED = ['go.id', 'kompas.com', 'tempo.co', 'antaranews.com', 'detik.com', 'cnnindonesia.com', 'bbc.com'];
const FACTCHECK = ['turnbackhoax.id', 'cekfakta.com'];
const SHORT = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'is.gd', 'shorturl.at', 'rebrand.ly'];
const hit = (h, list) => list.some((d) => h === d || h.endsWith('.' + d));

const RULES = [
  ['Mengajak menyebarkan pesan', /sebarkan|viralkan|bagikan ke|tolong share|forward|sebelum dihapus/i, 20],
  ['Bahasa sensasional', /heboh|gempar|terbongkar|terungkap|mukjizat|ampuh|rahasia|100\s?%|dijamin/i, 15],
  ['Pola penipuan (hadiah, OTP, tautan)', /transfer|hadiah|undian|kode otp|klik (link|tautan)|bantuan sosial|saldo gratis/i, 25],
  ['Mengutip "ahli" tanpa nama', /menurut (dokter|ahli|peneliti)|kata (dokter|ahli)|konon/i, 10],
];

export function analyze(text, index) {
  const signals = []; let risk = 0;
  const add = (label, w, tone = 'risk') => { signals.push({ label, tone }); risk += w; };

  for (const [label, re, w] of RULES) if (re.test(text)) add(label, w);
  const letters = text.replace(/[^A-Za-z]/g, '');
  if (letters.length > 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.4) add('Huruf kapital berlebihan', 10);
  if ((text.match(/!/g) || []).length >= 3) add('Tanda seru berlebihan', 10);

  const urls = text.match(/https?:\/\/[^\s)]+/g) || [];
  for (const u of urls) {
    let h; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch { continue; }
    if (hit(h, FACTCHECK)) add(`Tautan ke situs cek fakta: ${h}`, -15, 'good');
    else if (hit(h, TRUSTED)) add(`Tautan ke media/lembaga rujukan: ${h}`, -10, 'good');
    else if (hit(h, SHORT)) add(`Tautan dipendekkan (${h}), tujuan tidak terlihat`, 15);
    else add(`Domain belum dikenal: ${h}`, 8, 'info');
  }
  if (!urls.length && !/menurut|sumber|dikutip/i.test(text)) add('Tidak menyebut sumber', 10);

  const matches = index.search(text).map((m) => ({
    claim: m.claim.claim, verdict: m.claim.verdict, explanation: m.claim.explanation,
    source_url: m.claim.source_url, similarity: +m.score.toFixed(2),
  }));
  const top = matches[0];
  const verdict = top && top.similarity >= 0.45 ? top.verdict : 'belum_terverifikasi';
  risk = Math.max(0, Math.min(100, risk));
  return { verdict, risk, level: risk >= 50 ? 'tinggi' : risk >= 25 ? 'sedang' : 'rendah', signals, matches };
}
