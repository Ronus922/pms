#!/bin/bash
# deploy-worktree.sh — build PMS in an ISOLATED worktree, then atomically swap the
# validated .next into the live prod dir. Root fix for: /var/www/pms being BOTH the
# build checkout AND the live serve dir, so an in-place `next build` churns the very
# .next the running process reads (and a feature-branch build can poison prod).
#
# Flow: sync worktree to REF -> pnpm install -> build (live .next untouched) ->
#       rewrite baked build-dir paths to the prod path -> rename-swap .next into prod
#       -> pm2 reload -> health-gate (auto-rollback to previous .next on non-200).
#
# One-time setup (already done):
#   git -C /var/www/pms worktree add --detach /var/www/pms-build feature/username-auth
#
# Usage: bash scripts/deploy-worktree.sh [git-ref]     # default: feature/username-auth
set -euo pipefail

PROD=/var/www/pms
BUILD=/var/www/pms-build
REF="${1:-feature/username-auth}"
PORT=3004

[ -d "$BUILD/.git" ] || { echo "❌ build worktree missing — run: git -C $PROD worktree add --detach $BUILD $REF"; exit 1; }

echo "🌿 [1/6] sync worktree to $REF ..."
git -C "$BUILD" fetch origin --quiet
git -C "$BUILD" checkout --detach --quiet "$REF"
ln -sfn "$PROD/.env.local" "$BUILD/.env.local"   # build-time secrets (Node-loaded; safe outside Turbopack graph)

echo "📦 [2/6] install deps (pnpm, shared store) ..."
# ponytail: shared global pnpm store => seconds when lockfile unchanged. Full re-resolve only on dep changes.
( cd "$BUILD" && pnpm install --frozen-lockfile )

echo "🔧 [3/6] build (isolated — live .next untouched) ..."
( cd "$BUILD" && npm run build )

echo "🩹 [4/6] rewrite baked build-dir paths -> prod path ..."
# `next build` records absolute root/appDir/outputFileTracingRoot. Rewrite so `next start`
# from $PROD resolves correctly — result is byte-identical in scheme to a native prod build.
# Only a handful of text/json files carry the path (no binary chunks); verified.
{ grep -rl "$BUILD" "$BUILD/.next" 2>/dev/null || true; } | xargs -r sed -i "s#$BUILD#$PROD#g"

echo "🔁 [5/6] atomic swap + reload ..."
rm -rf "$PROD/.next.prev"
mv "$PROD/.next" "$PROD/.next.prev"     # instant; running process unaffected until reload
mv "$BUILD/.next" "$PROD/.next"          # instant rename (same filesystem)
pm2 reload "$PROD/ecosystem.config.js" --update-env

echo "✅ [6/6] health check ..."
sleep 5
CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/" || echo 000)
if [ "$CODE" = "200" ]; then
  echo "✅ live (HTTP 200) — BUILD_ID $(cat "$PROD/.next/BUILD_ID")"
  pm2 save
  rm -rf "$PROD/.next.prev"
else
  echo "❌ HTTP $CODE — rolling back to previous .next"
  rm -rf "$PROD/.next"
  mv "$PROD/.next.prev" "$PROD/.next"
  pm2 reload "$PROD/ecosystem.config.js" --update-env
  pm2 logs pms --lines 30 --nostream
  exit 1
fi
