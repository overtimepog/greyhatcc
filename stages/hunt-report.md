# Stage: hunt-report

Entry when: findings confirmed, ready for H1 report generation
Exit when: all reports written to hunt-state/reports/

## Purpose

Generate HackerOne-ready vulnerability reports for each validated finding.

## Execution

1. For each confirmed finding:
   - Dispatch to report-drafter worker
   - Worker reads finding summary + evidence IDs
   - Worker produces H1-formatted report markdown
   - Report saved to hunt-state/reports/finding-{id}.md
2. For chain findings: generate combined chain report
3. Update evidence-index.md with report file references
4. Write final summary to hunt-state/decision-log.md

## Worker Map

| Task | Worker | Model |
|------|--------|-------|
| Individual report | greyhatcc:report-drafter | sonnet |
| Chain report | greyhatcc:report-drafter | opus |
| Evidence curation | greyhatcc:evidence-curator | haiku |

## Exit Criteria

- Report file exists for every validated finding
- Hunt summary written

## Transition

→ hunt-test (if more test items remain)
→ FINALIZE (if queue empty)
