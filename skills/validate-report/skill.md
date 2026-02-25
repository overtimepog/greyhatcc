---
name: validate-report
description: Multi-gate report quality validation - checks asset accuracy, scope compliance, dedup, proof, CVSS rationale, exclusion list, and submission readiness
---

# Report Validator (Multi-Gate Quality Check)

## Usage
`/greyhatcc:validate <report_file or finding_id> [program_name]`

## Smart Input
`{{ARGUMENTS}}` is parsed automatically:
- **CVE ID** (CVE-2024-xxxx) → used for CVE lookup and exploit search
- **Finding ID** (FIND-001) → looked up in findings_log.md
- **Description** (free text) → used as search/filter query
- **File path** → read and analyzed directly
- **Empty** → error: "Usage: /greyhatcc:<skill> <identifier>"

No format specification needed — detect and proceed.


Runs every quality gate on a report before it gets submitted to HackerOne. This is the last line of defense against rejected reports.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## Quality Gates (All Must Pass)

### Gate 1: Asset Accuracy
**The #1 cause of rejected reports.**

- [ ] Report has an `**Asset:**` field
- [ ] Asset name EXACTLY matches an entry in scope.md
- [ ] Asset type matches (URL, Android App, iOS App, etc.)
- [ ] The affected URL in Steps to Reproduce matches the declared asset

Common failures:
- Report says "the API" instead of "api-au.syfe.com"
- Report says "*.example.com" instead of the specific subdomain
- Asset in report doesn't match any scope entry
- Testing was done on UAT but asset says production

**Fix**: Replace the asset name with the exact string from the program's scope table.

### Gate 2: Scope Compliance
- [ ] Asset is listed in the program's in-scope table
- [ ] If testing on staging/UAT: program rules allow UAT findings
- [ ] If asset is a wildcard match: verify the specific subdomain isn't excluded
- [ ] No excluded domains appear in the Steps to Reproduce

### Gate 3: Exclusion List
**The #2 cause of rejected reports.**

- [ ] Vulnerability TYPE is not on the program's non-qualifying list
- [ ] If the type IS excluded: report clearly proves the exclusion doesn't apply
- [ ] Common auto-rejections checked:
  - Missing headers (HSTS, CSP, X-Frame-Options) → almost always excluded
  - Cookie flags → almost always excluded
  - Open redirect without chain → usually excluded
  - CORS without data exfil proof → usually excluded
  - User enumeration → usually excluded
  - Self-XSS → always excluded unless chained with CSRF
  - Rate limiting without ATO/financial impact → usually excluded
  - Outdated library without working exploit → always excluded

### Gate 4: Duplicate Check
- [ ] Finding not in submissions.json (not already submitted)
- [ ] Finding not a root-cause duplicate of another finding in findings_log.md
- [ ] No identical report in reports/ directory
- [ ] Hacktivity check for publicly disclosed similar reports (if not yet run)

### Gate 5: Proof of Exploitation
**The #3 cause of rejected reports: "not reproducible" or "theoretical."**

- [ ] Steps to Reproduce contain copy-pasteable commands
- [ ] Every curl command includes ALL required headers (program research header, auth tokens)
- [ ] Expected output is shown after each step
- [ ] A working PoC script/page exists (not pseudocode)
- [ ] Evidence files are referenced and exist
- [ ] For CORS: a PoC HTML page that demonstrates actual cross-origin data read
- [ ] For XSS: a payload that fires in a realistic context (not just `alert(1)`)
- [ ] For SSRF: proof of internal access beyond DNS callback
- [ ] For IDOR: proof of cross-user data access (not just your own data with different ID format)

### Gate 6: CVSS Integrity
- [ ] CVSS vector string is present and syntactically valid
- [ ] Every metric has a written rationale (not just the value)
- [ ] Score matches the vector (no manual override inflation)
- [ ] Conservative sanity checks:
  - AC:L requires NO preconditions (no subdomain takeover needed, no specific config)
  - PR:N requires truly no authentication (not even a free account)
  - S:C requires crossing a trust boundary (not just same-origin)
  - Score >= 9.0 requires RCE, full ATO, or mass data breach evidence
  - Score >= 7.0 requires more than information disclosure

### Gate 7: Report Completeness
- [ ] Title follows `[Type] in [Asset] allows [Impact]` format
- [ ] Title is under 100 characters
- [ ] TLDR section exists (3 sentences max)
- [ ] CWE classification is present
- [ ] Impact section names specific data types / user actions (not generic)
- [ ] Remediation section has actionable steps (not "fix the bug")
- [ ] Vulnerability chain table populated if other findings relate
- [ ] References section has OWASP/CWE links

