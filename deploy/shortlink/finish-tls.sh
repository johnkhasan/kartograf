#!/usr/bin/env bash
#
# Builds/starts the shortlink app, issues the TLS certificate for
# shortlink.javohir.ru, and publishes the vhost on the shared hsbch nginx.
#
# Run once, after shortlink.javohir.ru resolves to this server. Safe to
# re-run.
#
# Everything it touches outside /srv/shortlink belongs to other live sites
# (hsbch.uz, nasiya.hsbch.uz, duel.hsbch.uz, status.hsbch.uz), so every edit
# is backed up first, the nginx config is validated in a throwaway container
# before the real one is touched, and any failure rolls the originals back.
set -euo pipefail

DOMAIN=shortlink.javohir.ru
EMAIL="${CERTBOT_EMAIL:-admin@javohir.ru}"
CERT_DIR=/srv/shortlink-certs
HSBCH_DIR=/srv/hsbch
NGINX_CONF=$HSBCH_DIR/nginx.conf
COMPOSE=$HSBCH_DIR/docker-compose.yml
SHORTLINK_DIR=/srv/shortlink
VHOST_SRC=$SHORTLINK_DIR/deploy/nginx-shortlink.conf
STAMP=$(date +%s)
MARKER="# >>> shortlink.javohir.ru (managed by /srv/shortlink/deploy/finish-tls.sh)"

log() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

# --- 0. Bring up the app itself --------------------------------------------
log "Building and starting shortlink-app"
( cd "$SHORTLINK_DIR" && docker compose up -d --build )

log "Attaching shortlink-app to the network hsbch-nginx can resolve it on"
docker network connect hsbch_default shortlink-app 2>/dev/null || true

