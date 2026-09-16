// Asserts what lib/sentry-options.ts promises: no event leaving this app
// carries a credential or a data subject (PLAN-NEXT.md §3 O1).
//
// This is asserted rather than reviewed for the same reason B1's properties
// are. A scrubber that misses a field is completely invisible — the app works,
// errors arrive in Sentry, the issues look right — and the only place the miss
// shows up is inside a vendor's event store, which is exactly where
// ARCO-regulated data must not be. The original miss was breadcrumbs: request
// URLs were stripped of their query string while the crumb trail beside them
// still held `/postulante/recuperar/confirmar?token=<live reset token>`.
//
// No network and no DSN: scrubEvent is a pure function of an event object.
import type { ErrorEvent, EventHint } from '@sentry/nextjs';

import { scrubEvent } from '../lib/sentry-options';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'}  ${label}${ok ? '' : ` — got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`,
  );
}

const hint = {} as EventHint;
const scrub = (event: Partial<ErrorEvent>) => scrubEvent(event as ErrorEvent, hint) as ErrorEvent;

// The two live secrets this site puts in a query string.
const RESET_URL = 'https://trabajo.com.py/postulante/recuperar/confirmar?token=live-reset-token';
const VERIFY_URL = 'https://trabajo.com.py/postulante/verificar?token=live-verify-token';

console.log('\n— request —');

const request = scrub({
  user: { id: '7', email: 'postulante@example.com', ip_address: '203.0.113.7' },
  extra: { formValues: { phone: '0981000000' } },
  request: {
    url: RESET_URL,
    query_string: 'token=live-reset-token',
    data: { password: 'hunter2' },
    cookies: { session: 'abc' },
    headers: {
      // Deliberately mixed casing: which runtime captured the event decides it.
      Referer: RESET_URL,
      Cookie: 'session=abc',
      authorization: 'Bearer abc',
      'X-Forwarded-For': '203.0.113.7',
      'user-agent': 'Mozilla/5.0',
    },
  },
});

check('the user object is gone', request.user, undefined);
check('extra is gone', request.extra, undefined);
check('the body is gone', request.request?.data, undefined);
check('cookies are gone', request.request?.cookies, undefined);
check('query_string is gone', request.request?.query_string, undefined);
check(
  'the request URL keeps its path and loses the token',
  request.request?.url,
  'https://trabajo.com.py/postulante/recuperar/confirmar',
);
check('Referer is gone despite its casing', request.request?.headers?.Referer, undefined);
check('Cookie is gone despite its casing', request.request?.headers?.Cookie, undefined);
check('X-Forwarded-For is gone despite its casing', request.request?.headers?.['X-Forwarded-For'], undefined);
check('authorization is gone', request.request?.headers?.authorization, undefined);
// The scrubber must not empty the event of everything useful.
check('user-agent survives', request.request?.headers?.['user-agent'], 'Mozilla/5.0');

console.log('\n— breadcrumbs —');

const crumbs = scrub({
  breadcrumbs: [
    { category: 'navigation', data: { from: '/postulante/entrar', to: VERIFY_URL } },
    { category: 'fetch', data: { url: RESET_URL, method: 'POST', status_code: 500 } },
    { category: 'xhr', data: { url: '/api/empleos?q=soldador' } },
    { category: 'console', level: 'log', message: 'form state {"email":"a@b.com"}' },
    { category: 'ui.click', message: 'button#enviar' },
  ],
}).breadcrumbs!;

check('the console crumb is dropped whole', crumbs.length, 4);
check('no dropped crumb was a console crumb', crumbs.some((c) => c.category === 'console'), false);
check(
  'a navigation crumb keeps its path',
  crumbs[0].data?.to,
  'https://trabajo.com.py/postulante/verificar',
);
check('a navigation crumb keeps the other end', crumbs[0].data?.from, '/postulante/entrar');
check(
  'a fetch crumb loses the reset token',
  crumbs[1].data?.url,
  'https://trabajo.com.py/postulante/recuperar/confirmar',
);
check('a fetch crumb keeps what debugs it', crumbs[1].data?.status_code, 500);
check('a search query is not sent either', crumbs[2].data?.url, '/api/empleos');
// Index 3, not 4: the console crumb ahead of it was dropped.
check('an unrelated crumb is untouched', crumbs[3].message, 'button#enviar');

console.log('\n— no token survives anywhere —');

