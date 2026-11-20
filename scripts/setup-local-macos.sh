#!/bin/bash
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo 'This setup is for macOS. See README.md for other platforms.' >&2
  exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  echo 'Install Node.js 24 or newer from https://nodejs.org/en/download, then reopen Terminal.' >&2
  exit 1
fi
if [[ "$(node -p 'parseInt(process.versions.node)')" -lt 24 ]]; then
  echo 'FluentPath requires Node.js 24 or newer.' >&2
  exit 1
fi

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$app_root"
npm ci --include=dev
npm run build -- --base / --mode chatgpt-local

mkdir -p "$HOME/Desktop"
launcher="$HOME/Desktop/FluentPath.command"
# Remember the Node location so Finder launches also work with nvm/Homebrew.
printf '#!/bin/bash\nexport PATH=%q:"$PATH"\nexec /bin/bash %q\n' \
  "$(dirname "$(command -v node)")" "$app_root/scripts/launch-local-macos.sh" > "$launcher"
chmod u+x "$launcher"
echo "FluentPath is ready. Double-click $launcher to start."
echo 'Keep this project folder in place. Nothing was added to macOS login items.'
