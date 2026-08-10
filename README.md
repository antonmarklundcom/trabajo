# trabajo.com.py — Frontend

Portal de empleos para Paraguay. Next.js 16 (App Router) + TypeScript + Tailwind CSS v4.

> Backend propio (MySQL + Drizzle) dentro de este mismo repo, con panel de
> administración en `/admin`. El diseño está en **`ARCHITECTURE.md`**, el plan
> por fases en **`PLAN.md`**, la migración WordPress → MySQL (histórica) en
> **`MIGRATION.md`** y el deploy en **`DEPLOY.md`**.

---

## Arquitectura: la seam

### El principio más importante

Todo el flujo de datos pasa por un único módulo: `lib/data.ts`. Ninguna página, componente ni ruta API lee directamente de los archivos JSON ni de la base de datos. Todas llaman funciones de `lib/data.ts`.

```
páginas / componentes / rutas API
         ↓
      lib/data.ts   ← EL ÚNICO PUNTO DE ENTRADA
         ↓
  lib/seed/*.json          (DATA_SOURCE=seed, default)
  lib/db/queries.ts → MySQL (DATA_SOURCE=db)
```

El switch es la variable de entorno `DATA_SOURCE`. Cambiarla **no requiere
tocar ninguna página, componente ni ruta API**.

El panel `/admin` (jobs, empresas, usuarios, postulaciones) siempre escribe a
la base de datos MySQL directamente, sin pasar por este switch — ver
`ARCHITECTURE.md` §3/§9.

---

## Cómo agregar o editar un empleo

**Vía `/admin`** (recomendado, requiere `DATA_SOURCE=db`): iniciá sesión en
`/admin/login` y usá `/admin/empleos`.

**Vía seed JSON** (`DATA_SOURCE=seed`, desarrollo/demo):

1. Abrí `lib/seed/jobs.json`
2. Agregá o editá el objeto del empleo (ver campos abajo)
3. Hacé commit y mergeá a `main`
4. Hostinger redespliega automáticamente en 3–5 minutos

### Campos de un empleo (jobs.json)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `slug` | string | URL única del empleo (kebab-case, sin tildes) |
| `title` | string | Título del puesto |
| `company` | string | Nombre de la empresa |
| `companyLogo` | string \| null | Ruta de logo en `/public/logos/` o `null` para placeholder |
| `categorySlug` | string | Slug de categoría de `categories.json` |
| `citySlug` | string | Slug de ciudad de `cities.json` |
| `contractType` | enum | `tiempo_completo` \| `medio_tiempo` \| `temporal` \| `pasantia` \| `freelance` |
| `seniority` | enum | `sin_experiencia` \| `junior` \| `semi_senior` \| `senior` |
| `modality` | enum | `presencial` \| `remoto` \| `hibrido` |
| `salaryMin` | number \| null | Salario mínimo en Guaraníes |
| `salaryMax` | number \| null | Salario máximo en Guaraníes |
| `salaryHidden` | boolean | `true` → muestra "A convenir" en lugar del rango |
| `description` | string | Descripción en markdown (`**negrita**`, `- listas`, `## subtítulos`) |
| `whatsapp` | string \| null | Número E.164 sin `+` (ej: `595971234567`) para el botón de WhatsApp |
| `featuredUntil` | string \| null | Fecha ISO hasta la que el empleo aparece como destacado |
| `postedAt` | string | Fecha ISO de publicación |
| `updatedAt` | string | Fecha ISO de última actualización |

**Ejemplo mínimo:**
```json
{
  "slug": "vendedor-zona-norte",
  "title": "Vendedor/a Zona Norte",
  "company": "Mi Empresa SA",
  "companyLogo": null,
  "categorySlug": "ventas",
  "citySlug": "asuncion",
  "contractType": "tiempo_completo",
  "seniority": "junior",
  "modality": "presencial",
  "salaryMin": 2500000,
  "salaryMax": 3500000,
  "salaryHidden": false,
  "description": "Buscamos **Vendedor/a** con ganas de crecer.\n\n**Requisitos:**\n- Buena presencia\n- Disponibilidad full-time",
  "whatsapp": "595971234567",
  "featuredUntil": null,
  "postedAt": "2026-06-14T08:00:00Z",
  "updatedAt": "2026-06-14T08:00:00Z"
}
```

---

## Variables de entorno

Copiá `.env.example` a `.env.local` para desarrollo local.

### Mínimo para que el sitio funcione (seed)

```env
NEXT_PUBLIC_SITE_URL=https://trabajo.com.py
NEXT_PUBLIC_WHATSAPP_LEADS=595XXXXXXXXX
NEXT_PUBLIC_BUSINESS_NAME=trabajo.com.py
DATA_SOURCE=seed
```

### Backend MySQL + panel `/admin`

