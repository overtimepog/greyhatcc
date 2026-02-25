# Stage: hunt-fix

Entry when: validation returned a finding that needs more work
Exit when: finding re-tested or re-exploited and re-queued for validation

## Purpose

Loop stage for findings that failed proof or quality gates. Re-test, re-exploit, or refine the finding, then send it back through validation.

## Execution

1. Read the returned finding and its gate failure reasons
2. If proof failed: dispatch appropriate test worker to re-test with adjusted approach
3. If quality failed: dispatch report-drafter to improve the report
4. Receive result
5. Update finding with new evidence/PoC
6. Re-enqueue for validation at priority 80
7. Log the fix attempt to decision-log.md

## Worker Dispatch

Same workers as hunt-test or hunt-report, depending on which gate failed.

## Retry Limit

Max 3 fix attempts per finding. After 3 failures: mark as rejected, log reason.

## Exit Criteria

- Finding re-queued for validation, OR
- Finding rejected after 3 attempts

## Transition

→ hunt-validate (re-validation)
→ hunt-test (continue testing other items)
