# Compaction Protocol

## Context Pressure Stages

1. **Normal** — under 60% context usage. No action needed.
2. **Warning** — 60-80% context usage. Begin planning compaction.
3. **Critical** — 80%+ context usage. Execute compaction immediately.

## Pre-Compaction Routine

When approaching compaction threshold:

1. **Checkpoint current work item** — save progress to hunt-state/
2. **Write handoff bundle** — create/update all handoff artifacts:
   - hunt-state/current-stage.md
   - hunt-state/next-actions.md
   - hunt-state/notepad.md
3. **Flush decision log** — ensure all pending decisions are logged
4. **Save queue state** — persist current queue to disk
5. **Write compaction marker** — hunt-state/compaction-marker.json

## Handoff Bundle Format

hunt-state/current-stage.md:
```
# Current Stage: [stage name]
## Active Work Item
[ID, type, subtype, target, status]
## Key Discoveries This Session
- [bullet 1]
- [bullet 2 - max 5]
## Unresolved Questions
- [question 1 - max 3]
## Queue Head (next 5 items)
| Priority | Type | Target |
## Evidence References
[IDs only]
## Next Actions
1. [action with priority]
```

## Post-Compaction Recovery

After compaction or session restart:

1. Check for `hunt-state/compaction-marker.json`
2. Read `hunt-state/current-stage.md` for context
3. Read `hunt-state/next-actions.md` for what to do
4. Load structured state from JSON files
5. Resume from the current stage, NOT from SEED
6. Delete compaction marker after successful recovery
