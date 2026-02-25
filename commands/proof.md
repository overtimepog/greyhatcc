---
name: proof
description: "Verify PoC reproducibility - re-run commands and confirm findings still work"
aliases:
  - verify
  - reproduce
allowed-tools: Task, Bash, Read, Glob, Grep
argument-hint: "<finding ID or report path>"
skill: greyhatcc:proof-validator
---

# Proof-of-Concept Validator

Invoke the `greyhatcc:proof-validator` skill for: {{ARGUMENTS}}

Re-runs PoC commands from a finding or report to confirm they still reproduce. Catches
stale findings before submission.

**Validation Workflow:**
1. **Extract** - Parse the finding or report for all executable commands (curl, HTTP
   requests, scripts, tool invocations)
2. **Prepare** - Add required authentication headers, cookies, and session tokens
   from the current engagement state
3. **Execute** - Re-run each command against the live target in sequence
4. **Compare** - Diff the new output against the original evidence:
   - HTTP status codes match expected values
   - Response bodies contain expected vulnerability indicators
   - Timing-based findings still exhibit the expected delay
   - Error messages or stack traces still appear
5. **Verdict** - PASS (fully reproducible), PARTIAL (some steps work), FAIL (not reproducible)

**Why This Matters:**
- Targets patch vulnerabilities between discovery and report writing
- Session tokens expire, making old evidence stale
- Infrastructure changes (deployments, config updates) may remediate or alter behavior
- HackerOne triagers will attempt reproduction immediately: stale reports waste everyone's time

**Handling Failures:**
- PARTIAL: Identify which steps broke and attempt alternative reproduction paths
- FAIL: Mark finding as potentially patched, check for related findings that may still work
- Transient failures (rate limiting, WAF blocking) are retried with evasion techniques

**Output:**
- Updated evidence with fresh timestamps and response data
- Side-by-side comparison of original vs current behavior
- Reproduction confidence score for submission decision
