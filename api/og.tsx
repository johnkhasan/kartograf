import { ImageResponse } from '@vercel/og';
import { readShare } from './_share';

export const config = { runtime: 'edge' };

const WIDTH = 1200;
const HEIGHT = 630;

/**
 * The picture a shared poster shows in a chat.
 *
 * Rendering the real map here would mean a headless browser; what makes a
 * preview worth having is that it names the places and carries the poster's
 * own palette, which the share code already contains. The card is set in the
 * product's own typeface, fetched from the same deployment.
 */
export default async function handler(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const preview = readShare(searchParams.get('s') ?? '');

  if (!preview) {
    return new Response('Not found', { status: 404 });
  }

  const { theme, title, subtitle, meta } = preview;
  const font = await fetch(new URL('/fonts/space-grotesk-700.ttf', origin))
    .then((r) => (r.ok ? r.arrayBuffer() : null))
    .catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
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
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 26 ? 62 : 78,
            letterSpacing: 10,
            textAlign: 'center',
            lineHeight: 1.15,
          }}
        >
          {title}
        </div>

        {subtitle ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              marginTop: 26,
            }}
          >
            <div style={{ display: 'flex', fontSize: 28, letterSpacing: 10, opacity: 0.85 }}>
              {subtitle}
            </div>
            <div style={{ width: 150, height: 3, background: theme.accent, marginTop: 16 }} />
          </div>
        ) : null}

        {meta ? (
          <div style={{ display: 'flex', fontSize: 24, letterSpacing: 5, marginTop: 24, opacity: 0.75 }}>
            {meta}
          </div>
        ) : null}

        <div
          style={{
            position: 'absolute',
            bottom: 38,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 18,
            letterSpacing: 6,
            opacity: 0.5,
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 6, border: `3px solid ${theme.accent}`, display: 'flex' }} />
          KARTOGRAF
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: font ? [{ name: 'Poster', data: font, weight: 700, style: 'normal' }] : undefined,
      headers: {
        // the code fully determines the picture, so it never needs revalidating
        'cache-control': 'public, max-age=31536000, immutable',
      },
    }
  );
}
