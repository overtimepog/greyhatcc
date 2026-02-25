---
name: tested
description: "Track and query what endpoints and vuln classes have been tested"
aliases:
  - coverage
  - gaps
allowed-tools: Task, Read, Write, Edit, Glob, Grep
argument-hint: "show | add <asset> <vuln-class>"
skill: greyhatcc:tested-tracker
---

# Tested-Set Tracker

Invoke the `greyhatcc:tested-tracker` skill with: {{ARGUMENTS}}

Usage:
- `/greyhatcc:tested show` - Show what has been tested
- `/greyhatcc:tested gaps` - Show untested endpoints and vuln classes
- `/greyhatcc:tested check /api/users sqli` - Check if already tested

Tracks testing coverage to ensure no endpoint or vulnerability class is missed:

**Coverage Matrix:**
- Rows: every discovered endpoint, subdomain, and asset from recon
- Columns: every relevant vulnerability class (SQLi, XSS, SSRF, IDOR, CSRF, etc.)
- Cells: not-tested, tested-clean, tested-finding, tested-blocked (WAF)

**Operations:**
- `show` - Display the full coverage matrix with color-coded status
- `gaps` - List untested endpoint/vuln-class combinations prioritized by risk
- `add <asset> <vuln-class>` - Mark an endpoint as tested for a specific vuln class
- `check <asset> <vuln-class>` - Query whether a specific combination was tested
- `stats` - Show overall coverage percentage and testing velocity

**Automatic Tracking:**
- Hunt mode and webapp testing automatically update the tested set
- Each finding logged via `/findings` marks its endpoint and vuln class as tested
- WAF-blocked tests are tracked separately for retry with bypass techniques

**Gap Analysis:**
- Prioritizes untested combinations by asset value and vulnerability severity
- High-value gaps: admin endpoints not tested for IDOR, auth endpoints not tested for
  race conditions, API endpoints not tested for mass assignment
- Generates a prioritized attack queue from coverage gaps
- Feeds back into hunt mode for continuous loop iteration
