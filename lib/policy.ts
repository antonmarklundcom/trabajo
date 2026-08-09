// The consent/ToS/privacy policy version stamped onto every `consents` row.
//
// Bump this whenever the Spanish consent, ToS or privacy copy changes
// materially (PLAN-PHASE2.md §7 item 13) — never silently. Every consents
// row records the version that was in effect when it was granted, so "what
// did this person agree to, and when" stays answerable after later edits.
//
// PR 6 lands the real employer terms/privacy copy (/terminos §4-5,
// /privacidad §5-6) and bumps this from the pre-copy placeholder. Bump again
// whenever that copy changes materially — see the file-level note above.
export const POLICY_VERSION = '2026-08-09-employer-copy-v1';
