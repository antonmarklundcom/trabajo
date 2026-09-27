// Admin access to candidate data — the sharpest edge in PLAN-PHASE2.md, and
// the module the privacy policy's "ese acceso queda registrado" sentence is a
// promise about (/privacidad, shipped in PR 6).
//
// ===========================================================================
// THE ONE RULE IN THIS FILE (PLAN-PHASE2.md §2.4)
//
//   Every exported function takes the acting `SessionUser` and a non-empty
//   `reason`, and writes its data_access_logs row INSIDE the function, before
//   returning. There is no code path here that returns candidate data and
//   skips the write.
//
// That is a construction, not a convention: the logging cannot be forgotten by
// a route handler or a page, because the route handler never sees the data
// until the log row exists. The alternative — logging in the UI layer — is one
// refactor away from a silent read.
//
// `role` is checked as exactly `admin`. `editor` does not get candidate access,
// which is a deliberate narrowing versus today's admin/editor parity: the
// curation team needs jobs, not CVs.
//
// ONE exception, and it is a preserved status quo rather than a new grant:
// listApplicationsForStaff() (the /admin/postulaciones table) accepts `admin`
// AND `editor`, because both roles have read that table since before this
// module existed. What changed is that the read is now logged; who may make it
// did not. Narrowing it to `admin` is an owner decision, not a side effect.
// ===========================================================================
//
// PR 7 populated this module with the CV path only, because that was the one
// admin candidate-data read that existed then. PR 12 adds listCandidates() /
// viewCandidate() and the /admin/postulantes surface on top of the same
// construction. The staff application list moved here from lib/db/admin.ts,
// where it returned names, phones, emails and messages with no log row at all
// — the one staff read of applicant data that /privacidad §6 ("ese acceso
// queda registrado") did not actually cover.
//
// What this module deliberately does NOT export, and must never grow
// (PLAN-PHASE2.md §5.2 and Phase 4):
//
//   - Free-text search over CVs, headlines or work history. Lookup is by exact
//     email or by candidate id — you have to already know who you are looking
//     for. A `LIKE '%…%'` here is the difference between an admin tool and a
//     talent database.
//   - Any bulk export. It is the single feature that would turn this product
//     into the thing we told the regulator we are not. An ARCO access request
//     is answered by the candidate's own export in /postulante/mis-datos.
//   - Any ranking, scoring or "recommended candidates" ordering.
import 'server-only';

import { unstable_cache } from 'next/cache';
import { and, asc, count, desc, eq, isNull, sql } from 'drizzle-orm';

import {
  applications,
  candidateCvs,
  candidateExperiences,
  candidates,
  cities,
  companies,
  dataAccessLogs,
  jobs,
  users,
  type applicationStatusEnum,
  type dataAccessActionEnum,
} from './schema';
import { AuthError, type SessionUser } from '../auth';

async function getDb() {
  return (await import('./index')).db;
}

/** Thrown when a drill-down is attempted without a usable reason. */
export class ReasonRequiredError extends Error {
  constructor() {
    super('A reason is required to access candidate data.');
    this.name = 'ReasonRequiredError';
  }
}

export const MAX_REASON_LENGTH = 255;
const MIN_REASON_LENGTH = 3;

/**
 * Rejects empty and whitespace-only reasons rather than storing them. A blank
 * reason column is worse than no column: it looks like an answer.
 */
function requireReason(reason: string): string {
  const trimmed = (reason ?? '').trim();
  if (trimmed.length < MIN_REASON_LENGTH) throw new ReasonRequiredError();
  return trimmed.slice(0, MAX_REASON_LENGTH);
}

function requireAdmin(actor: SessionUser): void {
  if (actor.role !== 'admin') {
    throw new AuthError(403, `Role "${actor.role}" may not access candidate data.`);
  }
}

/**
 * The role gate for listApplicationsForStaff() only — `admin` or `editor`, the
 * same pair the /admin layout and PATCH /api/admin/postulaciones/[id] admit.
 * See the header: this preserves who could already read that table. It is not
 * a template for widening any other function here.
 */
