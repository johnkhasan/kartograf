# shortlink.javohir.ru

Self-hosted URL shortener for Kartograf's "Share" feature, running on the
same VPS as several other unrelated projects (behind the shared `hsbch`
nginx). It replaces the long, base64-ish `?s=...` share links with e.g.
`https://shortlink.javohir.ru/aB3kZ9`.

- **`server.js`** — dependency-free Node HTTP server. `POST /api/create`
  stores a share payload (the compressed code from `src/lib/share.ts`) and
  returns a short id; `GET /:id` 302-redirects to
  `https://map.javohir.ru/?s=<code>`. Data lives in a single JSON file on a
  Docker volume — traffic here is expected to stay low (personal poster
  shares), so a flat file beats a database for this.
- **`Dockerfile` / `docker-compose.yml`** — builds and runs the service as
  container `shortlink-app`.
- **`nginx-shortlink.conf`** — the vhost block appended to the shared
  `hsbch-nginx` proxy's config (`/srv/hsbch/nginx.conf` on the VPS).
- **`finish-tls.sh`** — one-shot setup: builds/starts the app, issues the
  Let's Encrypt certificate (webroot method against the shared proxy's
  catch-all `:80` block), wires the renewal hook, appends the vhost, and
  validates the *entire* nginx config in a throwaway container before
  touching the live one — rolling back automatically if anything (including
  the other, unrelated sites on that box) fails to come back up.

## Deploying (or redeploying after an edit)

This is deployed by hand — there's no CI here, since it changes rarely and
lives on infrastructure shared with other projects.

```bash
scp server.js Dockerfile docker-compose.yml root@207.180.200.230:/srv/shortlink/
scp nginx-shortlink.conf finish-tls.sh root@207.180.200.230:/srv/shortlink/deploy/
ssh root@207.180.200.230 "chmod +x /srv/shortlink/deploy/finish-tls.sh && bash /srv/shortlink/deploy/finish-tls.sh"
```

`finish-tls.sh` is safe to re-run — it reuses the existing certificate and
skips steps that are already done, so it also works as the redeploy command
after changing `server.js` (it always rebuilds the image first).

## Environment

Set on the `app` service in `docker-compose.yml`:

- `TARGET_ORIGIN` — where `GET /:id` redirects to (`https://map.javohir.ru`).
- `ALLOWED_ORIGINS` — comma-separated list of origins the `/api/create` CORS
  policy accepts fetches from. Must include the site that calls it.
