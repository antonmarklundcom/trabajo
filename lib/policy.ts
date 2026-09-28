// The consent/ToS/privacy policy version stamped onto every `consents` row.
//
// Bump this whenever the Spanish consent, ToS or privacy copy changes
// materially (PLAN-PHASE2.md §7 item 13) — never silently. Every consents
// row records the version that was in effect when it was granted, so "what
// did this person agree to, and when" stays answerable after later edits.
//
// PR 6 landed the employer terms/privacy copy (/terminos §4-5, /privacidad
// §5-6). PR 11 adds the candidate-facing privacy sections (/privacidad §7-9:
// retention periods, ARCO rights, private-by-default statement) — bumped
// again per the file-level note above. The job-alerts section (/privacidad §10)
// bumped it once more, before JOB_ALERTS_ENABLED is switched on. /terminos §7
// (package prices and time-limited promotions) bumped it again.
export const POLICY_VERSION = '2026-09-27-pricing-v1';