function requireApplicationStaff(actor: SessionUser): void {
  if (actor.role !== 'admin' && actor.role !== 'editor') {
    throw new AuthError(403, `Role "${actor.role}" may not access application data.`);
  }
}

export type AccessContext = {
  /** From `clientIp()` (lib/client-ip.ts) at the route boundary. Null when
   *  the request did not arrive through the trusted proxy chain — never a
   *  client-supplied value, since this column is ARCO evidence. */
  ip: string | null;
};

async function logAccess(
  actor: SessionUser,
  action: (typeof dataAccessActionEnum)[number],
  subjectType: AccessSubject['subjectType'],
  subjectId: number,
  // Nullable only for `list_candidates`, where §2.4 makes the reason optional.
  // Every drill-down action goes through requireReason() first, so a NULL here
  // cannot come from a view_candidate or view_cv call.
  reason: string | null,
  context: AccessContext,
): Promise<void> {
  await logAccessMany(actor, action, [{ subjectType, subjectId }], reason, context);
}

/**
 * Who a log row is about. `candidate` for anyone with an account — that is the
 * key the candidate's own export (/postulante/mis-datos, candidate-arco.ts)
 * reads, so "who has seen my data" finds the row. `application` for an
 * anonymous lead-form application, which has no account id to name: the
 * application id is the only stable handle on that person's data.
 */
type AccessSubject = { subjectType: 'candidate' | 'application'; subjectId: number };

/**
 * The multi-row form of logAccess(), for a read that discloses several data
 * subjects at once — one INSERT with one row per subject, all stamped with the
 * same time. An empty list writes nothing, because nothing was disclosed.
 *
 * `reason` is NULL only for the list reads (`list_candidates`, and the
 * `view_application` rows written by the un-gated /admin/postulaciones table).
 */
async function logAccessMany(
  actor: SessionUser,
  action: (typeof dataAccessActionEnum)[number],
  subjects: readonly AccessSubject[],
  reason: string | null,
  context: AccessContext,
): Promise<void> {
  if (subjects.length === 0) return;
  const db = await getDb();
  const createdAt = new Date();
  await db.insert(dataAccessLogs).values(
    subjects.map(({ subjectType, subjectId }) => ({
      actorUserId: actor.id,
      actorRole: actor.role,
      action,
      subjectType,
      subjectId,
      reason,
      ip: context.ip,
      createdAt,
    })),
  );
}

export type AdminCv = {
  id: number;
  candidateId: number;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
};

/**
 * A CV, for an admin, with the access recorded. Returns null when the CV does
 * not exist or its bytes are already gone.
 *
 * The log row names the **candidate**, not the CV: the question this table has
 * to answer cheaply is "who has looked at my data", asked by a candidate, and
 * `(subject_type, subject_id, created_at)` is indexed for exactly that. The
 * action `view_cv` records which kind of access it was.
 *
 * Nothing is logged when there is no row, because nothing was disclosed — an
 * id that resolves to nothing tells the reader neither who the candidate is nor
 * what their CV contains.
 */
export async function viewCandidateCvAsAdmin(
  actor: SessionUser,
  cvId: number,
  reason: string,
  context: AccessContext,
): Promise<AdminCv | null> {
  requireAdmin(actor);
  const validReason = requireReason(reason);

  const db = await getDb();
  const rows = await db
    .select({
      id: candidateCvs.id,
      candidateId: candidateCvs.candidateId,
      storageKey: candidateCvs.storageKey,
      originalFilename: candidateCvs.originalFilename,
      mimeType: candidateCvs.mimeType,
    })
    .from(candidateCvs)
    .where(and(eq(candidateCvs.id, cvId), isNull(candidateCvs.deletedAt)))
    .limit(1);

  const cv = rows[0];
  if (!cv) return null;

  // Before the return, always. If this insert throws, the caller gets the
  // error and not the CV — which is the correct failure direction for a
  // logging guarantee we made in writing.
  await logAccess(actor, 'view_cv', 'candidate', cv.candidateId, validReason, context);

  return cv;
}

