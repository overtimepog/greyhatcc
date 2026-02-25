---
name: evidence-capture
description: Capture and organize evidence for vulnerability findings including HTTP request/response logs, screenshots, and tool outputs
---

# Evidence Capture

## Usage
Typically called from within other skills/workflows, not directly.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## Evidence Types Taxonomy

### 1. HTTP Request/Response Logs
The most critical evidence type. Every finding MUST have reproducible HTTP evidence.

```
evidence/<finding_id>/http_request_<timestamp>.txt   - Full curl command with ALL headers
evidence/<finding_id>/http_response_<timestamp>.txt  - Complete HTTP response (headers + body)
evidence/<finding_id>/http_chain_<step>.txt           - Multi-step chain evidence (numbered)
```

Requirements:
- Include the **exact curl command** with all flags, headers (including program-required headers like `X-HackerOne-Research: overtimedev`), and body
- Capture **full response headers** using `-D -` or `-i` flags
- For authentication-dependent requests, note the auth mechanism but redact tokens in evidence summaries
- Include timestamps for time-sensitive findings (race conditions)

### 2. Screenshots (Playwright)
Visual proof for UI-rendered vulnerabilities.

```
evidence/<finding_id>/screenshot_<description>_<timestamp>.png
evidence/<finding_id>/screenshot_before.png    - State before exploitation
evidence/<finding_id>/screenshot_after.png     - State after exploitation
evidence/<finding_id>/screenshot_impact.png    - Demonstrating impact
```

Capture via Playwright MCP:
```
Use: mcp__plugin_playwright_playwright__browser_take_screenshot
```

When to capture:
- XSS payload execution (alert box, DOM modification)
- IDOR showing another user's data
- Admin panel access
- Sensitive data exposure in browser
- Visual confirmation of subdomain takeover claim page

### 3. Tool Output
Raw output from security scanning tools.

```
evidence/<finding_id>/nmap_<target>_<timestamp>.txt
evidence/<finding_id>/nuclei_<template>_<timestamp>.txt
evidence/<finding_id>/shodan_<ip>_<timestamp>.json
evidence/<finding_id>/ffuf_<wordlist>_<timestamp>.txt
evidence/<finding_id>/sqlmap_<target>_<timestamp>.txt
```

### 4. Video PoC
For complex multi-step exploits or race conditions.

```
evidence/<finding_id>/poc_video_<timestamp>.mp4
evidence/<finding_id>/poc_video_<timestamp>.gif
```

Best captured via screen recording while walking through Steps to Reproduce.

### 5. Code Snippets / PoC Scripts
Working exploit code that demonstrates the vulnerability.

```
evidence/<finding_id>/poc_exploit.<ext>          - Full PoC script (Python, JS, HTML)
evidence/<finding_id>/poc_page.html               - PoC HTML page (CORS, XSS, clickjacking)
evidence/<finding_id>/vulnerable_code_snippet.txt - Extracted vulnerable source code
```

### 6. Configuration Files
Evidence of misconfiguration findings.

```
evidence/<finding_id>/config_<service>.txt       - Extracted configuration
evidence/<finding_id>/source_map_<bundle>.json    - Exposed source maps
evidence/<finding_id>/openapi_spec.json           - Discovered API specs
evidence/<finding_id>/graphql_schema.json         - Extracted GraphQL schema
```

## Naming Convention

All evidence files follow this pattern:
```
evidence/<finding_id>/<type>_<description>_<timestamp>.<ext>
```

| Component | Format | Example |
|-----------|--------|---------|
| `finding_id` | `F-XXX` matching findings_log.md | `F-001` |
| `type` | Evidence type prefix | `http`, `screenshot`, `tool`, `poc`, `config` |
| `description` | Brief snake_case label | `cors_request`, `admin_panel`, `sqlmap_dump` |
| `timestamp` | ISO date or unix timestamp | `2026-02-24`, `1708732800` |
| `ext` | Appropriate file extension | `.txt`, `.png`, `.json`, `.html`, `.py` |

## Directory Convention
```
evidence/
├── F-001/
│   ├── http_request_cors_2026-02-24.txt
│   ├── http_response_cors_2026-02-24.txt
│   ├── poc_cors_exploit.html
│   └── screenshot_data_exfil_2026-02-24.png
├── F-002/
│   ├── http_request_idor_user1_2026-02-24.txt
│   ├── http_response_idor_user1_2026-02-24.txt
│   ├── http_request_idor_user2_2026-02-24.txt
│   ├── http_response_idor_user2_2026-02-24.txt
│   └── screenshot_pii_leak_2026-02-24.png
├── F-003/
│   ├── tool_nmap_10.0.0.1_2026-02-24.txt
│   ├── tool_nuclei_cve-2024-xxxx_2026-02-24.txt
│   └── poc_exploit_rce.py
└── README.md
```

