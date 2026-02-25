---
name: proof-validator
description: Verify PoC reproducibility before submitting - re-runs curl commands, checks responses match claims, ensures deterministic proof exists
---

# Proof Validator

## Usage
`/greyhatcc:proof <finding_id or report_file>`

Verifies that a finding's Proof of Concept actually works RIGHT NOW. The #1 reason reports get marked N/A is "not reproducible." This skill prevents that.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

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

## Re-Execution Framework

### Command Extraction
Parse the finding/report file and extract all executable commands:

```
Extraction patterns:
1. Code blocks containing `curl` commands
2. Code blocks containing `python`, `python3`, `node` commands
3. Inline bash commands in numbered steps
4. Referenced PoC script files in evidence/<finding_id>/
5. HTML PoC files that need to be served and browsed
6. Multi-step sequences (numbered steps with dependencies)
```

### Pre-Execution Setup

Before re-running any command:

1. **Load required headers** from scope.json `rules.requiredHeaders`:
   ```bash
   # Always add program-required headers
   -H "X-HackerOne-Research: overtimedev"
   ```

2. **Check authentication state**: If commands require auth tokens/cookies:
   - Are they still valid? (check expiration)
   - Can we refresh them? (re-login if needed)
   - If credentials are needed, prompt user

3. **Set execution timeout**: Default 30 seconds per command
   - Race conditions: allow 5 seconds per request burst
   - Long-running scans: allow 120 seconds
   - Network timeouts: allow 60 seconds

### Execution Protocol

For each extracted command:

```
1. Parse the command to identify:
   - HTTP method and URL
   - Required headers (add program headers if missing)
   - Authentication tokens (check validity)
   - Expected response indicators (status code, headers, body patterns)

2. Execute with timeout:
   - Wrap in timeout: `timeout 30 <command>`
   - Capture full output: stdout + stderr
   - Record execution timestamp (UTC)

3. Compare actual vs expected:
   - Status code match? (200 vs 200 = PASS)
   - Critical headers present? (CORS header, Set-Cookie, etc.)
   - Response body contains expected data? (PII, tokens, error signatures)
   - Response body does NOT contain block indicators? (WAF block, 403, captcha)

4. Record result:
   - PASS: Actual matches expected
   - FAIL: Actual differs from expected
   - PARTIAL: Some assertions pass, others fail
   - ERROR: Command failed to execute (timeout, DNS failure, connection refused)
   - BLOCKED: WAF/rate limit prevented execution
```

### Handling Special Test Types

#### Authentication-Required Tests
```
If PoC needs valid session:
1. Check if test credentials are in scope.json rules.testAccounts
2. If credentials provided: re-authenticate, get fresh token
3. If no credentials: prompt user for auth token
4. Substitute fresh token into all commands
5. Note: "Re-validated with fresh auth token at <timestamp>"
```

#### Time-Sensitive Tests (Race Conditions)
```
Race condition PoCs may not reproduce consistently:
1. Run the race test 5 times
2. Record success/failure for each attempt
3. If 2+ out of 5 succeed: CONFIRMED (with note about intermittent nature)
4. If 0 out of 5 succeed: May be STALE or timing-dependent
5. Note: "Race condition validated X/5 attempts at <timestamp>"
6. For HTTP/2 single-packet attacks: ensure HTTP/2 is used
```

#### Multi-Step Chain Tests
```
For chained vulnerability PoCs:
1. Execute each step sequentially
2. Capture output from step N to feed into step N+1
3. If any step fails, mark the chain as BROKEN at that step
4. Record which links in the chain still work independently
5. Note: "Chain validated through step X of Y"
```

#### Playwright-Based Tests
```
For PoCs that require browser interaction:
1. Use Playwright MCP browser_navigate to load the PoC page
2. Use browser_evaluate to check for expected DOM state
3. Use browser_take_screenshot for visual evidence
4. Use browser_console_messages to capture JS errors/output
5. Note: "Browser-based PoC validated via Playwright at <timestamp>"
```

### Freshness Requirement

**The PoC must work NOW, not just when it was originally found.**

```
Freshness checks:
1. When was this finding first discovered? (from findings_log.md date)
2. How long ago was it?
   - < 24 hours: likely still valid
   - 1-7 days: should re-validate
   - > 7 days: MUST re-validate before submission
   - > 30 days: HIGH risk of being patched
3. Has the target deployed changes since discovery?
   - Check Last-Modified, ETag, or version headers
   - Compare response signatures with original evidence
4. If re-run fails: finding may be STALE — update status in findings_log.md
```

### Post-Validation Actions

Based on validation result:

| Verdict | Action |
|---------|--------|
| **CONFIRMED** | Proceed with report. Save fresh evidence to `evidence/<finding_id>/proof_rerun_<date>.txt` |
| **STALE** | Update findings_log.md status to "Patched?". Do NOT submit report. Remove from pending findings. |
| **PARTIAL** | Update report to reflect current state. Some steps may need adjustment. Re-validate after fixes. |
| **FAILED** | Mark finding as invalid in findings_log.md. Remove from gadgets.json active chains. Do NOT submit. |
| **BLOCKED** | Try alternative technique (different IP, Playwright, encoding bypass). If still blocked, note in report. |

## Delegation
- Quick proof check (1-3 commands) → execute directly, no agent needed
- Complex PoC (scripts, multi-step) → `webapp-tester-low` (haiku)

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
