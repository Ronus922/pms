# Flow: [FLOW_NAME]

## Metadata

| Property | Value |
|----------|-------|
| Module | [MODULE_NAME] |
| Trigger | [What initiates this flow] |
| Actors | [User roles that can trigger this] |
| Priority | [High / Medium / Low] |
| Estimated Complexity | [Simple / Medium / Complex] |

## Preconditions

1. [PRECONDITION_1] -- e.g., "User is authenticated"
2. [PRECONDITION_2] -- e.g., "User has [module]:create permission"
3. [PRECONDITION_3] -- e.g., "Related entity [X] exists"

## Flow Diagram (Text)

```
[START] --> Step 1 --> Step 2 --> Decision?
                                    |
                            Yes --->  Step 3A --> [END: Success]
                            No  --->  Step 3B --> [END: Alternative]
```

## Steps

### Step 1: [STEP_NAME]

| Property | Value |
|----------|-------|
| Actor | [User / System] |
| Component | [Component name] |
| Action | [What happens] |

**Details:**
[Detailed description of what happens in this step]

**UI State:**
- Before: [What the user sees before this step]
- During: [Loading/processing state]
- After: [What the user sees after this step]

---

### Step 2: [STEP_NAME]

| Property | Value |
|----------|-------|
| Actor | [User / System] |
| Component | [Component name] |
| Action | [What happens] |

**Details:**
[Detailed description]

**Decision Point:** [If this step has a branch]
- Condition A: [CONDITION] --> Go to Step 3A
- Condition B: [CONDITION] --> Go to Step 3B

---

### Step 3A: [SUCCESS_PATH_STEP]

| Property | Value |
|----------|-------|
| Actor | [User / System] |
| Component | [Component name] |
| Action | [What happens] |

---

### Step 3B: [ALTERNATIVE_PATH_STEP]

| Property | Value |
|----------|-------|
| Actor | [User / System] |
| Component | [Component name] |
| Action | [What happens] |

## Side Effects

| Trigger | Effect | Async? | Reversible? |
|---------|--------|--------|-------------|
| [WHEN] | [Email notification sent] | Yes | No |
| [WHEN] | [Status of related entity changes] | No | Yes |
| [WHEN] | [Audit log entry created] | Yes | No |
| [WHEN] | [n8n webhook triggered] | Yes | No |

## Error Handling

### Error: [ERROR_NAME]

| Property | Value |
|----------|-------|
| Occurs at | Step [N] |
| Cause | [What causes this error] |
| User sees | [Error message in Hebrew] |
| Recovery | [How the user can retry or fix] |
| System action | [Logging, alerting, cleanup] |

### Error: [ERROR_NAME_2]

| Property | Value |
|----------|-------|
| Occurs at | Step [N] |
| Cause | [What causes this error] |
| User sees | [Error message in Hebrew] |
| Recovery | [How the user can retry or fix] |
| System action | [Logging, alerting, cleanup] |

## Rollback Behavior

| Step | Rollback Action | Automatic? |
|------|----------------|------------|
| Step [N] | [What gets undone] | [Yes / No -- manual by admin] |

## Success Criteria

- [ ] [CRITERION_1] -- e.g., "Record is created in database"
- [ ] [CRITERION_2] -- e.g., "User sees success toast"
- [ ] [CRITERION_3] -- e.g., "Email is sent within 30 seconds"
- [ ] [CRITERION_4] -- e.g., "Related entity status is updated"

## Edge Cases

| Scenario | Expected Behavior |
|----------|------------------|
| [EDGE_CASE_1] | [BEHAVIOR] |
| [EDGE_CASE_2] | [BEHAVIOR] |
| [EDGE_CASE_3] | [BEHAVIOR] |

## Related Flows

| Flow | Relationship |
|------|-------------|
| [FLOW_NAME] | [Triggers after this flow / Triggered by this flow] |
