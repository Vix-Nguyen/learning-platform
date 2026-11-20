#!/bin/bash
set -euo pipefail

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$app_root"
if ! command -v node >/dev/null; then
  echo 'Node.js is missing. Install Node.js 24+ and rerun npm run setup:mac.' >&2
  exit 1
fi
if [[ "$(node -p 'parseInt(process.versions.node)')" -lt 24 ]]; then
  echo 'FluentPath requires Node.js 24 or newer. Rerun npm run setup:mac after upgrading.' >&2
  exit 1
fi
if [[ ! -f dist/index.html || ! -d node_modules/tsx ]]; then
  echo 'Run npm run setup:mac in the project folder first.' >&2
  exit 1
fi

# Check the fixed OAuth port before starting; never stop an unrelated server.
node --input-type=module -e '
  import { createServer } from "node:net";
  const probe = createServer();
  probe.once("error", () => {
    console.error("Port 5173 is in use. Stop the existing FluentPath server or close its Terminal window first.");
    process.exit(1);
  });
  probe.listen(5173, "127.0.0.1", () => probe.close());
'

node --import tsx server/index.ts --chatgpt-local &
server_pid=$!
cleanup() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 0' INT TERM HUP

app_url='http://127.0.0.1:5173/'
for ((attempt = 0; attempt < 100; attempt++)); do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo 'FluentPath could not start. See the server error above.' >&2
    exit 1
  fi
  if curl --noproxy '*' --max-time 1 --fail --silent "${app_url}api/session" >/dev/null; then
    echo "FluentPath is running at $app_url"
    echo 'Keep this Terminal window open. Press Control-C here to stop FluentPath.'
    open "$app_url"
    wait "$server_pid"
    exit 0
  fi
  sleep 0.2
done
echo 'FluentPath did not become ready within the startup timeout.' >&2
exit 1
