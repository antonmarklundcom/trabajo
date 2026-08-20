'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WithdrawButton({ applicationId }: { applicationId: number }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleWithdraw() {
    if (
      !confirm(
        'Vas a retirar tu consentimiento para esta postulación. La empresa dejará de ver tus datos de contacto y tu CV para esta vacante. ¿Continuar?',
      )
    ) {
      return;
    }
    setSubmitting(true);
    await fetch(`/api/postulante/postulaciones/${applicationId}/retirar`, { method: 'POST' });
    router.refresh();
  }

  return (
    <button
      onClick={handleWithdraw}
      disabled={submitting}
      className="text-xs text-error hover:underline disabled:opacity-60"
    >
      {submitting ? 'Retirando...' : 'Retirar consentimiento'}
    </button>
  );
}
