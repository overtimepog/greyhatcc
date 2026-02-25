---
name: proof-validator
description: Verify PoC reproducibility before submitting - re-runs curl commands, checks responses match claims, ensures deterministic proof exists
---

# Proof Validator

## Usage
`/greyhatcc:proof <finding_id or report_file>`

Verifies that a finding's Proof of Concept actually works RIGHT NOW. The #1 reason reports get marked N/A is "not reproducible." This skill prevents that.

## What It Checks

### 1. Extract PoC Commands
Parse the finding/report for all curl commands, scripts, and reproduction steps.
Look for:
- `curl` commands in code blocks
- Python/JS/HTML PoC scripts
- Numbered "Steps to Reproduce"
- Referenced evidence files

### 2. Re-Run Each Command
For each extracted curl command:
1. Add the program's required research headers (from scope.md)
2. Execute the command
3. Compare the response to what the report claims
4. Record: status code, relevant headers, body snippet

### 3. Validate Response Matches Claims

| Report Claims | Validation |
|--------------|------------|
| "Returns 200" | Verify status code is 200 |
| "CORS header reflects origin" | Check Access-Control-Allow-Origin matches |
| "Leaks user data" | Verify PII/sensitive data in response body |
| "Actuator exposed" | Verify /actuator returns health/beans/env data |
| "GraphQL introspection enabled" | Verify __schema query returns schema |
| "JWT accepted without signature" | Verify modified token gets 200, not 401 |
| "IDOR returns other user's data" | Verify different user ID returns different user's data |

### 4. Freshness Check
- When was this finding first discovered? (from findings_log.md)
- Has the target been patched since? (re-run confirms)
- If the PoC fails now, the finding may be stale

### 5. Evidence Snapshot
After re-running, save fresh evidence:
- `evidence/<finding_id>/proof_rerun_<date>.txt` — full request/response
- Note whether the re-run matched the original claim

## Output

```markdown
## Proof Validation: <finding_id>

### Commands Tested: <N>
### Results:

| # | Command | Expected | Actual | Match |
|---|---------|----------|--------|-------|
| 1 | curl -sk https://... | 200 + CORS header | 200 + CORS header | PASS |
| 2 | curl -sk https://... | 200 + user data | 403 Forbidden | FAIL |

### Verdict: [CONFIRMED / STALE / PARTIAL / FAILED]

- CONFIRMED: All PoC commands reproduce as documented
- STALE: Finding no longer reproduces (target may have been patched)
- PARTIAL: Some steps work, others don't (update the report)
- FAILED: PoC doesn't work at all (remove the finding)

### Recommendations:
- [specific actions based on results]
```

## Integration Points
- Called automatically by hunt-loop before reporting phase
- Called automatically by siege mode in the validation pipeline
- Called by `/greyhatcc:validate` as part of multi-gate validation
- Can be called manually to spot-check any finding

## Important Notes
- Always include the program's required research headers
- Respect rate limits — don't re-run 50 commands in 5 seconds
- If a PoC requires authentication, ensure you have a valid session
- For time-sensitive findings (race conditions), note that re-runs may vary
- Save evidence of the re-run for the report appendix

## Delegation
- Quick proof check (1-3 commands) → execute directly, no agent needed
- Complex PoC (scripts, multi-step) → `webapp-tester-low` (haiku)
