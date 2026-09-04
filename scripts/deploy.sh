#!/usr/bin/env bash
###############################################################################
# deploy.sh — THE ONE canonical production deploy for PMS.
#
#   bash scripts/deploy.sh [git-ref]        # default ref: feature/username-auth
#
# PM2 is the ONLY sanctioned owner of the PMS process and of port 3004. This is
# the single entry point; scripts/deploy-worktree.sh and scripts/prepare-
# standalone.sh are thin compatibility wrappers that delegate here. Do NOT start
# PMS with pnpm/next start, nohup, or bare node. See DEPLOYMENT.md.
#
# Flow (isolated-worktree build → atomic swap → PM2 reload):
#   0. pre-deploy PORT-OWNERSHIP GUARD (never blind-kills an unknown owner)
#   1. sync build worktree to REF        (live /var/www/pms/.next untouched)
#   2. pnpm install (frozen)
#   3. next build                        (in the worktree)
#   4. rewrite baked build-dir paths → prod path
#   5. atomic .next swap + `pm2 reload`  (auto-rollback to previous .next on fail)
#   6. pm2 save
#   7. post-deploy VERIFICATION (one listener, PM2-owned, HTTP ok, no new
#      EADDRINUSE, restart count stable over an observation window)
###############################################################################
set -euo pipefail

PROD=/var/www/pms
BUILD=/var/www/pms-build
REF="${1:-feature/username-auth}"
PORT=3004
APP=pms
ERRLOG=/home/ubuntu/.pm2/logs/pms-error.log
HEALTH_URL="http://localhost:${PORT}/"

# ─────────────────────────── helpers: port ownership ─────────────────────────
# Exact-name lookup via jlist — `pm2 pid <name>` is fuzzy and can return a
# DIFFERENT app's pid (verified), which would make the guard misjudge ownership.
pm2_pms_pid() {
  pm2 jlist 2>/dev/null | python3 -c "
import json,sys
try:
    rows=[x for x in json.load(sys.stdin) if x.get('name')=='$APP' and x.get('pid')]
    print(rows[0]['pid'] if rows else '')
except Exception:
    print('')" 2>/dev/null
}

port_has_listener() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }

# PIDs listening on $1 — own-visible first, then via sudo for a foreign owner.
listeners_on_port() {
  local port="$1" pids
  pids=$(ss -ltnHp "sport = :$port" 2>/dev/null | grep -oE 'pid=[0-9]+' | grep -oE '[0-9]+' | sort -u)
  if [ -z "$pids" ] && port_has_listener "$port"; then
    pids=$(sudo -n bash -c "ss -ltnHp 'sport = :$port'" 2>/dev/null | grep -oE 'pid=[0-9]+' | grep -oE '[0-9]+' | sort -u)
  fi
  echo "$pids"
}

is_descendant_of() { # $1=pid  $2=ancestor-pid
  local pid="$1" anc="$2" i=0 ppid
  while [ -n "$pid" ] && [ "$pid" != 0 ] && [ "$i" -lt 12 ]; do
    [ "$pid" = "$anc" ] && return 0
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -dc '0-9')
    pid="$ppid"; i=$((i + 1))
  done
  return 1
}

pid_is_pms() { # true if pid $1 is the PM2 pms pid or a descendant of it
  local pid="$1" anc; anc=$(pm2_pms_pid)
  [ -n "$anc" ] && { [ "$pid" = "$anc" ] || is_descendant_of "$pid" "$anc"; }
}

describe_pid() {
  local p="$1"
  echo "      pid : $p"
  echo "      comm: $(ps -o comm= -p "$p" 2>/dev/null || echo '?')"
  echo "      ppid: $(ps -o ppid= -p "$p" 2>/dev/null | tr -dc '0-9')"
  echo "      exe : $(readlink -f /proc/$p/exe 2>/dev/null || sudo -n readlink -f /proc/$p/exe 2>/dev/null || echo '?')"
  echo "      cmd : $(ps -o args= -p "$p" 2>/dev/null | head -c 200 || echo '?')"
}

# ── STEP 0: pre-deploy port guard ─────────────────────────────────────────────
# Nothing listening → continue. PM2-owned pms holds it → safe (reload hands over).
# ANY other/unidentifiable owner → fail loud with full identity. Never blind-kill.
assert_port_safe() {
  echo "🛡  [0/7] port-ownership guard on :$PORT ..."
  if ! port_has_listener "$PORT"; then echo "  ✓ :$PORT free"; return 0; fi
  local pids p; pids=$(listeners_on_port "$PORT")
  if [ -z "$pids" ]; then
    echo "  ✗ :$PORT has a listener whose owner could not be identified (foreign/orphan)."
    sudo -n ss -ltnp "sport = :$PORT" 2>/dev/null || ss -ltnp "sport = :$PORT" 2>/dev/null || true
    echo "  → investigate and stop it deliberately by PID. NEVER blind-kill. Aborting."
    return 1
  fi
  for p in $pids; do
    if pid_is_pms "$p"; then
      echo "  ✓ :$PORT held by PM2 pms (pid $p) — reload will hand over"
    else
      echo "  ✗ :$PORT held by a NON-PM2 process — refusing to deploy:"
      describe_pid "$p"
      echo "  → If this is a stray 'nohup pnpm/next start', that is the FORBIDDEN path."
      echo "    Stop it deliberately: kill <pid>. Then re-run this script. Aborting."
      return 1
    fi
  done
}

