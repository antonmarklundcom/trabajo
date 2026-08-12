# Phase 3 — blogg + sparade jobb

> Status: **beslutad och till största delen byggd**. Skrivet av Sonnet som
> utkast, granskat och avgjort av Opus 2026-08-10. §1 (sparade jobb) är byggt
> och mergat som PR 15 (`1e49e5d`, PR #37); efterkontrollen och rättningarna
> ligger i PR 15b (§6), mergad som #38. §2 (bloggen) är beslutad och byggd som
> PR 16 (Väg A, #39); efterkontrollen ligger i §8. Bygg-briefen för PR 16 står
> kvar oredigerad i §7.
>
> §2:s öppna frågor besvaras i §5, §1:s i §6. De ursprungliga
> formuleringarna står kvar oredigerade, så att beslutet går att läsa mot det
> som faktiskt frågades.
>
> **Tillägg 2026-08-12:** §9 löser upp motsägelsen mellan `PLAN-IMAGES.md`:s
> "PR 20 (blog images)" och Väg A-beslutet i §5.1; §10 är bygg-briefen för PR 20
> som den omdefinieras där. `PLAN-IMAGES.md` är rättad att matcha.
>
> **Befordrad 2026-08-12** från `PLAN-PHASE3-DRAFT.md` till det här namnet, som
> en del av planrevisionen i §11. Filen hette "DRAFT" medan varje öppen fråga i
> den redan var avgjord och fyra av dess fem PR:ar var mergade; namnet var det
> enda som fortfarande sa utkast. §11 är revisionen av plan mot `main`, §12 är
> beslutet om blogg-publicering från `/admin` — den lucka som `content/blog/README.md`
> beskriver men som inget plandokument hittills ägde.
>
> Språknot: dokumentet är på svenska medan `AGENTS.md` säger att dokumentation
> är engelsk. Det behålls som det är — §5, §6, §8 och §9 är avgjorda resonemang
> där en översättning riskerar att tappa nyanser som faktiskt bär beslut, och
> vinsten av enhetligt språk är mindre än den risken. Nya avsnitt (§11, §12)
> följer samma språk som resten av filen så att dokumentet inte blir tvåspråkigt
> mitt i.

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
| 15b | Efterkontroll batch J: no-FK-beslutet + `cascade:verify` | Opus | **Mergat** (`3ce0bcc`, PR #38 — se §6) |
| 16 | Blogg Väg A: `lib/blog.ts`, `/blog`, `/blog/[slug]`, sitemap, OG, JSON-LD | Sonnet | **Mergat** (`4f28183`, PR #39 — batch K, se §8) |
| 16b | Efterkontroll batch K: escapad rå HTML, bundna blogg-slugs | Opus | **Mergat** (`22745b9`, PR #41 — se §8) |
| 17 | Blogg: de tre första artiklarna som innehåll (bara `content/blog/*.md`) | Sonnet | **Mergat** (`66a9545`, PR #48) |
| 20 | Blogg-omslagsbilder som commitade assets (ingen uppladdning, ingen `lib/image-storage.ts`) | Sonnet | **Nästa att bygga.** Beslut i §9, brief i §10. Se §11.2 |
| 22 | Blogg Väg B, steg 1: `blog_posts`-schema + `lib/db/blog.ts` | **Opus** | **Villkorad** — bygg inte förrän ett villkor i §5.1 är uppfyllt (§12) |
| 23 | Blogg Väg B, steg 2: admin-CRUD + omslagsuppladdning via `lib/image-storage.ts` | Sonnet | Villkorad, efter 22 (§12) |
| 24 | Blogg Väg B, steg 3: import av `content/blog/*.md`, cutover, borttagning av filvägen | **Opus** | Villkorad, efter 23 (§12) |

> Numreringsnot (2026-08-12, andra): raden som tidigare stod som "(villkorad, ej
> numrerad)" har fått nummer — 22, 23 och 24 — i §12, som scopar den. Att den
> är numrerad betyder **inte** att den är godkänd att bygga; villkoren i §5.1
> gäller oförändrat och §12.6 är grinden. Numren är tilldelade nu bara för att
> `PLAN-IMAGES.md` äger 19–21 och nästa lediga nummer annars skulle behöva
> gissas av den session som en dag utlöser villkoret.

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

## 11. Planrevision mot `main` (Opus, 2026-08-12)

En genomgång av vad plandokumenten påstår mot vad som faktiskt ligger i `main`
(`ce53893`). Anledningen till att den behövdes: fem PR:ar mergades på två dagar
över tre plandokument som refererar varandra, och statusraderna uppdaterades
inte i takt med det.

### 11.1 `PLAN-PHASE2.md`: allt är byggt, och dokumentet säger det ingenstans

PR 1–14 är mergade, samtliga: #20–#23 (PR 1–3 plus PR 5:s scope-beslut), #24 och
#25 (PR 4–5), #26–#33 (PR 6–13, i den ordning batcherna kördes), #35 (PR 14:s
dokumentationsdel) och #36 (PR 14b, upcoming-purge i `/admin`). §9:s föreslagna
tillägg till `AGENTS.md` ligger också inne, alla sex.

Bristen är inte att något saknas utan att **§6:s tabeller inte har någon
statuskolumn alls**. En läsare kan inte se att hela dokumentet är avklarat utan
att köra `git log` mot det, vilket är precis det arbete den här revisionen
gjorde. Rättat: §6 har nu en statuskolumn per PR och en rubrik som säger att
fasen är stängd.

### 11.2 PR 20 är beslutad men inte byggd

Det här är revisionens enda faktiska avvikelse mellan plan och kod, och den är
lätt att missläsa åt fel håll:

- **#47 (`4db58ff`) mergade beslutet, inte bygget.** Den PR:en skrev §9 och §10
  i det här dokumentet, rättade `PLAN-IMAGES.md` att sluta räkna bloggen som en
  konsument av bildpipelinen, och märkte om `blog`-namespacet i
  `lib/image-storage.ts` som reserverat. Ren dokumentation plus en kodkommentar.
- **Bygg-briefen i §10 är orörd.** Verifierat i koden, inte antaget:
  `frontmatterSchema` i `lib/blog.ts` har varken `coverImage` eller `coverAlt`,
  `blogCoverUrl()` finns inte, `public/blog-covers/` finns inte, och
  `scripts/verify-blog.ts` har ingen av §10.5:s sex assertions.

PR 20 är alltså **nästa obyggda PR i hela projektet**, och den är fullt scopad
sedan #47. §3:s statusrad säger det nu rakt ut.

### 11.3 Statusrader som låg efter

Rättade i §3, listade här så att rättelsen går att kontrollera:

| Rad | Sa | Är |
|---|---|---|
| PR 15b | "Byggd, väntar på merge" | Mergad som #38 (`3ce0bcc`) |
| PR 17 | "Efter 16" | Mergad som #48 (`66a9545`) |
| PR 16b | fanns inte som rad | Mergad som #41 (`22745b9`) — §8:s egen efterkontroll |

Samma sak i `PLAN-IMAGES.md`: bilddefekt-PR:arna **#44** (escapad rå HTML i
jobbeskrivningar), **#45** (logotyp-uppladdningens ordning, cache-bustning,
knappvillkor) och **#46** (statuskod-drift och alt-text i jobbgalleriet) fanns
inte i något plandokument. De är efterkontroller av PR 19 och 21 i samma anda
som §6 och §8 är av PR 15 och 16, och `PLAN-IMAGES.md` har nu en rad för dem.

### 11.4 Luckor som inget dokument ägde

Tre saker som revisionen hittade och som inte är statusbokföring:

1. **`PLAN-PHASE2.md` Q5 (transaktionell e-post) besvarades aldrig, och PR 8
   byggdes utan den.** Det finns ingen `lib/email.ts`, inget e-postberoende i
   `package.json` och ingen route för lösenordsåterställning någonstans i
   `app/`. Två konsekvenser som båda står i planen som förutsatta: en kandidat
   som glömmer sitt lösenord har **ingen återställningsväg alls**, och
   §4.3:s varning 23 månader före purge kan inte skickas. Ytan är idag mörk
   bakom `CANDIDATE_ACCOUNTS_ENABLED=false`, vilket är varför det inte har
   märkts — men flaggan kan inte flippas förrän det är löst, och den kopplingen
   fanns inte skriven någonstans. Registrerad i `PLAN-PHASE2.md` §8 Q5 som en
   blockerare för flaggan, inte som en öppen fråga.
2. **`ARCHITECTURE.md` har noll täckning av Phase 3.** Den uppdaterades för
   Phase 2 i PR 14 och inte sedan dess: varken `saved_jobs`, bloggen eller den
   delade bildpipelinen nämns i den. Den är listad i `AGENTS.md` som
   backend-designen att läsa före kodning, så en session som läser den får en
   bild av schemat som saknar tre tabeller.
3. **`AGENTS.md`:s dokumenttabell listade inte det här dokumentet**, trots att
   det är det som styr allt pågående arbete. Rättat i samma PR som den här
   sektionen.

Punkt 2 är inte åtgärdad här — den är en egen liten dokumentations-PR och den
har inget att göra med bloggluckan §12 löser. Den ligger som **PR 21d** i
`PLAN-IMAGES.md` §6.1, tillsammans med de tre efterkontroll-PR:ar som punkt
11.3 hittade.

---

## 12. Beslut: publicera och redigera blogginlägg från `/admin` (Opus, 2026-08-12)

### 12.1 Luckan

`content/blog/README.md` avslutas med "There is no database or admin panel —
content ships via Git." Det är korrekt beskrivet och det var ett medvetet val
(§5.1). Men det är också den enda innehållsytan på sajten som inte går att
redigera från `/admin`, och inget plandokument ägde frågan om när det ska
ändras — §5.1 satte villkoren men scopade aldrig vad som faktiskt ska byggas
den dagen. Den här sektionen är det scopet.

### 12.2 Två vägar övervägdes. Den ena förkastas, inte skjuts upp.

**Förkastad: behåll Markdown i git och lägg ett admin-UI som committar filer via
GitHub API.** Den låter billig — ingen tabell, inget migreringsarbete, samma
läsväg — och den är den sämre av de två på varje axel som betyder något:

1. **Den gör admin-panelen till en RCE-yta.** Ett API som kan committa till det
   här repot behöver en token med push-rättighet, lagrad i appens env på delad
   hosting. Merge till `main` är en produktionsdeploy (`DEPLOY.md`). Alltså:
   den som tar över en admin-session, eller hittar en CSRF i ett formulär i
   `/admin`, kan committa godtycklig kod som deployas automatiskt. Idag är
   värsta utfallet av en kapad admin-session att någon redigerar rader i en
   databas. Det är en kategoriskillnad, och den går åt fel håll.
2. **Publiceringen blir asynkron och kan misslyckas efter att den bekräftats.**
   Skribenten klickar "publicera", commiten går igenom, UI:t säger klart — och
   sedan fäller CI artikeln på en assertion (§10.5:s bildregler är precis den
   sortens kontroll). Artikeln syns aldrig, och felet dyker upp i en
   CI-logg som ingen skribent läser. Ett formulär som validerar innan det
   sparar har inte det problemet.
3. **Varje rättstavning blir en deploy.** Det är minuter, inte sekunder, och det
   är dessutom exakt villkor 3 i §5.1 — "artiklar behöver redigeras oftare än de
   skrivs" — som denna väg gör värre i stället för att lösa.
4. **Den löser inte villkor 1.** En skribent som inte är ägaren skulle publicera
   genom en token som tillhör någon annan, utan granskningssteget som är hela
   poängen med git-flödet. Man får git-flödets kostnader utan dess kontroll.

**Vald: Väg B — `blog_posts` i databasen med admin-CRUD**, exakt den väg §5.1
redan pekade ut, byggd när §5.1:s villkor utlöses. Det är den enda av de två som
faktiskt gör det luckan handlar om: redigera utan deploy, publicera utan
push-rättighet, och ge en skribent som inte är ägaren en yta med rollkontroll i
stället för en delad token.

### 12.3 Villkoret står kvar. Det är inte uppfyllt idag.

Att luckan nu är scopad ändrar inte §5.1: Väg B byggs när **ett** av dessa är
sant, inte tidigare.

1. Någon som inte är ägaren, och inte arbetar genom en Claude-session, ska kunna
   publicera utan att be någon annan.
2. Publiceringstakten går över ungefär två artiklar i veckan.
3. Artiklar behöver redigeras oftare än de skrivs.

Med tre publicerade artiklar och en skribent är inget av det sant. §12.2 säger
vad som byggs; det här säger när. Att blanda ihop de två är hur en villkorad
uppgradering blir en planerad.

### 12.4 Vad Väg B kostar, uttryckligen, så att det inte upptäcks mitt i bygget

Två saker som Väg A ger gratis och som Väg B tar bort. Ingen av dem är ett skäl
att inte bygga den, men båda är sådant som annars upptäcks av den session som
sitter med en trasig CI-build:

- **Bloggen slutar renderas i `DATA_SOURCE=seed`.** Det finns ingen
  seed-representation av artiklar och det ska inte byggas en (`ARCHITECTURE.md`
  §3:s söm är definierad kring den publika jobbkatalogen). Seed-läget behåller
  alltså sajten men inte bloggen.
- **`generateStaticParams` över artiklar kan inte vara kvar.** CI kör
  `npm run build` utan databas. Artikelsidan måste därför bli
  `revalidate`-cachad i stället för statiskt genererad, med samma
  `unstable_cache` + tag-mönster som jobbkatalogen (`lib/cache-tags.ts`), och en
  egen cache-tag som admin-skrivningar invaliderar. Det är PR 22:s arbete, inte
  något PR 23 upptäcker.

### 12.5 Designen, mot `AGENTS.md` som den är skriven

Det här är det som gör scopet kontrollerbart innan det byggs. Varje punkt är en
regel i `AGENTS.md` och hur Väg B möter den:

- **Inga FK-constraints.** `blog_posts` får rena int-kolumner. Den pekar på
  `users` genom `created_by_user_id` / `updated_by_user_id`, som är
  **revisionsstämplar och medvetet får dangla** — en borttagen redaktör ska inte
  ta sina artiklar med sig, och en artikel utan författare är fortfarande en
  publicerad SEO-URL. De registreras därför i `DELIBERATE_ORPHANS` i
  `scripts/verify-cascades.ts`, inte i `DEPENDENCIES`, i samma form som
  `deletionRequests` redan står där. Det är ett beslut som ska stå skrivet, inte
  en utelämnad rad.
- **Publika läsningar går genom en enda synlighetspredikat.** `lib/db/queries.ts`
  äger jobbkatalogens predikat; bloggen är inte jobbkatalogen, så den får sitt
  eget i `lib/db/blog.ts` — `published = true AND published_at <= now()` — som
  **en** exporterad predikatfunktion som varje publik läsning använder. Samma
  konstruktion, samma skäl: en glömd `WHERE` publicerar ett utkast.
- **`lib/blog.ts` förblir enda läsvägen för sidorna.** Det var hela poängen med
  §7.2. Sidor och komponenter ändras inte i PR 24; det som byts ut är vad
  `lib/blog.ts` läser ifrån. Om en blogg-PR någonsin importerar `lib/db/blog`
  direkt från en sida är den fel.
- **Serversidig auktorisering i varje muterande handler.** `/api/admin/blog/*`
  börjar med `requireSessionWithRole(['admin','editor'])`. `editor` **ska** ha
  bloggen — det är innehållskuration, inte kandidatdata, och `AGENTS.md`:s
  narrowing gäller uttryckligen bara kandidatdata.
- **Omslagsbilder blir uppladdningar och går genom `lib/image-storage.ts`.** Det
  här är den punkt där §9.2:s resonemang vänder: under Väg A produceras bytesen
  av en commit från den som redan kan deploya, under Väg B av en inloggad
  redaktör vid runtime. Då finns det en främling igen, och då är pipelinen rätt
  svar — vilket är exakt varför `blog`-namespacet reserverades i §9.3 i stället
  för att tas bort. Databasen lagrar **nyckeln**, aldrig URL:en
  (`PLAN-IMAGES.md` §2.1), och nyckeln mintas av `buildImageKey()` och härleds
  aldrig ur filnamn eller artikel-id.
- **Slugs är live SEO-URL:er.** Den vassaste nya kanten: ett formulär gör det
  trivialt att byta URL på en indexerad artikel. Regeln blir att **slugen är
  oföränderlig när artikeln en gång publicerats** — samma disciplin som
  arbetsgivare inte får redigera jobb-slugs (`PLAN-PHASE2.md` PR 5). Ett byte
  kräver en 301, och en 301-tabell är en egen utökning, inte något som smygs in
  i ett redigeringsformulär.
- **Rå HTML i artikeltext.** Escapningen i `lib/blog.ts` slutar vara hygien och
  blir en säkerhetskontroll den dag texten kommer från en databas och en
  icke-ägare kan skriva den — vilket §8.1 förutsåg och är skälet till att den
  finns. `blog:verify` måste behålla sin assertion och PR 22 måste inte röra
  renderaren.
- **Ingen kandidat- eller ansökningsdata.** §5.4:s förbud gäller oförändrat:
  ingen "populärt bland sökande"-widget, ingen ansökningsstatistik. En
  admin-vy över bloggen läser `blog_posts` och ingenting annat.

### 12.6 PR-uppdelning och modelltier

Tre PR:ar, sekventiellt, samma disciplin som §6.2 i `PLAN-PHASE2.md` — skapa PR,
CI grön, merga, dra `main`, nästa.

| PR | Innehåll | Modell |
|---|---|---|
| **22** | `blog_posts`-schema (en migrering), `lib/db/blog.ts` med synlighetspredikatet, cache-tag + invalidering, `DELIBERATE_ORPHANS`-posten i `verify-cascades.ts`. Sidorna byggs om från `generateStaticParams` till `revalidate`-cachning (§12.4). **Ingen UI, ingen beteendeändring — `lib/blog.ts` läser fortfarande filer.** | **Opus** |
| **23** | `/admin/blog` CRUD: lista, skapa, redigera, publicera/avpublicera, omslagsuppladdning via `lib/image-storage.ts` med `blog`-namespacet, `/api/admin/blog/*` med rollkontroll. Spanska (PY). Skriver till tabellen; publika sidor läser fortfarande filer. | Sonnet |
| **24** | Cutover: `scripts/blog-import.ts` (idempotent på slug) importerar `content/blog/*.md`, `lib/blog.ts` byter läskälla till `lib/db/blog.ts`, `.md`-filerna tas bort, `content/blog/README.md` ersätts av admin-dokumentation, `scripts/verify-blog.ts` byter från filassertions till DB-form. | **Opus** |

*Varför Opus på 22 och 24:* PR 22 är där synlighetspredikatet och
no-FK-konventionen blir kolumner — ett missat predikat publicerar utkast, och
en felregistrerad cascade upptäcks först när en användare raderas. PR 24 är en
cutover av **live, indexerade URL:er**: en artikel som tappar sin slug mellan
filen och raden är en 404 på en sida Google redan har. Ingen av dem är mekaniskt
arbete mot en färdig spec, vilket är gränsen `PLAN.md` §4 drar. PR 23 är
formulär och CRUD mot ett schema som redan finns, alltså Sonnet.

Att PR 23 skriver till en tabell som ingen läser publikt är avsiktligt: det gör
att admin-UI:t kan mergas, deployas och provas mot riktig data medan bloggen
fortfarande serveras från filer, så att PR 24 är en cutover med känd datamängd i
stället för ett bygge och en cutover samtidigt.

### 12.7 Frågor som måste besvaras innan PR 22 skrivs

Schemabeslut är dyra att ångra när det finns rader. Två är verkligt öppna:

1. **Var ligger artikeltexten — Markdown eller rich text?** *Föreslaget:
   Markdown i en `text`-kolumn, renderad av samma `marked`-konfiguration som
   idag.* Det gör PR 24:s import till en kopiering i stället för en konvertering
   och behåller escapningen i §8.1. En WYSIWYG som producerar HTML skulle göra
   saneringsfrågan verklig på ett sätt Markdown inte gör.
2. **Behålls `category` som enum i schemat, eller blir det en tabell?**
   *Föreslaget: enum, samma tre värden som `frontmatterSchema` har idag.* §5.3
   beslutade en sluten lista på tre; en tabell är bara motiverad när
   kategorisidor byggs, och de är i sin tur gated på fem artiklar över två
   kategorier.

Båda är förslag, inte beslut, och båda ska bekräftas av ägaren innan migreringen
skrivs — inte efter, eftersom en `ALTER` på en tabell med publicerade artiklar
är en produktionsdeploy mot live SEO-URL:er.
