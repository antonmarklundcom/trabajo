// The Spanish (Paraguay) copy for the transactional emails a candidate can
// receive. Copy lives apart from the send seam so that
// changing a sentence is not an edit to the delivery path.
//
// Transactional only, per PLAN-NEXT.md §2 E1: these confirm something the
// person just did or asked for. No marketing, no job recommendations — a
// candidate who resets a password has not asked to hear from us about anything
// else.
import 'server-only';

import { emailUrl, type EmailMessage } from '../email';

export function emailVerificationMessage(to: string, name: string, token: string): EmailMessage {
  const link = emailUrl(`/postulante/verificar?token=${encodeURIComponent(token)}`);
  return {
    to,
    subject: 'Confirmá tu email — trabajo.com.py',
    text: [
      `Hola ${name},`,
      '',
      'Creaste una cuenta en trabajo.com.py. Confirmá tu email entrando acá:',
      '',
      link,
      '',
      'El enlace vence en 24 horas.',
      '',
      'Tu cuenta ya funciona aunque no confirmes: podés postularte y cargar tu CV igual.',
      'Confirmar el email nos ayuda a saber que la dirección es tuya.',
      '',
      'Si no creaste esta cuenta, ignorá este mensaje.',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}

export function passwordResetMessage(to: string, name: string, token: string): EmailMessage {
  const link = emailUrl(`/postulante/recuperar/confirmar?token=${encodeURIComponent(token)}`);
  return {
    to,
    subject: 'Restablecer tu contraseña — trabajo.com.py',
    text: [
      `Hola ${name},`,
      '',
      'Pediste restablecer la contraseña de tu cuenta en trabajo.com.py.',
      'Entrá acá para elegir una nueva:',
      '',
      link,
      '',
      'El enlace vence en 30 minutos y se puede usar una sola vez.',
      '',
      'Si no pediste esto, no hace falta que hagas nada: tu contraseña actual sigue',
      'funcionando y este enlace vence solo.',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}

/**
 * The retention warning (PLAN-NEXT.md §2 E2).
 *
 * This one is the difference between /privacidad describing a deletion policy
 * and the site actually operating one: §4.3 promises a warning before an
 * inactive profile is purged, and until now the sweep only counted who should
 * get it. The copy leads with what to do about it, because the action that
 * cancels the deletion is simply logging in.
 */
export function retentionWarningMessage(
  to: string,
  name: string,
  monthsUntilPurge: number,
): EmailMessage {
  return {
    to,
    subject: 'Tu perfil en trabajo.com.py se va a eliminar por inactividad',
    text: [
      `Hola ${name},`,
      '',
      'Hace tiempo que no usás tu cuenta en trabajo.com.py.',
      '',
      `Según nuestra política de privacidad, los perfiles inactivos se eliminan.`,
      `Si no ingresás en los próximos ${monthsUntilPurge} meses, vamos a borrar tu perfil,`,
      'tu CV y tus datos personales de forma permanente.',
      '',
      'Para conservar tu cuenta no tenés que hacer nada especial: alcanza con ingresar.',
      '',
      emailUrl('/postulante/login'),
      '',
      'Si preferís que borremos tus datos ahora, podés hacerlo vos mismo desde',
      'tu perfil, en "Mis datos".',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}

/**
 * "Recibimos tu postulación" (PLAN-NEXT.md §3 N1).
 *
 * Sent on both application paths, so `name` can be absent: the anonymous lead
 * form takes a name but this email is also the one an unnamed submission would
 * get, and a greeting is not worth a lookup that could fail.
 *
 * Deliberately does NOT say when or whether the employer will reply. We do not
 * control that, and a confirmation that implies a response is a promise the
 * site cannot keep. It says what happened and where to see it, nothing more.
 */
export function applicationReceivedMessage(
  to: string,
  name: string | null,
  jobTitle: string,
  companyName: string,
): EmailMessage {
  return {
    to,
    subject: `Recibimos tu postulación — ${jobTitle}`,
    text: [
      name ? `Hola ${name},` : 'Hola,',
      '',
      `Recibimos tu postulación a "${jobTitle}" en ${companyName}.`,
      '',
      'Tus datos ya están con la empresa. Si les interesa tu perfil, te van a',
      'contactar por los datos que dejaste.',
      '',
      'Podés seguir viendo empleos acá:',
      emailUrl('/empleos'),
      '',
      'Recibís este correo porque te postulaste a un empleo en trabajo.com.py.',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}

/**
 * "La empresa quiere contactarte" (PLAN-NEXT.md §3 N3).
 *
 * Sent on ONE transition, `contacted`, and no other. `reviewed` and
 * `discarded` are deliberately silent: a "te descartaron" email is a rejection
 * the candidate did not ask to be told about in that form, and "alguien miró tu
 * perfil" is noise dressed as news.
 *
 * It says the employer intends to make contact — not that they will, and not
 * when. We do not control either, and the message has to survive an employer
 * who marks the row and then never calls.
 */
export function applicationContactedMessage(
  to: string,
  name: string,
  jobTitle: string,
  companyName: string,
): EmailMessage {
  return {
    to,
    subject: `${companyName} quiere contactarte — ${jobTitle}`,
    text: [
      `Hola ${name},`,
      '',
      `${companyName} marcó tu postulación a "${jobTitle}" como contactada.`,
      '',
      'Eso quiere decir que les interesó tu perfil y que van a escribirte o',
      'llamarte por los datos que dejaste. Revisá que tu teléfono y tu correo',
      'estén al día:',
      '',
      emailUrl('/postulante/perfil'),
      '',
      'Recibís este aviso porque te postulaste a este empleo. Podés desactivar',
      'estos avisos desde tu perfil.',
      '',
      '— trabajo.com.py',
    ].join('\n'),
  };
}
