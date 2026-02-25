# Stage: hunt-recon

Entry when: hunt-plan complete, queue has recon items
Exit when: no more recon-type items in queue head, OR enough surfaces discovered to begin testing

## Purpose

Discover attack surface. Do NOT test for vulnerabilities — map the terrain.

## Execution

1. Pop highest-priority recon item from queue
2. Dispatch to appropriate recon worker (see worker map below)
3. Receive compact result (summary + evidence IDs + signals + next_actions)
4. Persist: add surfaces, signals, gadgets to state files
5. Enqueue follow-up items from worker's next_actions
6. Update hunt-state/current-stage.md and hunt-state/next-actions.md
7. Log decisions to hunt-state/decision-log.md
8. Repeat until stage exit criteria met

## Worker Map

| Subtype | Worker Agent | Model |
|---------|-------------|-------|
| subdomain-enum | greyhatcc:subdomain-worker | haiku |
| tech-fingerprint | greyhatcc:fingerprint-worker | haiku |
| shodan | greyhatcc:shodan-worker | haiku |
| osint | greyhatcc:osint-worker | haiku |
| js-analysis | greyhatcc:js-worker | sonnet |
| cloud-recon | greyhatcc:cloud-worker | haiku |
| h1-research | greyhatcc:h1-research-worker | haiku |
| subdomain-takeover | greyhatcc:takeover-worker | haiku |
| port-scan | greyhatcc:portscan-worker | haiku |

## Parallelism

Up to 3 independent recon items may run in parallel (they target different hosts/subtypes).

## Exit Criteria

- Queue head is no longer recon-type (test items have higher priority), OR
- ≥10 surfaces discovered and ≥3 test items queued, OR
- All recon items exhausted

## Transition

→ hunt-test (primary path)
→ hunt-recon (loop if new recon items emerge from test results)
