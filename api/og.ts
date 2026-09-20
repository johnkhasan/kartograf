import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readShare } from './_share.js';

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
/** The poster typeface, shipped with the function so a cold start never waits on a fetch. */
let fontCache: Buffer | null = null;
function posterFont(): Buffer {
  if (!fontCache) fontCache = readFileSync('public/fonts/space-grotesk-700.ttf');
  return fontCache;
}

export default async function handler(request: Request) {
  const preview = readShare(new URL(request.url).searchParams.get('s') ?? '');
  if (!preview) return new Response('Not found', { status: 404 });

  const { theme, title, subtitle, meta } = preview;

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

  // satori turns the lettering into paths, so the rasterizer never needs a
  // font of its own
  const svg = await satori(card as never, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [{ name: 'Poster', data: posterFont(), weight: 700, style: 'normal' }],
  });

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'content-type': 'image/png',
      // the code fully determines the picture, so it never needs revalidating
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
