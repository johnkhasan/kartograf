import { readShare } from './_share.js';

const SITE = 'https://map.javohir.ru';

const escape = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The page a link crawler gets for a shared poster.
 *
 * Shared links point at the shortlink host, which redirects here with the
 * code intact — and crawlers follow redirects, so this is where a per-poster
 * preview belongs. People are never routed here: the rewrite that sends
 * traffic this way matches crawler user agents only, and anyone who lands on
 * it anyway is sent straight on to the app with their code.
 */
export default async function handler(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('s') ?? '';
  const preview = readShare(code);
  const target = `${SITE}/?s=${encodeURIComponent(code)}`;

  if (!preview) {
    return Response.redirect(SITE, 302);
  }

  const title = preview.couple
    ? `${preview.title} — ${preview.meta || preview.subtitle}`
    : `${preview.title}${preview.subtitle ? `, ${preview.subtitle}` : ''}`;
  const description = preview.couple
    ? `Kartograf — ikki joy va ular orasidagi masofa. Posterni ko‘ring, o‘zgartiring va yuklab oling.`
    : `Kartograf — ${preview.title} xarita posteri. Ko‘ring, o‘zgartiring va yuklab oling.`;
  const image = `${SITE}/api/og?s=${encodeURIComponent(code)}`;

  const html = `<!doctype html>
<html lang="uz">
  <head>
    <meta charset="utf-8" />
    <title>${escape(title)}</title>
    <meta name="description" content="${escape(description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Kartograf" />
    <meta property="og:url" content="${escape(target)}" />
    <meta property="og:title" content="${escape(title)}" />
    <meta property="og:description" content="${escape(description)}" />
    <meta property="og:image" content="${escape(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escape(title)}" />
    <meta name="twitter:description" content="${escape(description)}" />
    <meta name="twitter:image" content="${escape(image)}" />
    <link rel="canonical" href="${escape(target)}" />
    <meta http-equiv="refresh" content="0; url=${escape(target)}" />
  </head>
  <body>
    <p><a href="${escape(target)}">${escape(title)}</a></p>
  </body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
}
