# trabajo.com.py — Frontend

Portal de empleos para Paraguay. Next.js 16 (App Router) + TypeScript + Tailwind CSS v4.

---

## Arquitectura: Seed-first, WordPress-ready

### La seam (el principio más importante)

Todo el flujo de datos pasa por un único módulo: `lib/data.ts`. Ninguna página, componente ni ruta API lee directamente de los archivos JSON ni llama a WordPress. Todas llaman funciones de `lib/data.ts`.

```
páginas / componentes / rutas API
         ↓
      lib/data.ts   ← EL ÚNICO PUNTO DE ENTRADA
         ↓
  [Phase 1]  lib/seed/*.json
  [Phase 2]  lib/wp.ts → WordPress + JetEngine
```

El switch entre fases es una variable de entorno:
- `USE_WP_BACKEND=false` → lee seed JSON (Phase 1, default)
- `USE_WP_BACKEND=true` → llama a `lib/wp.ts` → WordPress (Phase 2)

Cambiar de fase **no requiere tocar ninguna página, componente ni ruta API**.

---

## Cómo agregar o editar un empleo (Phase 1)

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

## El switch Phase 2 — paso a paso

Cuando WordPress + JetEngine estén listos en `panel.trabajo.com.py`:

1. Confirmá los endpoints (CPT `/wp-json/wp/v2/empleos` o CCT `/wp-json/jet-cct/v1/empleos`)
2. Confirmá los nombres de cada campo meta en el editor de JetEngine
3. Completá `mapWpJobToJob` en `lib/wp.ts` con los nombres reales (marcados con `// TODO`)
4. Completá `getCategories()` y `getCities()` en `lib/wp.ts`
5. En Hostinger, configurá:
   - `WP_API_URL=https://panel.trabajo.com.py`
   - `USE_WP_BACKEND=true`
6. Redesplegá (o hacé push a `main`)

**No se toca ninguna página, componente ni ruta API.** Solo `lib/wp.ts` + las dos variables de entorno.

---

## Variables de entorno

Copiá `.env.example` a `.env.local` para desarrollo local.

### Mínimo para que el sitio funcione (Phase 1)

```env
NEXT_PUBLIC_SITE_URL=https://trabajo.com.py
NEXT_PUBLIC_WHATSAPP_LEADS=595XXXXXXXXX
NEXT_PUBLIC_BUSINESS_NAME=trabajo.com.py
USE_WP_BACKEND=false
```

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
- **Datos (Phase 1):** archivos JSON locales en `lib/seed/`
- **Datos (Phase 2):** WordPress + JetEngine REST API via `lib/wp.ts`

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
```

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
