#!/usr/bin/env bash
set -euo pipefail

TASK_NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$TASK_NVM_DIR/nvm.sh" ]; then
  # shellcheck source=/dev/null
  . "$TASK_NVM_DIR/nvm.sh"
fi

exec node server/ibkr-api.mjs