### Gate 8: Program Rule Compliance
- [ ] Required research headers in every request (e.g., `X-HackerOne-Research: overtimedev`)
- [ ] Correct test account used (if program provides test accounts)
- [ ] No prohibited testing methods used (no DoS, no social engineering)
- [ ] Testing hours respected (if program has testing windows)
- [ ] Report format follows program preferences (if specified)

## Output

```markdown
## Report Validation: <report_file>

| Gate | Status | Details |
|------|--------|---------|
| 1. Asset Accuracy | PASS/FAIL | [details] |
| 2. Scope Compliance | PASS/FAIL | [details] |
| 3. Exclusion List | PASS/FAIL | [details] |
| 4. Duplicate Check | PASS/FAIL | [details] |
| 5. Proof of Exploitation | PASS/FAIL | [details] |
| 6. CVSS Integrity | PASS/FAIL | [details] |
| 7. Report Completeness | PASS/FAIL | [details] |
| 8. Program Rules | PASS/FAIL | [details] |

### Overall: [READY TO SUBMIT / NEEDS FIXES / DO NOT SUBMIT]

### Required Fixes (if any):
1. [specific fix needed]
2. [specific fix needed]
```

### Verdict Values
- **READY TO SUBMIT**: All 8 gates pass. Report is HackerOne-ready.
- **NEEDS FIXES**: Some gates failed but are fixable. Fix and re-validate.
- **DO NOT SUBMIT**: Critical failures (out of scope, confirmed dupe, excluded vuln type without override).

### Per-Gate Pass/Fail Criteria

#### Gate 1: Asset Accuracy — Pass/Fail
```
PASS if ALL:
  - Report contains "**Asset:**" field
  - Asset string exactly matches an entry in scope.md authorized.assets
  - Asset type matches (URL, Domain, Android App, etc.)
  - URLs in Steps to Reproduce are on the declared asset

FAIL if ANY:
  - No asset field in report
  - Asset name is paraphrased ("the API" instead of "api-au.syfe.com")
  - Asset uses wildcard when a specific subdomain was tested
  - Report tested on UAT but asset field says production domain

AUTO-FIX: Replace asset name with exact string from scope.md asset list
```

#### Gate 2: Scope Compliance — Pass/Fail
```
PASS if ALL:
  - Asset is listed in scope.md in-scope table
  - If wildcard match: specific subdomain is not in excluded list
  - If UAT: program rules explicitly allow UAT findings
  - No excluded domains appear in any curl command

FAIL if ANY:
  - Asset not found in scope.md in-scope list
  - Subdomain matches an excluded domain pattern
  - UAT-only finding when program requires prod validation
  - Steps include requests to out-of-scope domains

AUTO-FIX: Add HOLD notice at top of report if asset is questionable. Remove OOS domains from steps.
```

#### Gate 3: Exclusion List — Pass/Fail
```
PASS if ALL:
  - Vulnerability type is NOT on excluded.vulnTypes list
  - OR: Report explicitly proves the exclusion does not apply (e.g., "CORS without exfil" excluded but report has working exfil PoC)
  - OR: Finding is part of a chain that elevates it past the exclusion

FAIL if ANY:
  - Vuln type matches excluded.vulnTypes exactly
  - Report does not address why the exclusion doesn't apply
  - No chain documented that overcomes the exclusion

AUTO-FIX: If chainable, add chain documentation section. If not, recommend DO NOT SUBMIT.
```

#### Gate 4: Duplicate Check — Pass/Fail
```
PASS if ALL:
  - Finding ID not in submissions.json
  - No identical (same endpoint + same vuln type) entry in findings_log.md with status "Reported"
  - No report in reports/ directory covering the same vulnerability
  - Hacktivity check returns LOW or CLEAR dupe risk

FAIL if ANY:
  - Finding already in submissions.json
  - Root-cause duplicate of another finding
  - Hacktivity check returns HIGH dupe risk

AUTO-FIX: If root-cause dupe, suggest combining into the existing report. If hacktivity dupe, suggest DIFFERENTIATE approach.
```

