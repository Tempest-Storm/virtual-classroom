#!/usr/bin/env bash
#
# One command to run the whole app and expose it to your phone over ANY network.
#
#   ./launch-phone.sh                 # random public URL
#   ./launch-phone.sh my-classroom    # try to reserve https://my-classroom.loca.lt
#
# Starts: MongoDB -> API (:5000) -> web (:5174) -> public tunnel.
# Open the printed https URL on your phone (cellular or any WiFi), then use
# "Add to Home Screen" to install it as an app.
#
# Stop everything with:  ./stop-phone.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
RT="$ROOT/.runtime"
SUBDOMAIN="${1:-benjamin-vclass}"
mkdir -p "$RT/mongo"

log()  { printf '\033[36m[launch]\033[0m %s\n' "$*"; }
warn() { printf '\033[33m[launch]\033[0m %s\n' "$*"; }

port_up() { ss -ltn 2>/dev/null | grep -q ":$1 "; }
wait_port() { for _ in $(seq 1 "${2:-30}"); do port_up "$1" && return 0; sleep 1; done; return 1; }

# --- MongoDB -----------------------------------------------------------------
if port_up 27017; then
  log "MongoDB already running on 27017"
else
  log "starting MongoDB…"
  nohup mongod --dbpath "$RT/mongo" --port 27017 --bind_ip 127.0.0.1 --quiet \
    >"$RT/mongo.log" 2>&1 &
  echo $! > "$RT/mongo.pid"
  wait_port 27017 || { warn "MongoDB failed — see $RT/mongo.log"; exit 1; }
fi

# --- Seed once (only if the DB is empty) -------------------------------------
USERS=$(mongosh --quiet --port 27017 virtual_classroom \
          --eval 'db.users.countDocuments()' 2>/dev/null || echo 0)
if [ "${USERS:-0}" = "0" ]; then
  log "seeding demo data…"
  ( cd "$ROOT/server" && npm run seed >"$RT/seed.log" 2>&1 ) \
    && log "seed complete" || warn "seed failed — see $RT/seed.log"
else
  log "database already has $USERS users — skipping seed"
fi

# --- API ---------------------------------------------------------------------
if port_up 5000; then
  log "API already running on 5000"
else
  log "starting API on :5000…"
  nohup bash -c "cd '$ROOT/server' && exec node src/index.js" >"$RT/api.log" 2>&1 &
  echo $! > "$RT/api.pid"
  wait_port 5000 || { warn "API failed — see $RT/api.log"; exit 1; }
fi

# --- Web (Vite) --------------------------------------------------------------
if port_up 5174; then
  log "web already running on 5174"
else
  log "starting web on :5174…"
  nohup bash -c "cd '$ROOT/web' && exec npx vite --port 5174 --host" >"$RT/web.log" 2>&1 &
  echo $! > "$RT/web.pid"
  wait_port 5174 || { warn "web failed — see $RT/web.log"; exit 1; }
fi

# --- Public tunnel (supervised: loca.lt drops idle tunnels, so auto-restart) --
log "opening public tunnel (subdomain: $SUBDOMAIN)…"
: > "$RT/tunnel.log"
nohup bash -c '
  while true; do
    echo "[tunnel] connecting $(date +%H:%M:%S)…"
    "'"$ROOT"'/node_modules/.bin/lt" --port 5174 --subdomain "'"$SUBDOMAIN"'"
    echo "[tunnel] dropped — reconnecting in 2s"
    sleep 2
  done
' >>"$RT/tunnel.log" 2>&1 &
echo $! > "$RT/tunnel.pid"

URL=""
for _ in $(seq 1 25); do
  URL=$(grep -oE 'https://[a-z0-9-]+\.loca\.lt' "$RT/tunnel.log" 2>/dev/null | head -1 || true)
  [ -n "$URL" ] && break
  sleep 1
done

PASS=$(curl -s -m8 https://loca.lt/mytunnelpassword 2>/dev/null \
        || curl -s -m8 https://api.ipify.org 2>/dev/null || echo "your PC's public IP")
LAN_IP=$(hostname -I 2>/dev/null | awk '{print $1}')

# --- Serve the APK over LAN for a one-time phone download --------------------
if [ -f "$ROOT/VirtualClassroom-debug.apk" ]; then
  mkdir -p "$RT/apk"
  cp -f "$ROOT/VirtualClassroom-debug.apk" "$RT/apk/VirtualClassroom-debug.apk"
  if ! port_up 5175; then
    nohup python3 -m http.server 5175 --bind 0.0.0.0 --directory "$RT/apk" \
      >"$RT/apk-serve.log" 2>&1 &
    echo $! > "$RT/apk.pid"
  fi
fi

echo
echo "======================================================================"
echo "  ✅  Backend is up. The APK talks to it two ways — pick per situation:"
echo
echo "   ── SAME WiFi as this PC (rock-solid) ─────────────────────────────"
echo "      In the app's login screen ▸ \"Server settings\", set:"
echo "          http://$LAN_IP:5000"
echo
if [ -n "$URL" ]; then
  echo "   ── OFF WiFi / cellular (via tunnel — occasional hiccups) ─────────"
  echo "      Default backend is already:  $URL"
  echo "      (If the app can't connect, wait a few seconds and retry — the"
  echo "       tunnel auto-reconnects.)"
else
  warn "  Tunnel URL not detected yet — check $RT/tunnel.log"
fi
echo
echo "   ── Install the APK on the phone (one time) ───────────────────────"
[ -n "$LAN_IP" ] && echo "      Same WiFi: open  http://$LAN_IP:5175/VirtualClassroom-debug.apk"
echo "      Or over USB:     adb install VirtualClassroom-debug.apk"
echo
echo "  Demo logins (password: Password123)"
echo "     teacher@demo.io   ·   amina@demo.io   ·   peter@demo.io"
echo
echo "  Stop everything:  ./stop-phone.sh"
echo "======================================================================"
