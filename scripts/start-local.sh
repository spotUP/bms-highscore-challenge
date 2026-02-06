#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PID_FILE=".local-pids"

if [ -f "$PID_FILE" ]; then
  while read -r pid; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
fi

if [ -f ".env" ]; then
  set -a
  . ./.env
  set +a
fi

export PORT="${PORT:-3001}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://localhost:${PORT}}"

nohup npm run server > /tmp/retroranks-api.log 2>&1 &
API_PID=$!

nohup npm run dev > /tmp/retroranks-dev.log 2>&1 &
DEV_PID=$!

printf "%s\n%s\n" "$API_PID" "$DEV_PID" > "$PID_FILE"

echo "Retroranks API: http://localhost:${PORT}/health"
echo "Retroranks web: http://localhost:8081"
echo "Logs: /tmp/retroranks-api.log /tmp/retroranks-dev.log"
