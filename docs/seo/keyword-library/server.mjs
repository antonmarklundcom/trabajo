// Keyword Library — local server. Run with "Start Keyword Library.cmd" (Windows)
// or `node server.mjs`. Node.js 18+; no npm install, no dependencies.
//
// Serves the page on http://localhost:5178 (this computer only) and keeps all
// data next to this file:
//
//   projects/<project>/project.json   name, country, language, notes
//   projects/<project>/config.json    themes, places, exclusions, confirmed typo merges
//   projects/<project>/raw/*.csv      the Keyword Planner exports, exactly as downloaded
//   projects/<project>/keywords.csv   merged data (phrase, monthly_searches, low_cpc, high_cpc)
//   projects/<project>/summary.md     the short AI-ready summary
//   INDEX.md                          every project with its full paths
//
// No AI and no network calls: see lib.mjs for what the merge actually does.
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_CONFIG, decode, findTypos, keywordsCsv, mergeFiles, parseFile, summaryMd, fold,
} from './lib.mjs';

const PORT = Number(process.env.KL_PORT) || 5178;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(ROOT, 'projects');
const MAX_UPLOAD = 60 * 1024 * 1024;

const slugify = (s) => fold(String(s)).trim().replace(/\s+/g, '-').replace(/[^a-z0-9.\-_]/g, '').replace(/^[.\-_]+/, '').slice(0, 80);
const exists = (p) => fs.access(p).then(() => true, () => false);
const readJson = async (p, fallback) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return fallback; } };
const writeJson = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2));
const dirOf = (slug) => path.join(DATA, slug);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
const cache = new Map(); // slug -> built project

async function listSlugs() {
  await fs.mkdir(DATA, { recursive: true });
  const entries = await fs.readdir(DATA, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name).sort();
}

async function loadProject(slug) {
  if (cache.has(slug)) return cache.get(slug);
  const dir = dirOf(slug);
  if (!(await exists(path.join(dir, 'project.json')))) return null;
  const project = await readJson(path.join(dir, 'project.json'), { name: slug });
  const config = { ...DEFAULT_CONFIG, ...(await readJson(path.join(dir, 'config.json'), {})) };
  const rawDir = path.join(dir, 'raw');
  await fs.mkdir(rawDir, { recursive: true });
  const files = [];
  let currency = null;
  for (const name of (await fs.readdir(rawDir)).sort()) {
    if (!/\.(csv|tsv|txt)$/i.test(name)) continue;
    const parsed = parseFile(decode(await fs.readFile(path.join(rawDir, name))));
    files.push({ name, rows: parsed.rows });
    currency = currency || parsed.currency;
  }
  const { rows, rowsRead, merged } = mergeFiles(files, config.merges);
  const built = {
    slug, project: { ...project, slug }, config, rows, rowsRead, merged, currency,
    files: files.map((f) => ({ name: f.name, rows: f.rows.length })),
  };
  cache.set(slug, built);
  return built;
}

async function saveOutputs(slug) {
  cache.delete(slug);
  const p = await loadProject(slug);
  const dir = dirOf(slug);
  await fs.writeFile(path.join(dir, 'keywords.csv'), keywordsCsv(p.rows));
  await fs.writeFile(path.join(dir, 'summary.md'), summaryMd({ ...p, folder: dir }));
  await writeIndex();
  return p;
}

async function writeIndex() {
  const out = ['# Keyword Library — all projects', '',
    `Updated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. For AI assistants: read a project's \`summary.md\` first; filter its \`keywords.csv\`, never read it whole.`, '',
    '| Project | Country | Phrases | Files | Summary | Data |', '| --- | --- | --- | --- | --- | --- |'];
  for (const slug of await listSlugs()) {
    const p = await loadProject(slug);
    if (!p) continue;
    const dir = dirOf(slug);
    out.push(`| ${p.project.name} | ${p.project.country || '—'} | ${p.rows.length} | ${p.files.length} | \`${path.join(dir, 'summary.md')}\` | \`${path.join(dir, 'keywords.csv')}\` |`);
  }
  await fs.writeFile(path.join(ROOT, 'INDEX.md'), out.join('\n') + '\n');
}

