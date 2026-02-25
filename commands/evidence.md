---
name: evidence
description: "Capture and organize evidence for vulnerability findings"
aliases:
  - ev
  - capture
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<finding ID or description>"
skill: greyhatcc:evidence-capture
---

# Evidence Capture

Invoke the `greyhatcc:evidence-capture` skill for: {{ARGUMENTS}}

Systematic evidence collection and organization for vulnerability findings:

**Evidence Types:**
- **HTTP Logs** - Full request/response pairs with headers, cookies, and body content
  captured as curl commands and raw HTTP for reproducibility
- **Screenshots** - Browser screenshots via Playwright capturing visual proof of
  exploitation (error pages, admin access, data exposure)
- **Tool Output** - Raw output from scanning tools (nmap, nuclei, sqlmap) with
  timestamps and exact command lines used
- **Code Snippets** - Vulnerable source code sections from JS bundles, source maps,
  or decompiled applications with line numbers highlighted
- **Network Captures** - Relevant packet data for timing attacks, race conditions,
  or protocol-level vulnerabilities

**Naming Conventions:**
- Evidence files: `evidence/<finding-id>/<type>_<timestamp>.<ext>`
- HTTP logs: `evidence/F-001/http_2024-01-15T10-30-00.txt`
- Screenshots: `evidence/F-001/screenshot_login-bypass.png`
- Tool output: `evidence/F-001/nmap_full-scan.txt`

**Chain-of-Evidence Linking:**
- Each evidence artifact is tagged with its parent finding ID
- Chain evidence links multiple findings showing the complete attack path
- Timeline reconstruction: ordered sequence of actions from initial access to impact
- Evidence integrity: timestamps and hashes for tamper detection

**Organization:**
- Evidence directory auto-created per finding with standardized structure
- Index file generated linking all artifacts to their findings and chains
- Export capability for attaching to H1 reports or PTES deliverables
- Cleanup tracking: list of all files placed on target for post-engagement removal
