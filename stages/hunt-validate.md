# Stage: hunt-validate

Entry when: findings with confidence > 0.7 need validation
Exit when: all candidate findings processed through 5-gate pipeline

## Purpose

Run each finding through the 5-gate validation pipeline. Only validated findings proceed to reporting.

## Execution

1. Pop highest-priority validate item
2. Run gates 1-3 (scope, exclusion, dedup) — cheap checks first
3. If gates 1-3 pass: run gate 4 (proof reproduction) — expensive, requires opus
4. If gate 4 passes: run gate 5 (quality check)
5. Update finding status: validated / rejected / returned
6. If returned: enqueue fix item (test or exploit) and go to hunt-fix
7. If validated: enqueue report item
8. Log all gate decisions to decision-log.md
9. Update evidence-index.md with fresh evidence from proof gate

## Worker Map

| Gate | Worker | Model |
|------|--------|-------|
| 1-2 (scope + exclusion) | greyhatcc:scope-check-worker | sonnet |
| 3 (dedup) | greyhatcc:dedup-worker | sonnet |
| 4-5 (proof + quality) | greyhatcc:proof-worker | opus |

## Exit Criteria

- All validate items processed
- Each finding has status: validated, rejected, or returned

## Transition

→ hunt-confirm (if findings validated)
→ hunt-fix (if findings returned for more work)
→ hunt-report (if all findings validated)
