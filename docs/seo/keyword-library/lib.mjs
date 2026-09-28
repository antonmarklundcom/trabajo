// Keyword Library — shared logic (used by server.mjs and by the browser page).
// No AI and no dependencies: everything here is plain text processing.
//
// 1. parseFile   reads a Google Keyword Planner export (UTF-16 or UTF-8, tabs or
//                commas, Swedish/English/Spanish headers) or our own 4-column CSV.
// 2. mergeFiles  one row per search: phrases that differ only in accents,
//                capitals, spacing or punctuation share a key; the wording with the
//                most searches wins (volumes are not summed — Keyword Planner
//                already groups close variants). Manual typo merges from the
//                project's config are applied on top.
// 3. findTypos   suggests pairs one letter apart ("trabjo" / "trabajo") for a
//                human to confirm. Never merged automatically: many near-pairs
//                are different searches ("luque" / "lugue" might be a typo,
//                "caja" / "cajas" is a plural).
// 4. groupBy / topTerms / summaryMd   the totals and the AI-ready summary.

export const DEFAULT_CONFIG = {
  exclude: 'new york\nestados unidos\nnew jersey\nlinkedin\nmilanuncios\ninem\neures\nespaña\nmexico\nchile\nargentina\ncolombia\nperu',
  themes: [
    'Trabaja con nosotros: trabaja con nosotros|trabajar en',
    'Remoto / online / casa: remot|online|en linea|desde (tu |la )?casa|teletrabajo|home office',
    'Lunes a viernes / horario: lunes a viernes|horario|nocturn|de noche|fin(es)? de semana',
    'Medio tiempo / estudiantes: medio tiempo|part.?time|estudiante|por horas',
    'Sin experiencia / primer empleo: sin experiencia|primer empleo|sin estudios',
    'Vacancia: vacancia',
    'Público / concurso: public|concurso|ministerio|municipal|gobierno',
    'Salario / sueldo: salario|sueldo|cuanto gana|jornal',
    'CV / entrevista: curriculum|\\bcv\\b|entrevista|carta de presentacion',
    'Derechos laborales: aguinaldo|liquidacion|despido|preaviso|vacaciones|horas extras|indemnizacion|aporte obrero|seguro social',
    'Publicar / contratar: publicar|busco personal|buscar personal|busco empleados|contratar|reclut|seleccion de personal',
  ].join('\n'),
  places: 'asuncion\nciudad del este\nencarnacion\nluque\nsan lorenzo\nlambare\ncapiata\nfernando de la mora\nlimpio\nmariano roque alonso\nnemby\nitaugua\nvilla elisa\ncaacupe\nconcepcion\npedro juan caballero\ncaaguazu\ncoronel oviedo\nvillarrica\nhernandarias\npresidente franco\npilar\nsalto del guaira',
  merges: {},        // typo key -> the key it was merged into
  notTypos: [],      // "keyA|keyB" pairs the user said are different searches
};

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------
export function decode(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xff && b[1] === 0xfe) return new TextDecoder('utf-16le').decode(b.subarray(2));
  if (b[0] === 0xfe && b[1] === 0xff) return new TextDecoder('utf-16be').decode(b.subarray(2));
  if (b.length > 4 && b[1] === 0 && b[3] === 0) return new TextDecoder('utf-16le').decode(b);
  return new TextDecoder('utf-8').decode(b).replace(/^﻿/, '');
}

function splitLine(line, delim) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

