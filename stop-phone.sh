#!/usr/bin/env bash
# Stop everything launch-phone.sh started.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
RT="$ROOT/.runtime"

for name in tunnel apk web api mongo; do
  pid_file="$RT/$name.pid"
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file")
    if kill "$pid" 2>/dev/null; then echo "[stop] $name (pid $pid) stopped"; fi
    rm -f "$pid_file"
  fi
done
# Belt-and-suspenders for the child processes vite/node spawn.
pkill -f "vite --port 5174" 2>/dev/null || true
pkill -f "localtunnel"      2>/dev/null || true
echo "[stop] done"
