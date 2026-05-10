# BUG_FIX_PROMPT.md -- Fix a Bug

> Copy the prompt below and paste it when fixing a bug.
> Replace all `[PLACEHOLDER]` values with the bug details.

---

## Prompt

```
Fix bug: [BUG_DESCRIPTION]

Where it happens: [page / component / action / specific URL]
Expected behavior: [what should happen]
Actual behavior: [what happens instead]
Steps to reproduce: [numbered steps]
Severity: [critical / high / medium / low]

BEFORE FIXING:
1. Read the affected files completely
2. Read files that import or are imported by the affected files
3. Understand the data flow from UI to server action to database and back
4. Read /docs/rules/RESTRICTIONS_AND_PROHIBITIONS.md
5. Identify the root cause before writing any code

RULES -- READ CAREFULLY:
- Do NOT redesign the UI while fixing the bug
- Do NOT refactor surrounding code
- Do NOT rename variables or restructure files
- Do NOT change working patterns or architecture
- Do NOT add features or improvements
- Do NOT update dependencies
- Make the MINIMAL change needed to fix the root cause
- If the fix requires more than 3 files changed, explain why before proceeding
- If the fix touches shared components, list all consumers that could be affected

INVESTIGATION STEPS:
1. Read the component/page where the bug manifests
2. Trace the data: where does the value come from?
3. Check validation: is input being validated correctly?
4. Check types: is there a type mismatch?
5. Check state: is state being managed correctly?
6. Check async: are there race conditions or missing awaits?
7. Check permissions: is there a permission check missing?
8. Check edge cases: null, undefined, empty array, empty string

REPORT (mandatory):
1. Files reviewed: [list every file you read]
2. Root cause: [clear explanation of what caused the bug]
3. Files changed: [list each file and what was changed]
4. Why the fix belongs there: [explain the architectural reasoning]
5. Risks: [what could break as a result of this change]
6. What was intentionally NOT changed: [things you noticed but deliberately left alone]
7. Testing steps: [exact steps to verify the fix works]
8. Regression check: [steps to verify nothing else broke]
```

---

## Common Bug Categories

Use this to guide your investigation:

| Category | Look For |
|----------|----------|
| **Render** | Missing key prop, stale closure, wrong dependency array |
| **Data** | Null/undefined access, wrong field name, type mismatch |
| **State** | Stale state, race condition, missing reset |
| **Async** | Missing await, unhandled promise, loading state |
| **Permission** | Missing check, wrong role, RLS policy |
| **Validation** | Missing validation, wrong schema, server/client mismatch |
| **RTL** | Wrong flex direction, wrong margin/padding side, wrong text alignment |
| **Mobile** | Overflow, touch target too small, missing breakpoint |

---

## Anti-Patterns in Bug Fixes

Do NOT do these:

| Anti-Pattern | Why It Is Wrong |
|--------------|-----------------|
| "While I'm here, let me also..." | Scope creep. Fix the bug only. |
| Wrapping in try/catch without handling | Hides the real error. |
| Adding `!` non-null assertion | Masks the actual null check needed. |
| Adding `as any` to silence TypeScript | Defeats the type system. |
| Copying code instead of fixing the source | Creates duplication. |
| "It works now" without understanding why | The bug will return. |
