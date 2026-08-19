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