// ===========================================================================
// The fixed reason list (PLAN-PHASE2.md §5.2)
//
// A closed vocabulary rather than a free-text box, so that "why did we open
// this profile" is answerable across a year of rows by grouping instead of by
// reading. `otro` still requires the free text, because the escape hatch has to
// stay usable — an unusable one just pushes people to pick the nearest wrong
// label, which is worse than an honest "otro: …".
// ===========================================================================

export const ACCESS_REASON_CODES = [
  'moderacion_de_contenido',
  'soporte_al_postulante',
  'denuncia_abuso',
  'solicitud_arco',
  'otro',
] as const;

export type AccessReasonCode = (typeof ACCESS_REASON_CODES)[number];

/** Spanish (Paraguay) labels — these are what gets stored and later displayed. */
export const ACCESS_REASON_LABELS: Record<AccessReasonCode, string> = {
  moderacion_de_contenido: 'Moderación de contenido',
  soporte_al_postulante: 'Soporte al postulante',
  denuncia_abuso: 'Denuncia / abuso',
  solicitud_arco: 'Solicitud ARCO',
  otro: 'Otro',
};

function isReasonCode(value: string): value is AccessReasonCode {
  return (ACCESS_REASON_CODES as readonly string[]).includes(value);
}

/**
 * Turns the `motivo` (+ `detalle` for `otro`) query pair into the string that
 * gets stored, or null when the pair is not usable.
 *
 * Returning null rather than throwing is deliberate: the page uses this to
 * decide whether to render the reason gate or the data, and "no reason yet" is
 * the normal first render of that page, not an error. The functions below still
 * enforce the reason themselves — this is a UI helper, never the gate.
 */
export function resolveAccessReason(
  code: string | undefined,
  detail: string | undefined,
): string | null {
  if (!code || !isReasonCode(code)) return null;
  const label = ACCESS_REASON_LABELS[code];
  const extra = (detail ?? '').trim();
  if (code === 'otro') {
    // An "otro" with no explanation carries no information at all, so it is not
    // a reason — it is the absence of one wearing a label.
    if (extra.length < MIN_REASON_LENGTH) return null;
    return `${label}: ${extra}`.slice(0, MAX_REASON_LENGTH);
  }
  return (extra ? `${label}: ${extra}` : label).slice(0, MAX_REASON_LENGTH);
}

// ===========================================================================
// listCandidates — AGGREGATE BY DEFAULT (PLAN-PHASE2.md §5.2)
//
// The default answer to "show me the candidates" is a set of counts. No name,
// no email, no phone, no headline, no CV — there is deliberately no shape of
// this function's result that could be pasted into a spreadsheet and sold.
//
// A lookup by exact email or by id is the one way to reach a single row, and
// even then the row carries id / city / signup date / application count: enough
// to identify the RIGHT record when investigating something, not enough to be
// useful as a talent list.
//
// `reason` is optional here, per §2.4, because an aggregate has no data subject
// to log an access against. When a lookup RESOLVES, that is no longer true —
// the operator has learned that a specific person has an account — so that case
// writes a `list_candidates` row before returning, with whatever reason was
// given.
// ===========================================================================

export type LabeledCount = { label: string; count: number };

export type CandidateAggregates = {
  total: number;
  byCity: LabeledCount[];
  bySignupMonth: LabeledCount[];
  byApplicationVolume: LabeledCount[];
};

/** The most a list row is ever allowed to contain. Note the absent fields. */
export type CandidateListRow = {
  id: number;
  cityName: string | null;
  createdAt: Date;
  applicationCount: number;
};

export type CandidateFilters = {
  /** Exact match, lowercased. Never a LIKE. */
  email?: string | null;
  candidateId?: number | null;
};

