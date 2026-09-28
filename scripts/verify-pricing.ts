// Asserts the package-pricing rules (lib/plans.ts, /admin/precios):
//
//   npm run pricing:verify
//
// 1. A promotion really ends. activePromo() is what every public page asks
//    before printing "Gratis hasta el …"; if it kept answering after the
//    date, the site would advertise a deadline it does not keep — misleading
//    advertising, and invisible in any single page view.
// 2. The date an admin picks is a whole day in Asunción (UTC-3), not in UTC.
// 3. What /admin/precios may save is bounded, and the form and the handler
//    run the same validation.
// 4. No page carries its own price literal — every price comes from
//    lib/pricing.ts, so two pages cannot disagree about what something costs.
// 5. The pricing write is admin-only and touches no job: a price never
//    publishes or approves anything.
//
// Pure functions plus source-reading; no database, no env, no network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PLAN_PRICING,
  activePromo,
  currentPriceGs,
  dateInputFromPromoEnd,
  formatGs,
  formatPlanPrice,
  formatPrice,
  pricePerDayGs,
  promoDaysLeft,
  promoEndFromDateInput,
  publishingIsFree,
  validatePlanPricing,
  type PlanPricing,
} from '../lib/plans';

const ROOT = process.cwd();
let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!ok && detail) console.log(`        ${detail}`);
}

function read(relative: string): string {
  return readFileSync(join(ROOT, relative), 'utf8');
}

// ---------------------------------------------------------------------------
// 1. Promotions end.
// ---------------------------------------------------------------------------

const end = promoEndFromDateInput('2026-10-31')!;
const plan: PlanPricing = { key: 'basico', priceGs: 149_000, promoPriceGs: 0, promoEndsAt: end };
const before = new Date('2026-10-31T12:00:00-03:00');
const after = new Date('2026-11-01T00:00:01-03:00');

check('promotion is active before its end date', activePromo(plan, before)?.priceGs === 0);
check('promotion is NOT active after its end date', activePromo(plan, after) === null);
check('the regular price returns once it ends', currentPriceGs(plan, after) === 149_000);
check(
  'a promotion with no end date is never active',
  activePromo({ ...plan, promoEndsAt: null }, before) === null,
);
check(
  'a "promotion" not below the regular price is never shown as one',
  activePromo({ ...plan, promoPriceGs: 149_000 }, before) === null,
);
check(
  'publishingIsFree() follows the Básico promotion',
  publishingIsFree({ ...DEFAULT_PLAN_PRICING, basico: plan }, before) &&
    !publishingIsFree({ ...DEFAULT_PLAN_PRICING, basico: plan }, after),
);
check('last day counts as 1 day left, never 0', promoDaysLeft(end, new Date('2026-10-31T23:00:00-03:00')) === 1);

// ---------------------------------------------------------------------------
// 2. Dates are Asunción days.
// ---------------------------------------------------------------------------

check(
  'a promotion ending 2026-10-31 ends at 23:59:59 in Asunción (02:59:59Z next day)',
  end.toISOString() === '2026-11-01T02:59:59.000Z',
  end.toISOString(),
);
check('the admin date input round-trips', dateInputFromPromoEnd(end) === '2026-10-31');
check('a malformed date is rejected', promoEndFromDateInput('31/10/2026') === null);

// ---------------------------------------------------------------------------
// 3. What may be saved.
// ---------------------------------------------------------------------------

const now = new Date('2026-09-27T12:00:00-03:00');
check(
  'a valid free promotion passes',
  validatePlanPricing({ key: 'basico', priceGs: 149_000, promo: { priceGs: 0, endsOn: '2026-10-31' } }, now).length === 0,
);
check(
  'a promotion ending in the past is rejected',
  validatePlanPricing({ key: 'basico', priceGs: 149_000, promo: { priceGs: 0, endsOn: '2026-09-01' } }, now).length > 0,
);
check(
  'a promotional price at or above the regular one is rejected',
  validatePlanPricing({ key: 'basico', priceGs: 149_000, promo: { priceGs: 149_000, endsOn: '2026-10-31' } }, now).length > 0,
);
check(
  'a regular price of 0 is rejected (free is a promotion, with an end date)',
  validatePlanPricing({ key: 'basico', priceGs: 0, promo: null }, now).length > 0,
);
check(
  'a runaway price is rejected',
  validatePlanPricing({ key: 'empresa', priceGs: 999_999_999, promo: null }, now).length > 0,
);
check(
  'fractional guaraníes are rejected',
  validatePlanPricing({ key: 'destacado', priceGs: 349_000.5, promo: null }, now).length > 0,
);
check(
  'the launch defaults are themselves valid',
  Object.values(DEFAULT_PLAN_PRICING).every(
    (p) =>
      validatePlanPricing(
        {
          key: p.key,
          priceGs: p.priceGs,
          promo:
            p.promoPriceGs === null ? null : { priceGs: p.promoPriceGs, endsOn: dateInputFromPromoEnd(p.promoEndsAt) },
        },
        now,
      ).length === 0,
  ),
);
check(
  'Empresa is sold as a base price ("Desde"), never with a maximum',
  formatPlanPrice('empresa', 1_490_000) === 'Desde Gs. 1.490.000' && formatPlanPrice('basico', 99_000) === 'Gs. 99.000',
);
check('Gs. formatting uses the dot separator', formatGs(1_990_000) === 'Gs. 1.990.000' && formatPrice(0) === 'Gratis');
check(
  '"menos de X por día" stays true',
  Object.values(DEFAULT_PLAN_PRICING).every((p) => pricePerDayGs(p) * 30 >= p.priceGs),
);

