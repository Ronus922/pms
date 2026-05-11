# MEMORY-REFINE — Reusable Skill / Workflow

> Project-level skill for normalising long-term memory in the GuestHub PMS project.
> Trigger this whenever PROJECT_MEMORY.md / CHANGELOG.md / INDEX.md or auto-memory files start to bloat, contradict each other, or become hard to scan.

---

## Trigger Phrases

Any of the following invokes this workflow:

- `MEMORY-REFINE`
- `refine memory`
- `normalize memory`
- `cleanup memory`
- `optimize project memory`
- `optimize md`
- `compact memory`
- `סדר זיכרון`
- `נקה זיכרון פרויקט`
- `ארגן זיכרון`

---

## Purpose

Keep long-term project memory:

- normalised (single source of truth per topic)
- compact (no repetitive explanations)
- maintainable (consistent shape across files)
- preserved (no loss of architectural / business knowledge)
- fast for future Claude sessions to comprehend

The opposite is bloat: same rule restated 4 times in 4 files; superseded entries silently still authoritative; chronological logs swallowed by snapshot rules; module memory drifting from canonical PROJECT_MEMORY.

---

## Scope (Files to Review)

1. `claude/PROJECT_MEMORY.md` — permanent decisions
2. `claude/CHANGELOG.md` — chronological history
3. `claude/INDEX.md` — file map
4. `claude/CLAUDE.md` — iron rules + governance (read-only — never modified by this workflow)
5. `claude/START_HERE.md`
6. Module memory in `~/.claude/projects/-var-www-pms/memory/` (`design_system_azure_ethos.md`, `project_*.md`, `feedback_*.md`, `MEMORY.md` index)
7. `docs/rules/`, `docs/design/`, `docs/components/` — only if directly contradicted by claude/* memory

---

## Behavior

When triggered, Claude must:

### 1. Detect

- duplicated rules (same statement, different files)
- duplicated explanations (same `why` rephrased)
- obsolete entries (refer to removed code, deleted modules, old paths)
- superseded decisions (newer rule contradicts older one without `[SUPERSEDED]` tag)
- bloated sections (one topic >200 lines spread across multiple places)
- conflicting rules (two files give different answers to the same question)
- unclear ownership (rule lives in CHANGELOG instead of PROJECT_MEMORY, or vice versa)
- fragmented logic documentation (one flow split across 4 unrelated entries)

### 2. Carefully

- merge overlapping sections (keep the most authoritative wording, link from the others)
- compress repetitive explanations (drop the duplicate, keep the canonical one)
- preserve architectural meaning (never lose a "why")
- preserve business logic integrity (cleaning derive rules, availability check, channel inventory protection, calendar resize delta-only — must not be diluted)
- preserve chronological meaning where needed (CHANGELOG must remain sortable by date)
- preserve unresolved risks (open follow-ups never silently dropped)
- improve scanning (tables > prose, headings > paragraphs)
- improve future-agent usability (the first 50 lines of each file should be enough to know what is in it)

### 3. Update

- `claude/PROJECT_MEMORY.md` (canonical rules)
- `claude/INDEX.md` (file map)
- module memory files in `~/.claude/projects/-var-www-pms/memory/` (only when authoritative content drifts)
- never `claude/CLAUDE.md` (governance file — out of scope)

### 4. Ensure (post-conditions)

- canonical flows obvious (reservations create/edit, cleaning task creation, calendar resize delta-only, availability check)
- inventory protection rules HIGHLY VISIBLE (top of relevant memory file, not buried)
- reservation integrity rules HIGHLY VISIBLE (LOCKED status, 10-point regression check)
- mobile/RTL requirements preserved
- security-sensitive operational behavior preserved (permission guards, server-as-authority, fail-closed)

---

## Hard Rules (Never)

- Never aggressively shorten critical logic ("delta-only resize" stays its full rule, not a one-liner).
- Never remove business rules blindly.
- Never remove unresolved risks (move them to a "Pending" or "Known Risks" section if needed; never delete).
- Never remove architecture decisions (mark `[SUPERSEDED YYYY-MM-DD]` instead).
- Never destroy historical context unnecessarily — CHANGELOG entries from past dates stay; only consolidate within a single date entry if it has clear repetition.
- Never rewrite memory into vague summaries ("design was updated" — useless).
- Never remove operational nuance (e.g. "polling not Realtime because plain Postgres" — keep the WHY).
- Never create duplicate docs.
- Never overwrite historical logs improperly.

---

## Required Output Format

### A. FILES REVIEWED

List of every file inspected (full path). Mark each as `[modified]` / `[read-only]`.

### B. MEMORY NORMALIZATION CHANGES

| File | What was merged | What was shortened | What was removed | Why safe |
|------|-----------------|--------------------|------------------|----------|

### C. MEMORY STRUCTURE RISKS

Bullet list:
- bloated sections still present
- conflicting docs still present
- outdated rules still in place
- unclear module ownership
- (per item: severity Low/Medium/High)

### D. MEMORY QUALITY IMPROVEMENTS

Bullet list of concrete improvements (readability, scanning, duplication reduction, architecture clarity, navigation).

### E. REMAINING RISKS

Bullet list of:
- anything still too bloated that should NOT be touched without user approval (e.g. CHANGELOG long entries with regression-sensitive detail)
- anything still unclear and needs a follow-up question
- anything requiring manual review by a human

### Closing line

State whether MEMORY-REFINE is in a safe stable state or whether a follow-up pass is needed.

---

## Examples of Safe Refines

- Two memory files both define the same color token → keep one canonical (in `claude/PROJECT_MEMORY.md`), have the other reference it.
- A `[SUPERSEDED]` row in `PROJECT_MEMORY.md` taking up 3 lines of legacy explanation → compress to one line: `[SUPERSEDED 2026-05-08 → see "Primary flat (Azure Ethos)"]`.
- `INDEX.md` lists a deleted file → remove the row.
- Auto-memory file `design_system_azure_ethos.md` and project memory both maintain their own version of the same rule → pick one as canonical, mark the other as a pointer.

## Examples of UNSAFE Refines (don't do)

- Compressing the calendar-resize-delta-only rule body into "drag preview is overlay only" — kills the actual mechanism details.
- Deleting the locked-modules list because "the user knows which files are locked".
- Merging two CHANGELOG date entries because they share a topic — destroys date provenance.
- Removing the 10-point regression check from reservations even though it has been "internalised".

---

## Trigger Frequency

Suggested cadence:
- After every 3rd `SAVE` workflow
- Whenever `PROJECT_MEMORY.md` exceeds ~500 lines
- Whenever `claude/CHANGELOG.md` newest entry alone exceeds ~150 lines
- Whenever conflicts are detected between auto-memory and project memory

The user may invoke at any time. Refine should be fast and conservative — when in doubt, leave the entry in place and report it under section E (Remaining Risks) instead of editing.
