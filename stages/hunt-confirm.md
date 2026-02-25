# Stage: hunt-confirm

Entry when: findings validated, need final confirmation before reporting
Exit when: all validated findings confirmed or rejected

## Purpose

Final human-readable review checkpoint. Write a confirmation summary that a human (or the orchestrator) can review before committing to report generation.

## Execution

1. For each validated finding:
   - Read the finding from hunt-state/findings.json
   - Read associated evidence from evidence-index.md
   - Write a 1-paragraph confirmation note to hunt-state/decision-log.md
2. Check for chain opportunities among validated findings
3. If chains found: group findings, adjust severity upward
4. Write hunt-state/next-actions.md with report generation plan
5. Update current-stage.md

## No Worker Dispatch

This stage runs inline in the dispatcher. No external workers needed.

## Exit Criteria

- All validated findings have confirmation notes in decision-log.md
- hunt-state/next-actions.md lists report items

## Transition

→ hunt-report