const form = read('components/admin/PricingForm.tsx');
const route = read('app/api/admin/precios/route.ts');
check('the form runs validatePlanPricing()', form.includes('validatePlanPricing('));
check('the route handler runs validatePlanPricing()', route.includes('validatePlanPricing('));

// ---------------------------------------------------------------------------
// 4. No price literal outside lib/plans.ts.
// ---------------------------------------------------------------------------

function code(source: string): string {
  return source.replace(/(?<!:)\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// The surfaces that sell a package. (The salary filter's "Gs. 2.000.000+" in
// FilterPanel is a salary, not a price we charge, so it is not listed.)
const PRICE_SURFACES = [
  'app/page.tsx',
  'app/planes/page.tsx',
  'app/publicar/page.tsx',
  'app/publicar-gratis/page.tsx',
  'app/buscar-personal/page.tsx',
  'app/layout.tsx',
  'components/PromoTopBar.tsx',
  'components/EmployerBenefits.tsx',
  'app/terminos/page.tsx',
  'app/empresa/(dashboard)/page.tsx',
  'components/EmployerBand.tsx',
  'components/PublishPromoBanner.tsx',
  'components/empresa/PlanCard.tsx',
  'components/EmployerForm.tsx',
];
const priceLiteral = /Gs\.\s*\d|\b\d{2,3}\.000\b/;
const offenders = PRICE_SURFACES.filter((f) => priceLiteral.test(code(read(f))));
check(
  'no page that sells a package hardcodes a price',
  offenders.length === 0,
  `found in: ${offenders.join(', ')} — read the price from lib/pricing.ts instead`,
);

// ---------------------------------------------------------------------------
// 4b. The promotion's landing page and site-wide bar exist only while it runs,
//     and the value copy makes no promise about candidate volume (D1).
// ---------------------------------------------------------------------------

const landing = code(read('app/publicar-gratis/page.tsx'));
check(
  '/publicar-gratis says there is no promotion, and the price, once it is over',
  landing.includes('Hoy no hay una promoción activa') &&
    /cuesta \{regular\} por 30/.test(landing) &&
    !landing.includes('redirect('),
);
check(
  '/publicar-gratis posts through the same moderated form as /publicar',
  landing.includes('<EmployerForm') && !landing.includes('fetch('),
);
const topBar = code(read('components/PromoTopBar.tsx'));
check(
  'PromoTopBar re-checks the end date in the browser (static pages bake the layout)',
  /Date\.now\(\)\s*>=\s*new Date\(endsAt\)/.test(topBar),
);
const valueCopy = [
  'app/publicar-gratis/page.tsx',
  'app/buscar-personal/page.tsx',
  'components/EmployerBenefits.tsx',
  'app/planes/page.tsx',
]
  .filter((f) => /más (postulantes|candidatos)|miles de|en minutos|garantiz/i.test(code(read(f))));
check(
  'the value copy promises no candidate volume or speed (PLAN-GROWTH.md §7 D1)',
  valueCopy.length === 0,
  `found in: ${valueCopy.join(', ')}`,
);

// ---------------------------------------------------------------------------
// 5. Admin-only, and no job is touched.
// ---------------------------------------------------------------------------

check("the pricing write requires the 'admin' role", /requireRole\(user,\s*\['admin'\]\)/.test(route));
check(
  'the admin page requires the admin role too',
  /requireSessionWithRole\(\['admin'\]\)/.test(read('app/admin/(dashboard)/precios/page.tsx')),
);
const writer = code(read('lib/db/plan-prices.ts'));
check(
  'the pricing write never touches jobs (a price never publishes)',
  !/\bjobs\b/.test(writer) &&
    !/from '@\/lib\/db\/(admin|employer)'/.test(route) &&
    !/'published'/.test(code(route)),
);
check('a save invalidates the pricing cache', route.includes('invalidatePricing()'));

console.log(failures === 0 ? '\nAll pricing checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
