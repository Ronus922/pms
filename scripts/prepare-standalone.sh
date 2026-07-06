#!/usr/bin/env bash
# DEPRECATED / NEUTRALISED — 2026-07-06.
#
# This script used to run:  lsof -ti:3004 | xargs kill -9  +  nohup pnpm start &
# That started PMS OUTSIDE PM2 and blind-killed whatever held :3004 (including the
# PM2-managed process). It was the root cause of the 8,268-restart EADDRINUSE loop.
#
# It no longer starts or kills anything. It only forwards to the one canonical,
# PM2-safe deploy. Direct pnpm/next start, nohup, and manual port-killing are
# FORBIDDEN in production (see DEPLOYMENT.md).
set -euo pipefail
echo "⚠  prepare-standalone.sh is deprecated and does NOT start/kill processes."
echo "   Delegating to the canonical, PM2-safe deploy → scripts/deploy.sh"
exec "$(cd "$(dirname "$0")" && pwd)/deploy.sh" "$@"
