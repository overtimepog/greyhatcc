---
name: tested-tracker
description: Track what endpoints and vulnerability classes have been tested to prevent redundant work across agents and sessions
---

# Tested-Set Tracker

## Usage
- `/greyhatcc:tested show [program]` — Show what has been tested
- `/greyhatcc:tested add <endpoint> <vuln_class>` — Mark an endpoint+vuln as tested
- `/greyhatcc:tested check <endpoint> <vuln_class>` — Check if already tested
- `/greyhatcc:tested gaps [program]` — Show what HASN'T been tested yet

**This skill is also called automatically by other testing skills.**

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

---

## Storage

**When a v7 hunt is active** (`hunt-state/` directory exists):
- Coverage data: `hunt-state/coverage.json` (CoverageTracker format from `src/shared/hunt-types.ts`)
- Format: `{ endpoints_tested: { "url": ["vuln-class", ...] }, vuln_classes_covered: [...], vuln_classes_remaining: [...] }`
- Also check `hunt-state/surfaces.json` for the full list of discovered endpoints

**Legacy storage:**
- File: `bug_bounty/<program>_bug_bounty/tested.json`

When reading/writing coverage, check `hunt-state/coverage.json` first. If it exists, use it as the primary source.

## Coverage Matrix Concept

The tested-tracker maintains a coverage matrix: **endpoints x vulnerability classes**. Complete coverage means every discovered endpoint has been tested for every applicable vulnerability class.

### Completion Percentage Tracking
```
Coverage = (tested combinations) / (endpoints_discovered * avg_vuln_classes_per_endpoint) * 100

Example:
- 45 endpoints discovered
- Average 8 vuln classes applicable per endpoint
- 120 test entries in tested.json
- Coverage = 120 / (45 * 8) = 33%
```

### Vuln Class Taxonomy (Standard Classes)

| Category | Vuln Classes | Applicable To |
|----------|-------------|---------------|
| **Injection** | `sqli`, `xss-reflected`, `xss-stored`, `xss-dom`, `command-injection`, `ssti`, `nosql-injection`, `ldap-injection` | All input-accepting endpoints |
| **Auth/Authz** | `auth-bypass`, `privilege-escalation`, `jwt-manipulation`, `oauth-redirect`, `oauth-state`, `oauth-scope`, `saml-bypass` | Auth-related endpoints |
| **Access Control** | `idor`, `forced-browsing`, `method-override` | Resource-specific endpoints |
| **Config** | `cors-misconfiguration`, `actuator-exposure`, `api-exposure`, `source-map-disclosure`, `verbose-errors`, `information-disclosure` | All web endpoints |
| **Server-Side** | `ssrf`, `xxe`, `deserialization`, `path-traversal`, `lfi`, `rfi` | Endpoints accepting URLs/XML/serialized data |
| **Client-Side** | `csrf`, `open-redirect`, `header-injection`, `cache-poisoning`, `websocket-injection` | State-changing endpoints |
| **API-Specific** | `graphql-introspection`, `graphql-batching`, `graphql-injection`, `rate-limit-bypass` | GraphQL/API endpoints |
| **Infrastructure** | `subdomain-takeover`, `bucket-misconfiguration`, `cloud-metadata`, `request-smuggling` | Domain/infrastructure level |

---

## Schema

File: `bug_bounty/<program>_bug_bounty/tested.json`