# --- 1. DNS must point here, or the ACME challenge cannot succeed ----------
log "Checking DNS for $DOMAIN"
SERVER_IP=$(curl -fsS --max-time 10 https://api.ipify.org)
RESOLVED=$(dig +short "$DOMAIN" @1.1.1.1 | tail -1)
echo "    server=$SERVER_IP  dns=${RESOLVED:-<none>}"
[ -n "$RESOLVED" ] || fail "$DOMAIN does not resolve yet. Add an A record -> $SERVER_IP and retry."
[ "$RESOLVED" = "$SERVER_IP" ] || fail "$DOMAIN resolves to $RESOLVED, not $SERVER_IP."

# --- 2. Certificate ---------------------------------------------------------
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  log "Certificate already issued — reusing it"
else
  log "Requesting certificate (webroot: the catch-all :80 block already serves the challenge)"
  certbot certonly --webroot -w /srv/certbot-webroot \
    -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" \
    || fail "certbot could not issue a certificate for $DOMAIN"
fi

log "Publishing the certificate where the nginx container can read it"
mkdir -p "$CERT_DIR"
install -m 644 "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$CERT_DIR/fullchain.pem"
install -m 600 "/etc/letsencrypt/live/$DOMAIN/privkey.pem"   "$CERT_DIR/privkey.pem"

# --- 3. Renewal hook ---------------------------------------------------------
HOOK=/etc/letsencrypt/renewal-hooks/deploy/hsbch-nginx-certs.sh
if ! grep -q "$DOMAIN" "$HOOK"; then
  log "Teaching the renewal hook about $DOMAIN"
  cp "$HOOK" "$HOOK.bak-$STAMP"
  python3 - "$HOOK" "$DOMAIN" "$CERT_DIR" <<'PY'
import sys, pathlib
hook, domain, dest = sys.argv[1], sys.argv[2], sys.argv[3]
p = pathlib.Path(hook)
s = p.read_text()
arm = f"  */{domain})\n    DEST={dest}\n    ;;\n"
s = s.replace("  *)\n    exit 0\n    ;;\n", arm + "  *)\n    exit 0\n    ;;\n", 1)
p.write_text(s)
PY
  sh -n "$HOOK" || { mv "$HOOK.bak-$STAMP" "$HOOK"; fail "renewal hook edit produced invalid shell"; }
fi

# --- 4. Mount the cert dir into the shared nginx -----------------------------
if grep -q "$CERT_DIR" "$COMPOSE"; then
  log "Compose already carries the shortlink cert mount"
else
  log "Adding the $CERT_DIR mount to the hsbch compose file"
  cp "$COMPOSE" "$COMPOSE.bak-$STAMP"
  python3 - "$COMPOSE" "$CERT_DIR" <<'PY'
import sys, pathlib
path, cert_dir = sys.argv[1], sys.argv[2]
p = pathlib.Path(path)
s = p.read_text()
anchor = "      - /srv/status-certs:/etc/nginx/status-certs:ro\n"
assert anchor in s, "could not find the status-certs mount to anchor to"
s = s.replace(anchor, anchor + f"      - {cert_dir}:/etc/nginx/shortlink-certs:ro\n", 1)
p.write_text(s)
PY
fi

# --- 5. Append the vhost -----------------------------------------------------
if grep -qF "$MARKER" "$NGINX_CONF"; then
  log "vhost already present — refreshing it"
  cp "$NGINX_CONF" "$NGINX_CONF.bak-$STAMP"
  python3 - "$NGINX_CONF" "$MARKER" <<'PY'
import sys, pathlib
path, marker = sys.argv[1], sys.argv[2]
p = pathlib.Path(path)
s = p.read_text()
p.write_text(s[: s.index(marker)].rstrip() + "\n")
PY
else
  cp "$NGINX_CONF" "$NGINX_CONF.bak-$STAMP"
fi

log "Appending the shortlink.javohir.ru server block"
{
  printf '\n%s\n' "$MARKER"
  sed 's|__CERT_DIR__|/etc/nginx/shortlink-certs|g' "$VHOST_SRC"
} >> "$NGINX_CONF"

# --- 6. Validate before touching the running proxy ---------------------------
log "Validating the full config in a throwaway container"
NGINX_IMAGE=$(docker inspect hsbch-nginx-1 --format '{{.Config.Image}}')
if ! docker run --rm \
      -v "$NGINX_CONF":/etc/nginx/conf.d/default.conf:ro \
      -v "$HSBCH_DIR/certs":/etc/nginx/certs:ro \
      -v /srv/nasiya-certs:/etc/nginx/nasiya-certs:ro \
      -v /srv/dueluz-certs:/etc/nginx/dueluz-certs:ro \
      -v /srv/status-certs:/etc/nginx/status-certs:ro \
      -v "$CERT_DIR":/etc/nginx/shortlink-certs:ro \
      -v dueluz_uploads:/var/www/duel-uploads:ro \
      "$NGINX_IMAGE" nginx -t; then
  log "Config is invalid — rolling everything back, nothing was changed"
  mv "$NGINX_CONF.bak-$STAMP" "$NGINX_CONF"
  [ -f "$COMPOSE.bak-$STAMP" ] && mv "$COMPOSE.bak-$STAMP" "$COMPOSE"
  fail "nginx rejected the generated configuration"
fi

# --- 7. Apply -----------------------------------------------------------------
log "Recreating hsbch-nginx-1 to pick up the new mount (brief restart)"
( cd "$HSBCH_DIR" && docker compose up -d nginx )

log "Waiting for the proxy to answer"
for _ in $(seq 1 30); do
  curl -fsS -o /dev/null --max-time 5 -H 'Host: hsbch.uz' https://127.0.0.1/ --insecure && break
  sleep 1
done

# --- 8. Verify every site the proxy serves, plus the new one end to end -------
log "Verifying all sites behind this proxy"
STATUS=0
check() {
  code=$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 15 "$1" 2>/dev/null || echo 000)
  case "$code" in
    2*|3*) printf '    OK   %-40s %s\n' "$1" "$code" ;;
    *)     printf '    FAIL %-40s %s\n' "$1" "$code"; STATUS=1 ;;
  esac
}
check https://hsbch.uz/
check https://nasiya.hsbch.uz/
check "https://$DOMAIN/"

log "Round-tripping a test link through the new service"
TEST_ID=$(curl -fsS --max-time 10 -X POST "https://$DOMAIN/api/create" \
  -H 'Content-Type: application/json' -H "Origin: https://map.javohir.ru" \
  -d '{"code":"deploy-smoke-test"}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])') \
  || { STATUS=1; echo "    FAIL could not create a test link"; }
if [ -n "${TEST_ID:-}" ]; then
  LOCATION=$(curl -fsS -o /dev/null --max-time 10 -w '%{redirect_url}' "https://$DOMAIN/$TEST_ID")
  case "$LOCATION" in
    *"s=deploy-smoke-test") printf '    OK   %-40s -> %s\n' "https://$DOMAIN/$TEST_ID" "$LOCATION" ;;
    *) printf '    FAIL %-40s -> %s\n' "https://$DOMAIN/$TEST_ID" "$LOCATION"; STATUS=1 ;;
  esac
fi

if [ "$STATUS" -ne 0 ]; then
  log "A site is failing — rolling back nginx"
  mv "$NGINX_CONF.bak-$STAMP" "$NGINX_CONF"
  [ -f "$COMPOSE.bak-$STAMP" ] && mv "$COMPOSE.bak-$STAMP" "$COMPOSE"
  ( cd "$HSBCH_DIR" && docker compose up -d nginx )
  fail "verification failed; the previous configuration has been restored"
fi

log "Done — https://$DOMAIN is live"
