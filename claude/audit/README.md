# PMS Project Audit — 2026-05-10

A deep audit of `/var/www/pms` (Next.js 16 + Supabase self-hosted + Postgres + Tailwind RTL) across security, dead code, dependencies, uploads, and architecture. Methodology aimed at concrete file:line findings, **not surface skimming**.

## How this audit was conducted

Three parallel scope-bounded agents ran read-only across the repo, plus targeted manual verification of every critical finding by the author opening the cited files directly. See [COVERAGE.md](COVERAGE.md) for the honest breakdown of what was inspected vs sampled vs skipped.

| Agent | Scope | Coverage |
|---|---|---|
| A | Dead code + dependency hygiene | Ran `knip` successfully, covered all `.ts/.tsx` files |
| B | Security: server actions, API routes, auth, tenant isolation | ~70% of `lib/actions/**`, 100% of `app/api/**` |
| C | Architecture: duplication, uploads, layering, god-files | Read 10 critical files in full, sampled the rest |
| Author verification | Top critical findings | Opened and re-read 8 cited files to confirm |

Items the agents flagged but the author did **not** personally open are marked `[unverified]` in the per-finding docs.

## Files in this audit

| File | Purpose |
|---|---|
| [README.md](README.md) | This overview |
| [01-critical-security.md](01-critical-security.md) | Multi-tenant leaks, role escalation paths, open redirect, webhook bypass, secret handling |
| [02-broken-uploads.md](02-broken-uploads.md) | Blob URL persisted to DB, placeholder file inputs, missing storage layer |
| [03-dead-code.md](03-dead-code.md) | Orphan files, unused exports, `src/` (62 files), 7 unused room tabs, duplicate DashboardShell |
| [04-dependencies.md](04-dependencies.md) | 4 unused npm packages, 1 unlisted import |
| [05-quality-debt.md](05-quality-debt.md) | console.logs, `any` types, god-components, duplicate invite forms |
| [06-action-plan.md](06-action-plan.md) | **The deliverable**: risk-tiered plan for cleanup, regression-gated paths, agent-vs-human split |
| [COVERAGE.md](COVERAGE.md) | Honest report of what was checked vs sampled vs not checked |

## Severity legend

| Severity | Meaning |
|---|---|
| 🔴 CRITICAL | Data exposure / silent data loss / production-affecting. Fix before anything else. |
| 🟠 HIGH | Exploitable security weakness, broken feature shown as working, or major regression risk. |
| 🟡 MEDIUM | Quality / maintainability issue with measurable cost but no immediate breakage. |
| 🟢 LOW | Minor cleanup, no functional impact. |
| ℹ️  INFO | Observed pattern worth knowing; not necessarily a defect. |

## Top-level summary

| Severity | Count | Examples |
|---|---|---|
| 🔴 CRITICAL | 4 | Multi-tenant leak in 3 read paths; mutation actions trust client `tenantId` |
| 🟠 HIGH | 6 | Broken upload pipeline (blob URL → DB) in 5 places; open redirect at `/auth/callback`; Channex webhook bypass via property_id fallback |
| 🟡 MEDIUM | 7 | `src/` directory entirely dead (62 files); 4 unused deps; duplicate invite forms |
| 🟢 LOW | 5 | 18 `console.*` calls; 6 real `any` types; 7 orphan room-tab components |
| ℹ️  INFO | 3 | God-components >500 lines (8 files); cron secret uses `!==` (timing); maps-test scratch page |

**Total: 25 distinct findings, all with file:line citations.**

## How to use this audit

1. **First**: read [01-critical-security.md](01-critical-security.md) and fix the 4 critical items. Do not skip.
2. **Then**: read [06-action-plan.md](06-action-plan.md) for the cleanup plan ordered by safety + dependency.
3. The other docs are reference material — drill into them when a specific topic comes up in the action plan.
4. [COVERAGE.md](COVERAGE.md) tells you what to **not** assume was checked.

## Out of scope (consciously)

- **Tests** — not reviewed; the project may not have a test suite. Adding regression tests is its own follow-on task.
- **Performance & bundle size** — not assessed.
- **`npm audit` / CVE scan** — not run; recommend running separately.
- **CSP / security headers** — not assessed; recommend a separate web-layer audit.
- **Database RLS** — assumed off (Supabase self-hosted, queries enforce tenancy in application layer); audit assumes that's intentional. If RLS is meant to be a second line of defense, that needs its own check.
- **Channex integration deep-dive** — the orchestrator at 1,017 lines was not read line-by-line; only its external-facing webhook handler was audited.
- **`output/` directory** — gitignored, treated as scratch/excluded.
