---
name: validate-report
description: Multi-gate report quality validation - checks asset accuracy, scope compliance, dedup, proof, CVSS rationale, exclusion list, and submission readiness
---

# Report Validator (Multi-Gate Quality Check)

## Usage
`/greyhatcc:validate <report_file or finding_id> [program_name]`

Runs every quality gate on a report before it gets submitted to HackerOne. This is the last line of defense against rejected reports.

## MANDATORY: Load Context First
1. Load scope.md — assets, exclusions, rules, bounty table
2. Load findings_log.md — all findings for cross-reference
3. Load submissions.json — previously submitted reports
4. Load the report file being validated

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

## Integration
- Called automatically by report-validator hook on Write/Edit of report files
- Called by hunt-loop in reporting phase
- Called by siege mode in validation pipeline
- Called by `/greyhatcc:h1-report` after report generation
- Can be called manually on any report file

## Delegation
- Quick validation (file checks only) → execute directly
- Full validation with proof re-run → `report-quality-gate` agent (haiku)
