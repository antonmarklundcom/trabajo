'use client';

import { useState } from 'react';

type Props = { url: string };

export default function CopyLinkButton({ url }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-brand font-medium hover:underline"
    >
      {copied ? 'Enlace copiado' : 'Copiar enlace'}
    </button>
  );
}
