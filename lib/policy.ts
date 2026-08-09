// The consent/ToS/privacy policy version stamped onto every `consents` row.
//
// Bump this whenever the Spanish consent, ToS or privacy copy changes
// materially (PLAN-PHASE2.md §7 item 13) — never silently. Every consents
// row records the version that was in effect when it was granted, so "what
// did this person agree to, and when" stays answerable after later edits.
//
// The employer terms/privacy copy itself lands in PR 6 alongside the
// EMPLOYER_DASHBOARD_ENABLED flip, so this initial value is a placeholder
// that PR 6 bumps once real copy exists — the column is NOT NULL and the
// activation flow has to write something before then.
export const POLICY_VERSION = '2026-08-09-pre-copy';