Ver `DEPLOY.md` y `MIGRATION.md` para provisionar la base y correr el
cutover. Variables relevantes: `DATA_SOURCE=db`, `DATABASE_URL`,
`SESSION_SECRET` (ver `.env.example`).

### Almacenamiento de CVs

Requerido cuando `CANDIDATE_ACCOUNTS_ENABLED=true`. `CV_STORAGE_DRIVER=r2`
(Cloudflare R2, bucket privado) o `CV_STORAGE_DRIVER=disk` (`CV_STORAGE_DIR`,
ruta absoluta fuera del build root). No hay valor por defecto. Detalles y
trampas en `DEPLOY.md`; las variables de cada driver están en `.env.example`.

Los CVs nunca tienen URL pública: se descargan por
`/api/postulante/cv/[id]`, `/api/empresa/cv/[applicationId]` o
`/api/admin/cv/[id]`, cada uno con su propia autorización.

### Almacenamiento de imágenes públicas

Requerido cuando alguna función que sube imágenes esté activa (logos de
empresa, imágenes del blog, imágenes de avisos). `IMAGE_STORAGE_DRIVER=disk`
(recomendado — `IMAGE_STORAGE_DIR`, ruta absoluta fuera del build root) o
`IMAGE_STORAGE_DRIVER=r2` (bucket público, `IMAGE_R2_PUBLIC_BASE_URL`). No hay
valor por defecto. La decisión y sus razones están en `PLAN-IMAGES.md` §2; las
variables de cada driver, en `.env.example`.

Es el almacenamiento **público**: todo lo que entra ahí se sirve sin sesión, a
propósito. No comparte directorio ni bucket con los CVs.

Toda imagen subida se valida por magic bytes (JPG, PNG, WebP — nunca SVG), se
reconvierte a WebP y se guarda con una clave generada
(`img/{logos|blog|jobs}/{uuid}.webp`); los bytes originales se descartan. Con
el driver `disk` se sirven desde `/img/...`. La base de datos guarda la
**clave**, nunca la URL.

### Analítica (opcional)

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

Con `NEXT_PUBLIC_GA_ID` seteado se carga Google Analytics 4 (page views
automáticos + eventos `lead_submit` y `whatsapp_click`). Sin la variable no se
carga ningún script de analítica.

### Loggers (opcionales — el sitio funciona sin ellos)

Los leads (postulantes + empleadores) se envían en paralelo a:
- **GHL webhook** (`GHL_WEBHOOK_URL`) — CRM GoHighLevel
- **Google Sheets** (`GOOGLE_SHEETS_WEBHOOK_URL`) — vía Apps Script o Zapier

Si estas variables están vacías, el sitio acepta las postulaciones igual. WhatsApp es el canal primario.

Para activarlos:
1. Creá el webhook en GHL → copiá la URL a `GHL_WEBHOOK_URL` en Hostinger
2. Creá un Google Apps Script que reciba POST JSON → copiá la URL a `GOOGLE_SHEETS_WEBHOOK_URL`

---

## Lead routing — campos enviados, variables de entorno, cómo configurar GHL/Sheets

Toda postulación (`/empleos/[slug]`) y solicitud de empleador (`/publicar`, `/contacto`)
se envía a `POST /api/v1/leads`. La ruta valida con zod, responde `201` de inmediato y
recién **después** (vía `after()`) hace el fan-out a los loggers. Por eso un fallo de
logger nunca falla la postulación del usuario.

### Cómo funciona

- **Validación:** zod (`leadSchema`, unión discriminada por `type`).
- **Un solo payload plano** (`buildPayload` en `lib/leads.ts`) se envía **en paralelo** a
  `GHL_WEBHOOK_URL` y `GOOGLE_SHEETS_WEBHOOK_URL` con `Promise.allSettled` y **3 reintentos
  con backoff exponencial** (1s, 2s, 4s) por destino.
- **Degradación elegante:** si una variable está vacía, ese destino se omite en silencio.
- **Un único webhook de GHL** recibe ambos tipos de lead; se distinguen por `lead_type`.
- **Leave-page-safe:** el botón de WhatsApp dispara `navigator.sendBeacon()` en el mismo
  handler que la navegación; la API parsea el JSON desde el body de texto crudo.
- Nunca se loguea nada sensible en el cliente.

### Campos enviados (claves planas, snake_case)

| Campo | Descripción |
|-------|-------------|
| `lead_type` | `"employer"` o `"seeker"` |
| `full_name` | Nombre del contacto / postulante |
| `email` | Email (opcional) |
| `phone` | Solo dígitos, E.164 cuando es posible (PY `09…` → `595…`) |
| `company_name` | Empresa (leads de empleador) |
| `job_title` | Empleador: el puesto a publicar. Postulante: el empleo al que aplicó |
| `job_slug` | Postulante: slug del empleo (si está disponible) |
| `city` | Nombre de ciudad con tildes (resuelto desde el slug) |
| `category` | Nombre de categoría con tildes (resuelto desde el slug) |
| `contract_type` | Tipo de contrato (si está disponible) |
| `message` | Mensaje / descripción del puesto |
| `source_page` | Path desde donde se envió el formulario |
| `submitted_at` | Timestamp ISO |

