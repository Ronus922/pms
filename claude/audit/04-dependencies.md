# Dependency Hygiene

Verified by author with `grep -rln "from \"<pkg>\"" app components lib --include="*.ts" --include="*.tsx"` returning zero hits for each. All findings high-confidence.

---

## 🟡 Unused npm dependencies (4) — safe to remove

| Package | Listed in | Imports found | Why it might be there |
|---|---|---|---|
| `@hookform/resolvers` | `dependencies` | 0 | Brought in alongside react-hook-form per CLAUDE.md Tier 1 stack; never used |
| `@tanstack/react-table` | `dependencies` | 0 | Same — listed as "Tier 1 required" but tables in this project are custom (no headless lib) |
| `react-hook-form` | `dependencies` | 0 | Same — forms here use plain React state + Zustand, no RHF |
| `@types/google.maps` | `devDependencies` | 0 | The project uses `@vis.gl/react-google-maps` (which has its own types) — the bare types package is leftover |

**Removal command** (run carefully — confirm zero hits one more time first):

```bash
pnpm remove @hookform/resolvers @tanstack/react-table react-hook-form
pnpm remove -D @types/google.maps
```

**Risk**: NONE if grep stays at 0. Run `pnpm tsc --noEmit && pnpm build` after each removal to confirm the build still passes.

**Bundle savings**: react-hook-form alone is ~40KB minified+gzipped on the client; @tanstack/react-table is ~25KB. Total ~65-75KB of dead client code removed.

---

## 🟢 Unlisted dependency — `server-only`

Agent A found 9 server-only files importing `server-only`, but the package isn't in `package.json`. Author did not personally verify the 9 specific files.

```ts
import 'server-only'  // appears in lib/integrations/channex/* and lib/services/*
```

This works at the moment because some other package transitively depends on `server-only` (Next.js itself, probably). But if Next.js ever drops that transitive, the build will fail.

**Fix**:

```bash
pnpm add server-only
```

It's a 6-line package whose only job is to throw an error if imported into a client component. The fix is to make the dependency explicit.

---

## ℹ️  Verified-clean packages

The following were flagged by knip as potentially unused, but author verified they ARE imported:

- `@turf/turf` — used by [lib/services/geofencing.ts](../../lib/services/geofencing.ts). Geofencing for the attendance module.
- `resend` was removed earlier in this session and replaced with `nodemailer` + `@types/nodemailer`. `pnpm-lock.yaml` should not contain `resend` anymore — verify with `pnpm why resend`.

---

## What was NOT done

- `npm audit` for known CVEs — recommended as a separate task.
- License audit — not in scope here.
- Bundle analyzer (`@next/bundle-analyzer`) — not run; the 65-75KB savings estimate above is rough.
- Lockfile drift check — not performed.