// The blunt version of every check above: serialise the whole scrubbed event
// and assert the secrets are simply not in it. New fields are covered inside
// wholesale-deleted user/extra objects, or breadcrumb data named url/from/to.
// Other breadcrumb data names and anything under event.contexts have no rule
// in lib/sentry-options.ts: that is a known limit, not a promise made here.
const everything = JSON.stringify(
  scrub({
    user: { id: '7' },
    request: { url: RESET_URL, query_string: 'token=live-reset-token', headers: { Referer: VERIFY_URL } },
    breadcrumbs: [
      { category: 'navigation', data: { from: RESET_URL, to: VERIFY_URL } },
      { category: 'console', message: `fetching ${RESET_URL}` },
    ],
  }),
);

check('no reset token anywhere in the event', everything.includes('live-reset-token'), false);
check('no verification token anywhere in the event', everything.includes('live-verify-token'), false);

console.log('\n— the rules generalise past the fixture —');

// These fields never appear in the fixture above. Their removal is evidence
// that the rules apply wholesale, not just to the handful of keys written down.
const sensitiveHeaders: Record<string, string> = {
  Authorization: 'secret-authorization',
  'Proxy-Authorization': 'secret-proxy-authorization',
  COOKIE: 'secret-cookie',
  'Set-Cookie': 'secret-set-cookie',
  REFERER: 'secret-referer',
  Referrer: 'secret-referrer',
  FORWARDED: 'secret-forwarded',
  'X-FORWARDED-FOR': 'secret-forwarded-for',
  'X-Real-IP': 'secret-real-ip',
  'X-Api-Key': 'secret-api-key',
  'x-CSRF-Token': 'secret-csrf-token',
};
const headers = scrub({
  request: { headers: { ...sensitiveHeaders, 'accept-language': 'es-PY' } },
});
for (const name of Object.keys(sensitiveHeaders)) {
  check(`the sensitive header ${name} is gone despite its casing`, headers.request?.headers?.[name], undefined);
}
check('accept-language survives', headers.request?.headers?.['accept-language'], 'es-PY');
const serializedHeaders = JSON.stringify(headers);
for (const secret of Object.values(sensitiveHeaders)) {
  check(`no ${secret} survives anywhere in the event`, serializedHeaders.includes(secret), false);
}

const nestedUser = scrub({
  user: {
    username: 'private-username',
    segment: 'private-segment',
    geo: { city: 'Asunción', region: 'Central', country_code: 'PY' },
  },
});
check('unknown and nested user fields disappear with the whole user', nestedUser.user, undefined);

const nestedExtra = scrub({
  extra: {
    context: { candidate: { cv: { filename: 'private-cv.pdf', token: 'nested-cv-secret' } } },
    ids: [1, 2],
  },
});
check('deeply nested extra disappears whole', nestedExtra.extra, undefined);
check('no nested CV secret survives anywhere in the event', JSON.stringify(nestedExtra).includes('nested-cv-secret'), false);

for (const category of ['redirect', 'ui.click', 'sentry.transaction']) {
  const event = scrub({
    breadcrumbs: [{ category, data: { url: RESET_URL, from: VERIFY_URL, to: RESET_URL } }],
  });
  check(
    `a ${category} crumb keeps only the url path`,
    event.breadcrumbs?.[0].data?.url,
    'https://trabajo.com.py/postulante/recuperar/confirmar',
  );
  check(
    `a ${category} crumb keeps only the from path`,
    event.breadcrumbs?.[0].data?.from,
    'https://trabajo.com.py/postulante/verificar',
  );
  check(
    `a ${category} crumb keeps only the to path`,
    event.breadcrumbs?.[0].data?.to,
    'https://trabajo.com.py/postulante/recuperar/confirmar',
  );
}

const messageCrumb = scrub({
  breadcrumbs: [{ category: 'redirect', message: `redirecting to ${RESET_URL}` }],
});
check('a non-console crumb carrying a token survives', messageCrumb.breadcrumbs?.length, 1);
check(
  'a non-console message keeps its text and loses the token',
  messageCrumb.breadcrumbs?.[0].message,
  'redirecting to https://trabajo.com.py/postulante/recuperar/confirmar',
);

console.log('\n— the event is still worth having —');

const kept = scrub({
  request: { url: 'https://trabajo.com.py/empleos', headers: { 'user-agent': 'Mozilla/5.0' } },
  breadcrumbs: [{ category: 'ui.click', message: 'button#postular' }],
});

check('a clean URL is untouched', kept.request?.url, 'https://trabajo.com.py/empleos');
check('a clean crumb trail survives', kept.breadcrumbs?.length, 1);

// An event with none of these fields must pass through rather than throw:
// beforeSend runs on every event, including ones captured before a request
// exists.
const bare = scrub({});
check('a bare event survives', bare !== null, true);

console.log(failures === 0 ? '\nAll Sentry scrubbing properties hold.\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