# ── STEP 7: post-deploy verification ──────────────────────────────────────────
verify_deploy() { # $1 = EADDRINUSE count captured before deploy
  local eaddr_before="$1" fail=0
  echo "🔎 [7/7] post-deploy verification ..."

  # (0) readiness wait — a fork-mode `pm2 reload` returns before the new
  # `next start` has bound :$PORT (~1-2s). Poll HTTP until 200 before asserting,
  # so we measure the NEW process, not the bind gap.
  local code=000 waited=0
  while [ "$waited" -lt 45 ]; do
    code=$(curl -s -o /dev/null -w '%{http_code}' -m 10 "$HEALTH_URL" 2>/dev/null); code="${code:-000}"
    [ "$code" = "200" ] && break
    sleep 2; waited=$((waited + 2))
  done

  # (a) exactly one listener, and it is PM2-owned pms
  local pids n
  pids=$(listeners_on_port "$PORT"); n=$(echo "$pids" | grep -c . || true)
  if [ "$n" != "1" ]; then
    echo "  ✗ expected exactly 1 listener on :$PORT, found $n [$pids]"; fail=1
  else
    if pid_is_pms "$pids"; then echo "  ✓ single listener pid $pids is PM2-owned pms"
    else echo "  ✗ listener pid $pids is NOT PM2-owned pms:"; describe_pid "$pids"; fail=1; fi
  fi

  # (b) HTTP health (from the readiness poll above)
  if [ "$code" = "200" ]; then echo "  ✓ HTTP $code (ready in ~${waited}s)"; else echo "  ✗ HTTP $code after ${waited}s"; fail=1; fi

  # (c) PM2 status online + no new EADDRINUSE since deploy start
  local st; st=$(pm2 jlist 2>/dev/null | python3 -c "import json,sys;print([x for x in json.load(sys.stdin) if x['name']=='$APP'][0]['pm2_env']['status'])" 2>/dev/null || echo unknown)
  [ "$st" = "online" ] && echo "  ✓ pm2 status online" || { echo "  ✗ pm2 status=$st"; fail=1; }
  local eaddr_after; eaddr_after=$(grep -c EADDRINUSE "$ERRLOG" 2>/dev/null || true)
  if [ "$eaddr_after" -le "$eaddr_before" ]; then echo "  ✓ no new EADDRINUSE ($eaddr_after total)"
  else echo "  ✗ new EADDRINUSE appeared ($eaddr_before → $eaddr_after)"; fail=1; fi

  # (d) restart count stable across a short observation window
  local r0; r0=$(pm2 jlist 2>/dev/null | python3 -c "import json,sys;print([x for x in json.load(sys.stdin) if x['name']=='$APP'][0]['pm2_env']['restart_time'])" 2>/dev/null || echo -1)
  echo "  … observing restart count ($r0) for 20s ..."
  local waited=0; while [ "$waited" -lt 20 ]; do sleep 5; waited=$((waited + 5)); done
  local r1; r1=$(pm2 jlist 2>/dev/null | python3 -c "import json,sys;print([x for x in json.load(sys.stdin) if x['name']=='$APP'][0]['pm2_env']['restart_time'])" 2>/dev/null || echo -2)
  if [ "$r0" = "$r1" ] && [ "$r0" != "-1" ]; then echo "  ✓ restart count stable at $r1"
  else echo "  ✗ restart count moved $r0 → $r1 during observation"; fail=1; fi

  return $fail
}

# ─────────────────────────────── main ────────────────────────────────────────
assert_port_safe

# Auto-provision the build worktree if missing (removes a setup footgun).
# A linked worktree's ".git" is a FILE (gitdir pointer), not a dir — probe with
# rev-parse instead of a -d test.
if ! git -C "$BUILD" rev-parse --git-dir >/dev/null 2>&1; then
  echo "🌱 build worktree missing — creating: git worktree add --detach $BUILD $REF"
  git -C "$PROD" worktree add --detach "$BUILD" "$REF"
fi

echo "🌿 [1/7] sync worktree to $REF ..."
git -C "$BUILD" fetch origin --quiet
git -C "$BUILD" checkout --detach --quiet "$REF"
ln -sfn "$PROD/.env.local" "$BUILD/.env.local"   # build-time secrets (Node-loaded)

echo "📦 [2/7] install deps (pnpm, shared store) ..."
( cd "$BUILD" && pnpm install --frozen-lockfile )

echo "🔧 [3/7] build (isolated — live .next untouched) ..."
( cd "$BUILD" && npm run build )

echo "🩹 [4/7] rewrite baked build-dir paths → prod path ..."
{ grep -rl "$BUILD" "$BUILD/.next" 2>/dev/null || true; } | xargs -r sed -i "s#$BUILD#$PROD#g"

EADDR_BEFORE=$(grep -c EADDRINUSE "$ERRLOG" 2>/dev/null || true)

echo "🔁 [5/7] atomic swap + reload ..."
rm -rf "$PROD/.next.prev"
mv "$PROD/.next" "$PROD/.next.prev"     # instant; running process unaffected until reload
mv "$BUILD/.next" "$PROD/.next"          # instant rename (same filesystem)
pm2 reload "$PROD/ecosystem.config.js" --update-env

echo "💾 [6/7] pm2 save ..."
pm2 save

if verify_deploy "$EADDR_BEFORE"; then
  echo "✅ deploy OK — BUILD_ID $(cat "$PROD/.next/BUILD_ID" 2>/dev/null || echo '?')"
  rm -rf "$PROD/.next.prev"
else
  echo "❌ verification FAILED — rolling back to previous .next"
  rm -rf "$PROD/.next"
  mv "$PROD/.next.prev" "$PROD/.next"
  pm2 reload "$PROD/ecosystem.config.js" --update-env
  pm2 logs "$APP" --lines 30 --nostream || true
  exit 1
fi
