const $ = (s) => document.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
async function api(url, body) {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Terjadi kesalahan.');
  return d;
}
const VERDICT = {
  hoaks: ['Cocok dengan hoaks yang sudah diperiksa', 'hoaks'],
  fakta: ['Sejalan dengan fakta terverifikasi', 'fakta'],
  belum_terverifikasi: ['Belum ada data pembanding', 'belum'],
};

function render(d, out) {
  const [label, cls] = VERDICT[d.verdict];
  const box = el('div', 'result');
  box.append(el('div', 'stamp ' + cls, label), el('p', null, `Tingkat risiko dari pola pesan: ${d.level} (${d.risk}/100)`));
  if (d.matches.length) {
    box.append(el('h3', null, 'Klaim serupa yang sudah diperiksa'));
    d.matches.forEach((m) => {
      const c = el('div', 'match');
      c.append(el('strong', null, `${m.verdict === 'hoaks' ? 'Hoaks' : 'Fakta'}, ${Math.round(m.similarity * 100)}% mirip`), el('p', null, m.claim), el('p', 'muted', m.explanation || ''));
      if (m.source_url) { const a = el('a', null, 'Lihat sumber'); a.href = m.source_url; a.target = '_blank'; a.rel = 'noopener noreferrer'; c.append(a); }
      box.append(c);
    });
  }
  if (d.signals.length) {
    box.append(el('h3', null, 'Tanda yang ditemukan'));
    const ul = el('ul', 'signals');
    d.signals.forEach((s) => ul.append(el('li', s.tone, s.label)));
    box.append(ul);
  }
  out.replaceChildren(box);
}

$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const out = $('#hasil');
  out.replaceChildren(el('p', 'muted', 'Memeriksa…'));
  try { render(await api('/api/check', { text: $('#t').value }), out); }
  catch (x) { out.replaceChildren(el('p', 'err', x.message)); }
});

$('#r').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('#rmsg');
  try {
    await api('/api/reports', { text: $('#rt').value, url: $('#ru').value });
    e.target.reset(); msg.className = 'muted'; msg.textContent = 'Laporan terkirim. Terima kasih.';
  } catch (x) { msg.className = 'err'; msg.textContent = x.message; }
});

(async () => {
  const rows = await api('/api/stats');
  const periods = [...new Set(rows.map((r) => r.period))], cats = [...new Set(rows.map((r) => r.category))];
  const max = Math.max(...rows.map((r) => r.total)), box = $('#stat');
  const legend = el('div', 'legend'); periods.forEach((p, i) => legend.append(el('span', 'k' + i, p))); box.append(legend);
  cats.forEach((c) => {
    const row = el('div', 'row'), bars = el('div');
    row.append(el('span', null, c));
    periods.forEach((p, i) => {
      const r = rows.find((x) => x.category === c && x.period === p); if (!r) return;
      const b = el('div', 'bar k' + i, r.total.toLocaleString('id-ID')); b.style.width = (r.total / max * 100) + '%'; bars.append(b);
    });
    row.append(bars); box.append(row);
  });
  box.append(el('p', 'muted', 'Sumber: ' + [...new Set(rows.map((r) => r.source))].join('; ') + '. Periode berbeda, jadi bandingkan dengan hati-hati.'));
})().catch(() => {});
