import { z } from 'zod';

// A company's website is typed by the employer and published twice: in the
// job's JobPosting JSON-LD (`hiringOrganization.sameAs`) and on the admin
// panel. Anything that is not an absolute http(s) URL — `javascript:`, a bare
// string carrying markup, a data: URI — is rejected at the write instead of
// being trusted at every read. lib/json-ld.ts escapes the output regardless;
// this keeps the stored value meaning what the field claims it means.
//
// Every route that writes `companies.website` validates with this schema.

export const COMPANY_WEBSITE_ERROR = 'El sitio web debe ser una dirección que empiece con http:// o https://.';

export function isHttpUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.includes('.');
}

export const companyWebsiteSchema = z
  .string()
  .trim()
  .max(500)
  .refine(isHttpUrl, { message: COMPANY_WEBSITE_ERROR })
  .nullable();
