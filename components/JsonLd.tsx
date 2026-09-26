import { serializeJsonLd } from '@/lib/json-ld';

// The only place on the site that writes a JSON-LD <script>. See
// lib/json-ld.ts for why JSON.stringify alone is not enough here.
export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
