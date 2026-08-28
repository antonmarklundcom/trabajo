// POST /api/empresa/verificar/reenviar — mail a fresh verification link.
//
// Without this, a link that never arrived (typo'd address, greylisted domain,
// RESEND_API_KEY not yet configured on the day the account was made) is
// unrecoverable, and the confirmation would quietly stop meaning anything.
//
// Authenticated, unlike the two handlers beside it: the address it sends to is
// read from the session's own user row and is never taken from the request. So
// there is no address to enumerate and nothing to spray — the worst an
// attacker with a stolen session can do is mail the account's real owner.
// Issuing supersedes the user's outstanding tokens, so the newest link is
// always the only working one.
import { authErrorResponse, requireApiSession, AuthError } from '@/lib/auth';
import { employerDashboardEnabled, employerSignupEnabled } from '@/lib/flags';
import { issueUserToken, EMAIL_VERIFICATION_TTL_MS } from '@/lib/db/user-tokens';
import { getEmployerCompany } from '@/lib/db/employer';
import { sendEmail } from '@/lib/email';
import { employerVerificationMessage } from '@/lib/emails/employer';
import { clientIpOrUnknown } from '@/lib/client-ip';
import { isEmployerSignupLimited } from '@/lib/public-write-limiter';

export async function POST(request: Request) {
  if (!employerDashboardEnabled() || !employerSignupEnabled()) {
    return Response.json({ error: 'No encontrado.' }, { status: 404 });
  }

  try {
    const user = await requireApiSession();
    if (user.role !== 'employer') {
      throw new AuthError(403, `Role "${user.role}" is not an employer.`);
    }
    if (user.companyId === null) {
      throw new AuthError(403, `Employer ${user.id} has no company assigned.`);
    }

    // Shares the signup budget on purpose: both mint a verification email to a
    // fresh address, and one counter is the honest way to bound how many this
    // origin can cause.
    if (isEmployerSignupLimited(clientIpOrUnknown(request.headers))) {
      return Response.json(
        { error: 'Demasiadas solicitudes. Probá de nuevo más tarde.' },
        { status: 429 },
      );
    }

    const company = await getEmployerCompany(user.companyId);
    const token = await issueUserToken(user.id, 'email_verification', EMAIL_VERIFICATION_TTL_MS);
    // Never throws, and a skipped send is not an error the employer caused —
    // so the response is the same either way (lib/email.ts).
    await sendEmail(
      employerVerificationMessage(user.email, user.name, company?.name ?? 'tu empresa', token),
    );

    return Response.json({ ok: true });
  } catch (err) {
    return authErrorResponse(err) ?? Response.json({ error: 'Error interno.' }, { status: 500 });
  }
}