// '14 800' / '14,800' / '1.28 kr' / '1,28' / '10 – 100' -> first number, or null.
export function num(text) {
  text = (text || '').replace(/ /g, ' ').trim();
  if (!text || /^[—–-]+$/.test(text)) return null;
  const m = text.match(/\d[\d .,]*/);
  if (!m) return null;
  const raw = m[0].trim().replace(/ /g, '');
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g, ''));
  const v = Number(raw.replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

export function parseFile(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const delim = lines[i].includes('\t') ? '\t' : ',';
    const cells = splitLine(lines[i], delim).map((c) => c.toLowerCase());
    if (cells.length < 3 || !/keyword|sökord|palabra|phrase/.test(cells[0])) continue;
    const find = (re) => { const j = cells.findIndex((c) => re.test(c)); return j < 0 ? null : j; };
    const vol = find(/month|månad|mensual/);
    const low = find(/low|låg|bajo/);
    const high = find(/high|hög|alto/);
    const cur = find(/currency|valuta|moneda/);
    const rows = [];
    let currency = null;
    for (const line of lines.slice(i + 1)) {
      if (!line.trim()) continue;
      const r = splitLine(line, delim);
      if (!r[0]) continue;
      const at = (j) => (j === null ? '' : r[j] || '');
      if (!currency && cur !== null && at(cur)) currency = at(cur);
      rows.push([r[0], num(at(vol)) || 0, num(at(low)), num(at(high))]);
    }
    return { rows, currency };
  }
  return { rows: [], currency: null };
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------
export const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
export const keyOf = (s) => fold(s).replace(/[^a-z0-9]/g, '');

/** files: [{ rows }]; merges: { typoKey: targetKey }. */
export function mergeFiles(files, merges = {}) {
  const map = new Map();
  let rowsRead = 0, merged = 0;
  const target = (k) => { let t = k; for (let i = 0; i < 5 && merges[t]; i++) t = merges[t]; return t; };
  for (const f of files) {
    for (const [phrase, vol, low, high] of f.rows) {
      const own = keyOf(phrase);
      if (!own) continue;
      rowsRead++;
      const k = target(own);
      const cur = map.get(k);
      if (!cur) { map.set(k, { key: k, phrase, vol, low, high, variants: [] }); continue; }
      if (cur.phrase === phrase) continue;
      merged++;
      if (vol > cur.vol) { cur.variants.push(cur.phrase); Object.assign(cur, { phrase, vol, low, high }); }
      else if (!cur.variants.includes(phrase)) cur.variants.push(phrase);
    }
  }
  const rows = [...map.values()].sort((a, b) => b.vol - a.vol || a.phrase.localeCompare(b.phrase));
  return { rows, rowsRead, merged };
}

// ---------------------------------------------------------------------------
// Possible typos: keys exactly one edit apart (deletion neighbourhoods, so it
// stays fast on 50.000 phrases instead of comparing every pair).
// ---------------------------------------------------------------------------
function oneEdit(a, b) {
  if (a === b || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// A one-letter difference is only a typo candidate when it sits inside ONE
// word of at least 4 letters, in phrases with the same number of words, and is
// not a plural or a number. That rules out "trabajo cde" / "trabajo de"
// (CDE = Ciudad del Este), "empleo" / "empleos", "trabajo" / "trabajos en…",
// "2025" / "2026".
const words = (p) => fold(p).split(/[^a-z0-9]+/).filter(Boolean);
function typoLike(a, b) {
  const wa = words(a), wb = words(b);
  if (wa.length !== wb.length) return false;
  const diff = wa.map((w, i) => [w, wb[i]]).filter(([x, y]) => x !== y);
  if (diff.length !== 1) return false;
  const [x, y] = diff[0];
  if (x.length < 4 || y.length < 4 || /\d/.test(x + y)) return false;
  const plural = (s, t) => t === s + 's' || t === s + 'es';
  if (plural(x, y) || plural(y, x)) return false;
  return oneEdit(x, y);
}

export function findTypos(rows, config = DEFAULT_CONFIG, limit = 300) {
  const not = new Set(config.notTypos || []);
  const buckets = new Map();
  rows.forEach((r, idx) => {
    if (r.key.length < 6) return;
    const seen = new Set([r.key]);
    for (let i = 0; i < r.key.length; i++) seen.add(r.key.slice(0, i) + r.key.slice(i + 1));
    for (const d of seen) { const b = buckets.get(d) || []; if (b.length < 40) b.push(idx); buckets.set(d, b); }
  });
  const pairs = new Map();
  for (const b of buckets.values()) {
    for (let x = 0; x < b.length; x++) for (let y = x + 1; y < b.length; y++) {
      const A = rows[b[x]], B = rows[b[y]];
      const [hi, lo] = A.vol >= B.vol ? [A, B] : [B, A];
      const id = [hi.key, lo.key].sort().join('|');
      if (pairs.has(id) || not.has(id) || !oneEdit(hi.key, lo.key) || !typoLike(hi.phrase, lo.phrase)) continue;
      pairs.set(id, { id, keep: hi.phrase, keepKey: hi.key, keepVol: hi.vol, typo: lo.phrase, typoKey: lo.key, typoVol: lo.vol });
    }
  }
  return [...pairs.values()].sort((a, b) => b.keepVol + b.typoVol - (a.keepVol + a.typoVol)).slice(0, limit);
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------
const lines = (text) => (text || '').split('\n').map((s) => s.trim()).filter(Boolean);

export function excluder(config) {
  const ex = lines(config.exclude).map(fold);
  return (r) => ex.some((e) => fold(r.phrase).includes(e));
}

export function themeGroups(config) {
  return lines(config.themes).map((l) => l.match(/^([^:]+):\s*(.+)$/)).filter(Boolean)
    .map((m) => { try { const re = new RegExp(m[2].trim(), 'i'); return { name: m[1].trim(), test: (p) => re.test(p) }; } catch { return null; } })
    .filter(Boolean);
}
export function placeGroups(config) { return lines(config.places).map(fold).map((c) => ({ name: c, test: (p) => p.includes(c) })); }

export function groupBy(rows, groups) {
  return groups.map((g) => {
    const hit = rows.filter((r) => g.test(fold(r.phrase))).sort((a, b) => b.vol - a.vol);
    return { name: g.name, count: hit.length, total: hit.reduce((s, r) => s + r.vol, 0), top: hit.slice(0, 5) };
  }).sort((a, b) => b.total - a.total);
}

export function topTerms(rows, n = 60) {
  const stop = new Set('de en la el los las y a para con por del un una al se que mi o me es lo sin su'.split(' '));
  const words = new Map(), pairs = new Map();
  for (const r of rows) {
    const w = fold(r.phrase).split(/[^a-z0-9]+/).filter((x) => x && !stop.has(x));
    for (const x of new Set(w)) words.set(x, (words.get(x) || 0) + r.vol);
    for (let i = 0; i + 1 < w.length; i++) { const p = w[i] + ' ' + w[i + 1]; pairs.set(p, (pairs.get(p) || 0) + r.vol); }
  }
  const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
  return { words: top(words), pairs: top(pairs) };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
const money = (n) => (n ?? 0).toFixed(2);
function csvCell(v) { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }
export const toCsv = (rows) => rows.map((l) => l.map(csvCell).join(',')).join('\n') + '\n';

export function keywordsCsv(rows) {
  return toCsv([['phrase', 'monthly_searches', 'low_cpc', 'high_cpc'], ...rows.map((r) => [r.phrase, r.vol, money(r.low), money(r.high)])]);
}

/** The file an AI reads first (~5k tokens), pointing at the full CSV to filter. */
export function summaryMd({ project, rows, rowsRead, merged, currency, files, config, folder }) {
  const isExcluded = excluder(config);
  const kept = rows.filter((r) => !isExcluded(r));
  const total = kept.reduce((s, r) => s + r.vol, 0);
  const themes = groupBy(kept, themeGroups(config));
  const places = groupBy(kept, placeGroups(config)).filter((g) => g.count);
  const { words, pairs } = topTerms(kept, 30);
  const cell = (v) => String(v).replace(/\|/g, '/');
  const t = (head, body) => [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...body.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
  const topList = (g) => g.top.map((r) => `${r.phrase} (${r.vol})`).join('; ');
  return `# Keyword research — ${project.name}

- Country / location of the data: **${project.country || 'not set'}** · language: ${project.language || 'not set'}
- Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by Keyword Library. Source: Google Keyword Planner exports in \`raw/\`.
${project.notes ? `- Notes: ${project.notes}\n` : ''}
## How to use this (for AI assistants)

- This file is the summary. The full data is \`keywords.csv\` in this folder: ${rows.length} unique phrases, columns \`phrase, monthly_searches, low_cpc, high_cpc\`, sorted by monthly searches. CPC currency: ${currency || 'as exported'}.
- Do **not** read \`keywords.csv\` in full. Filter it (grep or a short script) for the topic you need.
- Variants that differ only in accents, capitals or spacing are merged into one row, plus typos a person confirmed. Totals add every matching phrase, long tail included. Rows containing the exclusion list are left out of this summary but stay in \`keywords.csv\`.
- Folder: \`${folder}\`

## Totals

- Files: ${files.map((f) => `${f.name} (${f.rows} rows)`).join(', ') || 'none'}
- Rows read: ${rowsRead} · unique phrases: ${rows.length} (${merged} variants merged) · summed monthly searches: ${total}
- Excluded from this summary: ${lines(config.exclude).join(', ') || 'nothing'}

## Themes

${t(['Theme', 'Phrases', 'Searches/mo', 'Top phrases'], themes.map((g) => [g.name, g.count, g.total, topList(g)]))}

## Places

${places.length ? t(['Place', 'Phrases', 'Searches/mo', 'Top phrases'], places.map((g) => [g.name, g.count, g.total, topList(g)])) : '_No place matches._'}

## Top words and word pairs (weighted by searches)

${t(['Word', 'Searches'], words)}

${t(['Word pair', 'Searches'], pairs)}

## Top 200 phrases

${t(['Phrase', 'Searches/mo', 'Low CPC', 'High CPC'], kept.slice(0, 200).map((r) => [r.phrase, r.vol, money(r.low), money(r.high)]))}
`;
}