#### Gate 5: Proof of Exploitation — Pass/Fail
```
PASS if ALL:
  - Steps to Reproduce contain copy-pasteable curl commands or scripts
  - Every command includes ALL required headers (research header, auth tokens)
  - Expected output is shown after each step
  - A working PoC exists (not pseudocode)
  - Evidence files referenced in report actually exist on disk
  - Vuln-specific proof meets bar:
    * CORS: PoC HTML page that demonstrates actual cross-origin data read
    * XSS: Payload fires in realistic context (not just alert(1) in self-XSS)
    * SSRF: Proof of internal access beyond DNS callback
    * IDOR: Cross-user data access (not own data with different ID format)

FAIL if ANY:
  - No curl commands in Steps to Reproduce
  - Missing required research headers in commands
  - No expected output shown
  - PoC is theoretical/pseudocode
  - Evidence files referenced but don't exist
  - CORS without exfil PoC, SSRF with only DNS callback, IDOR accessing own data

AUTO-FIX: Re-run proof-validator skill to capture fresh evidence. Add missing headers to commands. Create PoC script.
```

#### Gate 6: CVSS Integrity — Pass/Fail
```
PASS if ALL:
  - CVSS vector string present and syntactically valid (CVSS:3.1/AV:../AC:..)
  - Every metric has a written rationale (not just the value)
  - Computed score matches the vector (no manual inflation)
  - Conservative checks pass:
    * AC:L → no preconditions needed
    * PR:N → truly unauthenticated
    * S:C → actually crosses trust boundary
    * Score >= 9.0 → RCE, full ATO, or mass data breach evidence
    * Score >= 7.0 → more than information disclosure

FAIL if ANY:
  - No CVSS vector string
  - Missing rationale for any metric
  - Score doesn't match vector computation
  - AC:L claimed but preconditions exist
  - PR:N claimed but free account needed
  - Inflated score without matching evidence

AUTO-FIX: Recalculate CVSS with conservative values. Add rationale template for each metric.
```

#### Gate 7: Report Completeness — Pass/Fail
```
PASS if ALL:
  - Title follows "[Type] in [Asset] allows [Impact]" format
  - Title is under 100 characters
  - TLDR exists (3 sentences max)
  - CWE classification present
  - Impact names specific data types / user actions
  - Remediation has actionable steps
  - Chain table populated if related findings exist
  - References include OWASP/CWE links

FAIL if ANY:
  - Title is generic ("XSS vulnerability")
  - No TLDR
  - No CWE
  - Impact is vague ("an attacker could compromise the system")
  - Remediation says "fix the bug" without specifics
  - Related findings exist but no chain table

AUTO-FIX: Generate proper title from finding details. Add CWE lookup. Expand impact with specific data types. Add chain table from gadgets.json.
```

#### Gate 8: Program Rule Compliance — Pass/Fail
```
PASS if ALL:
  - Required research headers in every curl command
  - Correct test account used (if program provides test accounts)
  - No prohibited methods used (no DoS, no social engineering)
  - Testing hours respected (if program has testing windows)

FAIL if ANY:
  - Missing required headers in any curl command
  - Wrong test account or unauthorized account
  - Report mentions prohibited testing methods
  - Testing conducted outside allowed hours

AUTO-FIX: Add missing headers to all curl commands. Note correct test account.
```

### Common Validation Failures and Examples

| Failure | Bad Example | Good Example |
|---------|-------------|-------------|
| Generic title | "CORS vulnerability" | "CORS Misconfiguration in api-au.syfe.com Allows Authenticated Data Theft via Origin Reflection" |
| Missing asset | "Found on the API" | "**Asset:** api-au.syfe.com (URL)" |
| Vague impact | "Attacker can access data" | "Attacker can read victim's financial portfolio, bank account numbers, and transaction history" |
| No research header | `curl -sk https://target/` | `curl -sk -H "X-HackerOne-Research: overtimedev" https://target/` |
| Inflated CVSS | AC:L when subdomain takeover needed | AC:H with rationale: "Requires claiming dangling subdomain" |
| Pseudocode PoC | "Send a request to the endpoint" | `curl -sk -H "Origin: https://evil.com" https://api.target.com/endpoint` |

## Integration
- Called automatically by report-validator hook on Write/Edit of report files
- Called by hunt-loop in reporting phase
- Called by siege mode in validation pipeline
- Called by `/greyhatcc:h1-report` after report generation
- Can be called manually on any report file

## Delegation
- Quick validation (file checks only) → execute directly
- Full validation with proof re-run → `report-quality-gate` agent (haiku)


## Agent Dispatch Protocol
When delegating to agents via Task(), ALWAYS:
1. **Prepend worker preamble**: "[WORKER] Execute directly. No sub-agents. Output ≤500 words. Save findings to disk. 3 failures = stop and report."
2. **Set max_turns**: haiku=10, sonnet=25, opus=40
3. **Pass full context**: scope, exclusions, existing findings, recon data
4. **Route by complexity**: Quick checks → haiku agents (-low). Standard work → sonnet agents. Deep analysis/exploitation → opus agents.

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
