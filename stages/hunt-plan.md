# Stage: hunt-plan

Entry when: new hunt initiated (no existing hunt-state/)
Exit when: scope loaded, initial queue seeded, plan.md written

## Steps

1. Parse target input (program handle, H1 URL, or domain)
2. Call H1 API tools to pull scope:
   - h1_program_detail → program overview
   - h1_structured_scopes → in-scope/out-of-scope assets
   - h1_bounty_table → payout ranges
   - h1_program_policy → rules, exclusions
3. Initialize hunt state: create hunt-state/ directory, write hunt.json
4. Seed initial work queue with recon items (see priority table in policy/queue-schema.md)
5. Write handoff artifacts:
   - hunt-state/plan.md — scope summary, target list, strategy
   - hunt-state/current-stage.md — "hunt-plan complete, entering hunt-recon"
   - hunt-state/next-actions.md — first 5 recon tasks
   - hunt-state/decision-log.md — "Hunt initiated for [program]"
   - hunt-state/open-questions.md — any scope ambiguities
   - hunt-state/notepad.md — empty
   - hunt-state/evidence-index.md — header only
6. Transition to hunt-recon

## Worker Dispatch

Use `greyhatcc:h1-research-worker` (haiku) for H1 API calls.

## Exit Criteria

- hunt-state/hunt.json exists with status: "running"
- hunt-state/queue.json has ≥3 queued recon items
- hunt-state/plan.md written with scope summary
