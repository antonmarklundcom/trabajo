import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  date,
  datetime,
  json,
  mysqlEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { BLOG_CATEGORIES } from '../blog-categories';

// Convention note (unchanged from the original seven tables): relationships are
// modelled as plain int columns plus indexes, not as MySQL FOREIGN KEY
// constraints. Two reasons this stays that way for the Phase 2 tables:
//   - Consistency. Half-constrained referential integrity is worse than none,
//     because it invites the assumption that the DB is enforcing what it isn't.
//   - The ARCO purge (PLAN-PHASE2.md §4.4) deletes a candidate while
//     deliberately keeping consents and deletion_requests rows that point at
//     the now-gone id. Those are evidence records that must outlive their
//     subject; an FK would make that impossible rather than merely unusual.
// Every scoping/ownership check is therefore in the query, never in the schema
// — which is also where AGENTS.md requires it to be.

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------

export const users = mysqlTable('users', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  role: mysqlEnum('role', ['admin', 'editor', 'employer']).notNull(),
  companyId: int('company_id'),
  isActive: boolean('is_active').notNull().default(true),
  // Set when the address behind this account is proved (lib/db/user-tokens.ts).
  // NULL on every account that predates self-serve signup and on every
  // invited one, because an invitation was already sent TO the address —
  // receiving it is the proof. It gates nothing: an employer with an
  // unconfirmed address posts exactly like a confirmed one, because their
  // postings land `pending` either way and the moderation queue is the real
  // gate. It exists so a reviewer can see whether the address was confirmed.
  emailVerifiedAt: datetime('email_verified_at'),
  lastLoginAt: datetime('last_login_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------

// How a company row came into existence. Not a permission and not a status:
// nothing in the app branches on it, and a self-registered company's postings
// go through exactly the same moderation queue as a team-created one. It is a
// moderation SIGNAL — the reviewer approving a first posting wants to know
// whether anyone at the platform has ever spoken to this company.
export const companyOriginEnum = ['admin', 'self_serve'] as const;

export const companies = mysqlTable('companies', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  // Legacy free-text URL. Read-only from 2026-08-10 on (PLAN-IMAGES.md) — no
  // new code path writes it, it exists only so a company that already had a
  // typed-in URL doesn't go blank. `logoKey` is the write path now.
  logoUrl: varchar('logo_url', { length: 500 }),
  // img/logos/{uuid}.webp, minted by lib/image-storage.ts. Takes precedence
  // over logoUrl whenever present — see companyLogoSrc() in lib/company-logo.ts.
  logoKey: varchar('logo_key', { length: 255 }),
  whatsapp: varchar('whatsapp', { length: 20 }),
  website: varchar('website', { length: 500 }),
  description: text('description'),
  ownerUserId: int('owner_user_id'),
  // N2: whether this company's employer users get an email when an application
  // lands on one of their listings. Per COMPANY rather than per user: the
  // notification goes to every active employer user of the company, so one
  // switch with one meaning beats a per-user flag whose default nobody set.
  // Defaults on — an employer who was invited to receive applications is not
  // helped by silence.
  notifyOnApplication: boolean('notify_on_application').notNull().default(true),
  createdVia: mysqlEnum('created_via', companyOriginEnum).notNull().default('admin'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// categories / cities
// ---------------------------------------------------------------------------

export const categories = mysqlTable('categories', {
  id: int('id').autoincrement().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
});

export const cities = mysqlTable('cities', {
  id: int('id').autoincrement().primaryKey(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  sortOrder: int('sort_order').notNull().default(0),
  createdAt: datetime('created_at').notNull(),
});

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------

export const contractTypeEnum = [
  'tiempo_completo',
  'medio_tiempo',
  'temporal',
  'pasantia',
  'freelance',
] as const;

export const seniorityEnum = [
  'sin_experiencia',
  'junior',
  'semi_senior',
  'senior',
] as const;

export const modalityEnum = ['presencial', 'remoto', 'hibrido'] as const;

export const jobStatusEnum = [
  'draft',
  'pending',
  'published',
  'rejected',
  'archived',
] as const;

export const jobs = mysqlTable(
  'jobs',
  {
    id: int('id').autoincrement().primaryKey(),
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    companyId: int('company_id').notNull(),
    categoryId: int('category_id').notNull(),
    cityId: int('city_id').notNull(),
    contractType: mysqlEnum('contract_type', contractTypeEnum).notNull(),
    seniority: mysqlEnum('seniority', seniorityEnum).notNull(),
    modality: mysqlEnum('modality', modalityEnum).notNull(),
    salaryMin: int('salary_min'),
    salaryMax: int('salary_max'),
    salaryHidden: boolean('salary_hidden').notNull().default(false),
    description: text('description').notNull(),
    whatsapp: varchar('whatsapp', { length: 20 }),
    status: mysqlEnum('status', jobStatusEnum).notNull().default('draft'),
    featuredUntil: datetime('featured_until'),
    publishedAt: datetime('published_at'),
    expiresAt: datetime('expires_at'),
    rejectionReason: text('rejection_reason'),
    createdBy: int('created_by'),
    updatedBy: int('updated_by'),
    createdAt: datetime('created_at').notNull(),
    updatedAt: datetime('updated_at').notNull(),
  },
  (table) => [
    index('status_published_at_idx').on(table.status, table.publishedAt),
    index('status_category_city_idx').on(table.status, table.categoryId, table.cityId),
    index('status_featured_until_idx').on(table.status, table.featuredUntil),
    // Employer scoping (PLAN-PHASE2.md §1.1). Every /empresa read filters on
    // company_id first; the three indexes above all lead with `status`, which
    // is the wrong prefix for that access pattern.
    index('company_status_created_idx').on(table.companyId, table.status, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// job_images
//
// 1–3 public photos per job posting (PLAN-IMAGES.md). One row per image so
// reordering/removing one never touches the others. `image_key` is the minted
// img/jobs/{uuid}.webp key from lib/image-storage.ts — never a URL, same rule
// companies.logoKey already follows since PR 19 (§2.1).
// ---------------------------------------------------------------------------

export const jobImages = mysqlTable(
  'job_images',
  {
    id: int('id').autoincrement().primaryKey(),
    jobId: int('job_id').notNull(),
    imageKey: varchar('image_key', { length: 255 }).notNull(),
    width: int('width').notNull(),
    height: int('height').notNull(),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('job_sort_idx').on(table.jobId, table.sortOrder)],
);

// ---------------------------------------------------------------------------
// applications
//
// Still one row per application, and still the destination of the anonymous
// lead form — `candidate_id` is nullable forever, because a visitor who will
// never make an account must keep being able to apply (PLAN-PHASE2.md §8 Q9).
// ---------------------------------------------------------------------------

// `hired` is appended, never inserted in the middle: MySQL stores enum values
// by ordinal, so reordering silently rewrites every existing row's meaning.
export const applicationStatusEnum = [
  'new',
  'reviewed',
  'contacted',
  'discarded',
  'hired',
] as const;

export const applications = mysqlTable(
  'applications',
  {
    id: int('id').autoincrement().primaryKey(),
    jobId: int('job_id').notNull(),
    // NULL = anonymous lead-form application.
    candidateId: int('candidate_id'),
    // The consents row that authorised sharing this data with this employer.
    // NULL on anonymous/legacy rows, which are covered by the form's own notice
    // rather than by a stored consent record.
    consentId: int('consent_id'),
    // A reference, never a copy: deleting the CV must actually delete what the
    // employer can reach (PLAN-PHASE2.md §4.4).
    cvId: int('cv_id'),
    // The personal fields. Nullable from here on, because redaction empties
    // them in place rather than deleting the row (see redactedAt below).
    name: varchar('name', { length: 200 }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 320 }),
    message: text('message'),
    sourcePage: varchar('source_page', { length: 255 }),
    status: mysqlEnum('status', applicationStatusEnum).notNull().default('new'),
    // Set when the candidate withdrew consent or deleted their account. The row
    // survives as a non-personal husk so the employer's history and the admin
    // statistics stay coherent; every personal column above is NULL by then.
    redactedAt: datetime('redacted_at'),
    // Without these two, the new→contacted→hired funnel in PLAN-PHASE2.md §5.1
    // is not measurable at all — `status` alone has no time dimension.
    statusChangedAt: datetime('status_changed_at'),
    statusChangedBy: int('status_changed_by'),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [
    index('job_created_idx').on(table.jobId, table.createdAt),
    // "Mis postulaciones" for a logged-in candidate.
    index('candidate_created_idx').on(table.candidateId, table.createdAt),
    // One application per candidate per job. This is the same guard saved_jobs
    // has had since it was written, and its absence here made
    // createCandidateApplication() a check-then-insert race: two concurrent
    // submits both passed the "already applied?" SELECT (§12.1).
    //
    // It does NOT constrain the anonymous lead form, and that is a property of
    // MySQL rather than of this line: a UNIQUE index permits repeated rows
    // where any indexed column is NULL, and every anonymous application has a
    // NULL candidate_id. scripts/verify-cascades.ts asserts the half that is
    // ours and the half that could change — that the anonymous write path still
    // never sets candidateId — because "the lead form still works" is not
    // something to discover in production.
    uniqueIndex('candidate_job_application_unique_idx').on(table.candidateId, table.jobId),
  ],
);

// ---------------------------------------------------------------------------
// activity_log
// ---------------------------------------------------------------------------

export const activityLog = mysqlTable('activity_log', {
  id: int('id').autoincrement().primaryKey(),
  actorUserId: int('actor_user_id'),
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: int('entity_id').notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  meta: json('meta'),
  createdAt: datetime('created_at').notNull(),
});

// ===========================================================================
// Phase 2 — job seeker profiles, consent, audit
// (PLAN-PHASE2.md §1.2. Read that section before changing anything below:
// several of these shapes are legal requirements under Ley N° 7593/2025, not
// modelling preferences.)
// ===========================================================================

// ---------------------------------------------------------------------------
// candidates
//
// Deliberately NOT a fourth value in users.role. Every existing guard, admin
// list and requireRole() call is written against `users`; a fourth role would
// mean auditing all of them, and the failure mode of missing one is a candidate
// inside /admin. A separate table makes that class of bug structurally
// impossible instead of conditionally absent (PLAN-PHASE2.md §1.2/§2.1).
// ---------------------------------------------------------------------------

export const candidates = mysqlTable('candidates', {
  id: int('id').autoincrement().primaryKey(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  cityId: int('city_id'),
  // Self-written. The platform never generates, scores or edits this — that
  // would be us describing a candidate, which is the line we do not cross.
  headline: varchar('headline', { length: 200 }),
  isActive: boolean('is_active').notNull().default(true),
  emailVerifiedAt: datetime('email_verified_at'),
  lastLoginAt: datetime('last_login_at'),
  // When the retention warning was last sent (PLAN-NEXT.md §2 E2). The warning
  // window is months wide, so the sweep runs many times while a candidate sits
  // inside it — without this column every run would re-send, and a monthly
  // "your profile will be deleted" is not a warning, it is harassment.
  //
  // Compared against last activity rather than just tested for NULL: a
  // candidate who logs back in leaves the window, and if they later fall
  // inactive again the old timestamp predates their return, so they are warned
  // afresh instead of being purged in silence.
  retentionWarnedAt: datetime('retention_warned_at'),
  // N3: whether to email this candidate when an employer marks one of their
  // applications as contacted. Opt-OUT, editable in /postulante/perfil. The
  // only status change that produces an email is `contacted` — a "te
  // descartaron" notice would do candidates more harm than good
  // (PLAN-NEXT.md §3 N3), so this flag governs one message, not a category.
  notifyOnStatusChange: boolean('notify_on_status_change').notNull().default(true),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// candidate_cvs
//
// One row per upload rather than one per candidate, so replacing a CV does not
// orphan the applications that referenced the previous file.
// ---------------------------------------------------------------------------

export const candidateCvs = mysqlTable(
  'candidate_cvs',
  {
    id: int('id').autoincrement().primaryKey(),
    candidateId: int('candidate_id').notNull(),
    // Opaque key in the storage driver (cv/{candidateId}/{uuid}.{ext}). Never
    // the user's filename: that string is untrusted input and is only ever
    // shown back, never used to address a file.
    storageKey: varchar('storage_key', { length: 255 }).notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: int('size_bytes').notNull(),
    isCurrent: boolean('is_current').notNull().default(true),
    uploadedAt: datetime('uploaded_at').notNull(),
    // Bookkeeping for the purge sweep, NOT a soft delete: the bytes are gone
    // from storage before this is ever set (PLAN-PHASE2.md §3.4).
    deletedAt: datetime('deleted_at'),
  },
  (table) => [index('candidate_current_idx').on(table.candidateId, table.isCurrent)],
);

// ---------------------------------------------------------------------------
// candidate_experiences
// ---------------------------------------------------------------------------

export const candidateExperiences = mysqlTable(
  'candidate_experiences',
  {
    id: int('id').autoincrement().primaryKey(),
    candidateId: int('candidate_id').notNull(),
    // Free text, never joined to `companies`: a candidate's past employer is
    // not a tenant of this platform, and resolving it to one would quietly
    // build the company↔candidate graph we are not allowed to have.
    companyName: varchar('company_name', { length: 200 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    startMonth: date('start_month').notNull(),
    endMonth: date('end_month'),
    isCurrent: boolean('is_current').notNull().default(false),
    description: text('description'),
    sortOrder: int('sort_order').notNull().default(0),
  },
  (table) => [index('candidate_sort_idx').on(table.candidateId, table.sortOrder)],
);

// ---------------------------------------------------------------------------
// consents — append-only ledger
//
// Never UPDATEd and never DELETEd while the data it authorises exists.
// Withdrawal is a NEW row with granted = false; the current state of a consent
// is the latest row for a (subject, purpose, company) triple. That is what
// makes "prove this candidate agreed, on this date, to this policy version,
// for this employer" answerable a year later (PLAN-PHASE2.md §4.1).
// ---------------------------------------------------------------------------

export const consentSubjectEnum = ['candidate', 'employer_user'] as const;

export const consentPurposeEnum = [
  /** Storing a profile + CV at all. Blocking at signup. */
  'profile_storage',
  /** Sharing the profile + CV with ONE named employer for ONE posting. */
  'application_share',
  /** ToS + "we are not an agency" acknowledgement, at employer activation. */
  'terms_acceptance',
] as const;

export const consents = mysqlTable(
  'consents',
  {
    id: int('id').autoincrement().primaryKey(),
    subjectType: mysqlEnum('subject_type', consentSubjectEnum).notNull(),
    subjectId: int('subject_id').notNull(),
    purpose: mysqlEnum('purpose', consentPurposeEnum).notNull(),
    granted: boolean('granted').notNull(),
    // Meaningless unless POLICY_VERSION is bumped whenever the Spanish consent
    // and privacy copy changes materially (PLAN-PHASE2.md §7 item 13).
    policyVersion: varchar('policy_version', { length: 20 }).notNull(),
    relatedCompanyId: int('related_company_id'),
    relatedJobId: int('related_job_id'),
    ip: varchar('ip', { length: 45 }),
    userAgent: varchar('user_agent', { length: 255 }),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [
    index('subject_purpose_idx').on(table.subjectType, table.subjectId, table.purpose),
    index('related_company_idx').on(table.relatedCompanyId),
  ],
);

// ---------------------------------------------------------------------------
// data_access_logs
//
// Who looked at whose personal data. Written INSIDE the admin candidate-read
// functions, never by the UI layer, so there is no code path that returns the
// data and skips the write (PLAN-PHASE2.md §2.4).
//
// Not written for an employer reading their own applications: that is the data
// they were consented to receive, and logging it would be noise that buries the
// signal this table exists to carry.
// ---------------------------------------------------------------------------

export const dataAccessActionEnum = [
  'list_candidates',
  'view_candidate',
  'view_cv',
  'view_application',
  'export',
] as const;

export const dataAccessLogs = mysqlTable(
  'data_access_logs',
  {
    id: int('id').autoincrement().primaryKey(),
    actorUserId: int('actor_user_id').notNull(),
    actorRole: varchar('actor_role', { length: 20 }).notNull(),
    action: mysqlEnum('action', dataAccessActionEnum).notNull(),
    subjectType: varchar('subject_type', { length: 30 }).notNull(),
    subjectId: int('subject_id').notNull(),
    // Mandatory for drill-down actions, enforced in code rather than by the
    // column: an empty reason must fail the request, not store an empty string.
    reason: varchar('reason', { length: 255 }),
    ip: varchar('ip', { length: 45 }),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [
    // "Who has seen my data" must be a cheap query if a candidate ever asks.
    index('subject_created_idx').on(table.subjectType, table.subjectId, table.createdAt),
    index('actor_created_idx').on(table.actorUserId, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// deletion_requests
//
// The audit trail of ARCO cancellations. Holds NO personal data by
// construction, and outlives the candidate it refers to — hence no FK and a
// hashed email rather than the address itself.
// ---------------------------------------------------------------------------

export const deletionRequestActorEnum = ['candidate', 'admin'] as const;

export const deletionRequests = mysqlTable('deletion_requests', {
  id: int('id').autoincrement().primaryKey(),
  // Intentionally not a reference: the point of this row is to survive the
  // candidate's deletion.
  candidateId: int('candidate_id').notNull(),
  // sha256(lowercased email). Lets a re-signup be correlated with a prior
  // deletion without keeping the address around to do it.
  emailHash: varchar('email_hash', { length: 64 }).notNull(),
  requestedBy: mysqlEnum('requested_by', deletionRequestActorEnum).notNull(),
  actorUserId: int('actor_user_id'),
  // Written BEFORE anything is destroyed, so an interrupted purge is still
  // evidenced. executed_at is stamped last.
  requestedAt: datetime('requested_at').notNull(),
  executedAt: datetime('executed_at'),
  outcome: text('outcome'),
});

// ---------------------------------------------------------------------------
// saved_jobs
//
// A candidate bookmarking a job to read/compare later — separate from
// `applications` (PLAN-PHASE3-DRAFT.md §1). No FK constraints, same as every
// other table here: cross-table cleanup (a hard-deleted job) is done in code,
// in `deleteJob()`, not by the schema.
// ---------------------------------------------------------------------------

export const savedJobs = mysqlTable(
  'saved_jobs',
  {
    id: int('id').autoincrement().primaryKey(),
    candidateId: int('candidate_id').notNull(),
    jobId: int('job_id').notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [
    // Also the idempotency guard for "save": a second save hits this
    // constraint, which the write path treats as success, not an error.
    uniqueIndex('candidate_job_unique_idx').on(table.candidateId, table.jobId),
    // "Mis guardados" for a logged-in candidate.
    index('candidate_created_idx').on(table.candidateId, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// employer_invitations
//
// How an employer account is attached to a company that ALREADY EXISTS — the
// only way that ever happens. An invitation is a claim on a company's
// applications, so someone at the platform has to vouch for it
// (PLAN-PHASE2.md §2.2).
//
// Self-serve signup (§8 Q2, opened 2026-08-28) does not use this table and
// deliberately cannot reach an existing company: it mints a brand-new
// `companies` row with `created_via = 'self_serve'` and attaches the new user
// to that. The two paths therefore have disjoint outcomes — an invitation is
// the only way to join an existing company, and a signup is the only way to
// create an unvouched one — which is what keeps Q2's actual risk ("anyone can
// claim a company and read its applications") unreachable rather than merely
// discouraged.
// ---------------------------------------------------------------------------

export const employerInvitations = mysqlTable(
  'employer_invitations',
  {
    id: int('id').autoincrement().primaryKey(),
    companyId: int('company_id').notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    // sha256 of a 32-byte random token. The raw token exists only inside the
    // invite link, so a leaked database row cannot be redeemed.
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    createdBy: int('created_by').notNull(),
    expiresAt: datetime('expires_at').notNull(),
    acceptedAt: datetime('accepted_at'),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('company_created_idx').on(table.companyId, table.createdAt)],
);

// ---------------------------------------------------------------------------
// user_tokens
//
// The `users` counterpart of candidate_tokens: single-use, hashed, expiring
// links mailed to a staff/employer address. Today it carries exactly one
// purpose — confirming the address a self-serve employer signed up with.
//
// A separate table rather than a `subject_type` column on candidate_tokens.
// The two audiences are separate tables with separate cookies and separate
// lifecycles (ARCHITECTURE.md §5), and a shared token table would be one
// forgotten predicate away from redeeming a candidate's token against a user
// id. Making that unrepresentable costs one small table.
//
// Every safety property is the one candidate_tokens documents, for the same
// reasons: 32 CSPRNG bytes, only the sha256 stored, single use enforced by
// `used_at`, expiry checked at redemption, and issuing supersedes the user's
// outstanding tokens of that purpose.
// ---------------------------------------------------------------------------

export const userTokenPurposeEnum = ['email_verification'] as const;

export const userTokens = mysqlTable(
  'user_tokens',
  {
    id: int('id').autoincrement().primaryKey(),
    userId: int('user_id').notNull(),
    purpose: mysqlEnum('purpose', userTokenPurposeEnum).notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: datetime('expires_at').notNull(),
    usedAt: datetime('used_at'),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('user_purpose_idx').on(table.userId, table.purpose)],
);

// ---------------------------------------------------------------------------
// auth_events
//
// Who tried to authenticate, on which surface, from where (PLAN-NEXT.md §2 A1).
//
// Distinct from data_access_logs, which answers "who READ a candidate's data".
// This one answers "who tried to get in" — the question you have after a
// password is suspected leaked, and the one nothing in this repo could answer
// before. Both are needed and neither substitutes for the other.
//
// What is deliberately NOT here: passwords, obviously, but also the full
// attempted identifier on a failure. A failed login carries a truncated address
// (see lib/db/auth-events.ts) — enough to see one account being hammered,
// not enough to turn this table into a harvest of every address someone tried.
//
// Retention: 24 months, the same clock data_access_logs runs on, swept by the
// same script. Rows outlive the account they name, on purpose: after a
// candidate is purged their id is orphaned here exactly as it is in `consents`,
// because the evidence of a login attempt is not the candidate's personal data
// to erase — it is the record of an event on our systems. There is no name or
// address on the row to erase either way.
// ---------------------------------------------------------------------------

export const authSurfaceEnum = ['admin', 'empresa', 'postulante'] as const;

export const authEventEnum = [
  'login_ok',
  'login_fail',
  'logout',
  'password_change',
  'password_reset_request',
  'password_reset_ok',
] as const;

export const authEvents = mysqlTable(
  'auth_events',
  {
    id: int('id').autoincrement().primaryKey(),
    surface: mysqlEnum('surface', authSurfaceEnum).notNull(),
    // Plain ints, no FK (AGENTS.md). Exactly one is set on a successful event;
    // both are NULL on a failure, because a failed attempt has no established
    // identity — that is what makes it a failure.
    userId: int('user_id'),
    candidateId: int('candidate_id'),
    event: mysqlEnum('event', authEventEnum).notNull(),
    // Truncated identifier on failures, so one account being attacked is
    // visible without storing every address anyone typed.
    identifierHint: varchar('identifier_hint', { length: 64 }),
    // The B1 trusted value. NULL when the request did not arrive through the
    // expected proxy chain — never a client-supplied string.
    ip: varchar('ip', { length: 45 }),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('surface_created_idx').on(table.surface, table.createdAt)],
);

// ---------------------------------------------------------------------------
// candidate_tokens
//
// Single-use, hashed, expiring tokens for the two flows a candidate can start
// from outside a session: verifying their email and resetting their password
// (PLAN-NEXT.md §2 E1).
//
// The shape copies employer_invitations deliberately, because the threat is the
// same: only the sha256 is stored, so the raw token exists solely inside the
// link in the inbox and a leaked database row cannot be redeemed. One table
// with a `purpose` rather than two tables — the columns, the expiry sweep and
// the ARCO cleanup would otherwise be duplicated with nothing distinguishing
// them but the name.
//
// Retention stance (PLAN-NEXT.md §5): no sweep of its own, deliberately. A row
// here is worthless the moment it is used or expires — it carries no personal
// data beyond the candidate id, and the hash cannot be reversed into the token
// it came from. Three things already bound the table: issuing supersedes the
// candidate's outstanding tokens of that purpose, a password change deletes all
// of theirs, and the ARCO purge destroys them with the account. If it ever
// needs one, it belongs next to data_access_logs in lib/db/retention.ts.
// ---------------------------------------------------------------------------

export const candidateTokenPurposeEnum = ['email_verification', 'password_reset'] as const;

export const candidateTokens = mysqlTable(
  'candidate_tokens',
  {
    id: int('id').autoincrement().primaryKey(),
    candidateId: int('candidate_id').notNull(),
    purpose: mysqlEnum('purpose', candidateTokenPurposeEnum).notNull(),
    // sha256 of a 32-byte random token, hex. Unique so a redemption is a single
    // indexed lookup and never a scan.
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
    expiresAt: datetime('expires_at').notNull(),
    // Set on redemption. Single-use is enforced here rather than by deleting
    // the row, so a second click on the same link can say "this link was
    // already used" instead of the same message as a forged token.
    usedAt: datetime('used_at'),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [
    // Invalidating a candidate's outstanding tokens of one kind — which every
    // issue and every password change does.
    index('candidate_purpose_idx').on(table.candidateId, table.purpose),
  ],
);

// ===========================================================================
// Phase 3 — blog (Väg B: bodies in the database, written from /admin/blog)
//
// PLAN-PHASE3-DRAFT.md §5.1 shipped the blog as Väg A — Markdown committed to
// the repo — and named the three conditions under which Väg B becomes the
// right answer. The first of them ("someone publishes without going through a
// Claude session") was invoked by the owner on 2026-08-12; §11 records the
// decision and what it costs. These two tables are the whole of the migration
// the §5.1 note promised would be cheap: the slugs, the routes and the
// rendering are unchanged, only the read source moved.
// ===========================================================================

// The same closed list Väg A validated in frontmatter, for the same reason
// (§5.3): a wrong value must be impossible, not a quiet eighth category. It
// is an enum here rather than a zod union so the database refuses one too.
// The tuple itself lives in lib/blog-categories.ts (C1) — the single source
// also used by the client-side post form and the public read path.
export const blogCategoryEnum = BLOG_CATEGORIES;

// Two states, not the five a job has. A blog post has no moderation queue —
// the only person who can write one is the person who approves it — so
// `pending` and `rejected` would be states nothing can ever put a row into.
export const blogStatusEnum = ['draft', 'published'] as const;

export const blogPosts = mysqlTable(
  'blog_posts',
  {
    id: int('id').autoincrement().primaryKey(),
    // A live SEO URL (AGENTS.md). Changing it on a published post mints a
    // blog_post_redirects row rather than silently breaking the old link.
    slug: varchar('slug', { length: 200 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    // <meta name="description"> and the OG description. Capped at 160 in the
    // zod schema, where the reason (it is what Google truncates) can be told
    // to the writer; the column is wider so a future limit change is not a
    // migration.
    description: varchar('description', { length: 300 }).notNull(),
    // Markdown, exactly as the author typed it. Rendered to HTML on read by
    // renderMarkdown() in lib/blog.ts — never stored as HTML, so the escaping
    // rules in that file apply to every row including ones written before the
    // rules changed.
    body: text('body').notNull(),
    category: mysqlEnum('category', blogCategoryEnum).notNull(),
    status: mysqlEnum('status', blogStatusEnum).notNull().default('draft'),
    // img/blog/{uuid}.webp, minted by lib/image-storage.ts. The KEY, never a
    // URL (PLAN-IMAGES.md §2.1) — this is the namespace §9.3 reserved for
    // exactly this build.
    coverImageKey: varchar('cover_image_key', { length: 255 }),
    // Required by the write path whenever coverImageKey is set. Nullable here
    // because the column has to hold "no cover, no alt" too.
    coverAlt: varchar('cover_alt', { length: 200 }),
    // Optional internal-linking targets for the "Empleos relacionados" block.
    // Slugs of an existing category/city — read through lib/data.ts, never
    // joined here, because the blog must not grow its own path into the job
    // catalog (AGENTS.md).
    relatedCategorySlug: varchar('related_category_slug', { length: 100 }),
    relatedCitySlug: varchar('related_city_slug', { length: 100 }),
    // The editorial date, not a timestamp: it is what `datePublished` and the
    // article header show, and the author sets it. Null while a draft has
    // never been published.
    publishedAt: date('published_at', { mode: 'string' }),
    authorUserId: int('author_user_id'),
    createdAt: datetime('created_at').notNull(),
    updatedAt: datetime('updated_at').notNull(),
  },
  (table) => [
    // The public list: published rows, newest first.
    index('status_published_idx').on(table.status, table.publishedAt),
    // The per-category archive (C2): published rows in one category, newest
    // first — the same shape as status_published_idx with category folded in,
    // for the query queryPublishedPosts({ category }) will run once C2 ships.
    index('category_published_idx').on(table.status, table.category, table.publishedAt),
  ],
);

// ---------------------------------------------------------------------------
// blog_post_redirects
//
// One row per slug a published post used to have. AGENTS.md: "Slugs are live
// SEO URLs. Renaming one needs a 301, not just an edit." Väg A could not honour
// that without a human remembering; with the slug in a column the redirect is
// mintable at the moment of the rename, which is the only moment the old value
// is still known.
// ---------------------------------------------------------------------------

export const blogPostRedirects = mysqlTable(
  'blog_post_redirects',
  {
    id: int('id').autoincrement().primaryKey(),
    // Unique across the table: a slug can only ever point at one destination,
    // and re-using a retired slug for a new post has to fail loudly rather
    // than create a redirect loop.
    fromSlug: varchar('from_slug', { length: 200 }).notNull().unique(),
    postId: int('post_id').notNull(),
    createdAt: datetime('created_at').notNull(),
  },
  (table) => [index('post_idx').on(table.postId)],
);

// ---------------------------------------------------------------------------
// ops_state
//
// A tiny key/value table for facts about OPERATING the site rather than about
// its content: right now, when the retention sweep last completed
// (PLAN-NEXT.md §3 O2).
//
// Hostinger gives us no cron, so `db:purge` is a script someone runs monthly.
// Nothing recorded that it had happened, which meant a missed month looked
// exactly like a done month — and the thing being missed is a deletion the
// privacy policy promises. This makes the omission visible on /admin.
//
// Key/value rather than a one-row table with a named column: the next
// operational timestamp (a backup, a restore rehearsal) is a row here instead
// of a migration. It references no other table, so it has no place in the
// dependency registry of scripts/verify-cascades.ts.
// ---------------------------------------------------------------------------

export const opsState = mysqlTable('ops_state', {
  stateKey: varchar('state_key', { length: 64 }).primaryKey(),
  value: varchar('value', { length: 255 }).notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ===========================================================================
// PagoPar checkout — the self-serve Destacado (PLAN-PAGOPAR.md §3)
//
// Schema only, landing on its own: merging to main is a production deploy with
// no staging, so the migration is its own reviewable event and the webhook
// that writes these rows arrives in the next PR (PLAN-PAGOPAR.md §8, "Do not
// fold A into B").
//
// Nothing here publishes anything. A paid Destacado is still a `published` job
// that /admin approved — payment buys placement in the list, never a place ON
// it (PLAN-PAGOPAR.md §7, asserted by scripts/verify-moderation.ts).
// ===========================================================================

// The order lifecycle. `pending` is where every order starts and the only
// state a payment callback may claim from — see PAID_CLAIM in
// lib/db/feature-orders.ts, which is what makes a retried delivery a no-op.
export const featureOrderStatusEnum = [
  'pending',
  'paid',
  'failed',
  'expired',
  'cancelled',
] as const;

// Both processors from the first migration, so the Bancard adapter
// (PLAN-PAGOPAR.md §10) is a new module and a second route rather than an
// ALTER TABLE on a table that by then holds live orders.
export const paymentProcessorEnum = ['pagopar', 'bancard'] as const;

// ---------------------------------------------------------------------------
// feature_orders
//
// One row per checkout attempt. What was bought is recorded here, and only
// here: the webhook reads `days` and `amount_gs` from this row and never from
// the callback body, because a callback that can name the number of days is a
// callback that can buy a year for one guaraní (PLAN-PAGOPAR.md §4 point 8).
// ---------------------------------------------------------------------------

export const featureOrders = mysqlTable(
  'feature_orders',
  {
    id: int('id').autoincrement().primaryKey(),
    // Plain ints, no FK — the schema-wide convention at the top of this file.
    // scripts/verify-cascades.ts registers this table against `jobs`, whose
    // hard delete (deleteJob() in lib/db/admin.ts) must purge its orders.
    jobId: int('job_id').notNull(),
    // Denormalised rather than joined through `jobs`: an order must survive
    // its job being re-pointed, and an employer-scoped read filters on
    // company_id like every other query an employer can reach.
    companyId: int('company_id').notNull(),
    // What was bought, not when it ends. The end date is computed at
    // fulfilment by computeFeaturedUntil(), because a window bought today and
    // fulfilled tomorrow must run from the fulfilment.
    days: int('days').notNull(),
    // Guaraníes have no decimal places, so the amount is an integer and no
    // rounding rule exists to get wrong.
    amountGs: int('amount_gs').notNull(),
    status: mysqlEnum('status', featureOrderStatusEnum).notNull().default('pending'),
    processor: mysqlEnum('processor', paymentProcessorEnum).notNull(),
    // Whatever identifies this order to the processor. UNIQUE is load-bearing:
    // it is half of the idempotency guarantee (PLAN-PAGOPAR.md §4 point 4) —
    // it makes "one order per processor reference" a property of the database
    // rather than of whichever handler remembered to check.
    processorOrderId: varchar('processor_order_id', { length: 191 }).notNull().unique(),
    paidAt: datetime('paid_at'),
    // Deliberately distinct from paid_at. "The money arrived" and "the window
    // was opened" are two facts, and a bug between them — a claimed order
    // whose job was never granted anything — is only visible if both are
    // recorded separately.
    fulfilledAt: datetime('fulfilled_at'),
    // The window this order actually produced, copied at fulfilment. A later
    // manual grant or revoke (PLAN-PAGOPAR.md §6, which stays forever) rewrites
    // jobs.featured_until; it must not rewrite what this order delivered.
    featuredUntil: datetime('featured_until'),
    createdAt: datetime('created_at').notNull(),
    updatedAt: datetime('updated_at').notNull(),
  },
  (table) => [
    // The employer's own order history, newest first.
    index('company_created_idx').on(table.companyId, table.createdAt),
    // Every order ever raised against one listing.
    index('job_created_idx').on(table.jobId, table.createdAt),
    // Reconciliation: what is still pending, what failed, and when.
    index('status_created_idx').on(table.status, table.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// payment_events
//
// Every callback delivery ever received, verified or not, stored raw. The row
// is written BEFORE verification and BEFORE any state change, so a forged,
// malformed or replayed delivery still leaves evidence (PLAN-PAGOPAR.md §4
// point 2). It is the reconciliation trail, and the only thing that answers
// "they say they paid and nothing happened" without asking the processor.
//
// `order_id` is nullable because the delivery that cannot be matched to an
// order is exactly the one worth keeping: an unparseable body, a reference
// we never issued, or a callback that arrived for an order since deleted.
// That last case is why this table is a DELIBERATE_ORPHAN in
// scripts/verify-cascades.ts rather than a DEPENDENCIES entry — see the note
// there.
// ---------------------------------------------------------------------------

export const paymentEvents = mysqlTable(
  'payment_events',
  {
    id: int('id').autoincrement().primaryKey(),
    orderId: int('order_id'),
    processor: mysqlEnum('processor', paymentProcessorEnum).notNull(),
    // Recorded, never trusted: a `false` row is the evidence of a rejected
    // delivery, and nothing downstream may read this column as permission.
    signatureValid: boolean('signature_valid').notNull(),
    // The body as it arrived. Raw, so what we were sent can be re-read later
    // against a processor's own record without depending on how a parser of
    // ours happened to interpret it that day.
    payload: json('payload').notNull(),
    receivedAt: datetime('received_at').notNull(),
    // IPv6-sized. Nullable because a delivery through a proxy that strips it
    // must still be logged rather than dropped.
    ip: varchar('ip', { length: 45 }),
  },
  (table) => [
    // "What did we receive for this order?" — the reconciliation question.
    index('order_received_idx').on(table.orderId, table.receivedAt),
    // "What arrived from this processor, in what order?" — including the
    // deliveries that matched no order at all.
    index('processor_received_idx').on(table.processor, table.receivedAt),
  ],
);
