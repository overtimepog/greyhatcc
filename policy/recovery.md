# Recovery Protocol

## Session Start Recovery

On every session start, check for active hunt:

1. Does `hunt-state/hunt.json` exist with `status: "running"`?
2. If yes → recovery mode
3. If no → clean start

## Recovery Steps

1. Read `hunt-state/current-stage.md` → understand where we are
2. Read `hunt-state/next-actions.md` → understand what to do next
3. Read `hunt-state/hunt.json` → get structured state
4. Read `hunt-state/queue.json` → get pending work
5. Read `hunt-state/decision-log.md` → last 10 entries for context
6. Read `hunt-state/notepad.md` → session notes
7. Resume the appropriate stage

## Recovery Priority

1. If a work item was `active` when interrupted → mark as `queued`, re-attempt
2. If in validation stage → continue validation
3. If in reporting stage → continue reporting
4. Otherwise → resume the hunt loop from queue head

## State Files Required for Recovery

Minimum set (must all exist for valid recovery):
- hunt-state/hunt.json
- hunt-state/queue.json
- hunt-state/current-stage.md

Optional but helpful:
- hunt-state/findings.json
- hunt-state/surfaces.json
- hunt-state/gadgets.json
- hunt-state/signals.json
- hunt-state/next-actions.md
- hunt-state/decision-log.md
