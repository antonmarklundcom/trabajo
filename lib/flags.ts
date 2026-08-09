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