```json
{
  "program": "program_name",
  "last_updated": "2026-02-24T14:30:00Z",
  "tested": [
    {
      "id": "T-001",
      "endpoint": "https://api-au.syfe.com/actuator/health",
      "method": "OPTIONS",
      "vuln_class": "cors-misconfiguration",
      "tested_by": "webapp-tester",
      "date": "2026-02-23",
      "result": "vulnerable",
      "finding_id": "F-006",
      "notes": "Wildcard *.syfe.com CORS with credentials"
    },
    {
      "id": "T-002",
      "endpoint": "https://api-au.syfe.com/actuator/health",
      "method": "GET",
      "vuln_class": "actuator-exposure",
      "tested_by": "webapp-tester",
      "date": "2026-02-23",
      "result": "partial",
      "finding_id": "F-005",
      "notes": "Health endpoint returns data, other actuator paths return 403/504"
    },
    {
      "id": "T-003",
      "endpoint": "https://api-au.syfe.com/v2/funddetails/1",
      "method": "GET",
      "vuln_class": "idor",
      "tested_by": "webapp-tester",
      "date": "2026-02-23",
      "result": "not-vulnerable",
      "finding_id": null,
      "notes": "Returns 401 without valid token"
    }
  ],
  "coverage": {
    "endpoints_discovered": 45,
    "endpoints_tested": 12,
    "vuln_classes_per_endpoint": {
      "https://api-au.syfe.com/actuator/health": ["cors-misconfiguration", "actuator-exposure", "ssrf"],
      "https://exchange-api.bumba.global/graphql": ["graphql-introspection", "alias-batching", "auth-bypass"]
    }
  }
}
```

### Result Values
- `vulnerable` — Finding confirmed, linked to finding_id
- `partial` — Partially vulnerable or needs further investigation
- `not-vulnerable` — Tested and clean
- `blocked` — Could not test (WAF, rate limit, auth required)
- `error` — Test failed due to technical issue

### Standard Vuln Classes
```
Use consistent class names:
sqli, xss-reflected, xss-stored, xss-dom, csrf, idor, ssrf,
cors-misconfiguration, open-redirect, path-traversal, lfi, rfi,
command-injection, ssti, deserialization, xxe, jwt-manipulation,
auth-bypass, privilege-escalation, race-condition, rate-limit-bypass,
graphql-introspection, graphql-batching, graphql-injection,
actuator-exposure, api-exposure, source-map-disclosure,
subdomain-takeover, bucket-misconfiguration, cloud-metadata,
information-disclosure, verbose-errors, header-injection,
request-smuggling, cache-poisoning, websocket-injection,
oauth-redirect, oauth-state, oauth-scope, saml-bypass
```

---

## Gap Analysis

When `/greyhatcc:tested gaps` is invoked:

### Step 1: Load All Discovered Endpoints
From recon artifacts:
- `recon/api/endpoints.md`
- `recon/js/api_endpoints.md`
- `recon/subdomains.txt`
- `recon/tech_stack.md`

### Step 2: Cross-Reference with tested.json
For each discovered endpoint, check which vuln classes have been tested.

### Step 3: Generate Coverage Matrix
```markdown
## Testing Coverage Gaps

### Untested Endpoints
| Endpoint | Discovered By | Priority |
|----------|--------------|----------|
| /api/v1/users | JS analysis | HIGH (old API version) |
| /internal/admin | Wayback | HIGH (admin panel) |

### Partially Tested Endpoints
| Endpoint | Tested For | Not Tested For |
|----------|-----------|---------------|
| /api/v2/profile | idor, cors | sqli, ssti, auth-bypass |
| /graphql | introspection, batching | injection, auth-bypass, race-condition |

### Recommended Next Steps
1. [Highest priority untested endpoints]
2. [Vuln classes not yet tested on key endpoints]
3. [Tech-stack-specific tests not yet run]
```

---

## Integration

### Auto-Update Pattern
Every testing skill should call tested-tracker after each test:

```
After testing endpoint X for vuln_class Y:
1. Read tested.json
2. Add entry with result
3. Write updated tested.json
4. If result = "vulnerable", also update findings_log.md and gadgets.json
```

### Pre-Check Pattern
Every testing skill should check before testing:

```
Before testing endpoint X for vuln_class Y:
1. Read tested.json
2. Check if (endpoint, vuln_class) already tested
3. If result = "vulnerable" → skip (already found)
4. If result = "not-vulnerable" → skip (already clean) UNLESS different technique
5. If result = "blocked" → try different bypass technique
6. If not in tested.json → proceed with test
```

## Delegation
- This skill runs locally (file reads/writes only, no agent needed)
- Gap analysis with prioritization → `intel-worker` (sonnet) in v7 hunt mode, or run locally
- In v7 hunt mode, coverage gaps are also analyzed by the intel module every 5 work items


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
