---
name: findings-log
description: Document and track security findings with structured severity ratings, evidence references, dedup checking, and chaining metadata
---

# Finding Documentation

## Usage
- `/greyhatcc:findings add "<title>"` - Add new finding
- `/greyhatcc:findings list` - List all findings
- `/greyhatcc:findings update <id>` - Update finding status

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

Before adding or updating findings, also follow the context-loader protocol:
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

## Severity Rating Guide

| Severity | CVSS Range | Criteria | Examples |
|----------|-----------|----------|---------|
| **CRITICAL** | 9.0-10.0 | RCE, full ATO, mass data breach, cloud takeover | Unauthenticated RCE, SSRF to IAM creds, SQL injection full DB |
| **HIGH** | 7.0-8.9 | Significant data access, auth bypass, priv esc | IDOR on PII, JWT forgery, CORS+exfil, OAuth token theft |
| **MEDIUM** | 4.0-6.9 | Limited exposure, needs user interaction | Stored XSS, CSRF on settings, standalone subdomain takeover |
| **LOW** | 0.1-3.9 | Minimal impact, informational | Reflected XSS unlikely context, version disclosure with no CVE |
| **INFO** | N/A | Informational, chain-only | Internal IPs in DNS, debug headers, CSP gaps |

## Finding Lifecycle

```
DISCOVERED → CONFIRMED → CHAINED (optional) → REPORTED → SUBMITTED → RESOLVED/BOUNTY
    ↓            ↓                                                        ↓
  INVALID     STALE                                                   DUPLICATE
  (remove)    (re-test)                                               (note original)
```

| Status | Meaning | Next Action |
|--------|---------|-------------|
| `Discovered` | Initial observation, needs validation | Run proof-validator |
| `Confirmed` | PoC works, evidence captured | Check for chains, run dedup |
| `Chained` | Part of a vulnerability chain | Write combined report |
| `Reported` | H1 report written | Run validate-report, then submit |
| `Submitted` | Submitted to HackerOne | Update submissions.json, wait for triage |
| `Resolved` | Fixed by program | Note in findings_log, check for regression |
| `Bounty` | Bounty awarded | Note amount in submissions.json |
| `Duplicate` | Marked as dupe | Note original report ID |
| `Stale` | No longer reproduces | Re-test or remove |
| `Invalid` | False positive confirmed | Remove from active findings |

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
