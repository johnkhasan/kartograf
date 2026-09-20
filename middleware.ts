export const config = { matcher: '/' };

/** Link crawlers, as they introduce themselves. */
const CRAWLER =
  /bot|crawler|spider|preview|telegram|whatsapp|twitter|facebook|discord|slack|linkedin|skype|vkshare|embedly|quora|pinterest|applebot|whatsapp/i;

/**
 * Sends link crawlers to the per-poster preview.
 *
 * This can't be a rewrite in vercel.json: those are consulted after the
 * filesystem, and `/` is a real file, so a crawler following a short link
 * would always get the app's generic index.html. Middleware runs first.
 *
 * People are untouched — only user agents that announce themselves as
 * crawlers are diverted, and the app is served as usual for everyone else.
 */
export default function middleware(request: Request): Response {
  const url = new URL(request.url);
  const code = url.searchParams.get('s');
  const agent = request.headers.get('user-agent') ?? '';

  if (!code || !CRAWLER.test(agent)) {
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }

  const target = new URL('/api/preview', url);
  target.searchParams.set('s', code);
  return new Response(null, { headers: { 'x-middleware-rewrite': target.toString() } });
}
