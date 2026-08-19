// ARCO rights — Acceso, Rectificación, Cancelación, Oposición — for the data
// subject themselves (PLAN-PHASE2.md §4.2 and §4.4).
//
// Same discipline as lib/db/candidate-profile.ts and lib/db/employer.ts:
// **every exported function takes `candidateId` as its FIRST parameter and
// every query mentions it in the WHERE clause.** There is no admin branch and
// no "delete by email" convenience — an ARCO cancellation destroys data, and
// the only way to be sure it destroyed the *right* candidate's data is that the
// id came from a session guard and never left the WHERE clause.
//
// Rectification (the R) is deliberately absent from this file: it is the
// profile editor that already exists (lib/db/candidate-profile.ts), and
// /postulante/mis-datos links to it rather than growing a second write path
// onto the same columns.
//
// Deletion is a HARD DELETE. Not a flag, not `is_deleted`, not an anonymised
// husk of the candidate row. PLAN-PHASE2.md §4.4 and AGENTS.md both state this,
// and the reasoning is worth keeping next to the code: cancelación means the
// data stops existing, a soft-delete flag leaves it queryable by exactly the
// actor the candidate is most likely to be worried about, and a flag would have
// to be honoured by every future query — the same "one missed WHERE clause"
// failure this codebase removes everywhere else. If a future change here starts
// looking like a status column, that is the signal to stop.
import 'server-only';

import { createHash } from 'node:crypto';

import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import {
  applications,
  candidateCvs,
  candidateExperiences,
  candidates,
  cities,
  companies,
  consents,
  dataAccessLogs,
  deletionRequests,
  jobs,
  savedJobs,
  candidateTokens,
} from './schema';
import { getStorage } from '../storage';

async function getDb() {
  return (await import('./index')).db;
}

/** sha256 of the lowercased email — see the `deletion_requests` note in schema.ts. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

// ===========================================================================
// A — Acceso: the self-service export
// ===========================================================================

export type CandidateExport = {
  exportedAt: string;
  /** What this file is, in the language the candidate reads. */
  aviso: string;
  perfil: Record<string, unknown>;
  experiencias: Record<string, unknown>[];
  cvs: Record<string, unknown>[];
  postulaciones: Record<string, unknown>[];
  guardados: Record<string, unknown>[];
  consentimientos: Record<string, unknown>[];
  accesosDeNuestroEquipo: Record<string, unknown>[];
};

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

/**
 * Everything this platform holds about one candidate, as plain JSON.
 *
 * "Everything" is meant literally and is the reason this function reads seven
 * tables rather than three: an export that quietly omits the consent ledger or
 * the staff-access log answers a narrower question than the one an access
 * request asks. The only thing not inlined is the CV bytes — those are already
 * downloadable one authorized route away, and base64 of a 5 MB PDF inside a
 * JSON file helps nobody — so each CV carries the URL that serves it.
 *
 * Returns null when the candidate does not exist, which after §4.4 is a
 * permanent, correct answer rather than a transient one.
 */
