---
name: findings-log
description: Document and track security findings with structured severity ratings, evidence references, dedup checking, and chaining metadata
---

# Finding Documentation

## Usage
- `/greyhatcc:findings add "<title>"` - Add new finding
- `/greyhatcc:findings list` - List all findings
- `/greyhatcc:findings update <id>` - Update finding status

## MANDATORY: Load Context First
Before adding or updating findings, follow the context-loader protocol:
1. Load program guidelines: scope.md → check the finding is NOT on the exclusion/non-qualifying list
2. Load findings_log.md → check for duplicates and related findings (same root cause = one bounty)
3. Load gadgets.json → check if this finding chains with existing gadgets
4. Load submissions.json → check if this was already submitted to HackerOne
5. Load tested.json → update with the test that produced this finding

**Before adding ANY finding, run through these gates:**
- Is the affected asset in scope? (check scope.md asset list)
- Is the vuln type on the exclusion list? (if yes, can you prove it doesn't apply?)
- Is this a duplicate of an existing finding? (same endpoint + same vuln, or same root cause)
- Does this chain with existing findings? (update gadgets.json if yes)

## Finding Entry Format

```markdown
### [SEVERITY] Finding Title
- **ID**: F-001
- **Severity**: CRITICAL | HIGH | MEDIUM | LOW | INFO
- **CVSS**: 9.8 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
- **Type**: SQL Injection | XSS | IDOR | etc.
- **Affected**: https://example.com/api/endpoint
- **Status**: Confirmed | Unconfirmed | Reported | Fixed
- **CVE**: CVE-YYYY-NNNNN (if applicable)
- **Evidence**: evidence/finding_001/
- **Description**: Brief description of the vulnerability
- **Steps to Reproduce**: Numbered reproduction steps
- **Impact**: What an attacker can achieve
- **Remediation**: How to fix it
- **Date Found**: YYYY-MM-DD
```

## Storage
- Main log: `findings/FINDINGS_LOG.md` or `bug_bounty/<program>_bug_bounty/findings_log.md`
- Individual findings: `findings/<finding_id>.md`
- Evidence: `evidence/<finding_id>/`

## Post-Add Actions
After adding a finding:
1. **Update gadgets.json** — add a gadget entry with `provides`/`requires` tags for chaining
2. **Update tested.json** — mark the endpoint + vuln class as tested with result = `vulnerable`
3. **Run chain analysis** — check if this finding's `provides` satisfies any existing gadget's `requires`
4. **Check program exclusion list** — flag if the finding type is borderline excluded
5. **Suggest report action** — if HIGH/CRITICAL, suggest immediate h1-report generation

Delegate to `report-writer-low` (haiku) for quick documentation.