### Configurar GHL

1. GHL → **Automation → Workflows** → nuevo workflow con trigger **"Inbound Webhook"**.
2. Copiá la URL generada a `GHL_WEBHOOK_URL` en Hostinger.
3. Mapeá los campos planos de arriba a los campos de contacto/oportunidad en GHL.
4. Usá `lead_type` para ramificar empleadores vs. postulantes dentro del workflow.

### Configurar Google Sheets

1. Creá un **Google Apps Script** (Web App) que reciba `POST` con body JSON y haga
   `appendRow` con las claves planas, o usá un "Catch Hook" de Zapier/Make.
2. Desplegalo como Web App (acceso "cualquiera") y copiá la URL a
   `GOOGLE_SHEETS_WEBHOOK_URL` en Hostinger.

Si ambas variables quedan vacías el sitio igual acepta los leads (WhatsApp es el canal
primario).

---

## Stack técnico

- **Framework:** Next.js 16 (App Router)
- **Lenguaje:** TypeScript (strict)
- **Estilos:** Tailwind CSS v4 (tokens en `app/globals.css` via `@theme`)
- **Fuente:** Inter (self-hosted via `next/font/google`)
- **Validación:** zod
- **Datos:** `lib/seed/*.json` (default) o MySQL + Drizzle via `lib/db/queries.ts` (`DATA_SOURCE=db`) — ver `ARCHITECTURE.md`

## Rutas

```
/                             Portada: hero búsqueda, destacados, categorías, recientes
/empleos                      Listado con filtros URL-driven
/empleos/[slug]               Detalle de empleo + JSON-LD JobPosting
/trabajo/[categoria]          Landing SEO por categoría
/trabajo/[categoria]/[ciudad] Landing SEO por categoría + ciudad
/publicar                     Formulario lead para empleadores
/planes                       Planes y precios
/contacto                     Contacto
/sitemap.xml                  Generado desde datos
/robots.txt                   Allow + sitemap
/api/v1/jobs                  REST API
/api/v1/jobs/[slug]           REST API
/api/v1/categories            REST API
/api/v1/cities                REST API
/api/v1/leads                 Orchestrator (application + employer_post)
/api/publicar                 Crea empleo pending desde /publicar (additive, no reemplaza /api/v1/leads)

/admin/login                  Login (requiere DATA_SOURCE=db)
/admin                        Panel: pendientes, actividad reciente
/admin/empleos                CRUD de empleos + flujo de aprobación
/admin/empresas                CRUD de empresas
/admin/usuarios                CRUD de usuarios (solo admin)
/admin/postulaciones          Bandeja de postulaciones por empleo
/api/admin/*                  Mutaciones — todas verifican rol server-side

/api/postulante/cv            Subida de CV del postulante (magic bytes, 5 MB)
/api/postulante/cv/[id]       Descarga/borrado del propio CV
/api/empresa/cv/[applicationId]  CV de una postulación a un empleo propio
/api/admin/cv/[id]            CV para el operador — exige motivo y queda registrado

/blog                          Listado de artículos (base de datos, requiere DATA_SOURCE=db)
/blog/[slug]                   Artículo + JSON-LD BlogPosting
/admin/blog                    CRUD de artículos (editor Tiptap, requiere sesión admin/editor)
/api/admin/blog/*              Mutaciones — todas verifican rol server-side
/api/admin/blog/images         Subida de imágenes del editor (namespace `blog`, ver §Almacenamiento de imágenes)
/img/[...key]                  Sirve las imágenes públicas (driver disk)
```

El blog no tiene modo seed: `getBlogPosts()`/`getBlogPost()` devuelven vacío
sin `DATABASE_URL` (así el resto del sitio sigue compilando en modo seed), pero
`/blog` en producción siempre requiere `DATA_SOURCE=db`.

Las rutas `/empresa/*` y `/postulante/*` están detrás de
`EMPLOYER_DASHBOARD_ENABLED` / `CANDIDATE_ACCOUNTS_ENABLED`: con la flag
apagada devuelven 404.

## Desarrollo local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Deploy (Hostinger Node.js Web App)

1. hPanel → Websites → Add Website → Node.js Apps → Import Git Repository
2. Branch: `main` | Node version: 22.x
3. Build command: `npm run build` | Start command: `npm start`
4. Configurá las variables de entorno (bloque "Mínimo" del `.env.example`)
5. Attach domain: `trabajo.com.py` + `www.trabajo.com.py`

Push a `main` → Hostinger redespliega automáticamente (~3–5 min).
