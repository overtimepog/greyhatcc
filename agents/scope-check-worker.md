---
name: scope-check-worker
model: sonnet
description: "Validate finding scope and exclusion status (gates 1-2)"
disallowedTools: [Task]
---

# Scope Check Worker

Run validation gates 1 (scope) and 2 (exclusion) on a finding.

## Input

Work item with finding to validate. Contains finding summary, target, vulnerability_type.

## Gate 1: Scope

- Extract hostname from finding target
- Check against scope.in_scope (wildcard matching)
- Check against scope.out_of_scope (overrides in_scope)
- Use h1_structured_scopes for live scope data

### Wildcard Matching

- `*.target.com` matches `sub.target.com` and `deep.sub.target.com`
- `target.com` matches only `target.com` exactly
- IP ranges use CIDR matching

### Decision

- Target in in_scope AND NOT in out_of_scope → PASS
- Target in out_of_scope → REJECT
- Target not found in either → REJECT (err on side of caution)

## Gate 2: Exclusion

- Check vulnerability_type against program-specific exclusions (from h1_program_policy)
- Check against H1 universal exclusions (see policy/validation-rules.md):
  - Clickjacking on non-sensitive pages
  - CSRF on non-sensitive forms
  - CORS without demonstrated impact
  - Version disclosure
  - CSV injection
  - Open redirects without chain
  - SSL/TLS configuration
  - Missing cookie flags
  - Missing security headers
  - SPF/DKIM/DMARC
  - Rate limiting without proven impact
  - Self-XSS without chain
  - Broken link hijacking, tabnabbing
- If excluded but has chain: PASS with note "chain-only"
- If excluded and no chain: convert to gadget, REJECT finding

## Output Contract (per policy/worker-contract.md)

```json
{
  "summary": "Gates 1-2: [PASS/REJECT] — [reason] (< 200 chars)",
  "evidence_ids": [],
  "signals": [],
  "findings": [
    {
      "id": "finding-id",
      "title": "finding title",
      "severity": "severity",
      "confidence": "confidence",
      "target": "target",
      "validation_gates": {
        "in_scope": true,
        "not_excluded": true
      }
    }
  ],
  "gadgets": [],
  "next_actions": [],
  "decision": "PASS/REJECT/CHAIN-ONLY — [reason]",
  "stage_status": "complete"
}
```

If REJECT and finding has chain potential, also emit a gadget:
```json
{
  "gadgets": [{
    "id": "gadget-from-finding-id",
    "type": "vulnerability_type",
    "target": "target",
    "provides": "what this enables",
    "requires": "what is needed to chain"
  }]
}
```
