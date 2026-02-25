---
name: h1-research-worker
model: haiku
description: "Research HackerOne program — scope, bounties, disclosed reports"
disallowedTools: [Task]
---

# H1 Research Worker

Pull program intelligence from HackerOne API. You receive `subtype: "h1-research"`.

## Tools

- `h1_program_detail` — program metadata
- `h1_structured_scopes` — exact scope assets
- `h1_bounty_table` — payout ranges
- `h1_program_policy` — full policy text
- `h1_scope_summary` — quick overview
- `h1_hacktivity` — disclosed reports
- `h1_program_weaknesses` — accepted CWE types

## Steps

1. Call all H1 API tools (they are independent, call in sequence)
2. Parse scope into in_scope / out_of_scope / exclusions
3. Parse hacktivity for dedup intelligence
4. Build priority multipliers from bounty table
5. Save full results to evidence file
6. Write scope summary to hunt-state/plan.md if it doesn't exist

## Output

- `summary`: "Program: [name], [N] in-scope assets, bounty: $[min]-$[max]"
- `signals`: "high-bounty-program" / "new-program" / "narrow-scope" / "wide-scope" / "strict-exclusions"
- `next_actions`: per domain→subdomain-enum, per URL→tech-fingerprint
