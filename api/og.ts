import { ImageResponse } from '@vercel/og';
import { readShare } from './_share';

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * Satori reads plain `{ type, props }` nodes, so the card is built with this
 * instead of JSX: Vercel's function tracing quietly drops the imports of a
 * .tsx entry point, and the route then ships without its own helpers.
 */
type Node = { type: string; props: Record<string, unknown>; key: null; $$typeof: symbol };

const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown
): Node => ({
  type,
  props: { style, ...(children === undefined ? {} : { children }) },
  key: null,
  $$typeof: Symbol.for('react.element'),
});

/**
 * The picture a shared poster shows in a chat.
 *
 * Rendering the real map here would mean a headless browser; what makes a
 * preview worth having is that it names the places and carries the poster's
 * own palette, which the share code already holds. Set in the product's own
 * typeface, fetched from this same deployment.
 */
export default async function handler(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const preview = readShare(searchParams.get('s') ?? '');
  if (!preview) return new Response('Not found', { status: 404 });

  const { theme, title, subtitle, meta } = preview;
  const font = await fetch(new URL('/fonts/space-grotesk-700.ttf', origin))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

  const children: Node[] = [
    el(
      'div',
      {
        display: 'flex',
        fontSize: title.length > 26 ? 60 : 76,
        letterSpacing: 10,
        textAlign: 'center',
        lineHeight: 1.15,
      },
      title
    ),
  ];

  if (subtitle) {
    children.push(
      el(
        'div',
        { display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 26 },
        [
          el('div', { display: 'flex', fontSize: 28, letterSpacing: 10, opacity: 0.85 }, subtitle),
          el('div', { width: 150, height: 3, background: theme.accent, marginTop: 16 }),
        ]
      )
    );
  }

  if (meta) {
    children.push(
      el(
        'div',
        { display: 'flex', fontSize: 24, letterSpacing: 5, marginTop: 24, opacity: 0.75 },
        meta
      )
    );
  }

  children.push(
    el(
      'div',
      {
        position: 'absolute',
        bottom: 38,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 18,
        letterSpacing: 6,
        opacity: 0.5,
      },
      [
        el('div', {
          width: 22,
          height: 22,
          borderRadius: 6,
          border: `3px solid ${theme.accent}`,
          display: 'flex',
        }),
        'KARTOGRAF',
      ]
    )
  );

  const card = el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: theme.bg,
      color: theme.text,
      padding: '0 80px',
      fontFamily: 'Poster',
    },
    children
  );

  return new ImageResponse(card as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: font ? [{ name: 'Poster', data: font, weight: 700, style: 'normal' }] : undefined,
    headers: {
      // the code fully determines the picture, so it never needs revalidating
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
