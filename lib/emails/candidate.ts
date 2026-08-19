// The Spanish (Paraguay) copy for the two transactional emails a candidate can
// receive from outside a session. Copy lives apart from the send seam so that
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
