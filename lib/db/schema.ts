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
  lastLoginAt: datetime('last_login_at'),
  createdAt: datetime('created_at').notNull(),
  updatedAt: datetime('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------

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
// `applications` (PLAN-PHASE3.md §1). No FK constraints, same as every
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
// How an employer account comes into existence. There is no self-serve employer
// signup: an account is a claim on a company's applications, and someone at the
// platform has to vouch for it (PLAN-PHASE2.md §2.2, open question Q2).
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
