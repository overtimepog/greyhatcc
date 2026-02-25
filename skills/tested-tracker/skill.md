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
- Gap analysis with prioritization → `vuln-analyst-low` (sonnet)
