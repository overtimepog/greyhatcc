# Stage: hunt-test

Entry when: surfaces discovered, test items in queue
Exit when: test items exhausted or findings ready for validation

## Purpose

Probe discovered surfaces for vulnerabilities. Emit findings, signals, and gadgets.

## Execution

1. Pop highest-priority test item from queue
2. Select model tier (see policy/queue-schema.md for defaults)
3. Dispatch to appropriate test worker
4. Receive compact result
5. For each finding with confidence > 0.7: enqueue validate item at priority 75
6. Store signals, gadgets, surfaces
7. Update handoff artifacts (current-stage.md, next-actions.md)
8. Log decisions
9. Every 5 items: run intel analysis (signal amplification, chain detection, coverage gaps)
10. Repeat

## Worker Map

| Subtype | Worker Agent | Model |
|---------|-------------|-------|
| quick-scan | greyhatcc:quick-scan-worker | haiku |
| xss | greyhatcc:xss-worker | sonnet |
| sqli | greyhatcc:sqli-worker | sonnet |
| ssrf | greyhatcc:ssrf-worker | sonnet |
| idor | greyhatcc:idor-worker | sonnet |
| auth | greyhatcc:auth-worker | opus |
| api | greyhatcc:api-worker | sonnet |
| logic | greyhatcc:logic-worker | opus |
| upload | greyhatcc:upload-worker | sonnet |
| redirect | greyhatcc:redirect-worker | haiku |
| cors | greyhatcc:cors-worker | haiku |
| header | greyhatcc:header-worker | sonnet |
| graphql | greyhatcc:graphql-worker | sonnet |
| wordpress | greyhatcc:wordpress-worker | sonnet |
| cache | greyhatcc:cache-worker | opus |

## Intel Analysis (every 5 items)

Dispatch intel analysis inline (not a separate agent). Read:
- policy/amplification-rules.md for signal matching
- policy/chaining-rules.md for gadget chain detection
- hunt-state/signals.json, gadgets.json, coverage.json

Produce: new queue items, priority adjustments, health assessment.

## Exit Criteria

- No more test items in queue, OR
- ≥1 finding ready for validation, OR
- Coverage > 80%

## Transition

→ hunt-validate (when findings need validation)
→ hunt-recon (when test reveals new surfaces needing recon)
→ hunt-test (loop for remaining test items)