const summaryOf = (p) => ({
  ...p.project, files: p.files.length, phrases: p.rows.length, rowsRead: p.rowsRead,
  merged: p.merged, totalSearches: p.rows.reduce((s, r) => s + r.vol, 0), folder: dirOf(p.slug),
});

function aiText(p) {
  const dir = dirOf(p.slug);
  return `Keyword research: ${p.project.name} (data location: ${p.project.country || 'not set'}).
Read first: ${path.join(dir, 'summary.md')}
Full data (filter it, don't read it all): ${path.join(dir, 'keywords.csv')} — ${p.rows.length} phrases, columns phrase, monthly_searches, low_cpc, high_cpc.
All projects: ${path.join(ROOT, 'INDEX.md')}`;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------
function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}
async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > MAX_UPLOAD) throw new Error('File too large'); chunks.push(c); }
  return Buffer.concat(chunks);
}
const jsonBody = async (req) => JSON.parse((await readBody(req)).toString('utf8') || '{}');

function openInOS(target) {
  const cmd = process.platform === 'win32' ? `explorer "${target}"` : process.platform === 'darwin' ? `open "${target}"` : `xdg-open "${target}"`;
  exec(cmd, () => {});
}

async function route(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  // Static files.
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
    return send(res, 200, await fs.readFile(path.join(ROOT, 'index.html')), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && url.pathname === '/lib.mjs') {
    return send(res, 200, await fs.readFile(path.join(ROOT, 'lib.mjs')), 'text/javascript; charset=utf-8');
  }
  if (parts[0] !== 'api') return send(res, 404, { error: 'Not found' });

  // Writes must come from our own page (a custom header other sites cannot send).
  if (req.method !== 'GET' && req.headers['x-keyword-library'] !== '1') return send(res, 403, { error: 'Forbidden' });

  if (parts[1] === 'projects' && parts.length === 2) {
    if (req.method === 'GET') {
      const list = [];
      for (const slug of await listSlugs()) { const p = await loadProject(slug); if (p) list.push(summaryOf(p)); }
      return send(res, 200, { projects: list, root: ROOT, index: path.join(ROOT, 'INDEX.md') });
    }
    if (req.method === 'POST') {
      const body = await jsonBody(req);
      const slug = slugify(body.name);
      if (!slug) return send(res, 400, { error: 'Give the project a name.' });
      if (await exists(path.join(dirOf(slug), 'project.json'))) return send(res, 409, { error: 'A project with that name already exists.' });
      await fs.mkdir(path.join(dirOf(slug), 'raw'), { recursive: true });
      await writeJson(path.join(dirOf(slug), 'project.json'), {
        name: String(body.name).trim(), country: body.country || '', language: body.language || '', notes: body.notes || '', created: new Date().toISOString(),
      });
      await writeJson(path.join(dirOf(slug), 'config.json'), DEFAULT_CONFIG);
      await saveOutputs(slug);
      return send(res, 201, { slug });
    }
  }

  if (parts[1] === 'projects' && parts[2]) {
    const slug = slugify(parts[2]);
    const p = await loadProject(slug);
    if (!p) return send(res, 404, { error: 'No such project.' });
    const dir = dirOf(slug);
    const what = parts[3] || '';

    if (req.method === 'GET' && what === '') {
      return send(res, 200, { project: summaryOf(p), config: p.config, files: p.files, currency: p.currency, ai: aiText(p) });
    }
    if (req.method === 'GET' && what === 'rows') return send(res, 200, { rows: p.rows });
    if (req.method === 'GET' && what === 'typos') return send(res, 200, { pairs: findTypos(p.rows, p.config) });

    if (req.method === 'PUT' && what === 'settings') {
      const body = await jsonBody(req);
      const project = await readJson(path.join(dir, 'project.json'), {});
      for (const k of ['country', 'language', 'notes']) if (k in body) project[k] = String(body[k]);
      await writeJson(path.join(dir, 'project.json'), project);
      const config = { ...p.config };
      for (const k of ['exclude', 'themes', 'places']) if (k in body) config[k] = String(body[k]);
      await writeJson(path.join(dir, 'config.json'), config);
      await saveOutputs(slug);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && what === 'files') {
      const name = path.basename(url.searchParams.get('name') || 'export.csv').replace(/[^\w.\- ()]/g, '_');
      const bytes = await readBody(req);
      if (!parseFile(decode(bytes)).rows.length) return send(res, 400, { error: `${name}: no Keyword Planner header found.` });
      const base = name.replace(/\.[^.]*$/, ''), ext = path.extname(name) || '.csv';
      let target = name;
      for (let i = 2; await exists(path.join(dir, 'raw', target)); i++) target = `${base}-${i}${ext}`;
      await fs.writeFile(path.join(dir, 'raw', target), bytes);
      await saveOutputs(slug);
      return send(res, 201, { saved: target });
    }
    if (req.method === 'DELETE' && what === 'files') {
      const name = path.basename(url.searchParams.get('name') || '');
      await fs.rm(path.join(dir, 'raw', name), { force: true });
      await saveOutputs(slug);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && what === 'typos') {
      const body = await jsonBody(req);
      const config = { ...p.config, merges: { ...p.config.merges }, notTypos: [...(p.config.notTypos || [])] };
      if (body.action === 'merge' && body.typoKey && body.keepKey) config.merges[body.typoKey] = body.keepKey;
      else if (body.action === 'ignore' && body.id) config.notTypos.push(body.id);
      else if (body.action === 'undo' && body.typoKey) delete config.merges[body.typoKey];
      else return send(res, 400, { error: 'Unknown action.' });
      await writeJson(path.join(dir, 'config.json'), config);
      await saveOutputs(slug);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && what === 'open') { openInOS(dir); return send(res, 200, { ok: true }); }
  }

  // Search every project at once.
  if (req.method === 'GET' && parts[1] === 'search') {
    const q = fold(url.searchParams.get('q') || '').trim();
    const min = Number(url.searchParams.get('min')) || 0;
    if (!q) return send(res, 200, { results: [] });
    let re = null;
    const m = q.match(/^\/(.+)\/$/);
    try { re = m ? new RegExp(m[1], 'i') : null; } catch { return send(res, 200, { results: [] }); }
    const results = [];
    for (const slug of await listSlugs()) {
      const p = await loadProject(slug);
      if (!p) continue;
      for (const r of p.rows) {
        if (r.vol < min) continue;
        const f = fold(r.phrase);
        if (re ? re.test(f) : f.includes(q)) results.push({ ...r, project: p.project.name, slug, country: p.project.country });
      }
    }
    results.sort((a, b) => b.vol - a.vol);
    return send(res, 200, { results: results.slice(0, 1000), total: results.length });
  }

  if (req.method === 'POST' && parts[1] === 'open-root') { openInOS(ROOT); return send(res, 200, { ok: true }); }
  return send(res, 404, { error: 'Not found' });
}

const server = createServer(async (req, res) => {
  // Only this computer, by its own name — blocks other sites from reaching the API through DNS tricks.
  const host = (req.headers.host || '').split(':')[0];
  if (!['localhost', '127.0.0.1'].includes(host)) return send(res, 403, { error: 'Forbidden' });
  try { await route(req, res, new URL(req.url, `http://localhost:${PORT}`)); }
  catch (err) { console.error(err); send(res, 500, { error: String(err.message || err) }); }
});

const url = `http://localhost:${PORT}`;
const openBrowser = () => { if (!process.env.KL_NO_BROWSER) openInOS(url); };
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') { console.log(`Keyword Library is already running — opening ${url}`); openBrowser(); setTimeout(() => process.exit(0), 500); }
  else { console.error(err); process.exit(1); }
});
server.listen(PORT, '127.0.0.1', async () => {
  await fs.mkdir(DATA, { recursive: true });
  console.log(`Keyword Library running at ${url}`);
  console.log(`Data folder: ${DATA}`);
  console.log('Close this window to stop it.');
  openBrowser();
});
