#!/usr/bin/env bash
set -euo pipefail

print_usage() {
  echo "Usage: ./run.sh [dev|test|prod] [port]"
  echo "Defaults to environment 'dev' and port 3001."
  echo "You can also set PORT, for example: PORT=3001 ./run.sh dev"
}

ENVIRONMENT=${1:-dev}
APP_PORT=${2:-${PORT:-3001}}

case "$ENVIRONMENT" in
  dev|test|prod)
    echo "Environment: $ENVIRONMENT"
    ;;
  *)
    echo "Invalid environment."
    print_usage
    exit 1
    ;;
esac

if ! [[ "$APP_PORT" =~ ^[0-9]+$ ]] || [ "$APP_PORT" -lt 1 ] || [ "$APP_PORT" -gt 65535 ]; then
  echo "Invalid port: $APP_PORT"
  print_usage
  exit 1
fi

get_package_hash() {
  local files=()
  [ -f "package.json" ] && files+=("package.json")
  [ -f "package-lock.json" ] && files+=("package-lock.json")

  if [ "${#files[@]}" -eq 0 ]; then
    echo "missing-package-files"
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${files[@]}" | shasum -a 256 | awk '{print $1}'
    return
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "${files[@]}" | sha256sum | awk '{print $1}'
    return
  fi

  echo "missing-hash-tool"
}

find_port_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$APP_PORT" -sTCP:LISTEN 2>/dev/null || true
    return
  fi

  if command -v fuser >/dev/null 2>&1; then
    fuser "$APP_PORT"/tcp 2>/dev/null || true
    return
  fi
}

stop_port_listener() {
  echo "Checking port $APP_PORT..."
  local pids
  pids=$(find_port_pids | tr '\n' ' ' | xargs 2>/dev/null || true)

  if [ -z "$pids" ]; then
    echo "Port $APP_PORT is free."
    return
  fi

  echo "Stopping process on port $APP_PORT: $pids"
  kill $pids 2>/dev/null || true
  sleep 2

  local remaining
  remaining=$(find_port_pids | tr '\n' ' ' | xargs 2>/dev/null || true)
  if [ -n "$remaining" ]; then
    echo "Force stopping process on port $APP_PORT: $remaining"
    kill -9 $remaining 2>/dev/null || true
    sleep 1
  fi
}

LAST_HASH_FILE=".last_package_hash"
CURRENT_HASH=$(get_package_hash)
LAST_HASH=""

if [ -f "$LAST_HASH_FILE" ]; then
  LAST_HASH=$(cat "$LAST_HASH_FILE")
fi

if [ ! -d "node_modules" ] || [ "$CURRENT_HASH" != "$LAST_HASH" ]; then
  echo "Installing dependencies..."
  npm install
  echo "$CURRENT_HASH" > "$LAST_HASH_FILE"
else
  echo "Dependencies are up to date."
fi

echo "Building the app..."
npm run build

stop_port_listener

echo "Starting dev server on port $APP_PORT with environment: $ENVIRONMENT"
export PORT="$APP_PORT"
exec npm run "dev:$ENVIRONMENT"

exit $?
