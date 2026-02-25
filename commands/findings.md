---
name: findings
description: "Document or review security findings for the current engagement"
aliases:
  - f
  - finding
  - log
allowed-tools: Task, Read, Write, Edit, Glob, Grep
argument-hint: "<finding details or \"show\">"
skill: greyhatcc:findings-log
---

# Findings Management

Invoke the `greyhatcc:findings-log` skill with: {{ARGUMENTS}}

Usage:
- `/greyhatcc:findings add "XSS in search"` - Add new finding
- `/greyhatcc:findings list` - List all findings
- `/greyhatcc:findings update F-001` - Update finding status

When an active hunt exists (`hunt-state/`), findings are read from and written to
`hunt-state/findings.json` in structured JSON format. Otherwise falls back to the
legacy `bug_bounty/<program>/findings_log.md` format.

Central repository for all discovered vulnerabilities throughout an engagement:

**Finding Lifecycle:**
1. **Create** - Log a new finding with title, severity, affected asset, and initial evidence
2. **Validate** - Confirm reproducibility, capture proof artifacts, verify impact
3. **Chain** - Check against gadget inventory for chaining opportunities
4. **Report** - Generate H1-ready or PTES report from validated finding

**Finding Record Structure:**
- Unique ID (F-001, F-002, etc.) for cross-referencing
- Title following `[Vulnerability] in [Component] allows [Impact]` format
- Severity: Critical, High, Medium, Low, Informational
- Affected asset with exact URL/endpoint
- Status: discovered, validated, chained, reported, submitted
- Evidence: HTTP request/response pairs, screenshots, tool output
- Chain references: links to related gadgets and chain paths
- CVSS v3.1 vector string and score

**Operations:**
- `show` or `list` - Display all findings with status and severity summary
- `add <details>` - Create a new finding entry
- `update <ID>` - Modify finding status, severity, or evidence
- `export` - Export findings as JSON or Markdown for reporting
- `chain <ID>` - Analyze a finding against the gadget inventory for chains