export async function buildCandidateExport(candidateId: number): Promise<CandidateExport | null> {
  const db = await getDb();

  const [profile] = await db
    .select({
      id: candidates.id,
      email: candidates.email,
      name: candidates.name,
      phone: candidates.phone,
      cityId: candidates.cityId,
      cityName: cities.name,
      headline: candidates.headline,
      isActive: candidates.isActive,
      emailVerifiedAt: candidates.emailVerifiedAt,
      lastLoginAt: candidates.lastLoginAt,
      createdAt: candidates.createdAt,
      updatedAt: candidates.updatedAt,
    })
    .from(candidates)
    .leftJoin(cities, eq(candidates.cityId, cities.id))
    .where(eq(candidates.id, candidateId))
    .limit(1);

  if (!profile) return null;

  const [experiences, cvs, applicationRows, savedJobRows, consentRows, accessRows] = await Promise.all([
    db
      .select()
      .from(candidateExperiences)
      .where(eq(candidateExperiences.candidateId, candidateId))
      .orderBy(asc(candidateExperiences.sortOrder), asc(candidateExperiences.id)),

    db
      .select()
      .from(candidateCvs)
      .where(eq(candidateCvs.candidateId, candidateId))
      .orderBy(desc(candidateCvs.uploadedAt)),

    db
      .select({
        id: applications.id,
        jobTitle: jobs.title,
        jobSlug: jobs.slug,
        companyName: companies.name,
        status: applications.status,
        message: applications.message,
        cvId: applications.cvId,
        consentId: applications.consentId,
        redactedAt: applications.redactedAt,
        createdAt: applications.createdAt,
      })
      .from(applications)
      .innerJoin(jobs, eq(applications.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(applications.candidateId, candidateId))
      .orderBy(desc(applications.createdAt)),

    db
      .select({
        id: savedJobs.id,
        jobTitle: jobs.title,
        jobSlug: jobs.slug,
        companyName: companies.name,
        createdAt: savedJobs.createdAt,
      })
      .from(savedJobs)
      .innerJoin(jobs, eq(savedJobs.jobId, jobs.id))
      .innerJoin(companies, eq(jobs.companyId, companies.id))
      .where(eq(savedJobs.candidateId, candidateId))
      .orderBy(desc(savedJobs.createdAt)),

    db
      .select({
        id: consents.id,
        purpose: consents.purpose,
        granted: consents.granted,
        policyVersion: consents.policyVersion,
        companyName: companies.name,
        jobTitle: jobs.title,
        ip: consents.ip,
        userAgent: consents.userAgent,
        createdAt: consents.createdAt,
      })
      .from(consents)
      .leftJoin(companies, eq(consents.relatedCompanyId, companies.id))
      .leftJoin(jobs, eq(consents.relatedJobId, jobs.id))
      .where(and(eq(consents.subjectType, 'candidate'), eq(consents.subjectId, candidateId)))
      .orderBy(asc(consents.createdAt)),

    // "Who at the platform has looked at my data" — the query the
    // (subject_type, subject_id, created_at) index in schema.ts exists for.
    // The staff member's identity is deliberately NOT included: the candidate
    // is entitled to know that their data was accessed, by which role and for
    // what stated reason, not to receive an employee's user id.
    db
      .select({
        action: dataAccessLogs.action,
        actorRole: dataAccessLogs.actorRole,
        reason: dataAccessLogs.reason,
        createdAt: dataAccessLogs.createdAt,
      })
      .from(dataAccessLogs)
      .where(
        and(eq(dataAccessLogs.subjectType, 'candidate'), eq(dataAccessLogs.subjectId, candidateId)),
      )
      .orderBy(desc(dataAccessLogs.createdAt)),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    aviso:
      'Este archivo contiene todos los datos personales que trabajo.com.py tiene sobre vos. ' +
      'Los archivos de CV no están incluidos como texto: descargalos desde los enlaces en "cvs".',
    perfil: {
      id: profile.id,
      email: profile.email,
      nombre: profile.name,
      telefono: profile.phone,
      ciudad: profile.cityName,
      titular: profile.headline,
      cuentaActiva: profile.isActive,
      emailVerificadoEl: iso(profile.emailVerifiedAt),
      ultimoIngreso: iso(profile.lastLoginAt),
      creadoEl: iso(profile.createdAt),
      actualizadoEl: iso(profile.updatedAt),
    },
    experiencias: experiences.map((row) => ({
      id: row.id,
      empresa: row.companyName,
      puesto: row.title,
      desde: iso(row.startMonth),
      hasta: iso(row.endMonth),
      actual: row.isCurrent,
      descripcion: row.description,
    })),
    cvs: cvs.map((row) => ({
      id: row.id,
      archivo: row.originalFilename,
      tipo: row.mimeType,
      bytes: row.sizeBytes,
      esElActual: row.isCurrent,
      subidoEl: iso(row.uploadedAt),
      // Null once the bytes are gone; the row survives only as bookkeeping for
      // the purge sweep, so offering a download link would be a broken promise.
      descargarEn: row.deletedAt ? null : `/api/postulante/cv/${row.id}`,
      archivoEliminadoEl: iso(row.deletedAt),
    })),
    postulaciones: applicationRows.map((row) => ({
      id: row.id,
      empleo: row.jobTitle,
      empleoUrl: `/empleos/${row.jobSlug}`,
      empresa: row.companyName,
      estado: row.status,
      mensaje: row.message,
      cvCompartidoId: row.cvId,
      consentimientoId: row.consentId,
      // Set means the personal fields above are already NULL in our database:
      // the candidate withdrew consent for this application (§4.2).
      datosRetiradosEl: iso(row.redactedAt),
      creadaEl: iso(row.createdAt),
    })),
    guardados: savedJobRows.map((row) => ({
      id: row.id,
      empleo: row.jobTitle,
      empleoUrl: `/empleos/${row.jobSlug}`,
      empresa: row.companyName,
      guardadoEl: iso(row.createdAt),
    })),
    consentimientos: consentRows.map((row) => ({
      id: row.id,
      finalidad: row.purpose,
      otorgado: row.granted,
      versionDePolitica: row.policyVersion,
      empresa: row.companyName,
      empleo: row.jobTitle,
      ip: row.ip,
      navegador: row.userAgent,
      fecha: iso(row.createdAt),
    })),
    accesosDeNuestroEquipo: accessRows.map((row) => ({
      accion: row.action,
      rol: row.actorRole,
      motivo: row.reason,
      fecha: iso(row.createdAt),
    })),
  };
}

// ===========================================================================
// C — Cancelación: account deletion (PLAN-PHASE2.md §4.4)
// ===========================================================================

export type DeletionCounts = {
  deletionRequestId: number;
  cvObjectsDeleted: number;
  cvRowsDeleted: number;
  experiencesDeleted: number;
  savedJobsDeleted: number;
  /** Verification and password-reset tokens destroyed with the account. */
  tokensDeleted: number;
  applicationsRedacted: number;
  consentsKept: number;
};

export type DeleteAccountOptions = {
  /** Who asked. `admin` covers the retention sweep, which acts for the platform. */
  requestedBy: 'candidate' | 'admin';
  /** The staff user behind an `admin` request, when there is one. */
  actorUserId?: number | null;
  /** Free-text note appended to `deletion_requests.outcome`. */
  note?: string;
};

/**
 * Executes PLAN-PHASE2.md §4.4, in that order, synchronously.
 *
 * The order is the specification, not an implementation detail:
 *
 *   1. Write `deletion_requests` FIRST, before anything is destroyed, so an
 *      interrupted purge is still evidenced. A crash after this point leaves a
 *      row with `executed_at IS NULL`, which is exactly the signal an operator
 *      needs; a crash before it leaves nothing to find.
 *   2. `storage.delete()` every CV object, and HARD-FAIL on error. A failure
 *      here aborts the whole cancellation with the DB untouched, because the
 *      alternative — reporting success while the bytes are still in a bucket —
 *      is the one answer an ARCO cancellation must never give. The DB rows are
 *      then still the only record of where those objects live.
 *   3. `DELETE` candidate_cvs + candidate_experiences + saved_jobs.
 *   4. REDACT the applications rows: NULL the personal columns, set
 *      `redacted_at`. The row survives carrying only job_id/status/timestamps,
 *      so the employer's history and the admin statistics stay coherent
 *      ("3 postulaciones" does not silently become 2).
 *   5. `DELETE` the candidates row.
 *   6. Keep the `consents` rows untouched. They now point at an id that no
 *      longer resolves, which is correct: they are the proof of what was
 *      authorised and they carry no personal data beyond IP/UA.
 *   7. Stamp `deletion_requests.executed_at`.
 *
 * Not queued. At this scale it is a handful of statements and two or three
 * object deletes, and a queue would only add a way for it to silently not
 * happen.
 *
 * Returns null when the candidate does not exist — deletion is idempotent by
 * consequence, since after the first run there is nothing left to match.
 */
export async function deleteCandidateAccount(
  candidateId: number,
  options: DeleteAccountOptions,
): Promise<DeletionCounts | null> {
  const db = await getDb();

  const [candidate] = await db
    .select({ id: candidates.id, email: candidates.email })
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .limit(1);
  if (!candidate) return null;

  const now = new Date();

  // --- 1. Evidence before destruction -------------------------------------
  const [requestResult] = await db.insert(deletionRequests).values({
    candidateId,
    emailHash: hashEmail(candidate.email),
    requestedBy: options.requestedBy,
    actorUserId: options.actorUserId ?? null,
    requestedAt: now,
  });
  const deletionRequestId = requestResult.insertId;

  // --- 2. The bytes, before any row that says where they are --------------
  // Every row, including ones already carrying `deleted_at`: driver deletes are
  // idempotent (ENOENT / HTTP 404 are accepted postconditions, see lib/storage.ts),
  // and re-deleting costs one call, while skipping a row whose bookkeeping was
  // written but whose object survived leaves a CV nobody can ever find again.
  const cvRows = await db
    .select({ id: candidateCvs.id, storageKey: candidateCvs.storageKey })
    .from(candidateCvs)
    .where(eq(candidateCvs.candidateId, candidateId));

  try {
    for (const cv of cvRows) {
      await getStorage().delete(cv.storageKey);
    }
  } catch (err) {
    // Deliberately no partial continuation. The deletion_requests row from
    // step 1 stays with executed_at NULL and now says why, so an operator can
    // see that a cancellation was requested and did not complete.
    await db
      .update(deletionRequests)
      .set({
        outcome:
          `FAILED at step 2 (CV object deletion): ${err instanceof Error ? err.message : String(err)}. ` +
          'No database rows were changed. Retry once storage is reachable.',
      })
      .where(eq(deletionRequests.id, deletionRequestId));
    throw err;
  }

  // Steps 3 to 5 are one transaction. Individually they are three deletes and
  // two updates; together they are the single fact the candidate asked for and
  // /privacidad promises. A crash between them leaves a half-deleted person —
  // CV rows gone but applications still carrying their name and phone, or
  // applications redacted while the candidate row survives to log in against.
  // Neither state is one this app can detect afterwards, and both are worse
  // than the request having failed outright (§12.1).
  //
  // Step 2 (the CV bytes) stays OUTSIDE deliberately: object storage cannot
  // join a database transaction, and §4.4's ordering is bytes-before-rows so a
  // failure leaves rows pointing at objects that are already gone rather than
  // objects nobody has a row for. That asymmetry is the design, not an
  // oversight.
  const {
    cvDelete,
    experienceDelete,
    savedJobsDelete,
    tokenDelete,
    freshRedaction,
    alreadyRedacted,
  } = await db.transaction(async (tx) => {
    // --- 3. The CV and work-history rows ------------------------------------
    const [cvDelete] = await tx
      .delete(candidateCvs)
      .where(eq(candidateCvs.candidateId, candidateId));
    const [experienceDelete] = await tx
      .delete(candidateExperiences)
      .where(eq(candidateExperiences.candidateId, candidateId));
    // No FK ties saved_jobs to candidates either (schema.ts convention), so this
    // hard delete must clean up bookmarks itself. Counted like every other table
    // this function destroys: `deletion_requests.outcome` is the evidence of what
    // a cancellation actually removed, and a table that is silently purged is a
    // table nobody can later prove was purged.
    const [savedJobsDelete] = await tx
      .delete(savedJobs)
      .where(eq(savedJobs.candidateId, candidateId));

    // --- 4. Redact the applications, keep the husk --------------------------
    // Two statements so that an application the candidate had already withdrawn
    // (§4.2) keeps its original `redacted_at`. That date is when their data
    // actually stopped being visible to the employer, and overwriting it with
    // today's would misdate the record in the one direction that flatters us.
    const [freshRedaction] = await tx
      .update(applications)
      .set({
        name: null,
        phone: null,
        email: null,
        message: null,
        cvId: null,
        candidateId: null,
        redactedAt: now,
      })
      .where(and(eq(applications.candidateId, candidateId), isNull(applications.redactedAt)));

    const [alreadyRedacted] = await tx
      .update(applications)
      .set({
        // The personal columns are already NULL on these rows; setting them again
        // is free and means this statement does not depend on §4.2 having done
        // its job perfectly.
        name: null,
        phone: null,
        email: null,
        message: null,
        cvId: null,
        candidateId: null,
      })
      .where(and(eq(applications.candidateId, candidateId), isNotNull(applications.redactedAt)));

    // Verification and password-reset tokens (PLAN-NEXT.md §2 E1). No FK ties
    // them to candidates either, and a live reset token outliving the account
    // it resets is the worst kind of orphan: still redeemable, pointing at an
    // id that a future candidate could be issued.
    const [tokenDelete] = await tx
      .delete(candidateTokens)
      .where(eq(candidateTokens.candidateId, candidateId));

    // --- 5. The candidate row itself ----------------------------------------
    await tx.delete(candidates).where(eq(candidates.id, candidateId));

    return {
      cvDelete,
      experienceDelete,
      savedJobsDelete,
      tokenDelete,
      freshRedaction,
      alreadyRedacted,
    };
  });

  // --- 6. consents: untouched, on purpose ---------------------------------
  // Counted, never written. If a future edit adds a DELETE here, it is deleting
  // the evidence that this deletion was authorised (§4.3 keeps them 5 years).
  const consentRows = await db
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.subjectType, 'candidate'), eq(consents.subjectId, candidateId)));

  const counts: DeletionCounts = {
    deletionRequestId,
    cvObjectsDeleted: cvRows.length,
    cvRowsDeleted: cvDelete.affectedRows,
    experiencesDeleted: experienceDelete.affectedRows,
    savedJobsDeleted: savedJobsDelete.affectedRows,
    tokensDeleted: tokenDelete.affectedRows,
    applicationsRedacted: freshRedaction.affectedRows + alreadyRedacted.affectedRows,
    consentsKept: consentRows.length,
  };

  // --- 7. Stamp it done ---------------------------------------------------
  await db
    .update(deletionRequests)
    .set({
      executedAt: new Date(),
      outcome:
        `OK: ${counts.cvObjectsDeleted} CV object(s) deleted, ${counts.cvRowsDeleted} cv row(s), ` +
        `${counts.experiencesDeleted} experience row(s), ${counts.savedJobsDeleted} saved job(s), ` +
        `${counts.tokensDeleted} token(s), ` +
        `${counts.applicationsRedacted} application(s) redacted, ` +
        `${counts.consentsKept} consent row(s) kept.` +
        (options.note ? ` ${options.note}` : ''),
    })
    .where(eq(deletionRequests.id, deletionRequestId));

  return counts;
}