export type CandidateListResult = {
  aggregates: CandidateAggregates;
  /** True when the caller supplied a lookup filter at all. */
  lookupAttempted: boolean;
  /** The single matching row, or null. Never more than one by construction. */
  match: CandidateListRow | null;
};

const VOLUME_BUCKETS = ['0', '1', '2-5', '6+'] as const;

const AGGREGATE_TTL_SECONDS = 300;

async function computeAggregates(): Promise<CandidateAggregates> {
  const db = await getDb();

  const [[{ total }], byCityRows, byMonthRows] = await Promise.all([
    db.select({ total: count() }).from(candidates),

    db
      .select({ label: cities.name, n: count() })
      .from(candidates)
      .leftJoin(cities, eq(candidates.cityId, cities.id))
      .groupBy(cities.id, cities.name)
      .orderBy(desc(count())),

    db
      .select({
        label: sql<string>`DATE_FORMAT(${candidates.createdAt}, '%Y-%m')`,
        n: count(),
      })
      .from(candidates)
      .groupBy(sql`DATE_FORMAT(${candidates.createdAt}, '%Y-%m')`)
      .orderBy(sql`DATE_FORMAT(${candidates.createdAt}, '%Y-%m') DESC`)
      .limit(12),
  ]);

  // Bucketing happens in SQL, over a derived per-candidate count, rather than by
  // pulling one row per candidate into Node and counting there: the second
  // shape is a full table of candidate ids in application memory, which is
  // exactly the kind of accidental "everyone, listed" this surface avoids.
  const perCandidate = db
    .select({
      candidateId: candidates.id,
      n: count(applications.id).as('n'),
    })
    .from(candidates)
    .leftJoin(applications, eq(applications.candidateId, candidates.id))
    .groupBy(candidates.id)
    .as('per_candidate');

  const bucketExpr = sql<string>`CASE
    WHEN ${perCandidate.n} = 0 THEN '0'
    WHEN ${perCandidate.n} = 1 THEN '1'
    WHEN ${perCandidate.n} <= 5 THEN '2-5'
    ELSE '6+'
  END`;

  const bucketRows = await db
    .select({ label: bucketExpr, n: count() })
    .from(perCandidate)
    .groupBy(bucketExpr);

  const bucketCounts = new Map(bucketRows.map((r) => [String(r.label), r.n]));

  return {
    total,
    byCity: byCityRows.map((r) => ({ label: r.label ?? 'Sin ciudad', count: r.n })),
    bySignupMonth: byMonthRows.map((r) => ({ label: String(r.label), count: r.n })),
    // Every bucket is emitted, including the empty ones: "0 postulaciones: 0"
    // is a fact, and a missing row reads as missing data.
    byApplicationVolume: VOLUME_BUCKETS.map((bucket) => ({
      label: bucket,
      count: bucketCounts.get(bucket) ?? 0,
    })),
  };
}

