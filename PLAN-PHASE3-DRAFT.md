# Phase 3 draft — blogg + sparade jobb

> Status: **utkast, ej godkänt**. Skrivet av Sonnet på ägarens begäran, för att
> Opus ska granska och besluta i en separat session. Ingen kod skriven än.

## 1. Sparade jobb (favoriter) för postulantes

**Varför:** en jobbsökare som är inloggad borde kunna spara ett jobb för att
läsa/jämföra senare, separat från de jobb hen faktiskt har sökt
(`mis-postulaciones` finns redan, se `app/postulante/(dashboard)/mis-postulaciones`).

**Omfattning — litet till medelstort, en PR:**

- Ny tabell `saved_jobs` (`id`, `candidate_id`, `job_id`, `created_at`,
  unique constraint på `(candidate_id, job_id)`).
- "Guardar" / "Guardado"-knapp på jobbannons (`/trabajo/[slug]` eller
  motsvarande) — bara synlig för inloggad postulante, kräver ingen ny
  auth-modell, återanvänder befintlig candidate-session.
- Ny flik i `app/postulante/(dashboard)/`, t.ex. `mis-guardados`, bredvid
  befintlig `mis-postulaciones`. Samma UI-mönster, ny query.
- Ny funktion i `lib/db/candidate-applications.ts` eller en ny
  `lib/db/candidate-saved-jobs.ts` (samma mönster som befintliga filer,
  `candidateId`-scopat).
- Om jobbet raderas/arkiveras: `ON DELETE CASCADE` eller visa "Jobbet är inte
  längre tillgängligt" i listan — hanteras som `mis-postulaciones` redan gör
  om liknande fall finns där.

**Modell:** Sonnet. Ingen ny dataskyddsyta (raden pekar bara mellan två
befintliga tabeller ägda av samma kandidat), men touchar
candidate-scoped-data-mönstret så en snabb koll mot AGENTS.md-reglerna
(t.ex. "no bulk export") är motiverad innan merge.

**Öppna frågor:**
1. Notifiera om ett sparat jobb stängs/går ut? (Kräver e-post — vänta till
   e-post är på plats, per ägarens besked ovan.)
2. Gräns på antal sparade jobb per kandidat? (Förslag: ingen gräns, litet
   dataset.)

---

## 2. Blogg-sektion (SEO + nyheter + jobbanalyser)

**Varför:** long-tail SEO-trafik, "hur skriver man ett CV i Paraguay",
lönestatistik-artiklar, branschnyheter. Separat från jobbannonser, men länkar
in i dem (intern länkning för SEO).

**Två vägar, olika storlek:**

### Väg A — Markdown-baserad (rekommenderas för start)

- Nya `.mdx`/`.md`-filer i `content/blog/*.md`, ingen databas, inget admin-UI.
- `app/blog/page.tsx` (lista) + `app/blog/[slug]/page.tsx` (artikel),
  statiskt genererade (`generateStaticParams`), samma mönster som befintliga
  statiska sidor.
- SEO: egen `sitemap.ts`-entry, OG-bilder, strukturerad data (`Article`
  schema.org) — bör återanvända `opengraph-image.tsx`-mönstret som redan
  finns i `app/`.
- Skribent (ägaren) skriver Markdown lokalt, PR:ar in det, eller ni kopplar
  in ett enkelt Git-baserat CMS senare (t.ex. Decap CMS) utan egen databas.
- **Omfattning: litet.** En PR, ingen ny auth, ingen ny dataskyddsyta,
  inget att bryta.

### Väg B — Admin-CMS i databasen (som jobbannonser)

- Ny tabell `blog_posts` (titel, slug, body, författare, publicerad-datum,
  status draft/published, kategori).
- Admin-UI för att skriva/redigera i `/admin` (återanvänder mönster från
  jobb-CRUD, steg 4 i `PLAN.md`).
- Publika sidor som ovan men datadrivna.
- **Omfattning: medelstort.** Kräver CRUD, admin-formulär, bild-uppladdning
  för artikelbilder (kan återanvända CV-storage-driver-mönstret från PR 7
  för bilder), och en till post i `lib/data.ts` som enda entry point
  (AGENTS.md-regeln gäller även här).

**Rekommendation i detta utkast:** Väg A (Markdown) för att komma igång
snabbt och testa om blogg-trafik faktiskt ger utfall, uppgradera till Väg B
om volymen (fler än en skribent, behov av redigering utan Git) motiverar det.

**Modell:** Sonnet för båda vägarna — ren UI/CRUD/copy-yta, ingen
dataskydds- eller tenant-gränsyta enligt samma regel som `PLAN.md` §4 /
`PLAN-PHASE2.md` §6 tillämpar.

**Öppna frågor:**
1. Väg A eller B? Påverkar storlek och vem som kan skriva innehåll.
2. Vem skriver artiklarna — ägaren, en frilansare, AI-genererat med
   mänsklig redigering? Påverkar om Väg A:s Git-flöde är realistiskt.
3. Kategorier från start (nyheter / jobbanalyser / karriärtips) eller platt
   lista tills volymen kräver struktur?
4. Kommentarer/delning på artiklar? (Förslag: nej till en början — extra
   moderationsyta utan tydlig SEO-vinst.)

---

## 3. Föreslagen PR-uppdelning om båda godkänns

| PR | Innehåll | Modell |
|---|---|---|
| 15 | Sparade jobb (schema + UI + query) | Sonnet |
| 16 | Blogg Väg A: statiska sidor, sitemap, OG, schema.org | Sonnet |
| (ev. 17) | Blogg Väg B-uppgradering: DB + admin-CRUD, om Väg A inte räcker | Sonnet |

Ingen av dessa rör tenant-gränser, kandidatdata eller destruktiva flöden, så
ingen Opus-batch krävs enligt samma modell-tiering-regel som tidigare faser
(`PLAN.md` §4, `PLAN-PHASE2.md` §6) — men Opus bör ändå sätta scope och
godkänna öppna frågor innan Sonnet börjar bygga.
