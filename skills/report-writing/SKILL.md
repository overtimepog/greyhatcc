---
name: report-writing
description: Generate professional penetration testing reports following PTES/OWASP methodology from collected findings and evidence
---

# Pentest Report Generation

You are executing the greyhatcc report writing skill.

## Usage
`/greyhatcc:report <target or engagement name>`

## MANDATORY: Load Context First
Before writing ANY report, follow the context-loader protocol:
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

### Full Pentest Report (default)
Delegate to `report-writer` (sonnet) or `report-writer-high` (opus) for executive level.

Structure:
1. Executive Summary with overall risk rating
2. Key Findings table (Severity | Title | CVE | Status)
3. Target Identification (network, devices, open ports)
4. Exploited Vulnerabilities (with PoC code blocks)
5. Post-Exploitation Activities
6. Security Controls Observed
7. Attack Scenarios
8. Recommendations (Critical -> Low priority)
9. Methodology
10. Appendices

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