async function lookupCandidate(filters: CandidateFilters): Promise<CandidateListRow | null> {
  const db = await getDb();

  const email = filters.email?.trim().toLowerCase();
  const id = filters.candidateId ?? null;
  if (!email && !id) return null;

  // eq(), never like(). §5.2: you have to already know who you are looking for.
  const predicate = email ? eq(candidates.email, email) : eq(candidates.id, id!);

  const rows = await db
    .select({
      id: candidates.id,
      cityName: cities.name,
      createdAt: candidates.createdAt,
      applicationCount: count(applications.id),
    })
    .from(candidates)
    .leftJoin(cities, eq(candidates.cityId, cities.id))
    .leftJoin(applications, eq(applications.candidateId, candidates.id))
    .where(predicate)
    .groupBy(candidates.id, cities.name, candidates.createdAt)
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Cached on the same 5-minute window as lib/db/stats.ts, and for the same
 * reason (PLAN-PHASE2.md §5.2): these are GROUP BY scans over candidates and
 * applications, and this app runs on an 8-connection pool.
 *
 * Only the aggregate is cached. The lookup and its log write are outside this
 * boundary — a cached access-log write is not a thing that may exist.
 */
const getCandidateAggregates = unstable_cache(computeAggregates, ['candidates-admin-aggregates'], {
  revalidate: AGGREGATE_TTL_SECONDS,
});

export async function listCandidates(
  actor: SessionUser,
  filters: CandidateFilters,
  reason: string | null | undefined,
  context: AccessContext,
): Promise<CandidateListResult> {
  requireAdmin(actor);

  const lookupAttempted = Boolean(filters.email?.trim() || filters.candidateId);
  const [aggregates, match] = await Promise.all([
    getCandidateAggregates(),
    lookupAttempted ? lookupCandidate(filters) : Promise.resolve(null),
  ]);

  // Only a RESOLVED lookup is logged. A lookup that matched nothing disclosed
  // nothing — and the id that would have to go in `subject_id` does not exist,
  // so there is no one to log an access against. The aggregate view is never
  // logged for the same reason: it has no data subject.
  if (match) {
    await logAccess(
      actor,
      'list_candidates',
      'candidate',
      match.id,
      reason?.trim() ? reason.trim().slice(0, MAX_REASON_LENGTH) : null,
      context,
    );
  }

  return { aggregates, lookupAttempted, match };
}

// ===========================================================================
// viewCandidate — the drill-down (PLAN-PHASE2.md §2.4, §5.2)
// ===========================================================================

export type AdminCandidateProfile = {
  id: number;
  email: string;
  name: string;
  phone: string;
  cityName: string | null;
  headline: string | null;
  isActive: boolean;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  experiences: {
    id: number;
    companyName: string;
    title: string;
    startMonth: string;
    endMonth: string | null;
    isCurrent: boolean;
  }[];
  /** Metadata only. The bytes are a second, separately logged action. */
  cvs: {
    id: number;
    originalFilename: string;
    sizeBytes: number;
    isCurrent: boolean;
    uploadedAt: Date;
  }[];
  applications: {
    id: number;
    jobTitle: string;
    companyName: string;
    status: string;
    redactedAt: Date | null;
    createdAt: Date;
  }[];
};

/**
 * One candidate's full profile, for an admin, with the access recorded.
 * Returns null when no such candidate exists.
 *
 * `reason` is non-optional and is validated before any read happens, so an
 * empty one costs the caller a throw rather than a silent read. The
 * `data_access_logs` row is written INSIDE this function, before the return:
 * there is no ordering of these statements in which the caller receives a
 * profile and the log row does not exist.
 *
 * The CV bytes are NOT here — only their metadata. Opening a CV is a second
 * action with its own `view_cv` row (viewCandidateCvAsAdmin), because "opened
 * the profile" and "read the CV" are different disclosures and a log that
 * conflates them cannot answer either question.
 */
export async function viewCandidate(
  actor: SessionUser,
  candidateId: number,
  reason: string,
  context: AccessContext,
): Promise<AdminCandidateProfile | null> {
  requireAdmin(actor);
  const validReason = requireReason(reason);

  const db = await getDb();

  const [profile] = await db
    .select({
      id: candidates.id,
      email: candidates.email,
      name: candidates.name,
      phone: candidates.phone,
      cityName: cities.name,
      headline: candidates.headline,
      isActive: candidates.isActive,
      emailVerifiedAt: candidates.emailVerifiedAt,
      lastLoginAt: candidates.lastLoginAt,
      createdAt: candidates.createdAt,
    })
    .from(candidates)
    .leftJoin(cities, eq(candidates.cityId, cities.id))
    .where(eq(candidates.id, candidateId))
    .limit(1);

  // Nothing disclosed, nothing logged — an id that resolves to nothing tells
  // the reader neither who the candidate is nor anything about them.
  if (!profile) return null;

  const [experiences, cvs, applicationRows] = await Promise.all([
    db
      .select({
        id: candidateExperiences.id,
        companyName: candidateExperiences.companyName,
        title: candidateExperiences.title,
        startMonth: candidateExperiences.startMonth,
        endMonth: candidateExperiences.endMonth,
        isCurrent: candidateExperiences.isCurrent,
      })
      .from(candidateExperiences)
      .where(eq(candidateExperiences.candidateId, candidateId))
      .orderBy(asc(candidateExperiences.sortOrder), asc(candidateExperiences.id)),

    db
      .select({
        id: candidateCvs.id,
        originalFilename: candidateCvs.originalFilename,
        sizeBytes: candidateCvs.sizeBytes,
        isCurrent: candidateCvs.isCurrent,
        uploadedAt: candidateCvs.uploadedAt,
      })
      .from(candidateCvs)
      .where(and(eq(candidateCvs.candidateId, candidateId), isNull(candidateCvs.deletedAt)))
      .orderBy(desc(candidateCvs.uploadedAt)),

    db
      .select({
        id: applications.id,
        jobTitle: jobs.title,
        companyName: companies.name,
        status: applications.status,
        redactedAt: applications.redactedAt,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(applications.candidateId, candidateId))
      .orderBy(desc(applications.createdAt)),
  ]);

  // Before the return, always. If this insert throws, the caller gets the error
  // and not the profile.
  await logAccess(actor, 'view_candidate', 'candidate', profile.id, validReason, context);

  return {
    ...profile,
    experiences: experiences.map((row) => ({
      ...row,
      startMonth: String(row.startMonth),
      endMonth: row.endMonth === null ? null : String(row.endMonth),
    })),
    cvs,
    applications: applicationRows,
  };
}

// ===========================================================================
// listApplicationsForStaff — /admin/postulaciones
//
// Moved here from lib/db/admin.ts (getAdminApplications), where the portal team
// read every applicant's name, phone, email and message with no log row. That
// is exactly the access /privacidad §6 tells the public "queda registrado", so
// the read now lives behind the same construction as the rest of this file:
// the log rows are written INSIDE the function, before it returns.
//
// Granularity: ONE ROW PER DATA SUBJECT WHOSE PERSONAL DATA THIS CALL RETURNS.
//   - A row whose `redacted_at` is set carries no personal data (every personal
//     column is NULL by then), so nothing about anyone was disclosed and no
//     log row is written for it.
//   - An application from a candidate account is logged against that
//     candidate (`subject_type = 'candidate'`), the key the candidate's own
//     export reads — the same choice viewCandidateCvAsAdmin() makes for a CV.
//   - An anonymous lead-form application has no account, so it is logged
//     against the application itself (`subject_type = 'application'`). No
//     schema change was needed: `subject_type` is a free varchar(30).
//   - A candidate who appears several times on one page gets one row for that
//     page view, not one per application: identical rows add nothing a reader
//     of the log can use.
// The action is `view_application`, which the enum has carried since PR 1 with
// no writer until now.
//
// `reason` is NULL: this table has no reason gate, and adding one changes what
// the operators see — an owner decision, not something this move gets to make.
// The table is paged at 20, so the batch insert is at most 20 rows.
// ===========================================================================

export type StaffApplicationFilters = {
  jobId?: number;
  status?: (typeof applicationStatusEnum)[number];
  page?: number;
};

export type StaffApplicationRow = {
  id: number;
  jobId: number;
  jobTitle: string;
  jobSlug: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  message: string | null;
  status: (typeof applicationStatusEnum)[number];
  /** Set means every personal column above is already NULL: the candidate
   *  withdrew consent (§4.2), deleted their account (§4.4) or the row aged out
   *  (§4.3). Returned so the table can say so, rather than rendering three
   *  empty cells that look like a bug. */
  redactedAt: Date | null;
  createdAt: Date;
};

const STAFF_APPLICATION_PAGE_SIZE = 20;

export async function listApplicationsForStaff(
  actor: SessionUser,
  filters: StaffApplicationFilters,
  context: AccessContext,
): Promise<{ applications: StaffApplicationRow[]; total: number; pageSize: number }> {
  requireApplicationStaff(actor);

  const db = await getDb();
  const page = filters.page ?? 1;
  const conditions = [];
  if (filters.jobId) conditions.push(eq(applications.jobId, filters.jobId));
  if (filters.status) conditions.push(eq(applications.status, filters.status));
  const where = conditions.length ? and(...conditions) : undefined;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: applications.id,
        jobId: applications.jobId,
        candidateId: applications.candidateId,
        jobTitle: jobs.title,
        jobSlug: jobs.slug,
        name: applications.name,
        phone: applications.phone,
        email: applications.email,
        message: applications.message,
        status: applications.status,
        redactedAt: applications.redactedAt,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(where)
      .orderBy(desc(applications.createdAt))
      .limit(STAFF_APPLICATION_PAGE_SIZE)
      .offset((page - 1) * STAFF_APPLICATION_PAGE_SIZE),
    db
      .select({ total: count() })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .where(where),
  ]);

  const subjects = new Map<string, AccessSubject>();
  for (const row of rows) {
    if (row.redactedAt) continue;
    const subject: AccessSubject =
      row.candidateId !== null
        ? { subjectType: 'candidate', subjectId: row.candidateId }
        : { subjectType: 'application', subjectId: row.id };
    subjects.set(`${subject.subjectType}:${subject.subjectId}`, subject);
  }

  // Before the return, always. If this insert throws, the caller gets the error
  // and not the applicants.
  await logAccessMany(actor, 'view_application', [...subjects.values()], null, context);

  // candidateId was selected for the log only; the table never showed it.
  const applicationRows: StaffApplicationRow[] = rows.map((row) => ({
    id: row.id,
    jobId: row.jobId,
    jobTitle: row.jobTitle,
    jobSlug: row.jobSlug,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    status: row.status,
    redactedAt: row.redactedAt,
    createdAt: row.createdAt,
  }));
  return { applications: applicationRows, total, pageSize: STAFF_APPLICATION_PAGE_SIZE };
}

