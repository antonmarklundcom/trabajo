// Feature flags for the Phase 2 route trees (PLAN-PHASE2.md §6).
//
// Why these exist: merging to `main` is a production deploy and there is no
// staging (DEPLOY.md). The employer dashboard and the candidate account area
// each take several PRs to become coherent, and half of a consent flow reaching
// real users is worse than no consent flow. The flags let each PR merge — and
// therefore be reviewed and deployed in a small diff — while the surface stays
// dark until its legal copy has landed and the owner has flipped the variable
// in hPanel.
//
// Read server-side only, at request time, and never through NEXT_PUBLIC_*: a
// client-visible flag is a hint to the browser, not a gate. The route-tree
// layouts call notFound() when a flag is off, so a disabled tree is
// indistinguishable from a route that does not exist.
//
// Default is OFF for both. An unset variable in hPanel must never mean "on" —
// that would make forgetting to configure something the same as choosing to
// enable it.
import 'server-only';

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

/** /empresa/* — employer dashboard. Ships dark; flipped on in PR 6. */
export function employerDashboardEnabled(): boolean {
  return isEnabled(process.env.EMPLOYER_DASHBOARD_ENABLED);
}

/** /postulante/* — candidate accounts. Ships dark; flipped on in PR 11. */
export function candidateAccountsEnabled(): boolean {
  return isEnabled(process.env.CANDIDATE_ACCOUNTS_ENABLED);
}

/**
 * /empresa/registro — self-serve employer signup (PLAN-PHASE2.md §8 Q2).
 *
 * A SECOND flag rather than a widening of the first, because they answer
 * different questions. EMPLOYER_DASHBOARD_ENABLED asks "may invited employers
 * use their panel"; this one asks "may a stranger create an account". Q2's
 * recommendation was to keep invitations only for at least the first year, and
 * the owner reopened it — so the surface ships dark and turning it on stays a
 * decision someone makes in hPanel on a date, not a side effect of a merge.
 *
 * Subordinate to the dashboard flag by construction: the route lives under
 * /empresa/*, whose layout 404s the whole tree when the dashboard is off. A
 * signup that could create accounts for a panel nobody can open would be a
 * trap, so the AND is structural rather than a second condition to remember.
 */
export function employerSignupEnabled(): boolean {
  return isEnabled(process.env.EMPLOYER_SIGNUP_ENABLED);
}

/**
 * Whether the PagoPar checkout may be offered at all (PLAN-PAGOPAR.md §5).
 *
 * Unlike the three flags above, this one is DERIVED from the credentials being
 * present rather than read from a switch of its own. There is no useful state
 * where the keys exist and checkout is off: a separate boolean would only add a
 * way to half-configure it, and "the keys are set but I forgot the flag" and
 * "the keys are not set" would look identical from the outside.
 *
 * What false must mean, per §5 — and it is NOT a broken checkout:
 *
 *   - no "Pagar en línea" button is RENDERED anywhere (a server-side check,
 *     never CSS or a disabled attribute);
 *   - /planes and components/empresa/PlanCard.tsx keep exactly today's
 *     WhatsApp CTA;
 *   - the webhook route, when it exists, returns 404 rather than 500;
 *   - every part of the manual sale (PLAN-PAGOPAR.md §1) keeps working.
 *
 * A half-configured deploy must look like today's site, not like a payment page
 * that fails after the customer has committed.
 *
 * Both keys, not either: a request signed with a public key whose private
 * counterpart is missing cannot be verified when it comes back.
 */
export function pagoparConfigured(): boolean {
  return isPresent(process.env.PAGOPAR_PUBLIC_KEY) && isPresent(process.env.PAGOPAR_PRIVATE_KEY);
}

/** Set-but-blank is unset. hPanel stores an emptied field as an empty string. */
function isPresent(value: string | undefined): boolean {
  return (value ?? '').trim().length > 0;
}
