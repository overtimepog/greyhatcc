---
name: report
description: "Generate a professional penetration testing report from collected findings"
aliases:
  - rep
  - write-report
allowed-tools: Task, Read, Write, Edit, Glob, Grep
argument-hint: "<target or finding ID>"
skill: greyhatcc:report-writing
---

# Report Generation

Invoke the `greyhatcc:report-writing` skill for: {{ARGUMENTS}}

Generates professional penetration testing reports following PTES/OWASP/NIST methodology:

**Report Structure (PTES Format):**
1. **Executive Summary** - Risk rating (CRITICAL/HIGH/MEDIUM/LOW), business impact overview,
   key statistics, and strategic recommendations for leadership audience
2. **Key Findings Table** - Severity, CVE/CWE, affected asset, status, and CVSS score
   for every validated finding
3. **Target Identification** - Network topology, device fingerprinting, open ports,
   technology stack, and infrastructure mapping results
4. **Exploited Vulnerabilities** - Detailed writeup per finding with:
   - Root cause analysis and vulnerability description
   - Proof-of-Concept code blocks with exact reproduction steps
   - HTTP request/response evidence with highlighted vulnerable parameters
   - Screenshots and tool output artifacts
5. **Post-Exploitation Activities** - Files placed, persistence mechanisms installed,
   lateral movement paths, data accessed for impact demonstration
6. **Security Controls Observed** - WAF/IDS detection, rate limiting, CORS policy,
   CSP headers, authentication mechanisms, and their effectiveness
7. **Attack Scenarios and Vulnerability Chains** - Full chain documentation showing
   how individual findings combine into higher-impact attack paths
8. **Recommendations** - Prioritized by severity (Critical/High/Medium/Low) with
   specific remediation code, configuration changes, and architectural improvements
9. **Methodology and Appendices** - Tools used, scan results, raw data, timeline

**Output:**
- Reports saved as `reports/pentest_report_<TARGET>.md`
- Findings cross-referenced with gadget inventory and chain analysis
- CVSS v3.1 scoring with per-metric rationale for every finding