## Per-Vulnerability Evidence Requirements

| Vulnerability Type | Required Evidence | Optional Evidence |
|--------------------|-------------------|-------------------|
| **XSS (Reflected/Stored)** | HTTP request with payload + response showing reflection, screenshot of execution | PoC HTML page, video showing cookie theft |
| **XSS (DOM)** | Screenshot of DOM state, browser console output | Playwright browser_evaluate output |
| **SQLi** | HTTP request with payload + response showing injection, extracted data sample | sqlmap output, database structure dump |
| **SSRF** | HTTP request triggering SSRF + response proving internal access, metadata/internal response | DNS callback proof (if blind), cloud credential extraction |
| **IDOR** | Two HTTP request/response pairs (user A accessing user B's data) | Enumeration script output, count of affected records |
| **CORS** | HTTP request with Origin header + response showing ACAO, working PoC HTML page reading cross-origin data | Screenshot of data exfiltration |
| **Open Redirect** | HTTP request + 30x response with attacker URL | Chain evidence (OAuth token theft) |
| **JWT Manipulation** | Original token decoded, modified token, request with forged token + successful response | jwt_tool output |
| **Race Condition** | Multiple simultaneous requests + responses showing double-action | Timing data, HTTP/2 frame capture |
| **Subdomain Takeover** | DNS resolution showing dangling CNAME, service error page, claim proof page | Impact chain evidence (CORS, CSP, cookie scope) |
| **Source Map Disclosure** | HTTP request for .map file + response (truncated), reconstructed source file listing | Full source tree (save locally only) |
| **Actuator Exposure** | HTTP request + response for each exposed endpoint | Sensitive data extracted (env vars, heap dump) |

## Chain-of-Evidence for Chained Vulnerabilities

When documenting vulnerability chains, maintain linked evidence across findings:

```
evidence/
├── F-001/                          # Subdomain takeover (link 1)
│   ├── http_cname_resolution.txt
│   ├── screenshot_error_page.txt
│   └── screenshot_claim_proof.png
├── F-002/                          # CORS trusts taken-over subdomain (link 2)
│   ├── http_cors_request.txt
│   ├── http_cors_response.txt
│   └── poc_cors_exploit.html
├── CHAIN-001/                      # Combined chain evidence
│   ├── chain_diagram.md            # Text diagram of the full chain
│   ├── poc_full_chain.html         # End-to-end PoC combining both vulns
│   ├── screenshot_data_theft.png   # Final impact demonstration
│   └── chain_evidence_map.md       # Links F-001 + F-002 evidence files
```

The `chain_evidence_map.md` links each step:
```markdown
## Chain: Subdomain Takeover -> CORS Bypass -> Data Theft

### Step 1: Subdomain Takeover (F-001)
- Evidence: evidence/F-001/http_cname_resolution.txt
- Proves: ag.target.com has dangling CNAME, claimable

### Step 2: CORS Bypass (F-002)
- Evidence: evidence/F-002/http_cors_response.txt
- Proves: api.target.com trusts *.target.com origins with credentials

### Step 3: Combined Impact (CHAIN-001)
- Evidence: evidence/CHAIN-001/poc_full_chain.html
- Proves: Hosting JS on claimed ag.target.com reads authenticated API data
```

## Evidence Integrity

### Checksums
For critical findings (HIGH/CRITICAL), generate SHA256 checksums:
```bash
sha256sum evidence/F-001/* > evidence/F-001/checksums.sha256
```

### Timestamps
- All evidence files include timestamps in filenames
- For time-sensitive findings (race conditions, expiring tokens), record exact UTC time
- Note the time between discovery and evidence capture

### Preservation Notes
- Never modify original evidence after capture
- If re-running a PoC (proof-validator), save as new files with updated timestamps
- Keep both original and re-run evidence for comparison
- For findings that may be patched, capture evidence immediately upon discovery

## Integration

Link evidence files to findings in `findings_log.md` and reference them in reports:
```markdown
**Evidence:** `evidence/F-001/` (3 files: request, response, screenshot)
```

The h1-report skill auto-includes evidence references in the Raw Evidence section.

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
