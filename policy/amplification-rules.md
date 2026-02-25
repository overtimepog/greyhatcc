# Signal Amplification Rules

## Matching Criteria

1. **Exact type match**: `signal.type` equals the Signal Type column (case-insensitive, normalized).
2. **Fuzzy description match**: If no exact match, scan `signal.description` for keywords. Requires 2+ keyword hits. Fuzzy matches get 50% boost reduction.
3. **Compound signals**: Two signals on the same target appearing in the same chain template get combined priority boost.

## Confidence Thresholds

| Confidence | Action |
|-----------|--------|
| < 0.2 | Skip — too speculative |
| 0.2 - 0.5 | Amplify with model_tier: haiku |
| 0.5 - 0.9 | Amplify with model_tier: sonnet |
| >= 0.9 | Amplify with model_tier: opus |

## Priority Calculation

```
final_priority = base(50) + boost
effective_priority = min(100, floor(final_priority * confidence + final_priority * 0.3))
```

Fuzzy matches: `boost * 0.5`. Chain matches: `boost_A + boost_B`, capped at 100.

## Amplification Table

| Signal Type | Priority Boost | New Work Item Subtype | Action Summary |
|------------|----------------|----------------------|----------------|
| `source-map-found` | +25 | `test/source-map-analysis` | Fetch .map, reconstruct source, scan for secrets and internal paths |
| `graphql-introspection-enabled` | +20 | `test/graphql-introspection` | Dump schema, test field-level authz, check alias batching bypass |
| `verbose-error-stack-trace` | +20 | `test/error-injection` | Identify tech/version from stack, test error-based injection (SQLi, SSTI, XXE) |
| `open-redirect` | +25 | `exploit/redirect-chain` | Chain with OAuth flows, test scheme bypass, document as gadget |
| `self-xss` | +25 | `exploit/self-xss-chain` | Chain with CSRF for login-based ATO, document provides/requires |
| `debug-endpoint` | +20 | `test/debug-endpoint` | Enumerate debug paths, extract env vars/creds, check interactive consoles |
| `jwt-weak-algorithm` | +30 | `exploit/jwt-forge` | Test alg:none, RS256/HS256 confusion, kid injection |
| `cors-wildcard-or-null` | +20 | `exploit/cors-theft` | Craft credentialed cross-origin PoC, test Origin:null, subdomain CORS |
| `s3-bucket-listing` | +25 | `exploit/s3-abuse` | Enumerate objects, test write access, check ACL/policy |
| `reflected-input` | +15 | `test/xss-test` | Identify reflection context, develop context-appropriate payload, test CSP bypass |
| `rate-limit-absent-auth` | +15 | `test/brute-force` | Test credential stuffing, OTP brute force, reset token entropy |
| `old-software-version` | +20 | `test/cve-exploit` | CVE lookup, find public PoC, verify exploitability, develop custom exploit |
| `ssrf-partial` | +20 | `test/blind-ssrf` | DNS callback confirmation, cloud metadata test, scheme bypass, DNS rebinding |
| `file-upload-accepted` | +20 | `test/file-upload` | Extension bypass, path traversal in filename, SVG XSS, ImageMagick CVEs |
| `websocket-endpoint` | +15 | `test/websocket` | WS auth bypass, CSWSH, message injection, race conditions |
| `api-version-old` | +20 | `test/api-downgrade` | Compare endpoint lists across versions, test missing authz on old versions |
| `exposed-swagger` | +20 | `test/api-test` | Extract full schema, find admin/internal endpoints, test BOLA |
| `spring-actuator` | +20 | `test/actuator-abuse` | Enumerate actuator endpoints, extract env vars, download heapdump, test jolokia RCE |
| `subdomain-wildcard-dns` | +15 | `test/subdomain-takeover` | Test unclaimed services, check cookie scope attacks |
| `cloud-metadata-accessible` | +30 | `exploit/cloud-metadata` | Extract IAM creds, enumerate permissions, escalate, document blast radius |

## Processing Algorithm

```
for each intel_run:
  unactioned_signals = signals where amplification_match is null
  for each signal in unactioned_signals:
    if signal.confidence < 0.2: skip
    rule = find_matching_rule(signal.type)
    if not rule:
      rule = fuzzy_match_rule(signal.description)
      if rule: boost = rule.boost * 0.5
    if rule:
      existing = find_work_item(subtype=rule.new_subtype, target=signal.target, status in [queued, active, done])
      if existing and existing.status == "done" and existing.result.success: skip
      companion_signals = find_companion_signals(signal.target, chain_templates)
      if companion_signals:
        create_chain_investigation_item(signal, companion_signals, combined_boost)
      else:
        priority = calculate_priority(base=50, boost=boost, confidence=signal.confidence)
        create_work_item(type, subtype, target, priority, parent_id, context)
      signal.amplification_match = rule.signal_type
```

## When NOT to Amplify

1. `signal.confidence < 0.2`
2. A done+successful work item already exists for this (subtype, target) pair
3. Target not in `hunt_state.scope.in_scope`
4. Signal type matches `hunt_state.scope.exclusions`
5. `hunt_state.stats.cost_estimate_usd > budget_limit`

## Deduplication

Signals of the same type on the same target within a single intel run produce only one work item. All matching signals are merged into the work item's context.
