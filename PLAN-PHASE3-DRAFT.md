# Phase 3 — blogg + sparade jobb

> Status: **beslutad**. Skrivet av Sonnet som utkast, granskat och avgjort av
> Opus 2026-08-10. §1 (sparade jobb) är byggt och mergat som PR 15 (`1e49e5d`,
> PR #37); efterkontrollen och rättningarna ligger i PR 15b (§6). §2 (bloggen)
> är beslutad men obyggd —
> bygg-briefen ligger i §7.
>
> §2:s öppna frågor besvaras i §5, §1:s i §6. De ursprungliga
> formuleringarna står kvar oredigerade, så att beslutet går att läsa mot det
> som faktiskt frågades.

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

| PR | Innehåll | Modell | Status |
|---|---|---|---|
| 15 | Sparade jobb (schema + UI + query) | Sonnet | **Mergat** (`1e49e5d`, PR #37) |
| 15b | Efterkontroll batch J: no-FK-beslutet + `cascade:verify` | Opus | Byggd, väntar på merge (se §6) |
| 16 | Blogg Väg A: `lib/blog.ts`, `/blog`, `/blog/[slug]`, sitemap, OG, JSON-LD | Sonnet | Brief i §7 |
| 17 | Blogg: de tre första artiklarna som innehåll (bara `content/blog/*.md`) | Sonnet | Efter 16 |
| (ev. 18) | Blogg Väg B-uppgradering: DB + admin-CRUD, om Väg A inte räcker | Sonnet | Villkorad, se §5 |

Ingen av dessa rör tenant-gränser, kandidatdata eller destruktiva flöden, så
ingen Opus-batch krävs enligt samma modell-tiering-regel som tidigare faser
(`PLAN.md` §4, `PLAN-PHASE2.md` §6) — men Opus bör ändå sätta scope och
godkänna öppna frågor innan Sonnet börjar bygga.

## 4. Opus medium-effort dubbelkoll efter batch J + K

Ingen av dessa PR:ar kräver en Opus-*författad* batch, men efter att Sonnet
har byggt och mergat 15 (batch J) och 16/17 (batch K) är följande värt en
Opus-granskning på medium effort — inte en fullständig audit, men punkter där
Sonnet historiskt kan slira eller där en liten miss växer till ett större
problem:

**Efter batch J (sparade jobb):**
1. **Scoping-läckage** — verifiera att `saved_jobs`-queryn faktiskt filtrerar
   på `candidate_id` från sessionen, inte ett värde som kan skickas från
   klienten (samma klass av bugg som scoping-verktyget i `PLAN-PHASE2.md` PR 3
   skyddar mot för `employer.ts`).
2. **Cascade-beteende** — om ett jobb raderas/arkiveras, blir raden i
   `saved_jobs` en hängande referens eller CASCADE:as den bort korrekt? Kolla
   att UI:t inte kraschar på ett borttaget jobb.
3. **`lib/data.ts`-regeln** — kontrollera att den nya frågevägen fortfarande
   går via `lib/data.ts` och inte direkt mot `lib/db/*` från en
   sida/komponent (AGENTS.md-regeln, lätt att missa i en ny flik).
4. **Ingen ny räckvidd för "bulk"** — säkerställ att "sparade jobb"-listan
   inte av misstag exponerar en export- eller admin-vy över alla kandidaters
   sparade jobb (skulle bryta "no bulk export"-regeln).

**Efter batch K (blogg):**
5. **`noindex`/sitemap-hygien** — att blogglistan/artiklarna faktiskt kommer
   med i `sitemap.ts` och att inget av det oavsiktligt ärver `noindex` från
   `/admin`- eller `/empresa`-trädets layout-inställningar (lätt copy-paste-fel
   om layouten återanvänds).
6. **Slug-kollisioner** — kontrollera att blogg-slugs inte kan krocka med
   befintliga route-segment (`/empleos`, `/planes`, jobbslugs etc.) eller med
   varandra; AGENTS.md-regeln om att slugs är "live SEO URLs" gäller här också
   så fort en artikel publicerats och indexerats.
7. **XSS i Markdown/rich text** — om Väg B (databasdrivet, rich text) valdes:
   verifiera att artikel-body saneras vid rendering (dangerouslySetInnerHTML
   eller motsvarande) så en skribent inte kan injicera script — särskilt
   relevant om fler än ägaren kan skriva innehåll.
8. **Bilduppladdning återanvänder verkligen CV-drivrutinen säkert** — om Väg B
   återanvänder storage-drivern från PR 7, dubbelkolla att magic-byte-
   valideringen är meningsfull för bilder (inte bara kopierad rakt av för
   PDF/CV-fallet) och att artikelbilder hamnar i ett separat, publikt
   tillgängligt utrymme — till skillnad från CV:n som medvetet aldrig får en
   publik URL.
9. **Modell-tiering-regeln höll** — en sista koll att inget av det byggda
   faktiskt korsade in i kandidat-/arbetsgivardata (t.ex. en "populära bland
   sökande"-widget på bloggen som i onödan läcker ansökningsstatistik) — om
   något sådant smugit sig in bör det has flaggats som Opus-yta i efterhand.

---

## 5. Beslut om bloggen (Opus, 2026-08-10)

### 5.1 Väg A. Inte Väg B, och inte "A nu, B snart".

**Väg A — statisk Markdown i repot.** Ingen tabell, inget admin-UI, ingen
bilduppladdning, ingen ny auth-yta.

Utkastets invändning mot Väg A var att Git-PR-flödet kanske inte är realistiskt
för den som skriver. Den invändningen faller på hur det här repot faktiskt
redigeras: allt innehåll som finns i det — jobbtexter i `lib/seed/*.json`,
`/privacidad`, `/terminos`, hela admin-panelens spanska copy — har skrivits och
mergats genom en Claude Code-session. Att lägga en `.md`-fil i `content/blog/`
och pusha är inte ett nytt arbetssätt som måste införas, det är det arbetssätt
som redan används. Väg B skulle bygga ett CMS för en skribent som inte finns.

Väg B blir aktuell **först** när ett av dessa är sant, inte tidigare:

1. Någon som inte är ägaren, och inte arbetar genom en Claude-session, ska
   kunna publicera utan att be någon annan.
2. Publiceringstakten går över ungefär två artiklar i veckan, där en deploy per
   artikel börjar kosta mer än den är värd.
3. Artiklar behöver redigeras oftare än de skrivs (rättelser, prisuppdateringar
   i lönestatistik), så att "en commit per ändring" blir ett hinder.

Inget av det är sant idag. PR 18 finns i tabellen i §3 som en villkorad post,
inte som ett planerat steg. Migreringen A→B är billig och blir inte dyrare av
att vänta: slugsen är desamma, sidorna är desamma, bara läskällan byts — vilket
är exakt varför `lib/blog.ts` i §7 är obligatorisk som enda läsväg.

### 5.2 Vem skriver: AI-utkast + ägarens redigering, commitat som Markdown.

Utkastets fråga 2 hade tre alternativ. Beslut: **AI-utkast som ägaren redigerar
och godkänner**, inte frilansare. En frilansare skulle antingen behöva Väg B
eller en Git-utbildning, och ingen av de kostnaderna är motiverad innan bloggen
har visat att den ger trafik alls.

Två regler som följer av att innehållet är AI-utkastat och inte
research-granskat av en redaktion:

- **Ingen siffra utan källa.** Lönestatistik, arbetslöshetstal, "X % av
  paraguayanska arbetsgivare…" — antingen med länk till källan (DGEEC/INE,
  MTESS, IPS) i texten, eller så stryks påståendet. En lönesiffra utan källa är
  det som gör att den här sortens sajt tappar förtroende, och den är
  dessutom det som folk delar vidare.
- **Ingen juridisk rådgivning i första person.** "Enligt Código del Trabajo
  art. X gäller Y" med hänvisning, aldrig "du har rätt att kräva Z". Portalen
  är inte en advokatbyrå och ska inte läsas som en.

Detta är innehållsregler, inte kodregler, och hör hemma i `content/blog/README.md`
(se §7).

### 5.3 Kategorier: fältet från dag ett, egna URL:er senare.

Utkastets fråga 3 ställde platt lista mot kategorier. Beslut: **båda, i rätt
ordning.**

- Varje artikel har ett obligatoriskt `category`-fält i frontmatter, validerat
  mot en sluten lista på tre värden: `noticias`, `analisis-laboral`,
  `consejos-cv`. Fel värde = build-fel, inte en tyst femte kategori.
- `/blog` renderar en platt, kronologisk lista. Kategorin visas som en etikett
  på varje kort och i artikelhuvudet.
- **Inga `/blog/categoria/[slug]`-routes byggs nu.** De läggs till när det
  finns minst fem publicerade artiklar fördelade på minst två kategorier —
  tidigare är det tunna sidor som Google behandlar som just tunna sidor.

Ordningen är hela poängen: att lägga till kategorisidor senare *lägger till*
URL:er, medan att retrofitta ett kategorifält på publicerade artiklar innebär
att man antingen gissar i efterhand eller ändrar befintliga URL:er. Fältet är
gratis nu, kategoriseringen i efterhand är det inte.

### 5.4 Kommentarer: nej. Delning: ja, men bara som länkar.

Utkastets fråga 4 föreslog nej till båda. Kommentarer: **nej**, av exakt det
skäl utkastet angav — en modereringsyta på spanska, utan SEO-vinst, på en sajt
vars enda befintliga användargenererade innehåll (jobbansökningar) är strikt
åtkomstkontrollerat.

Delning avviker från utkastet: **ja, men implementerat som vanliga `<a href>`**
mot `wa.me` och Facebooks sharer, plus en "kopiera länk"-knapp. Skälet är
paraguayanskt snarare än tekniskt: innehåll sprids här via WhatsApp, och en
artikel om hur man skriver ett CV är precis den sorts sak som vidarebefordras i
en familjegrupp. Kostnaden är noll — inga SDK:er, inga tredjepartsskript, inget
som laddar eller mäter något när sidan öppnas. Det som utkastet ville undvika
(en modereringsyta, en spårningsyta) uppstår inte av en länk.

**Uttryckligen förbjudet på bloggen**, för att §4 punkt 9 ska ha ett svar i
förväg: ingen "populärt bland sökande"-widget, ingen "X personer har sökt det
här jobbet", ingen ansökningsstatistik, ingen kandidatdata över huvud taget.
Bloggen läser jobbkatalogen genom `lib/data.ts` och ingenting annat. En
blogg-PR som importerar från `lib/db/candidate-*` eller `lib/db/employer` är
fel oavsett hur den ser ut.

---

## 6. Efterkontroll batch J — resultat (Opus, medium effort)

Granskningen som §4 efterlyste, körd efter att PR 15 mergats. Punkterna nedan
följer §4:s numrering.

### 6.1 Schemafrågan: `saved_jobs` behåller no-FK-konventionen. Beslutat.

§1 i det här dokumentet bad om FK:er med `ON DELETE CASCADE`. `lib/db/schema.ts`
förbjuder FK-constraints i hela repot. **Schemakonventionen vinner.** Det här
är ett avgjort beslut, inte en avvägning som ska tas upp igen:

- En constrained tabell i ett i övrigt oconstrained schema ger ingen garanti.
  ARCO-raderingen lämnar medvetet `consents` och `deletion_requests` pekande på
  id:n som inte längre går att slå upp (`candidate-arco.ts` steg 6). Ett schema
  där läsaren måste komma ihåg vilken enda tabell som är skyddad är sämre än ett
  där ingen är det.
- En cascade på `candidate_id` skulle dessutom flytta en del av §4.4:s radering
  in i schemat. `deletion_requests.outcome` är beviset för vad en cancelación
  faktiskt förstörde; rader som databasen tar bort bakom ryggen på funktionen
  kan inte räknas i det beviset. §4.4 måste ha exakt en läsbar implementation.

Kompensationen i kod är **komplett och rätt ordnad**. De enda produktionsvägar
som hard-deletar en `jobs`- eller `candidates`-rad är `admin.ts#deleteJob` och
`candidate-arco.ts#deleteCandidateAccount` (verifierat genom att räkna upp
samtliga `.delete(...)`-anrop i `lib/` och `scripts/`). Båda rensar
`saved_jobs`, och båda gör det *före* föräldraraden — rätt ordning, eftersom en
krasch mittemellan då förlorar ett bokmärke i stället för att lämna en
föräldralös rad som inga JOIN hittar. `lib/db/retention.ts` raderar varken jobb
eller kandidater (den delegerar till `deleteCandidateAccount`), och
`scripts/verify-scoping.ts` raderar bara sina egna fixtures.

Tre saker rättades i PR 15b:

1. **Bekräftad bugg.** `listSavedJobs()` räknade `total` på enbart `saved_jobs`
   medan sidfrågan `innerJoin`:ade `jobs` och `companies`. Vid en enda
   föräldralös rad skrev sidan ut ett antal som var högre än antalet rader, och
   sista sidan kunde bli tom. Räkningen använder nu samma JOIN:ar.
2. **Bekräftad lucka i bevisföringen.** `deleteCandidateAccount()` raderade
   `saved_jobs` utan att räkna dem, så `deletion_requests.outcome` utelämnade en
   tabell den förstör. Nu räknad och rapporterad (`savedJobsDeleted`).
3. **`scripts/verify-cascades.ts`** (`npm run cascade:verify`) gör konventionen
   mekaniskt kontrollerbar, i samma idiom som `verify-scoping.ts` och
   `verify-candidate-access.ts`: den slår fast att `schema.ts` inte innehåller
   någon `.references()`, och att varje modul som hard-deletar en registrerad
   förälder rensar sina beroenden först. Att lägga till en tabell som pekar på
   en annan kräver nu en post i registret — ett beslut i stället för en diff.

Regeln står numera i `AGENTS.md` så att nästa session inte behöver härleda den
ur `schema.ts` igen.

### 6.2 Scoping-läckage: rent.

Alla fyra exporter i `lib/db/candidate-saved-jobs.ts` tar `candidateId` som
första parameter och nämner den i varje WHERE-klausul. `candidateId` kommer
uteslutande från `requireApiCandidate()` / `getCandidate()` / `requireCandidate()`;
klientens body innehåller bara `jobSlug`, validerad med zod. Ingen adminbranch,
ingen cross-candidate-vy.

Värt att notera som ett medvetet rätt val snarare än en slump: hela flödet är
nycklat på **`jobSlug`, aldrig på `savedJobs.id`**. `UnsaveJobButton` skickar
slug, inte radens id. Eftersom `saved_jobs.id` är globalt löpande skulle en
id-baserad DELETE-route ha varit den självklara platsen för en IDOR — den routen
finns inte. Samma sak för `unsaveJob()` och `isJobSaved()`: båda matchar på
`(candidateId, jobId)`, så en kandidat kan varken läsa eller radera någon annans
bokmärke ens med rätt gissat id.

### 6.3 Cascade/orphan end to end: rent efter 6.1.

Med rättningarna ovan: ett hard-deletat jobb tar sina bokmärken med sig; en
ARCO-radering tar kandidatens bokmärken med sig och redovisar dem. Ett jobb som
arkiveras, går ut eller avvisas — vilket är det normala fallet, till skillnad
från hard delete som bara admin kan göra — raderar ingenting: raden ligger kvar
och renderas som "Ya no disponible" med titeln oklickbar. Det är rätt beteende
och det var §4 punkt 2:s faktiska fråga. UI:t kraschar inte, eftersom
`isAvailable` beräknas i frågelagret och sidan aldrig antar att en länk finns.

### 6.4 `lib/data.ts`-sömmen: rent, och precedenset är korrekt.

`app/postulante/(dashboard)/mis-guardados/page.tsx` importerar
`lib/db/candidate-saved-jobs` direkt, precis som `mis-postulaciones` importerar
`lib/db/candidate-applications` och hela `/empresa`-trädet importerar
`lib/db/employer`. **Det precedenset är inte en överträdelse.** Sömmen i
`ARCHITECTURE.md` §3 är definierad kring åtta funktioner över den *publika
jobbkatalogen*, och den finns för att `DATA_SOURCE=seed|db` ska gå att växla.
Kontodata har ingen seed-representation och därmed ingenting att växla mellan;
att lägga den bakom `lib/data.ts` skulle ge sömmen en gren som aldrig kan ta
något annat värde än `db`.

`AGENTS.md` formulerade regeln absolut ("den enda ingången") medan tre moduler
redan byggde på ett underförstått undantag. Regeln är omskriven till att säga
var gränsen faktiskt går, så att nästa läsare inte behöver välja mellan att tro
på dokumentet eller på koden.

En kvarstående inkonsekvens, medvetet inte åtgärdad: `saveJob()` slår upp jobbet
direkt i `jobs`-tabellen, inte via sömmen, vilket betyder att med
`DATA_SOURCE=seed` skulle en spara-knapp på en seed-annons ge 404. Det gäller
redan `createCandidateApplication()` på samma sätt och av samma skäl — inloggade
kandidater existerar bara i DB-läge — så det är inte något PR 15 införde. Om
`DATA_SOURCE=seed` någon gång ska köras med kandidatkonton påslagna är det den
ena buggen att komma ihåg; idag kan de två flaggorna inte vara på samtidigt i
praktiken.

### 6.5 Ingen bulk-/admin-/cross-candidate-yta: rent.

Ingen kod någonstans räknar hur många kandidater som sparat ett visst jobb.
`lib/db/stats.ts` rör inte `saved_jobs` alls. Ingen admin-vy, ingen export,
ingen sortering på popularitet. Modulens filhuvud skriver ut varför, vilket är
värt att behålla: en `count(*) GROUP BY job_id` här vore rankningsdata om
kandidaters beteende, alltså Phase 4-yta enligt `AGENTS.md`.

### 6.6 Kvarstående, inte åtgärdat: ingen gräns på antal sparade jobb.

§1:s öppna fråga 2 föreslog ingen gräns. Det står fast, men noteras här som en
känd yta: `POST /api/postulante/guardados` har ingen rate limit, till skillnad
från inloggning och kontoradering. En inloggad kandidat kan alltså skapa
obegränsat många rader. Det kräver ett giltigt konto och en giltig
publicerad-jobb-slug per rad, taket är antalet publicerade jobb gånger antalet
konton, och unique-indexet stoppar dubbletter — så det är en storleksordning
från att vara ett problem. Åtgärdas om och när kandidatkonton öppnas brett; en
enkel `MAX_SAVED_JOBS`-kontroll i `saveJob()` räcker då.

---

## 7. Bygg-brief: PR 16, blogg Väg A (Sonnet)

Fullt scopad. Bygg exakt det här; avvikelser ska tas upp innan de byggs, inte
efter. Beslutsunderlaget står i §5 — läs det, inte bara listan nedan.

**Modell: Sonnet.** Ren statisk läs- och renderingsyta: ingen databas, ingen
auth, ingen kandidat- eller arbetsgivardata, inga destruktiva flöden. Faller
under samma modell-tiering-regel som `PLAN.md` §4 och `PLAN-PHASE2.md` §6.

### 7.1 Innehållsformat

`content/blog/<slug>.md` — **filnamnet är slugen**, vilket också är det som gör
slug-unikhet omöjlig att bryta (filsystemet gör jobbet; §4 punkt 6 kräver ingen
kod). Slugs är live SEO-URL:er så fort en artikel publicerats: ett filnamnsbyte
är en 301, inte en rename.

Frontmatter, avgränsad med `---`, **platt `key: value` och inget annat** — inga
listor, ingen nästling, ingen YAML-parser (`js-yaml`/`gray-matter` ska inte
läggas till; en handskriven parser för sex platta fält är mindre kod än
beroendet och kan inte råka tolka `no` som `false`):

```
---
title: Cómo escribir un CV en Paraguay
description: Guía práctica de una página, con lo que los empleadores paraguayos realmente miran.
category: consejos-cv
publishedAt: 2026-08-14
updatedAt: 2026-08-14
published: true
relatedCategory: administracion
relatedCity: asuncion
---
```

- Validera hela frontmatter med **zod** (redan ett beroende). Ogiltig
  frontmatter = kastat fel vid build, aldrig en artikel som tyst hoppas över.
- `category` ∈ `noticias` | `analisis-laboral` | `consejos-cv`. Sluten lista.
- `published: false` → artikeln finns inte: inte i listan, inte i sitemap, och
  **ingen route genereras** (uteslut i `generateStaticParams`).
- `relatedCategory` / `relatedCity` är valfria och matchar befintliga
  taxonomi-slugs.
- `description` är obligatorisk och används som `<meta name="description">` och
  som OG-beskrivning. Max 160 tecken, validerat.

### 7.2 `lib/blog.ts` — enda läsvägen

All filläsning ligger här. Ingen page-, komponent- eller route-fil får anropa
`node:fs` för blogginnehåll. Det är samma disciplin som `lib/data.ts` har, av
samma skäl, och det är också det som gör en eventuell Väg B-migrering (§5.1)
till en ändring i en fil.

Exportera: `getBlogPosts()` (publicerade, nyast först), `getBlogPost(slug)`,
`getBlogSlugs()`. Läsning sker vid build; ingen ISR behövs eftersom en ny
artikel innebär en deploy.

### 7.3 Markdown-rendering

**Återanvänd inte `components/MarkdownContent.tsx`.** Den klarar fet/kursiv,
h2/h3 och punktlistor — inga länkar, inga bilder, ingen kod, inga tabeller — och
intern länkning är hela SEO-motivet för bloggen. Den escapar dessutom inte HTML.

Lägg till **`marked`** (litet, synkront, inga peer-beroenden) och konfigurera
`gfm: true`. Sanitizer (`DOMPurify`/`jsdom`) ska **inte** läggas till, och skälet
ska stå i en kommentar i filen: innehållet ligger i repot, så den som kan
publicera en artikel kan redan publicera godtycklig React — en sanitizer skulle
skydda mot en angripare som per definition redan vunnit. Det som däremot ska
göras, som hygien snarare än säkerhet, är att **slå av rå HTML-genomsläpp** i
renderaren, så att ett inklistrat kodblock från en annan sajt inte kan smuggla
in en spårningspixel utan att någon märker det. `MarkdownContent.tsx` lämnas
orörd för jobbannonser. (Detta är svaret på §4 punkt 7; Väg B-frågan om
rich-text-sanering blir aktuell först om PR 18 någonsin byggs.)

### 7.4 Sidor

- `app/blog/page.tsx` — lista, kronologisk, kategorietikett per kort,
  `ItemList` + `BreadcrumbList` JSON-LD efter mönstret i
  `app/trabajo/[categoria]/page.tsx`.
- `app/blog/[slug]/page.tsx` — artikel, `generateStaticParams` över
  `getBlogSlugs()`, `BlogPosting` + `BreadcrumbList` JSON-LD efter mönstret i
  `app/empleos/[slug]/page.tsx` (`datePublished`, `dateModified`, `author` =
  organisationen, inte en person).
- `app/blog/[slug]/opengraph-image.tsx` — samma stilmall som
  `app/opengraph-image.tsx` (`#FBF9F6`, `#C0362A`-list, samma typografi), med
  artikelrubriken.
- Delningslänkar (§5.4): `wa.me/?text=`, Facebook sharer, kopiera-länk. Vanliga
  `<a>`/knappar. Inga skript från tredje part, inga pixlar, ingenting som laddar
  vid sidvisning.
- **"Empleos relacionados"** i artikelfoten när `relatedCategory`/`relatedCity`
  finns: `getJobs({ categoria, ciudad })` **från `lib/data.ts`**, max fem
  träffar, blocket utelämnas helt när det inte finns några. Det här är den enda
  punkten där bloggen rör jobbdata, och den ska gå genom sömmen. Ingen
  kandidat- eller ansökningsdata, någonsin (§5.4).

### 7.5 SEO-hygien (§4 punkt 5 och 6)

- Lägg in `/blog` och varje publicerad artikel i `app/sitemap.ts`.
  `lastModified` = `updatedAt`. Artiklar med `published: false` ska inte med.
- `app/robots.ts` tillåter redan `/`; `/blog` ska **inte** läggas till i
  `disallow`.
- `app/blog/` är syskon till `app/admin/` och `app/empresa/` och ärver
  ingenting från deras layouter — men verifiera det uttryckligen i webbläsaren
  eller i byggutdata i stället för att anta det. Ett `noindex` som smugit in via
  en kopierad layout är precis den copy-paste-miss §4 punkt 5 pekar ut.
- Slugkollision med befintliga route-segment är strukturellt omöjlig: allt ligger
  under `/blog/`. Skapa inga alias eller rewrites från roten.

### 7.6 `content/blog/README.md`

Kort fil, på engelska som övrig dokumentation, som beskriver frontmatter-fälten,
den slutna kategorilistan, att filnamnet är slugen och att ett filnamnsbyte
kräver en 301 — plus innehållsreglerna i §5.2 (ingen siffra utan källa, ingen
juridisk rådgivning i första person). Det är den fil nästa skribent-session
kommer att läsa i stället för det här dokumentet.

### 7.7 Utanför scope för PR 16

Artikelinnehåll (det är PR 17), kategorisidor, RSS, nyhetsbrev, författarsidor,
kommentarer, bilduppladdning, admin-UI. Bygg inget av det "medan du ändå är
inne i filen".

---

## 8. Efterkontroll batch K — resultat (Opus, medium effort, 2026-08-10)

Genomgång av §4 punkt 5–9 efter att PR 16 (blogg Väg A) och PR 18 (delad
bildpipeline) mergats. Två fynd, båda åtgärdade i samma PR som den här
sektionen. Resten är rent.

### 8.1 Punkt 7, XSS i Markdown: kommentaren i `lib/blog.ts` var faktafel.

Filen påstod att `marked` var konfigurerad med *"raw HTML passthrough OFF (the
default — no `html: true`)"*. Det stämmer inte om biblioteket: `marked` har
ingen `html`-option, det släpper igenom rå HTML **som standard**, och
`sanitize`-optionen togs bort i v5. Verifierat, inte antaget:

```
marked.parse('Hola <script>alert(1)</script>')
→ "<p>Hola <script>alert(1)</script></p>"
```

Den strängen går sedan till `dangerouslySetInnerHTML` i
`app/blog/[slug]/page.tsx`.

**Var det en sårbarhet? Nej — men det var inte det skyddet filen sa att det
var.** Innehållet är Markdown commitat i repot, så den som kan publicera en
artikel kan redan publicera godtycklig React; en sanitizer skulle försvara mot
en angripare som per definition redan vunnit. Det argumentet står kvar och är
korrekt. Problemet var att den *hygien* filen utlovade — "stoppar en
inklistrad kodsnutt från en annan sajt från att smuggla in en trackingpixel" —
var precis det som inte fungerade, och att §5 uttryckligen håller dörren öppen
för Väg B, där artikeltexten ligger i databasen och någon annan än ägaren kan
skriva den. Den migreringen hade ärvt en passthrough ingen trodde var på.

**Åtgärd:** `renderer.html` skriver om rå HTML till escapad text. Escapa,
inte kasta bort — inget som en skribent skrivit försvinner tyst, en
inklistrad `<div>` syns som text, vilket är hur skribenten upptäcker misstaget.

### 8.2 Punkt 6, slug-hygien: `getBlogPost()` byggde en filsökväg av en oskyddad slug.

Kollisioner mellan artiklar är omöjliga (filnamnet *är* sluggen) och kollisioner
med `/empleos` etc. är omöjliga (allt ligger under `/blog/`). Men sluggen blev
en sökväg utan validering:

```
getBlogPost('../../AGENTS') → path.join(content/blog, '../../AGENTS.md')
                            → /AGENTS.md, exists: true   (verifierat)
```

`generateStaticParams` täcker de kända sluggarna, men `dynamicParams` är på som
standard, så en okänd URL renderas ändå vid request. `.md`-suffixet begränsar
skadan till markdown-filer, och en fil utan giltig frontmatter ger 500 i stället
för utlämnat innehåll — men det är en *begränsning*, inte ett skydd.

**Åtgärd:** `SLUG_PATTERN` (`a-z0-9` + bindestreck) prövas innan någon sökväg
byggs, i samma stil som `STORAGE_KEY_PATTERN` i `lib/storage.ts`. `readPostFile()`
kastar dessutom på ett filnamn som inte kan ge en giltig SEO-URL — högljutt, inte
tyst överhoppat, eftersom filnamnet är den live-URL AGENTS.md-regeln handlar om.

### 8.3 Punkt 5, `noindex`/sitemap: rent.

`/blog` och varje artikel ligger i `app/sitemap.ts`, `robots.ts` disallow:ar bara
`/api/`, `/admin/`, `/empresa/`, `/postulante/`, och artikelsidan sätter
`robots: { index: true, follow: true }` explicit. Ingen layout-ärvd `noindex`
har smugit sig in från `/admin`-trädet.

### 8.4 Punkt 8, bildpipelinen: rent, och starkare än vad punkten bad om.

`lib/image-storage.ts` (PR 18) accepterar på magic bytes (inte Content-Type,
inte filnamn), **omkodar allt till WebP med sharp** så en polyglot-fil inte
överlever rundturen, mintar egna nycklar `img/{namespace}/{uuid}.webp`, och
håller publika bilder i ett eget utrymme skilt från CV:erna — som fortsatt aldrig
får en publik URL. SVG är avvisat för att det är XML med `<script>` i.
Ingenting att åtgärda.

### 8.5 Punkt 9, modell-tiering: rent.

Bloggens enda datauttag är relaterade jobb via `getJobs()` i `lib/data.ts` —
den publika katalogen. Ingen widget läser kandidat-, ansöknings- eller
arbetsgivardata, så ingenting i batch K korsade in i Opus-yta i efterhand.

### 8.6 Sidofynd: `cascade:verify` fanns men kördes aldrig i CI.

PR 15b byggde `scripts/verify-cascades.ts` och la in npm-scriptet, men inget
CI-steg — så kontrollen körde bara när någon råkade komma ihåg den. Tillagd i
`.github/workflows/ci.yml` tillsammans med den nya `blog:verify`.
