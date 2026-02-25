---
name: report-writing
description: Generate professional penetration testing reports following PTES/OWASP methodology from collected findings and evidence
---

# Pentest Report Generation

You are executing the greyhatcc report writing skill.

## Usage
`/greyhatcc:report <target or engagement name>`

## Smart Input
`{{ARGUMENTS}}` is parsed automatically:
- **Program handle** (e.g. `security`) → used directly with H1 API
- **H1 URL** (https://hackerone.com/security) → program handle extracted
- **Domain** (example.com) → search H1 programs for matching domain
- **Empty** → error: "Usage: /greyhatcc:<skill> <program>"

No format specification needed — detect and proceed.


## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

Before writing ANY report, also follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (report format section, chaining methodology)
2. Load program guidelines: scope.md → assets, exclusions, rules, bounty table
3. Load ALL findings: findings_log.md — every finding must be included
4. Load ALL reports: reports/*.md — avoid contradicting or duplicating existing reports
5. Load ALL evidence: evidence/ — reference actual evidence files, not imagined ones
6. Load gadgets.json — include chain table in report
7. Load submissions.json — note which findings have been submitted and their status
8. Load memory: Target-specific notes from previous sessions

**The report-writer agent MUST read these files before writing. Do NOT generate a report from memory or imagination. Every claim must be backed by evidence files.**

## Report Types

### Full Pentest Report (PTES Structure)
Delegate to `report-writer` (sonnet) or `report-writer-high` (opus) for executive level.

#### Section-by-Section Writing Guide

**1. Executive Summary** (1-2 pages)
- Overall risk rating: CRITICAL / HIGH / MEDIUM / LOW
- Business impact in non-technical language
- Key statistics: N findings, X critical, Y high
- Top 3 recommendations (executive action items)
- Engagement scope and duration summary

**2. Key Findings Table**
```markdown
| # | Title | Severity | CVSS | CVE | Status | Asset |
|---|-------|----------|------|-----|--------|-------|
| 1 | RCE via deserialization | CRITICAL | 9.8 | CVE-2024-XXXX | Confirmed | api.target.com |
| 2 | IDOR on user profiles | HIGH | 7.5 | N/A | Confirmed | app.target.com |
```

**3. Target Identification**
- Network topology diagram (if applicable)
- Device/service fingerprinting results
- Open ports and services from nmap
- Technology stack from tech-fingerprint
- WAF/CDN identification

**4. Exploited Vulnerabilities** (per finding)
- Description with root cause analysis
- Full PoC code blocks (copy-pasteable)
- Step-by-step reproduction
- Evidence screenshots and HTTP logs
- Impact assessment (CIA triad)

**5. Post-Exploitation Activities**
- Files placed on target systems (with paths)
- Persistence mechanisms installed
- Lateral movement performed
- Data accessed/exfiltrated (test data only)
- **Cleanup checklist** for remediation team

**6. Security Controls Observed**
- What defenses were in place
- What defenses worked (blocked attacks)
- What defenses were bypassed (and how)
- WAF effectiveness assessment

**7. Attack Scenarios & Vulnerability Chains**
- Chain diagrams (text-based)
- Gadget inventory summary from gadgets.json
- Business impact of combined chains

**8. Recommendations** (prioritized)
```
CRITICAL Priority (fix within 24-48 hours):
- [specific remediation with code examples]

HIGH Priority (fix within 1 week):
- [specific remediation with code examples]

MEDIUM Priority (fix within 1 month):
- [specific remediation with code examples]

LOW Priority (fix in next release cycle):
- [specific remediation]
```

**9. Methodology**
- Tools used (with versions)
- Testing timeline
- OWASP/PTES methodology followed
- Scope constraints and limitations

**10. Appendices**
- Raw scan outputs
- Full evidence files
- Tool configurations
- Glossary of terms

#### Severity Rating Criteria

| Rating | Criteria | Examples |
|--------|----------|---------|
| **CRITICAL** (9.0-10.0) | RCE, full ATO, mass data breach, cloud takeover | Unauthenticated RCE, SQL injection with full DB access, SSRF to IAM creds |
| **HIGH** (7.0-8.9) | Significant data exposure, auth bypass, privilege escalation | IDOR on PII, JWT forgery, CORS with data exfil, OAuth token theft |
| **MEDIUM** (4.0-6.9) | Limited data exposure, requires user interaction, limited impact | Stored XSS, CSRF on settings, subdomain takeover (standalone), info disclosure |
| **LOW** (0.1-3.9) | Minimal impact, theoretical, informational | Reflected XSS requiring unlikely user action, missing headers (if not excluded), version disclosure |

### HackerOne Report
Use `/greyhatcc:h1-report` for HackerOne-specific formatting.

## Data Sources
- `findings/FINDINGS_LOG.md` - All documented findings
- `recon/` - Reconnaissance data
- `evidence/` - Screenshots, HTTP logs, response dumps
- `exploits/` - PoC code

## Output
Save to `reports/pentest_report_<target>.md` or `reports/h1_report_<finding>.md`

## Post-Report Actions
1. Run dedup-checker on each finding before finalizing
2. Update submissions.json when a report is submitted to HackerOne
3. Cross-reference findings with program exclusion list — flag any borderline findings

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
