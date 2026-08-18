# Phase 3 — blogg + sparade jobb

> Status: **beslutad**. Skrivet av Sonnet som utkast, granskat och avgjort av
> Opus 2026-08-10. §1 (sparade jobb) är byggt och mergat som PR 15 (`1e49e5d`,
> PR #37); efterkontrollen och rättningarna ligger i PR 15b (§6). §2 (bloggen)
> är beslutad och byggd som PR 16 (Väg A); efterkontrollen ligger i §8.
> Bygg-briefen för PR 16 står kvar oredigerad i §7.
>
> §2:s öppna frågor besvaras i §5, §1:s i §6. De ursprungliga
> formuleringarna står kvar oredigerade, så att beslutet går att läsa mot det
> som faktiskt frågades.
>
> **Tillägg 2026-08-12:** §9 löser upp motsägelsen mellan `PLAN-IMAGES.md`:s
> "PR 20 (blog images)" och Väg A-beslutet i §5.1; §10 är bygg-briefen för PR 20
> som den omdefinieras där. `PLAN-IMAGES.md` är rättad att matcha.
>
> **Tillägg 2026-08-12, senare samma dag:** ägaren utlöste villkor 1 i §5.1 och
> **Väg B är byggd** — artiklarna ligger i `blog_posts` och skrivs från
> `/admin/blog`. §11 är beslutet och bygglistan. Läs §11 innan §9–§10: de två
> senare beskriver committade omslagsbilder, vilket är den lösning Väg A behövde
> och som Väg B ersätter med en riktig uppladdning genom `lib/image-storage.ts`.
> **PR 20 som §10 beskriver byggdes aldrig och ska inte byggas** — dess
> förutsättning (ingen admin-yta att hänga en uppladdning på) gäller inte
> längre. §9.2:s resonemang om *varför* committade bytes inte behövde
> pipelinen står kvar som korrekt för den värld det skrevs i.
>
> **Tillägg 2026-08-18:** §12 är två oberoende revisionspass över hela repot
> (Sonnet + Fable 5) — fynden, inte rättningarna. §13 är triagen av §12.1:
> sju PR:er, ordnade efter exponering, med modell per PR. §14 är §12.2:s fyra
> frågor skrivna som beslutsunderlag för ägaren. §12–§14 är på engelska enligt
> `AGENTS.md`; §1–§11 står kvar på svenska.

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
| 16 | Blogg Väg A: `lib/blog.ts`, `/blog`, `/blog/[slug]`, sitemap, OG, JSON-LD | Sonnet | **Mergat** (batch K, se §8) |
| 17 | Blogg: de tre första artiklarna som innehåll (bara `content/blog/*.md`) | Sonnet | Efter 16 |
| 20 | Blogg-omslagsbilder som commitade assets (ingen uppladdning, ingen `lib/image-storage.ts`) | Sonnet | **Förfallen** — ersatt av 22, se §11 |
| 22 | Blogg Väg B: `blog_posts`, `/admin/blog`, 301-tabell, omslagsuppladdning genom bildpipelinen | Opus | **Byggd**, se §11 |

> Numreringsnot (2026-08-12): raden ovan hette tidigare "(ev. 18)", vilket
> krockade med PR 18 i `PLAN-IMAGES.md` (den delade bildpipelinen, byggd och
> mergad). Två olika PR:ar kan inte ha samma nummer i två plandokument som
> refererar varandra. Väg B-uppgraderingen är villkorad och får ett nummer den
> dag ett av villkoren i §5.1 faktiskt inträffar — inte innan. PR 19–21 är
> `PLAN-IMAGES.md`:s numrering och gäller.

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

---

## 9. Beslut: blogg-bilder (Opus, 2026-08-12)

### 9.1 Motsägelsen som skulle lösas

Två dokument skrivna samma dag (2026-08-10) sa olika saker:

- `PLAN-IMAGES.md` §0 och §5 räknar upp **"PR 20 (blog images)"** som en av tre
  konsumenter av den delade bildpipelinen, vid sidan av PR 19 (företagslogotyp,
  byggd och mergad som #42) och PR 21 (jobbannonsbilder, byggd och mergad som
  #43). Båda de PR:arna levererade samma form: en auktoriserad
  uppladdningsroute plus ett admin-/arbetsgivar-UI som anropar `storeImage()`.
- §5.1 i det här dokumentet beslutade Väg A för bloggen: **ingen tabell, inget
  admin-UI, ingen bilduppladdning, ingen ny auth-yta.**

"PR 20" som `PLAN-IMAGES.md` beskriver den kan inte byggas. Det finns ingen
admin-yta för bloggen att hänga en uppladdningsroute på, och att bygga en vore
i sig den "nya auth-yta" §5.1 utesluter — en `POST /api/admin/blog/imagenes`
kräver en admin-session, ett formulär, en plats i panelen och en
ägarskapskontroll för innehåll som inte finns i någon tabell att äga.
Motsägelsen är inte en avvägning mellan två rimliga vägar; den ena sidan
beskriver en PR vars förutsättningar beslutet på den andra sidan tog bort.

Att `blog`-namespacet ändå finns i `IMAGE_NAMESPACES` är följdfelet: PR 18
byggde en union på tre värden för tre planerade konsumenter, och den tredje
blev aldrig av. Det är samma klass av fel som §8.1 — en fil som påstår ett
skydd den inte har — fast tvärtom: en kodkommentar som utlovar en konsument som
inte kommer.

### 9.2 Beslut: alternativ (a). Blogg-bilder finns, men de laddas aldrig upp.

**"PR 20 (blog images)" omdefinieras till: en omslagsbild per artikel, commitad
som en fil i repot bredvid `.md`-filen, refererad från frontmatter, validerad
av `lib/blog.ts` vid läsning och av `scripts/verify-blog.ts` i CI. Noll anrop
till `lib/image-storage.ts`, noll runtime-uppladdning, ingen ny route, inget
nytt UI, ingen ny auth-yta.** Briefen ligger i §10.

Alternativ (b) — "inga blogg-bilder alls förrän Väg B" — övervägdes och
förkastades, av tre skäl:

1. **Det är den dyraste möjliga kopplingen.** (b) gör en artikelbild beroende
   av att bloggen först får en databas och ett CMS. Det är att låta en
   redaktionell fråga (ska en artikel ha en bild?) avgöras av en
   infrastrukturfråga (ska bloggen ha ett admin-UI?) som §5.1 uttryckligen
   sköt på framtiden. De två har ingenting med varandra att göra så länge
   skribenten är samma person som committar.
2. **Väg A stöder redan innehåll som är filer.** Artikeltexten är en fil i
   repot. En bild bredvid den är samma sak, samma flöde, samma granskning,
   samma deploy. Det är inte en ny publiceringsmodell som måste införas — det
   är den som redan används, applicerad på en andra filtyp.
3. **`BlogPosting` utan `image` är en sämre SEO-yta**, vilket är hela
   motiveringen till att bloggen finns (§2). Google Discover och rich results
   vill ha en `image` på artikelschemat. Den kostar ett fält och en fil.

**Det som gör (a) säkert är att förtroendegränsen inte flyttas.** Hela §5:s och
§8.1:s resonemang om artikeltexten gäller ordagrant för bilden: innehållet
ligger i repot, alltså kan den som kan publicera en bild redan publicera
godtycklig React. Bildpipelinens magic-byte-kontroll och omkodning försvarar
mot en **främling som laddar upp bytes till vår origin**. Här finns ingen
främling och ingen uppladdning — det finns en commit, granskad i en PR, av
samma person som äger sajten. Att köra committade bytes genom `storeImage()`
skulle inte tillföra ett enda skydd; det skulle bara flytta filen från git
(versionerad, deployad, backad upp) till `IMAGE_STORAGE_DIR` (oversionerad,
måste överleva en deploy på egen hand) och göra en statisk sajt beroende av
runtime-lagring för att rendera sitt eget innehåll. Det vore sämre på varje
axel.

Att pipelinen inte behövs betyder inte att inget behöver kontrolleras. Två av
dess gränser gäller fortfarande, av andra skäl, och flyttas därför till CI i
stället för till runtime (§10.5):

- **Storlek och dimensioner.** Inte för att en angripare kan bomba oss, utan
  för att en 4 MB-JPEG som committas ligger kvar i git-historiken för alltid
  och för att en okomprimerad hjältebild är en LCP-regression på paraguayanska
  mobilnät. Detta är `PLAN-IMAGES.md` §3:s siffror (1600 px för blogg),
  kontrollerade av ett skript i stället för av en validator.
- **Ett enda format.** `.webp`, samma som pipelinen producerar. Skälet här är
  inte XSS — `public/logos/*.svg` visar att repot redan serverar committade
  vektorer och det är oproblematiskt av exakt samma förtroendeskäl — utan att
  en (1) filtyp betyder en konstant `Content-Type`, en konvertering som sker
  vid författandet, och en eventuell Väg B-migrering där bytesen redan har
  pipelinens utformat.

### 9.3 `blog`-namespacet i `lib/image-storage.ts` behålls, men som reserverat.

`IMAGE_NAMESPACES` innehåller `logos | blog | jobs`. Efter det här beslutet har
`blog` ingen anropare och kommer inte att få en så länge Väg A gäller.

**Det tas inte bort.** Att stryka det kostar en kod-PR som rör en
säkerhetskritisk union, dess nyckelregex och `verify-image-storage.ts`, för
noll funktionell vinst — och det måste läggas tillbaka den dag §5.1:s villkor
utlöses och artikeltexten flyttar till databasen (då kommer bilderna med, från
en riktig uppladdningsyta, och då är pipelinen rätt svar). Ett oanvänt värde i
en sluten union är inte en risk: `buildImageKey()` anropas aldrig med det, och
regexen blir inte svagare av att en gren är obebodd.

**Det som däremot rättas nu är kommentaren**, eftersom en kodkommentar som
säger `blog` (PR 20, article images) är exakt den felaktiga utfästelse som
skapade den här motsägelsen. Namespacet märks som reserverat för Väg B, med
hänvisning hit. Det är en dokumentationsrättelse i en kodfil, inte ett bygge.

### 9.4 Vad som uttryckligen *inte* följer av det här beslutet

Så att nästa session inte tolkar "blogg-bilder finns nu" bredare än det är:

- Ingen uppladdningsroute, inget formulär, ingen drag-and-drop, ingen cropper —
  inte i `/admin`, inte någon annanstans. Om en sådan behövs är det inte den
  här PR:en, det är att §5.1:s villkor har utlösts och att Väg B ska beslutas
  först.
- Ingen `/img/`-URL för en blogg-bild. Committade assets serveras statiskt från
  `public/`; `app/img/[...key]/route.ts` är diskdrivrutinens route för mintade
  nycklar och ska inte förväxlas med den (§10.2 väljer katalognamn för att
  hålla de två URL-rymderna åtskilda).
- Inga bilder i artikel-*body*. Frontmatter-fältet är en omslagsbild, inte ett
  bildbibliotek. `![alt](...)`-syntax i Markdown lämnas overksam i den mening
  att inget håller reda på om filen finns — den dagen någon vill ha bilder mitt
  i en artikel är det en egen, medveten utökning av §10, inte något som smygs
  in i en artikel-PR.
- Inga varianter, ingen srcset, ingen resize vid request. `PLAN-IMAGES.md` §6
  gäller ordagrant även här, och skälet är starkare: en resize-parameter i en
  URL är en CPU-yta, och den här sajten har ingen anledning att ha en.

---

## 10. Bygg-brief: PR 20, blogg-omslagsbilder (Sonnet)

Fullt scopad. Bygg exakt det här; avvikelser tas upp innan de byggs, inte
efter. Beslutsunderlaget står i §9 — läs det, inte bara listan nedan. Läs också
`PLAN-IMAGES.md` §5 och §6 för att förstå vad den här PR:en medvetet *inte*
använder, och varför det inte är ett förbiseende.

**Modell: Sonnet.** Statisk läs- och renderingsyta: ingen databas, ingen auth,
ingen uppladdning, ingen kandidat- eller arbetsgivardata, inga destruktiva
flöden. Samma modell-tiering-regel som §7 och `PLAN.md` §4.

### 10.1 Frontmatter: två nya fält, båda valfria, men bundna till varandra

```
coverImage: cv-guia-paraguay.webp
coverAlt: Persona revisando un currículum impreso sobre un escritorio
```

- Båda **valfria**. En artikel utan omslagsbild är ett normalfall och ska
  renderas exakt som idag — inget tomrum, ingen platshållare, ingen grå ruta.
- **`coverAlt` är obligatorisk om `coverImage` finns.** Zod `superRefine`, inte
  ett runtime-`if` i sidan. En omslagsbild utan alt-text är ett
  tillgänglighetsfel som ska stoppa bygget, i samma anda som PR #46:s rättning
  av gallerialt-texten på jobbannonser.
- `coverImage` är ett **bart filnamn**, aldrig en sökväg: validera mot
  `/^[a-z0-9]+(?:-[a-z0-9]+)*\.webp$/`. Inga snedstreck, ingen `..`, ingen
  versal, ingen annan ändelse. Samma disciplin och samma skäl som
  `SLUG_PATTERN` i `lib/blog.ts` — värdet blir en filsökväg, alltså deklareras
  den tillåtna mängden en gång och hävdas, i stället för att antas.
- `coverAlt` max 160 tecken, min 1. Alt-text på spanska (Paraguay), som all
  UI-copy.
- Filnamnet behöver **inte** vara samma som artikelns slug. Två artiklar får
  dela en generisk omslagsbild, och det är en av poängerna med att fältet är
  ett filnamn i stället för en boolean.

### 10.2 Var filerna ligger: `public/blog-covers/`

Committade assets, serverade statiskt av Next från `public/`, alltså på
`/blog-covers/<filnamn>`. Katalognamnet är valt för att undvika två krockar,
och båda måste förbli undvikna:

- **Inte `public/blog/`**, som skulle servera på `/blog/...` och lägga statiska
  filer i samma URL-rymd som artiklarnas live-SEO-URL:er.
- **Inte `public/img/`**, som skulle servera på `/img/...` och överlappa
  `app/img/[...key]/route.ts` — diskdrivrutinens route för mintade nycklar.
  Statiska filer vinner över route-handlers i Next, så en sådan överlappning
  går inte sönder högljutt; den går sönder tyst, vilket är värre.

`content/blog/` är fel plats för bytesen: den katalogen serveras inte, så en
bild där skulle kräva en route-handler som läser från disk — alltså exakt den
runtime-yta §9.2 säger nej till.

### 10.3 `lib/blog.ts`: validering vid läsning, samma fil som allt annat

All kunskap om omslagsbilder ligger här, som allt annat bloggen läser. Ingen
sida och ingen komponent får slå upp en fil eller bygga en sökväg själv.

- Utöka `frontmatterSchema` enligt §10.1 och `BlogPostMeta` med
  `coverImage?: string` och `coverAlt?: string`.
- I `readPostFile()`: när `coverImage` finns, **kontrollera att filen
  existerar** i `public/blog-covers/` och kasta annars — högljutt, med
  filnamnet och artikelslugen i felmeddelandet. Samma val som `readPostFile()`
  redan gör för ett ogiltigt filnamn: en trasig referens är ett misstag att
  rätta innan den shippar, inte en artikel att tyst rendera utan bild.
- Exportera **`blogCoverUrl(coverImage: string): string`** som returnerar
  `/blog-covers/${coverImage}`. En funktion, inte en sträng som konkateneras på
  tre ställen, och av exakt samma skäl som `imagePublicUrl()` finns i
  `PLAN-IMAGES.md` §2.1: den dag bilderna någonsin flyttar är det en fil som
  ändras. Sidorna anropar den; de känner inte till katalogen.
- Ingen `sharp`-import i `lib/blog.ts`. Dimensioner läses aldrig vid render
  (§10.4 förklarar varför de inte behöver läsas).

### 10.4 Rendering

- **`app/blog/[slug]/page.tsx`:** omslagsbilden överst i `<article>`, ovanför
  kategorietiketten, med rundade hörn som matchar kortet
  (`rounded-[10px] border border-[#E7E1D6]`, samma paletten som resten av
  sidan). Vanlig `<img>`, inte `next/image` — `PLAN-IMAGES.md` §6 avstod från
  loader-integration och ingenting här behöver den.
- **Fasta dimensioner, inget CLS:** omslagsbilder är **exakt 1600×900**
  (16:9), hävdat i CI (§10.5), så sidan skriver `width={1600} height={900}`
  som konstanter och behöver aldrig läsa en filheader vid render. Det är hela
  skälet till att måttet är exakt och inte "max 1600 bred".
- `alt={post.coverAlt}`, `fetchPriority="high"`, ingen `loading="lazy"` —
  bilden är sidans LCP-element.
- **JSON-LD:** lägg `image: [absolut URL till omslagsbilden]` på `BlogPosting`
  när den finns, utelämna fältet helt när den inte gör det. Absolut URL byggd
  från samma `siteUrl` som `postUrl` redan använder.
- **`/blog`-listan visar inga omslagsbilder.** Medvetet: utan varianter
  (`PLAN-IMAGES.md` §6) skulle varje kort ladda hela hjältebilden, så en lista
  med tio artiklar drar ett par megabyte för att visa miniatyrer. Om listan
  någon gång ska ha bilder är svaret en andra committad fil i
  miniatyrstorlek — aldrig en resize vid request.
- **OG-bilden ändras inte.** `app/blog/[slug]/opengraph-image.tsx` fortsätter
  generera det befintliga kortet. Skäl: den garanterar att *varje* artikel har
  en OG-bild, även de utan omslag, och att komponera in en WebP i `ImageResponse`
  förutsätter WebP-stöd i satori som inte ska antas utan att verifieras. Vill
  man ha omslaget i OG är det ett eget, verifierat steg — inte något som
  klämmas in här.

### 10.5 `scripts/verify-blog.ts`: det som ersätter pipelinens gränser

Nya assertions i den befintliga filen, i dess stil (samma `check()`, samma
exit-kod, ingen databas, ingen env, inget nätverk). Det här är den mekaniska
delen av §9.2 — reglerna som pipelinen hade skött om det funnits en
uppladdning:

1. Varje `coverImage` som en artikel refererar **existerar** i
   `public/blog-covers/`.
2. Filen **avkodar som WebP** — läs headern med `sharp` (redan ett beroende,
   samma bibliotek pipelinen använder): `format === 'webp'`, `pages` saknas
   eller är 1 (ingen animation, samma regel som `PLAN-IMAGES.md` §3).
3. **Exakt 1600×900.**
4. **Max 200 KB** på disk. Det är gott om marginal för en 1600×900 WebP på
   kvalitet 82 och samtidigt lågt nog att en okonverterad fil åker fast.
5. **Inga föräldralösa filer:** varje fil i `public/blog-covers/` refereras av
   minst en artikel — inklusive artiklar med `published: false`, som är
   riktiga referenser även om de inte renderas. `PLAN-IMAGES.md` §6 avstod från
   en orphan sweeper eftersom varje konsument städar sitt eget; här är
   motsvarigheten att en borttagen artikel som lämnar sin bild kvar fälls i CI,
   eftersom git inte har någon delete-hook som gör det åt oss.
6. **Alt-text finns** för varje `coverImage` (redundant mot zod, men den här
   filen är det som körs i CI och det som en läsare kollar).

Noll omslagsbilder är ett giltigt tillstånd: git spårar inte tomma kataloger, så
`public/blog-covers/` kan mycket väl saknas när PR 20 mergas och ingen artikel
ännu har en bild. Skriptet ska då passera, inte krascha — samma hållning som
`readAllPosts()` har mot en saknad `content/blog/`.

Skriptet körs redan som `npm run blog:verify` i `.github/workflows/ci.yml`
(§8.6) — ingen ny CI-post behövs.

### 10.6 `content/blog/README.md`

Utöka tabellen med `coverImage` och `coverAlt`, plus ett kort avsnitt
"Cover images" på engelska som övrig dokumentation:

- Var filen ska ligga (`public/blog-covers/`), att den ska vara WebP, exakt
  1600×900 och under 200 KB, och att alt-text är obligatorisk när det finns en
  bild.
- **Hur man producerar en sådan fil**, som en kommandorad att kopiera, eftersom
  det är det steget en skribent-session faktiskt fastnar på. Använd repots egen
  `sharp` (redan ett beroende — hämta inte in `sharp-cli` via `npx` för det
  här), i stil med:

  ```
  node -e "require('sharp')('foto.jpg').resize(1600,900,{fit:'cover'}).webp({quality:82}).toFile('public/blog-covers/<namn>.webp')"
  ```

  Kvalitet 82 är samma tal som pipelinen använder (`PLAN-IMAGES.md` §3), så en
  committad omslagsbild och en uppladdad jobbbild ser likadana ut.
  **Kör kommandot innan du skriver in det i README:n** — det här dokumentets
  version är oprövad (den skrevs i en session utan installerade
  `node_modules`), och en README med ett kommando som inte kör är sämre än
  ingen README.
- Att en borttagen artikel också ska ta bort sin bild (CI fäller annars).

### 10.7 Utanför scope för PR 20

Bilder i artikelbody, bildtexter, gallerier, miniatyrer i listan, OG-komposition,
kategorisidor, RSS, `next/image`, varianter/srcset, någon form av uppladdning,
någon form av admin-UI, och varje anrop till `lib/image-storage.ts`. Bygg inget
av det "medan du ändå är inne i filen" — flera av dem är uttryckligen
förkastade i §9.4 och en av dem skulle återinföra motsägelsen den här sektionen
finns för att lösa.

---

## 11. Beslut: Väg B byggs nu (ägaren, 2026-08-12)

### 11.1 Vad som ändrades, och varför det inte är en omprövning

§5.1 valde Väg A och skrev ut tre villkor för när Väg B blir aktuell — "först
när ett av dessa är sant, inte tidigare". Villkor 1 lyder: *någon som inte är
ägaren, och inte arbetar genom en Claude-session, ska kunna publicera utan att
be någon annan.*

Ägaren begärde 2026-08-12 en blogg som administreras från `/admin` med
"perfect SEO". Det är villkor 1, uttalat av den enda person som kan avgöra om
det är sant: hela §5.1:s argument mot Väg B var att den skulle bygga *"ett CMS
för en skribent som inte finns"*. När den som äger sajten säger att hen vill
skriva därifrån finns skribenten, och argumentet upphör att gälla — det var
aldrig ett tekniskt argument.

Det här är alltså inte att §5.1 var fel eller att beslutet har rivits upp.
§5.1:s ordning höll exakt som den var tänkt: A byggdes först, den var billig,
den visade formen, och migreringen A→B blev — som §5.1 lovade — ett byte av
läskälla bakom `lib/blog.ts` med samma slugs, samma routes och samma rendering.
Att dokumentet skrev ut villkoren i förväg är vad som gjorde det här till ett
femton-minuters beslut i stället för en ny utredning.

### 11.2 Vad som byggdes

| Yta | Fil(er) |
|---|---|
| Tabeller | `blog_posts`, `blog_post_redirects` i `lib/db/schema.ts`, migration `0005_third_firebrand.sql` |
| Datalager | `lib/db/blog.ts` — publika läsningar bakom **en** `publishedPredicate()`, admin-CRUD under en tydlig avdelare i samma fil |
| Läs-söm | `lib/blog.ts` — samma exporter som under Väg A, nu mot databasen; `renderMarkdown()` oförändrad |
| Admin-UI | `/admin/blog`, `/admin/blog/nuevo`, `/admin/blog/[id]` + `components/admin/BlogPostForm.tsx`, `BlogCoverUploader.tsx`, `BlogDeleteButton.tsx` |
| API | `POST /api/admin/blog`, `PATCH|DELETE /api/admin/blog/[id]`, `POST|PATCH|DELETE /api/admin/blog/[id]/portada`, `POST /api/admin/blog/preview` |
| Omslagsbilder | `lib/blog-cover.ts` → `storeImage('blog', …)`. Det är `blog`-namespacet som `PLAN-IMAGES.md` §9.3 reserverade för precis den här dagen |
| Import | `scripts/blog-import.ts` (`npm run blog:import`), idempotent på slug |
| CI | `scripts/verify-blog.ts` omskriven; `scripts/verify-cascades.ts` och `scripts/verify-db.ts` utökade |

### 11.3 Fyra beslut inuti bygget som inte stod i §5

1. **Slug-byte på en publicerad artikel mintar en 301 i samma skrivning**
   (`blog_post_redirects`). `AGENTS.md` har alltid sagt att en slug-ändring
   kräver en 301; under Väg A gick det inte att uppfylla utan att en människa
   kom ihåg det, eftersom slugen var ett filnamn. Nu är gamla värdet känt
   precis i det ögonblick det ersätts, vilket är det enda ögonblick redirecten
   kan skapas automatiskt. Jobb- och företagsslugs har ingen sådan tabell och
   fortsätter varna i stället.
2. **Alt-text är en obligatorisk query-parameter på uppladdningen**, inte ett
   fält i artikelformuläret. "Omslagsbild utan alt-text" blir då ett tillstånd
   API:et inte kan producera — samma val som §10.1 gjorde för committade
   bilder, av samma skäl.
3. **`published: false` blev `status: 'draft'`, inte en soft delete.** Ett
   utkast är en rad som `publishedPredicate()` inte släpper igenom, och det är
   den enda mekanismen. Ingen ny flagga, ingen andra väg in.
4. **Kategorisidor byggdes fortfarande inte.** §5.3:s tröskel — minst fem
   publicerade artiklar över minst två kategorier — är inte nådd (tre
   artiklar). Att bloggen nu har ett admin-UI ändrar ingenting i det
   resonemanget: tunna sidor är tunna oavsett hur innehållet skrevs.

### 11.4 Kvar att göra, i ordning

1. **Cutover-steget:** kör `npm run db:migrate` mot produktion,
   sedan `npm run blog:import -- --write`. Före importen är `/blog` tomt —
   `.md`-filerna läses inte längre. De två stegen hör ihop och ska köras i
   samma sittning.
2. Efterkontroll i §4:s anda efter merge (särskilt punkt 5, `noindex`/sitemap,
   nu när artikel-URL:erna genereras från en tabell).
3. Fristående från de två ovan: `/admin/blog` öppnade en skrivväg som §12.1
   hittade ett hål i (`javascript:`-URL:er i artikel-Markdown). Den rättningen
   är PR **B3** i §13.4 och hör inte hemma i den här listan — den här listan
   handlar om att bli klar med cutovern. Steg 1 ovan är samma sak som §12.3
   noterar som ogjort.

### 11.5 Vad som *inte* följer av det här beslutet

- Ingen kommentarsfunktion, ingen prenumeration, inget RSS, inga
  författarsidor. §5.4 gäller ordagrant.
- Ingen andra skribentroll. `admin` och `editor` skriver blogg, precis som de
  redan skriver jobbannonser; `employer` gör det inte, och en fjärde roll för
  "skribent" är inte en yta det här bygget öppnar.
- Ingen bild i artikel-body. Frontmatter-fältet blev en kolumn, inte ett
  bildbibliotek — §9.4 gäller fortfarande, av samma skäl.

---

## 12. Audit findings — Sonnet + Fable 5 (2026-08-18)

Two independent passes over the whole repo: first a Sonnet checklist audit
(non-negotiables, doc/code drift, CI coverage), then a Fable 5 deep-read audit
deliberately steered away from repeating it (races, transaction boundaries,
cache behaviour, trust boundaries). Combined results below. The stale-doc items
both passes found were fixed in the same commit as this section
(`ARCHITECTURE.md` §4/§5, `MIGRATION.md` header, `DEPLOY.md` counts,
`PLAN-PHASE2.md` §8 Q1); everything below is what remains. Code fixes are
intentionally NOT applied here — this section is the record, the fixes are
follow-up PRs.

### 12.1 Pure engineering fixes — no owner decision needed

**CI gaps**

- No `npm run lint` step and no isolated `tsc --noEmit` step in
  `.github/workflows/ci.yml` — typechecking happens only implicitly inside
  `next build`. Fix: add both as explicit CI steps. Benefit: lint regressions
  and type errors in non-built code paths (scripts) fail fast and visibly.

**Correctness / atomicity**

- Duplicate-application race: `createCandidateApplication()`
  (`lib/db/candidate-applications.ts:57–62`) is check-then-insert with **no
  unique index on `(candidate_id, job_id)`** — unlike `saved_jobs`, which has
  exactly that guard (`lib/db/schema.ts:466`). Two concurrent submits both
  pass the check. Fix: add the unique index (candidate rows only —
  anonymous rows have NULL `candidate_id`, which MySQL unique indexes permit
  repeatedly, so the lead form is unaffected) and treat the constraint
  violation as `already_applied`. Benefit: the race becomes impossible
  instead of unlikely.
- No DB transaction around (a) the consent-insert → application-insert pair
  (`lib/db/candidate-applications.ts:74–87`) and (b) steps 3–5 of
  `deleteCandidateAccount()` (`lib/db/candidate-arco.ts:386–435`). A
  mid-write crash can leave a consent row authorising a share that never
  happened, or a half-deleted candidate. Fix: wrap each in
  `db.transaction()`. Benefit: consent/application state and the ARCO purge
  become all-or-nothing. (The CV *storage* delete stays outside the
  transaction by design — bytes-before-rows is §4.4's ordering.)

**Security**

- Blog Markdown XSS gap: the `marked` renderer override in `lib/blog.ts:64–72`
  escapes raw HTML but does **not** filter link destinations —
  `[x](javascript:alert(1))` renders as a live anchor. Fix: allowlist link
  href schemes (http/https/mailto only) in the renderer, and add a
  corresponding assertion to `scripts/verify-blog.ts` so the property is
  CI-locked like the raw-HTML escape already is. Benefit: closes the one
  remaining script-injection path from the admin editor to every visitor.
- Spoofable rate-limit key: the login limiter reads the client IP as the
  **leftmost** `x-forwarded-for` entry (`app/api/admin/login/route.ts:20`,
  same pattern in the empresa/postulante routes and `lib/leads.ts:249`). XFF
  is client-appendable — an attacker prepending a random value gets a fresh
  bucket per request, i.e. unlimited login attempts per account. Fix: take
  the trusted hop (rightmost entry / the platform-provided real client IP)
  in one shared helper. Benefit: the limiter actually limits an attacker,
  not just an honest client.
- No rate limiting on authenticated candidate write endpoints (e.g.
  `POST /api/postulante/postulaciones`) while the anonymous leads route
  already has it — §6.6 flagged the same for `guardados`. Fix: apply the
  same `createAttemptLimiter` pattern. Benefit: a compromised or scripted
  account can't spray writes.

**Duplication / drift**

- Two independent in-memory rate limiters: `lib/rate-limit.ts`
  (`createAttemptLimiter`) and a second hand-rolled one in `lib/leads.ts:260`
  (`requestTimestamps` Map). Same single-process fragility, implemented
  twice. Fix: consolidate on one module. Benefit: one place to fix the XFF
  issue above and one place to replace if the process model ever changes.
- `cachedOrRaw()` is duplicated verbatim in `lib/db/queries.ts:380` and
  `lib/blog.ts`, both string-matching `'incrementalCache missing'` against a
  Next internal. Fix: extract one shared helper. Benefit: when the Next
  internal message changes, it breaks in one place, loudly, not in two.
- Unbounded cache cardinality: `cachedJobs` keys on `filtersKey(filters)`
  including free-text `q` (`lib/db/queries.ts:316–326`). A crawler sending
  random `?q=` values mints an unlimited number of cached entries on disk.
  Fix: normalize/cap `q` in the key, or exclude `q`-carrying queries from
  `unstable_cache` and serve them raw. Benefit: cache size is bounded by the
  finite filter space again.
- Seed-vs-DB sort drift: seed's `salario` sort ignores `featured`
  (`lib/data.ts`) while the DB path keeps featured as a tiebreaker
  (`lib/db/queries.ts`); `seedGetFeaturedJobs` returns file order while the
  DB orders `asc(jobs.id)`. Fix: align both sides, or record the divergence
  as accepted in `ARCHITECTURE.md` §3 — `db:parity` should not be quietly
  tolerating it. Benefit: the parity guarantee stays a guarantee.

**Docs**

- `user:password` and `candidate:create` (`package.json`) are the only two
  ops scripts documented nowhere. Fix: one line each in `DEPLOY.md`.
  Benefit: the next operator doesn't rediscover them by reading
  `package.json`.

### 12.2 Requires an owner decision — recorded, not resolved

- **CV storage driver (R2 vs disk) — PLAN-PHASE2.md §8 Q4, still open.**
  `CV_STORAGE_DRIVER` has no default and throws if unset, so production has
  chosen *something*, but the repo doesn't say what. `DEPLOY.md` already
  spells out the stakes: disk means unscheduled manual backups, legal
  exposure under Ley N° 7593/2025 if a CV is lost, and **no migration path
  between drivers once CVs exist on one**. The cost of deferring rises with
  every stored CV. Decision needed before real CV volume arrives.
- **Transactional email (Resend) — PLAN-PHASE2.md §8 Q5, still entirely
  unimplemented**, and §8 calls it "the one open question that changes PR
  scope". Consequences of not deciding: password reset has no possible
  implementation (see the `ARCHITECTURE.md` §5 note fixed in this commit);
  the 23-month retention warning can only be *reported*, never sent
  (`db:purge`); and `candidates.emailVerifiedAt` can never be set — meaning
  every consent row is tied to an unverified address, which weakens its
  evidentiary value for ARCO/legal purposes.
- **Single-process assumption.** Both in-memory rate limiters and the
  `revalidateTag`-based invalidation (`ARCHITECTURE.md` §8) assume one Node
  process. Fine forever if Hostinger stays single-instance; breaks
  *silently* under horizontal scaling — per-instance rate limits, and an
  instance that never sees another's invalidations, so "editor publishes and
  sees it immediately" stops being true. Owner should confirm whether
  single-instance is a permanent assumption (then document it as one) or
  whether scaling should be planned for (then these become real work).
- **Ops hardening phase — candidate for a small new phase, priority is the
  owner's call** since none of it gates a current PR:
  - No error tracking — only stray `console.*` calls in `lib/`, while
    `DEPLOY.md` itself describes production failures as an opaque
    "Application error / Digest" page with no useful information.
  - No MySQL backup/restore procedure documented anywhere — only the CV and
    image *directories* are mentioned in backup terms.
  - No monitoring that the monthly `db:purge` sweep actually runs. A
    silently skipped month is non-compliance with the retention numbers
    published in `/privacidad`.
  - No auth audit trail beyond `lastLoginAt` — no record of logins, failed
    logins, or password changes.

### 12.3 Operational, not code

- **The blog production cutover (§11.4 step 1) does not appear to have been
  run**: `npm run db:migrate` then `npm run blog:import -- --write` against
  production. This cannot be confirmed from the repo — that state lives in
  the production database — but it is still listed as outstanding, and until
  it runs, the deployed `/blog` is empty. Operational to-do for whoever holds
  production access; nothing to fix in code.
---

## 13. Triage of §12 — PR breakdown and model per PR (2026-08-18)

English, like §12 and unlike the rest of this document: this section is read
against §12's finding list, and `AGENTS.md` puts docs in English anyway. §1–§11
stay as they are.

### 13.1 What this triage is, and how it was produced

§12 is the record of what is wrong. This section is the plan for fixing it:
§12.1's list cut into PR-sized units, each with a model, ordered by risk.
Nothing here is implemented — that is deliberate, and it matches §12's own
"the fixes are follow-up PRs".

One thing about the provenance, because it affects how much weight the
agreements below deserve. This triage was started while §12 was still an
unmerged branch and was not visible in the repo, so the two named security
findings were re-derived from the code independently rather than read off
§12's list. Where this section and §12 agree, two passes that could not see
each other reached the same place. Two consequences of that are worth keeping:

- **The blog XSS was reproduced, not reasoned about.** Running the repo's own
  `marked` (18.0.9) with the exact override in `lib/blog.ts:63-69`:
  `[clic](javascript:alert(document.cookie))` →
  `<a href="javascript:alert(document.cookie)">clic</a>`. Also
  `![x](javascript:…)` → a live `img src`, and `data:text/html;base64,…`
  survives as an href — so the allowlist §12.1 asks for has to cover the
  `image` renderer too, not only `link`.
- **Job descriptions are not affected, and that is not luck.**
  `components/MarkdownContent.tsx` implements no link syntax at all — no `href`
  is produced anywhere in that file — so the hand-rolled renderer is strictly
  safer here than the library. Worth writing down so nobody "fixes" the job
  path by moving it to `marked`.

### 13.2 Correction to my own pass: the cache was not clean

Before §12 was visible I audited the cache and reported it clean. That was
answering a narrower question than the one that mattered. I checked
*invalidation* — all 22 call sites of `invalidatePublicContent()` and
`invalidateBlogContent()` against `PUBLIC_PATHS`, `BLOG_PATHS`, `CACHE_TAGS`
and every `unstable_cache` key — and that half is genuinely fine: every
mutating handler that can change public output calls one of the two, and
`revalidatePath` with `'page'` on the dynamic patterns covers every slug,
including the old one after a rename.

I did not check *key cardinality*, and that is where the defect is. §12.1's
finding stands, and it is verified: `filtersKey()` (`lib/db/queries.ts:316`)
JSON-encodes the whole filter object including free-text `q`, and `q` reaches
it straight from the public query string (`app/empleos/page.tsx:28,47`). Every
distinct `?q=` mints a cache entry. On shared Hostinger disk that is a
resource-exhaustion vector any crawler can trip by accident, and it is live in
production today.

So it is not a "cache cleanup" and it is not ranked with the tidying below —
it is B2, above the blog XSS, because it needs no session at all.

### 13.3 One finding not in §12

`/api/postulante/mis-datos/eliminar` calls
`checkCandidateLoginRateLimit(ip, candidate.email)` — the **same limiter
instance** as candidate login (route line 56-57). Five failed password
confirmations on the deletion page consume the login budget, and vice versa.

`lib/rate-limit.ts`'s own header states the rule being broken: *"Each caller
creates its OWN limiter instance. That is deliberate… Sharing the code is the
point; sharing the counters is not."* The module already has the answer; the
call site does not follow it. It lands in B1 because B1 is already rewriting
every limiter call site, and it matters because the affected path is ARCO
self-service deletion — the one `/privacidad` promises.

Related, and already implied by §12.1's XFF finding but worth making explicit
as a *requirement on the fix* rather than a separate item: the same spoofable
value is what gets written to `consents.ip` and `data_access_logs`
(`lib/db/candidates-admin.ts:90`). Those are the ARCO evidence rows. B1 is not
only a limiter fix; it decides what those columns are worth.

### 13.4 The PRs

Ordered by exposure, not by size. The rule used: **live and reachable without
any session first**, then live-but-authenticated, then work behind a dark
feature flag. Flag-dark work is not low priority — B4 must land before
`CANDIDATE_ACCOUNTS_ENABLED` is ever flipped — it just cannot hurt anyone this
week.

| PR | Title | Model | §12 items covered |
|---|---|---|---|
| **B1** ✅ | Trusted client IP + one limiter module | **Opus** | Spoofable XFF key; two independent limiter implementations; plus §13.3's shared ARCO instance and the seven divergent `clientIp` copies |
| **B2** ✅ | Bounded cache key for free-text search | **Opus** | Unbounded cache cardinality |
| **B3** ✅ | Link/image scheme allowlist in blog Markdown | **Opus** | Blog Markdown XSS gap |
| **B4** ✅ | Application uniqueness + transaction boundaries | **Opus** | Duplicate-application race; missing transactions around consent→application and `deleteCandidateAccount()` steps 3–5 |
| **B5** | Rate limits on authenticated candidate writes | Sonnet | No limiting on `postulaciones` / `guardados` (also §6.6) |
| **B6** | CI: `lint` and `tsc --noEmit` | Sonnet | Both CI gaps |
| **B7** | Shared `cachedOrRaw`, seed/DB sort parity, two undocumented scripts | Sonnet | `cachedOrRaw` duplication; seed-vs-DB sort drift; `user:password` / `candidate:create` in `DEPLOY.md` |

**B1 — Opus.** `PLAN.md` §4's first criterion verbatim: auth, where subtly
wrong leaks data. Three things have to be true at once and only one of them is
mechanical. The hop must be counted from the trusted end, configured rather
than guessed. A second bucket keyed on identity alone has to exist, because an
attacker with a botnet has real IPs and pinning the hop does not stop them —
while staying slow rather than locking-out, since the current `ip:email` key
was chosen precisely so a stranger cannot lock a known-good account out
(`lib/rate-limit.ts:31-33`). And it changes what lands in the consent evidence
columns. None of that shows up in a UI when it is wrong.

**B2 — Opus.** `PLAN.md` §4's other named Opus area, and for its stated
reason. The failure mode of a badly normalized cache key is not a big cache;
it is two different filter sets colliding on one key and one visitor's result
set being served for another's query. That is "silently serves stale content"
with a sharper edge. The two candidate fixes — normalize-and-cap `q`, or
exclude `q`-carrying queries from `unstable_cache` entirely — differ in
exactly this risk, and picking between them is the work.

**B3 — Opus.** Not because an allowlist is hard, but because it is written
*into the same renderer override* that currently holds the raw-HTML escape. An
override that replaces where it should extend switches that escape off, and
nothing in CI today would notice — `blog:verify` asserts the escape through
`renderMarkdown()`, so it would keep passing if the escape were still there and
fail usefully only if the new assertions land in the same PR. `AGENTS.md` names
that escape as a boundary. Silent-when-wrong is the Opus line.

**B4 — Opus.** A schema migration under the no-FK regime (`AGENTS.md`: plain
columns and indexes, cross-table cleanup in code, and `verify-cascades.ts`
kept in step), plus transactions on the ARCO purge — the destructive path
`PLAN-PHASE2.md` §6 already made Opus for PR 10, for reasons that have not
changed. The unique index needs the NULL-`candidate_id` behaviour §12.1
describes to be correct in MySQL, or the anonymous lead form breaks; that is
worth proving in the PR body, not asserting.

**B5, B6, B7 — Sonnet.** B5 is applying an existing pattern once B1 has
settled what the pattern is, so it is sequenced after B1 and is otherwise
mechanical. B6 is configuration, with one unknown: how much eslint complains on
its first green run. That tail stays inside B6 and must not become a
repo-wide reformat. B7 is three small independent things; the only judgement in
it is the sort drift, and the rule is *the DB path is the source of truth and
seed follows it*, with `db:parity` run and pasted into the PR body — §12.1 is
right that parity quietly tolerating a divergence is the actual problem.

**Built 2026-08-18 (B1–B4).** Four decisions inside the builds that §13.4 did
not settle in advance, recorded because each is a place a later reader could
reasonably expect the opposite:

1. **The identity bucket is 4x the per-IP allowance (20 per 15 min), not a
   lockout.** §13.4 required a bucket that does not depend on IP and said it
   must stay slow rather than excluding. 20 is the number that does both: an
   ordinary user has already been stopped by the strict bucket at 5, and an
   attacker with a proxy pool is bounded per account. The cost is explicit — an
   attacker who knows an email can hold that account at 429 for the rest of the
   window. Bounded, self-healing lockout of one account beats unbounded
   guessing at it.
2. **B2 does not cache searches at all.** Normalising `q` was the other
   candidate. It cannot bound the space — a 64-character cap still leaves an
   effectively infinite one — so the choice was between bounded disk and a
   MySQL round trip per search. The cached paths are the ones that carry the
   traffic; search is not one of them.
3. **`new URL()`, not a scheme regex, in B3.** Browsers normalise leading
   whitespace, control characters and `JaVaScRiPt:` before deciding what a
   scheme is; hand-rolled matching is where these checks fail. Parsing makes
   our answer and the browser's the same answer by construction.
4. **B4's CV objects stay outside the transaction.** PLAN-PHASE2.md §4.4's
   bytes-before-rows ordering wins over atomicity where the two conflict: a
   rollback that leaves rows pointing at destroyed bytes is recoverable
   bookkeeping, while committed row deletions would strand the bytes with
   nothing left to find them by.

Two CI scripts were added — `client-ip:verify` and `search:verify` — and
`blog:verify` grew the link-scheme half. All three assert properties that were
silent when broken, which is the same reason the eight scripts before them
exist.

*Rough shape:* B1 medium and the one that needs
`node_modules/next/dist/docs/` read for header handling; B2 medium; B3 small;
B4 medium; B5 small; B6 small-with-a-tail; B7 small. Two Opus sessions and one
Sonnet session, near enough.

### 13.5 Deliberately not in B1–B7

- **No distributed rate-limit store and no cross-instance invalidation.** Both
  wait on §14 D3. B1 makes the limiter correct within one process; it does not
  make it shared.
- **No CSP header, no error tracking, no backup procedure, no purge-run
  monitoring, no auth audit trail.** That is §12.2's ops-hardening list, which
  §14 D4 leaves with the owner precisely because none of it gates a PR.
- **No captcha and no account lockout.** Both change what a real user meets,
  which makes them product decisions rather than audit fixes.
- **Nothing about the blog production cutover.** §12.3 is right that it is
  operational; §11.4 step 1 already owns it.

### 13.6 Where this lands, and why not a `PLAN-PHASE4.md`

Decision: **§13 and §14 in this document. No new plan file, and not folded
into §11.4.**

1. **A `PLAN-PHASE4.md` would describe the wrong kind of work.** `PLAN.md` and
   `PLAN-PHASE2.md` each open a *new body of work* — a schema, a flag, a
   surface that does not exist yet. Seven fixes to already-merged code have
   none of that. A plan document of their own would give them a weight they do
   not have and turn "the plan" into a bug tracker.
2. **"Phase 4" is already taken.** `PLAN-PHASE2.md` §6 calls candidate search,
   ranking and matching *"Phase 4 — NOT NOW"*, gated on legal review, and
   `AGENTS.md` repeats it as a non-negotiable. A `PLAN-PHASE4.md` about rate
   limiting would make every future reference to "phase 4" ambiguous — exactly
   the collision the "read §11 before §9–§10" note in this document's header
   exists to warn about.
3. **§11.4 is the wrong list.** It is one PR's tail: the blog cutover's two
   commands, run in one sitting. Seven cross-cutting fixes there stop it being
   a checklist for finishing the blog.
4. **This document is already where post-merge review lives** — §4, §6, §8 and
   now §12 are all "what did we find after merge". §13 is the same genre one
   size up, and it sits directly under the findings it triages, which is the
   only place it can be read without cross-referencing.

---

## 14. Owner decisions: the four questions in §12.2 (2026-08-18)

Same form as `PLAN-PHASE2.md` §8: what is being asked, what each option costs,
and what breaks if the answer keeps waiting. An assumed default is written out
**only where the plan already has one** — D4 has none, and that absence is the
question.

None of these are decided here. §12.2 records them; this section is what the
owner needs in order to answer them.

### D1. CV storage: Cloudflare R2 or Hostinger disk?

*Plan's assumption: R2* (`PLAN-PHASE2.md` §3.1 and §8 Q4).

**What is being asked.** Only which one runs. Both drivers are built, sit
behind one interface in `lib/storage.ts`, and are exercised in CI on every
push. This is an account and a few environment variables, not code.

**What they cost.** R2: a Cloudflare account, a private bucket, and
`CV_R2_ACCOUNT_ID`, `CV_R2_BUCKET`, `CV_R2_ACCESS_KEY_ID`,
`CV_R2_SECRET_ACCESS_KEY`. The volume fits the free tier with room to spare.
Disk: no new account, a directory outside the build root, `CV_STORAGE_DIR` —
and then Hostinger's own backup is the only backup of every CV, which moves
the backup question into D4 rather than removing it.

**On the migration point.** §12.2 says there is no migration path between
drivers once CVs exist. Precisely: no such script exists today, and none is
planned. One could be written — the interface makes it a read-all/write-all
loop — but it is real work that has to be scheduled, and its cost grows with
the number of stored CVs. So the door is not locked; it gets heavier.

**If deferred.** Nothing breaks today: `CANDIDATE_ACCOUNTS_ENABLED` is `false`
and there is not one CV in the system. Exactly two things are blocked —
flipping that flag, and `npm run db:purge --apply` once a candidate is due,
which refuses to run without a configured driver, by design.

### D2. Transactional email: is Resend added, or not?

*Plan's assumption: yes, Resend, in PR 8* (`PLAN-PHASE2.md` §8 Q5).

**What is being asked.** The same thing §8 Q5 asked, still unanswered. There is
still no email provider in the repo — not Resend, not nodemailer, no SMTP code
at all.

**What does not exist without it.** Four things, and the fourth is the one
that is easy to miss:

1. Email verification at registration. An address is currently a claim.
2. Password reset. There is no `/postulante/recuperar` route because one
   cannot be built. A candidate who forgets their password has no way back to
   their account, and their CV.
3. The pre-purge warning. `findCandidatesToWarn()` (`lib/db/retention.ts:74`)
   reports who is in the warning window and stops there; the comment in the
   file says why. Without email, data is purged without the notice the privacy
   policy promises.
4. `candidates.emailVerifiedAt` can never be set — so every consent row is
   attached to an unverified address. §12.2 is right that this weakens the
   evidentiary value of the consent record, which is the same asset B1 is
   protecting from the other side.

**What it costs.** Resend's free tier covers this volume. An API key, a
`lib/email.ts`, roughly one Sonnet PR. The real work is DNS — SPF and DKIM on
the domain — without which the feature exists but the mail lands in spam.

**If deferred.** Candidate accounts cannot honestly go live. Items 3 and 4 are
the difference between a missing feature and text on `/privacidad` that does
not match what the system does. Still, as §8 Q5 said, the one question that
changes PR scope.

### D3. May the app assume it runs as exactly one process?

**What is being asked.** Whether single-instance is a permanent constraint to
be written down, or an assumption the code should stop making.

**What depends on it.** More than the limiters, which is the part worth
correcting from my earlier framing. Two things:

- Both login limiters and the lead limiter are in-memory `Map`s
  (`lib/rate-limit.ts`, `lib/leads.ts:260`). Under two instances each becomes
  half as strict, silently.
- `revalidateTag`-based invalidation (`ARCHITECTURE.md` §8) is per-process
  too. Under two instances, an editor publishes, one instance expires its
  entries and the other does not — so "publish and see it immediately" becomes
  a coin flip, and an unpublished job can keep being served by the instance
  that never heard. That is the more serious half, because it touches the
  visibility predicate's whole point.

**What the options cost.** Keeping the assumption: nothing. It is true today —
Hostinger runs this app as one persistent Node process, and
`lib/rate-limit.ts` says so itself. Dropping it: the limiter moves to a table
(one table, one index, a write per login attempt, `AGENTS.md`'s no-FK rule and
`verify-cascades.ts` applying to it), and the cache needs a shared invalidation
signal, which is a larger question than the limiter and not a one-PR change.

**If deferred.** Nothing breaks — *provided the assumption is written down as
a hosting constraint rather than living in three code comments*. The failure
mode is quiet: someone scales to two instances one day and nothing logs, errors
or looks different.

**Recommendation** (the plan states no default here, but the reasons point one
way): keep the assumption, record it in `DEPLOY.md` as a rule — *do not scale
this app horizontally without first moving the limiters and the cache
invalidation* — and reopen it only when there is a reason to scale.

### D4. Ops hardening: how far?

**What is being asked.** How much outside the app itself gets built now. There
is no assumed default to fall back on: the plan has never set one, and that is
why the question belongs to the owner rather than to whoever writes the code.
§12.2 lists four gaps; a fifth belongs with them because B3 makes it relevant.

| | Item | Cost | What it buys |
|---|---|---|---|
| a | Error tracking | A service, an env var, one wiring PR | `DEPLOY.md` describes production failures as an opaque "Application error / Digest" page; today the only trace is stray `console.*` in `lib/` |
| b | MySQL backup **and one rehearsed restore** | Small — but only the restore counts | Nothing today documents a database backup; only the CV and image directories are discussed in those terms. The untested backup is the classic loss |
| c | Monitoring that `db:purge` actually ran | A scheduled check and an alert | A silently skipped month is non-compliance with the retention numbers published on `/privacidad` — invisible until someone asks |
| d | Auth audit trail beyond `lastLoginAt` | A table, or structured logs | No record of logins, failed logins or password changes; after an incident there would be nothing to read |
| e | CSP header | Small PR plus a pass over inline scripts | Second layer under B3; makes a future XSS much less useful |

**If deferred.** Nothing breaks on a good day — each of these is only visible
on a bad one. Two asymmetries are worth weighing: (b) is the only one where
deferring can become irreversible, and (d) is the only one that cannot be
applied retroactively, because it is a record that either was or was not being
kept at the time you need it.