// ===========================================================================
// listAccessLogs — /admin/registros-de-acceso (PLAN-PHASE2.md §5.2)
//
// Reading the access log is NOT itself candidate access: the table holds ids,
// actions, reasons and staff names, and no candidate personal data at all. So
// this function takes no reason and writes no row. Logging log-reads would add
// a row for every glance at the page and bury the rows that matter.
//
// It is admin-only for a different reason than the functions above: this is the
// owner's view of their own team, including themselves, and it is the one place
// where "who looked at what" is answerable without asking the person who looked.
// ===========================================================================

export type AccessLogRow = {
  id: number;
  actorUserId: number;
  actorName: string | null;
  actorRole: string;
  action: string;
  subjectType: string;
  subjectId: number;
  reason: string | null;
  ip: string | null;
  createdAt: Date;
};

export const ACCESS_LOG_PAGE_SIZE = 50;

export async function listAccessLogs(
  actor: SessionUser,
  page: number,
): Promise<{ rows: AccessLogRow[]; total: number; pageSize: number }> {
  requireAdmin(actor);

  const db = await getDb();
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        id: dataAccessLogs.id,
        actorUserId: dataAccessLogs.actorUserId,
        actorName: users.name,
        actorRole: dataAccessLogs.actorRole,
        action: dataAccessLogs.action,
        subjectType: dataAccessLogs.subjectType,
        subjectId: dataAccessLogs.subjectId,
        reason: dataAccessLogs.reason,
        ip: dataAccessLogs.ip,
        createdAt: dataAccessLogs.createdAt,
      })
      .from(dataAccessLogs)
      .leftJoin(users, eq(dataAccessLogs.actorUserId, users.id))
      .orderBy(desc(dataAccessLogs.createdAt))
      .limit(ACCESS_LOG_PAGE_SIZE)
      .offset((safePage - 1) * ACCESS_LOG_PAGE_SIZE),

    db.select({ total: count() }).from(dataAccessLogs),
  ]);

  return { rows, total, pageSize: ACCESS_LOG_PAGE_SIZE };
}
