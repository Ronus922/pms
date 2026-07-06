#!/usr/bin/env bash
# COMPATIBILITY WRAPPER — 2026-07-06.
#
# The isolated-worktree build/swap logic that used to live here is now the body
# of the single canonical deploy: scripts/deploy.sh (which also adds the pre- and
# post-deploy port-ownership guards). This wrapper is kept only so existing
# muscle-memory / docs that call deploy-worktree.sh still reach the safe path.
#
# There is ONE deployment model. Use scripts/deploy.sh.
set -euo pipefail
exec "$(cd "$(dirname "$0")" && pwd)/deploy.sh" "$@"
