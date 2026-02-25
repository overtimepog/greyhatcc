---
name: gadget-inventory
description: Build and maintain a vulnerability gadget inventory for chaining — catalog every finding with its chaining potential and map bug-to-bug relationships
---

# Gadget Inventory & Chain Builder

## Usage
- `/greyhatcc:gadgets show [program]` — Display current gadget inventory
- `/greyhatcc:gadgets add <finding_description>` — Add a gadget to inventory
- `/greyhatcc:gadgets chain` — Analyze all gadgets for chaining opportunities
- `/greyhatcc:gadgets check <new_finding>` — Check if a new finding chains with existing gadgets

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

Also load:
1. Load findings_log.md — all current findings
2. Load gadgets.json — existing gadget inventory
3. Load reports/*.md — see what's already been chained and reported

---

## What Is a Gadget?

A gadget is ANY finding — even informational — that could serve as input, precondition, or amplifier for another vulnerability. The core philosophy: **"Does bug A produce input for bug B?"**

Low-severity gadgets that seem worthless alone become HIGH/CRITICAL when chained:
- Open redirect (LOW) + OAuth flow = token theft (CRITICAL)
- Self-XSS (excluded) + CSRF = forced XSS → ATO (HIGH)
- Subdomain takeover (MED) + wildcard CORS = authenticated data theft (HIGH)
- SSRF (MED) + cloud metadata = IAM credentials → full cloud compromise (CRITICAL)
- Info disclosure (INFO) + credential stuffing = account takeover (HIGH)

---

## Gadget Schema

File: `bug_bounty/<program>_bug_bounty/gadgets.json`

```json
{
  "program": "program_name",
  "last_updated": "2026-02-24",
  "gadgets": [
    {
      "id": "G-001",
      "finding_id": "F-001",
      "title": "Dangling CNAME on ag.syfe.com",
      "type": "subdomain-takeover",
      "asset": "ag.syfe.com",
      "severity_alone": "MEDIUM",
      "description": "Cloudflare Error 1016 — origin deprovisioned, CNAME still proxied",
      "provides": ["trusted_origin", "js_hosting", "cookie_scope"],
      "requires": [],
      "chains_with": ["G-002"],
      "chain_impact": "Provides trusted *.syfe.com origin for CORS bypass → authenticated API access",
      "status": "confirmed",
      "evidence": "evidence/F-001/"
    },
    {
      "id": "G-002",
      "finding_id": "F-006",
      "title": "Wildcard CORS on api-au.syfe.com",
      "type": "cors-misconfiguration",
      "asset": "api-au.syfe.com",
      "severity_alone": "MEDIUM",
      "description": "Reflects any *.syfe.com origin with credentials:true",
      "provides": ["cross_origin_read", "cross_origin_write", "credential_relay"],
      "requires": ["trusted_origin"],
      "chains_with": ["G-001"],
      "chain_impact": "With G-001: full authenticated financial data theft + account modification (HIGH, CVSS 8.7)",
      "status": "confirmed",
      "evidence": "evidence/F-006/"
    }
  ],
  "chains": [
    {
      "id": "CHAIN-001",
      "name": "Subdomain Takeover → CORS Bypass → Financial Data Theft",
      "gadgets": ["G-001", "G-002"],
      "severity_chained": "HIGH",
      "cvss_chained": 8.7,
      "description": "Claim dangling ag.syfe.com → host JS → CORS reads authenticated API → exfil financial data + modify bank accounts",
      "report": "reports/006_cors_subdomain_bypass.md",
      "status": "reported"
    }
  ]
}
```

### Gadget Fields Explained

| Field | Purpose |
|-------|---------|
| `provides` | What this gadget gives to the chain — capabilities it unlocks |
| `requires` | What this gadget needs from another gadget — its prerequisites |
| `chains_with` | Direct references to gadgets it connects with |
| `chain_impact` | What the combined chain achieves (the "so what") |
| `severity_alone` | Severity if reported standalone |
| `status` | `discovered` → `confirmed` → `chained` → `reported` |

### Standard `provides` / `requires` Vocabulary

Use these consistent tags for automated chain matching:

```
Capabilities (provides/requires):
- trusted_origin        → Can serve content from a trusted domain
- js_hosting            → Can host and execute JavaScript on trusted origin
- cookie_scope          → Can read/set cookies on the target's domain
- cross_origin_read     → Can read responses cross-origin with credentials
- cross_origin_write    → Can write/mutate cross-origin with credentials
- credential_relay      → Can relay auth tokens/OTPs cross-origin
- ssrf                  → Can make server-side requests to arbitrary URLs
- cloud_credentials     → Has cloud IAM/API credentials
- admin_access          → Has administrative access
- user_pii              → Has access to user personal data
- auth_bypass           → Can bypass authentication
- session_token         → Has a valid session token for another user
- code_execution        → Can execute code on the server
- file_read             → Can read arbitrary files on the server
- file_write            → Can write files to the server
- redirect              → Can redirect users to arbitrary URLs
- internal_network      → Can access internal network resources
- api_endpoint          → Discovered undocumented API endpoint
- api_key               → Has a valid API key or secret
- user_enumeration      → Can enumerate valid usernames/emails
- debug_info            → Has debug/error information disclosing internals
```

---

## Chain Analysis Algorithm

When `/greyhatcc:gadgets chain` is invoked:

### Step 1: Build the Graph
For each gadget, map `provides` → `requires` relationships. A chain exists when gadget A's `provides` satisfies gadget B's `requires`.

### Step 2: Check Known High-Value Chains
Test against these classic patterns:

| Chain Pattern | Gadgets Needed | Result |
|--------------|----------------|--------|
| Open Redirect + OAuth | `redirect` + OAuth flow on target | Token theft → ATO |
| Self-XSS + CSRF | XSS (even self) + CSRF on same form | Forced XSS → session hijack |
| Subdomain Takeover + CORS | `trusted_origin` + permissive CORS | Authenticated data theft |
| SSRF + Cloud Metadata | `ssrf` + cloud deployment | IAM credentials → cloud takeover |
| IDOR + PII Endpoint | Sequential IDs + PII response | Mass data breach |
| API Downgrade + Auth Bypass | Old API version + missing auth | Unauthenticated access to v2+ data |
| Info Disclosure + Credential Stuffing | Leaked emails/usernames + password resets | Account takeover |
| JWT Confusion + Admin Claims | Algorithm confusion + role claim modification | Privilege escalation |
| File Upload + Path Traversal | Write capability + traversal | Remote code execution |
| SSTI + Any Input | Template injection + user-controlled input | Remote code execution |

### Step 3: Score the Chains
For each discovered chain:
1. Calculate combined CVSS (use the HIGHEST impact values from each gadget)
2. Compare to standalone severities — chains should be strictly higher
3. Prioritize chains that cross the severity threshold (LOW→MED, MED→HIGH, HIGH→CRIT)

### Step 4: Output
```
## Chain Analysis Results

### New Chains Discovered
| Chain | Gadgets | Standalone Max | Chained Severity | Delta |
|-------|---------|---------------|------------------|-------|
| CHAIN-002 | G-003 + G-005 | MEDIUM | HIGH | +1 tier |

### Unchained Gadgets (Potential)
| Gadget | Provides | Waiting For |
|--------|----------|-------------|
| G-004 | redirect | OAuth flow target |
| G-007 | user_enumeration | Valid credential source |

### Recommendations
1. [Finding X + Finding Y should be combined into one report]
2. [Finding Z needs a prerequisite — test for Y to complete the chain]
3. [Finding W is informational alone but becomes medium if we find X]
```

---

## When to Update the Inventory

| Event | Action |
|-------|--------|
| New finding discovered | Add gadget with `provides`/`requires` tags |
| New finding chains with existing | Update both gadgets' `chains_with`, create chain entry |
| Report submitted | Update gadget/chain status to `reported` |
| Finding invalidated | Update gadget status to `invalid`, remove from active chains |
| New recon data | Check if new assets create new chain opportunities |

## Integration

This skill is referenced by:
- **findings-log** — when adding a finding, also add a gadget entry
- **h1-report** — pulls chain table from gadgets.json
- **hunt** — runs chain analysis after each testing phase
- **webapp-testing** / **api-testing** — check gadgets for chaining context before testing

## Delegation
- Chain analysis → run locally (just JSON parsing + logic)
- Complex chain assessment → `vuln-analyst` (opus) for novel chain identification


## Agent Dispatch Protocol
When delegating to agents via Task(), ALWAYS:
1. **Prepend worker preamble**: "[WORKER] Execute directly. No sub-agents. Output ≤500 words. Save findings to disk. 3 failures = stop and report."
2. **Set max_turns**: haiku=10, sonnet=25, opus=40
3. **Pass full context**: scope, exclusions, existing findings, recon data
4. **Route by complexity**: Quick checks → haiku agents (-low). Standard work → sonnet agents. Deep analysis/exploitation → opus agents.

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
