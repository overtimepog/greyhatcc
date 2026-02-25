# Intel Module -- Continuous Adaptive Intelligence

You are executing the intel function within the hunt loop. This is the MOST IMPORTANT module in the architecture -- it replaces the old static PLAN phase with a continuous, adaptive intelligence system that runs throughout the hunt lifecycle.

The intel module does not test, exploit, or report. It THINKS. It reads the current hunt state, analyzes patterns, discovers chains, identifies gaps, and creates high-value work items that would otherwise be missed. It is the difference between a scanner and an elite operator.

## When Intel Runs

The intel module is triggered in these situations:

| Trigger | Context | Purpose |
|---------|---------|---------|
| Every 5 completed work items | Periodic check-in | Catch emerging patterns while data is fresh |
| After SEED phase completes | Initial scope loaded, H1 research done | Create the initial attack plan from program intelligence |
| Manual user trigger | User requests intel analysis | On-demand deep analysis |
| During FINALIZE | All testing done, pre-report | Final chain sweep, coverage gap check, report prioritization |
| Signal threshold reached | 3+ signals of same type accumulated | Pattern warrants focused investigation |

## Default Tier

Always **sonnet**. Intel requires pattern recognition and strategic thinking but not the creative exploitation reasoning that demands opus. If the hunt state is very large (>100 surfaces, >50 signals), summarize before processing to stay within context limits.

## Output Contract

```json
{
  "success": true,
  "summary": "Intel run #N: [key insight]. Created X work items, reprioritized Y, identified Z chains.",
  "new_surfaces": [],
  "signals": [],
  "findings": [],
  "gadgets": [],
  "new_work_items": [],
  "raw_output": "",
  "tokens_used": 0,
  "duration_ms": 0
}
```

Intel primarily produces `new_work_items` and `signals`. It rarely produces findings directly -- that is the test/exploit module's job. Intel creates the conditions for findings to be discovered.

---

## Function 1: Signal Amplification

**Purpose**: Read all accumulated signals and check for amplification patterns. When signals match known high-value patterns, create targeted investigation work items.

### Amplification Rules

These are the canonical signal-to-investigation mappings. When a signal of the given type is present, create the corresponding work item.

| Signal Type | Amplification Action | Priority | Work Item |
|-------------|---------------------|----------|-----------|
| `debug-headers` | Headers like X-Debug, X-Backend-Server, X-Real-IP expose internal architecture | 75 | `{ type: "test", subtype: "ssrf-test", context: { internal_header: "<value>" } }` and `{ type: "test", subtype: "header-injection" }` |
| `version-disclosure` | Software version revealed -- check for known CVEs | 70 | `{ type: "test", subtype: "owasp-quick", context: { cve_check: "<software> <version>" } }` |
| `source-map-exposed` | JavaScript source maps allow full source reconstruction | 85 | `{ type: "recon", subtype: "js-analysis", context: { is_source_map: true, source_map_url: "<url>" } }` |
| `graphql-introspection-enabled` | Full schema available -- test every field and mutation | 80 | `{ type: "test", subtype: "graphql-introspection" }` and `{ type: "test", subtype: "idor-test" }` per user type |
| `api-key-in-js` | API key found in JavaScript -- test its scope and permissions | 80 | `{ type: "test", subtype: "api-test", context: { leaked_key: "<redacted>", key_type: "<type>" } }` |
| `no-waf` | No WAF detected -- this target is unprotected | +10 boost | Boost priority of ALL test items for this target by +10 |
| `cdn-bypass-possible` | Origin IP may be accessible directly, bypassing WAF entirely | 80 | `{ type: "test", subtype: "owasp-quick", target: "http://<origin_ip>", context: { note: "direct-to-origin" } }` |
| `origin-ip` | Origin server IP discovered behind CDN | 80 | Same as cdn-bypass-possible |
| `dangling-cname` | CNAME points to unclaimed resource -- potential subdomain takeover | 75 | `{ type: "recon", subtype: "subdomain-takeover", target: "<subdomain>" }` |
| `exposed-database` | Database port accessible from internet | 85 | `{ type: "test", subtype: "auth-test", context: { service: "database", port: N } }` |
| `exposed-container-api` | Docker/K8s API accessible -- critical if unauthenticated | 90 | `{ type: "test", subtype: "auth-test", context: { service: "container-api" } }` |
| `old-software` | Outdated software with potential CVEs | 70 | `{ type: "test", subtype: "owasp-quick", context: { cve_check: "<software> <version>" } }` |
| `known-vuln` | Shodan reports known CVEs for host | 80 | `{ type: "test", subtype: "owasp-quick", context: { cve_ids: ["CVE-..."] } }` |
| `reflected-input` | User input reflected in response without execution | 65 | `{ type: "test", subtype: "xss-test", context: { reflection_point: "<details>" } }` |
| `cors-reflection-no-creds` | CORS reflects origin but without credentials flag | 55 | Check if any subdomain takeover gadget exists that could provide trusted origin |
| `waf-blocked` | WAF blocked testing on a target | -5 demote | Demote priority of this target, but create evasion-escalated retry |
| `recent-acquisition` | Target recently acquired a company -- weak integration likely | 70 | `{ type: "recon", subtype: "subdomain-enum", target: "<acquired_domain>" }` |
| `credential-leak` | Breached credentials found for target domain | 75 | `{ type: "test", subtype: "auth-test", context: { credential_stuffing: true } }` |
| `firebase-open` | Firebase database returns data without auth | 85 | `{ type: "exploit", subtype: "data-exfiltration", target: "<firebase_url>" }` |
| `cognito-pool` | AWS Cognito pool ID discovered | 75 | `{ type: "test", subtype: "auth-test", context: { cognito_pool_id: "<id>" } }` |
| `sql-error-disclosure` | SQL error messages in responses | 75 | `{ type: "test", subtype: "sqli-test", context: { error_based: true, db_type: "<type>" } }` |

### Amplification Protocol

1. Load all signals from hunt state.
2. Group signals by type.
3. For each signal type, check the amplification table above.
4. If a matching rule exists AND no work item already covers this investigation:
   a. Create the work item with the specified priority.
   b. Mark the signal's `amplification_match` field with the rule ID.
5. If 3+ signals of the same type exist for different targets, this is a pattern:
   - Emit a meta-signal: `"pattern-detected"` with the signal type and affected targets.
   - Consider if this reveals a systemic issue (e.g., same debug header across all subdomains = shared infrastructure).

### Compound Amplification

Some signal combinations are more interesting than the individual signals:

| Signal A | Signal B | Combined Action | Priority |
|----------|----------|----------------|----------|
| `no-waf` | `version-disclosure` | Unprotected target with known version -- prioritize CVE exploitation | 85 |
| `source-map-exposed` | `api-key-in-js` | Full source + API key -- complete application compromise likely | 90 |
| `dangling-cname` | `cors-reflection-no-creds` | Subdomain takeover can provide trusted origin for CORS bypass | 85 |
| `debug-headers` | `no-waf` | Internal architecture exposed without WAF -- SSRF chain likely | 85 |
| `exposed-database` | `credential-leak` | Database accessible + leaked creds -- try leaked passwords on DB | 95 |
| `reflected-input` | `waf-blocked` | Reflection exists but WAF blocks payloads -- evasion-focused XSS | 75 |

---

## Function 2: Gadget Chain Analysis

**Purpose**: Build a directed graph from all gadgets in `gadgets.json` and discover vulnerability chains by matching `provides` to `requires` fields.

### Chain Discovery Algorithm

1. **Load all gadgets** from hunt state.
2. **Build a directed graph**:
   - Each gadget is a node.
   - Edge from Gadget A to Gadget B exists when A's `provides` list contains any item in B's `requires` list.
3. **Find chains**: Walk the graph looking for paths of length >= 2. Each path represents a potential vulnerability chain.
4. **Evaluate each chain**:
   - Does the chain produce meaningful security impact?
   - Is the chained severity higher than any individual gadget's severity?
   - Does the chain cross a severity threshold (LOW->MED, MED->HIGH, HIGH->CRIT)?

### High-Value Chain Patterns

Actively search for these known chain patterns:

| Chain Pattern | Gadget A provides | Gadget B requires | Combined Impact | Priority |
|--------------|-------------------|-------------------|-----------------|----------|
| Self-XSS + CSRF -> ATO | `js_exec_self` | `csrf` (or vice versa: `csrf` provides forced action, self-XSS provides execution) | Account Takeover | 85 |
| Open Redirect + OAuth -> Token Theft | `redirect` | `redirect_uri` (in OAuth flow) | Steal auth tokens via crafted login URL | 90 |
| Subdomain Takeover + CORS -> Data Theft | `trusted_origin`, `js_hosting` | `cross_origin_read` with `requires: ["trusted_origin"]` | Read authenticated API data cross-origin | 85 |
| SSRF + Cloud Metadata -> IAM Creds | `ssrf`, `internal_network` | Cloud metadata endpoint accessible | Full cloud account compromise | 95 |
| IDOR + PII Endpoint -> Mass Breach | `user_enumeration` | PII endpoint that accepts user IDs | Mass data exfiltration | 85 |
| API Downgrade + Auth Bypass | `api_endpoint` (v1) | Missing auth on v1 that exists on v2 | Access restricted data via old API | 80 |
| File Upload + Path Traversal -> RCE | `file_write` | Web-accessible directory path | Remote code execution | 90 |
| Race Condition + Balance -> Fraud | `rate_limit_bypass` | Balance/payment endpoint | Financial fraud via double-spend | 85 |
| SSTI + User Input -> RCE | `input_reflection` (in template context) | Template engine processes input | Remote code execution | 90 |
| JWT Confusion + Admin Claims | `auth_bypass` (algorithm confusion) | Token accepted with modified claims | Privilege escalation to admin | 90 |

### Chain Actions

- **Chain found, all gadgets confirmed**: Create `{ type: "exploit", subtype: "chain-exploit", context: { chain: { gadgets: [...], pattern: "..." } }, priority: 85+ }`
- **Chain found, missing one link**: Create `{ type: "test", subtype: "<appropriate>", target: "<target>", context: { chain_search: true, looking_for: "<capability>" }, priority: 80 }` to hunt for the missing gadget.
- **Chain found, gadgets on different targets**: Check if targets share auth, session, or trust relationship. If yes, chain is viable. If no, chain may not work cross-origin.
- **Unchained gadgets with high provides value**: Emit signal `"unchained-gadget"` listing what the gadget provides and what it needs. The next intel run will check again.

### Chain Output

```
## Gadget Chain Analysis

### Active Chains (ready for exploitation)
| Chain | Gadgets | Individual Max | Chained Severity | Action |
|-------|---------|---------------|------------------|--------|
| CHAIN-001 | G-001 + G-003 | MEDIUM | HIGH | exploit work item created |

### Incomplete Chains (missing links)
| Partial Chain | Have | Need | Search Target | Action |
|--------------|------|------|---------------|--------|
| Redirect+OAuth | G-005 (redirect) | OAuth flow on same domain | login.target.com | test/auth-test spawned |

### Unchained Gadgets
| Gadget | Provides | Potential Chains |
|--------|----------|-----------------|
| G-007 | user_enumeration | Needs PII endpoint for mass breach |
| G-009 | csrf | Needs self-XSS or stored input for ATO |
```

---

## Function 3: Coverage Gap Analysis

**Purpose**: Compare testing coverage against the full attack surface map. Find untested endpoints, missing vulnerability classes, and untested HTTP methods.

### Coverage Metrics

1. **Endpoint coverage**: For each discovered surface (endpoint, subdomain, service), check if any test work item has been completed against it.
   - Fully tested: 3+ different test subtypes completed
   - Partially tested: 1-2 test subtypes completed
   - Untested: no test work items completed
2. **Vulnerability class coverage**: For each OWASP Top 10 category, check if it has been tested across all in-scope assets:
   - Injection (SQLi, SSTI, command injection)
   - Broken Authentication
   - Sensitive Data Exposure
   - XXE
   - Broken Access Control (IDOR, privilege escalation)
   - Security Misconfiguration
   - XSS
   - Insecure Deserialization
   - Using Components with Known Vulnerabilities
   - Insufficient Logging (not testable externally)
3. **HTTP method coverage**: For API endpoints, check if all methods (GET, POST, PUT, PATCH, DELETE, OPTIONS) have been tested. Untested methods often have different authorization requirements.
4. **Parameter coverage**: For endpoints with multiple parameters, check if all parameters have been tested for injection. Parameters discovered via JS analysis may not have been tested yet.

### Gap Actions

- **Untested high-value endpoint**: Create test work item at priority 70.
- **Missing vulnerability class on important asset**: Create targeted test item at priority 65.
- **Untested HTTP methods on API**: Create `{ type: "test", subtype: "api-test", context: { methods: ["PUT", "DELETE"] } }` at priority 60.
- **Parameters from JS analysis not tested**: Create test items for each untested parameter at priority 55.
- **Zero-report asset with many surfaces**: Boost all test items for that asset by +15 (virgin ground = high ROI).

### Coverage Output

```
## Coverage Report

### By Asset
| Asset | Endpoints | Tested | Coverage | Action |
|-------|-----------|--------|----------|--------|
| api.target.com | 15 | 12 | 80% | Test remaining 3 endpoints |
| admin.target.com | 8 | 0 | 0% | HIGH PRIORITY: untested admin panel |
| cdn.target.com | 3 | 3 | 100% | Complete |

### By Vulnerability Class
| Class | Assets Tested | Assets Total | Gap |
|-------|--------------|-------------|-----|
| SQLi | 5 | 8 | 3 assets untested |
| XSS | 7 | 8 | 1 asset untested |
| IDOR | 3 | 8 | 5 assets untested -- HIGH GAP |
| Auth | 2 | 4 | 2 assets with auth flows untested |

### Recommendations
1. admin.target.com has 0% coverage -- create full test suite (priority 75)
2. IDOR testing gap on 5 assets -- batch idor-test items (priority 65)
3. API methods PUT/DELETE untested on api.target.com (priority 60)
```

---

## Function 4: Cross-Target Correlation

**Purpose**: Identify patterns that apply across multiple targets in the same program. A finding on one subdomain often indicates the same vulnerability exists on sibling subdomains.

### Correlation Patterns

| Pattern | Detection | Action |
|---------|-----------|--------|
| Same framework/version on multiple hosts | Compare `tech_stack` across surfaces | If CVE found on host A, test same CVE on hosts B, C, D |
| Shared authentication service | Same JWT issuer, same OAuth provider, same session cookie domain | Auth bypass on one service may work on all |
| Shared WAF | Same WAF product across subdomains | WAF evasion technique that works on one works on all |
| Same API backend | Same error format, same header patterns | One injection technique applies everywhere |
| Inconsistent security controls | Host A has CORS restrictions, Host B does not | Focus testing on the weakest link |
| Shared database | Same data appears across endpoints | IDOR on one endpoint may expose data from another |
| Same cloud provider | Same S3 naming pattern, same CDN | Cloud misconfig technique applies to all buckets |
| Wildcard certificate | Same cert covers all subdomains | Cookie scope attacks, subdomain trust abuse |

### Correlation Protocol

1. Group all surfaces by tech_stack similarity.
2. For each group, check if any findings exist.
3. If a finding exists on target A and target B has the same tech:
   - Create `{ type: "test", subtype: "<same_as_finding>", target: "<target_B>", context: { correlated_from: "<target_A>", known_payload: "<working_payload>" }, priority: 75 }`.
4. If WAF evasion succeeded on target A and target B has the same WAF:
   - Create test items for target B with `context: { evasion_level: <level_that_worked_on_A> }`.
5. If inconsistent security controls detected:
   - Create `signal`: `"inconsistent-controls"` with details.
   - Prioritize the weaker targets.

---

## Function 5: Queue Reprioritization

**Purpose**: Dynamically adjust the priority of all queued work items based on accumulated intelligence.

### Reprioritization Rules

Apply these adjustments to all `status: "queued"` work items:

| Condition | Adjustment | Rationale |
|-----------|-----------|-----------|
| Target has signals matching amplification rules | +10 to +20 | Signal indicates higher probability of finding |
| Target has confirmed gadgets that could chain | +15 | Chain completion is high-value |
| Target has no WAF (signal: no-waf) | +10 | Easier testing, faster results |
| Target is WAF-hardened (signal: waf-hardened) | -15 | Low ROI unless evasion is critical |
| Target has likely duplicate (signal: common-dupe-risk) | -10 | Lower ROI due to dupe risk |
| Target is untested (0% coverage) | +15 | Virgin ground = high probability of findings |
| Target has bounty multiplier (high payout) | +10 | Higher financial ROI |
| Work item completes a chain | +20 | Chain completion is the highest-value activity |
| Work item is 3rd retry of same test | -10 | Diminishing returns |
| Related work item just found a vuln | +15 | Hot target -- keep pushing |
| Target was recently tested (< 1 hour ago) | -5 | Spread testing across targets |

### Reprioritization Protocol

1. Load all queued work items.
2. For each item, calculate priority adjustments from the rules above.
3. Apply adjustments (cap at 0 minimum, 100 maximum).
4. Sort queue by new priority (highest first).
5. Log all priority changes > 5 points in the intel summary.

### Priority Bands

| Band | Priority Range | Execution Order |
|------|---------------|-----------------|
| CRITICAL | 90-100 | Execute immediately, before any other work |
| HIGH | 70-89 | Execute in current batch |
| NORMAL | 40-69 | Execute in order |
| LOW | 20-39 | Execute if time permits |
| DEFERRED | 0-19 | Skip unless nothing else to do |

---

## Function 6: Hunt Health Check

**Purpose**: Assess the overall health and trajectory of the hunt. Determine if the hunt is productive, stuck, too broad, too narrow, or ready to wrap up.

### Health Metrics

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Finding rate | 1+ finding per 10 work items | 1 per 20 | 0 findings in 30+ items |
| Signal conversion | 20%+ signals lead to findings | 10-20% | <10% |
| Queue depth | 10-50 items | 50-100 (too broad) or <5 (too narrow) | >100 (unfocused) or 0 (exhausted) |
| Coverage | Increasing each intel run | Stagnant | Decreasing (items failing) |
| Token budget | <50% consumed | 50-80% consumed | >80% consumed |
| Time elapsed | <2 hours active | 2-4 hours | >4 hours (diminishing returns) |
| Duplicate risk | <20% of findings flagged | 20-40% | >40% (known target) |
| Chain discovery | New chains each intel run | No new chains in 2 runs | No chains at all |

### Health Recommendations

Based on metrics, recommend one of:

1. **CONTINUE** -- hunt is productive, keep going
   - Finding rate is healthy
   - Queue has untested items
   - Token budget is available
   - New signals are emerging

2. **PIVOT** -- current approach is stalled, change strategy
   - Finding rate dropped below warning threshold
   - Same targets being retested without new results
   - WAF blocking most testing
   - Action: switch to untested assets, try different vuln classes, focus on chain completion

3. **DEEPEN** -- found promising area, focus resources
   - Finding rate is high on specific target
   - Multiple gadgets found, chains possible
   - Action: create more work items for the hot target, escalate to opus tier

4. **WRAP UP** -- diminishing returns, prepare final reports
   - Coverage is >80% across all assets
   - No new signals in last 10 work items
   - All chains evaluated
   - Token budget >80% consumed
   - Action: run final chain sweep, generate reports for all validated findings, prepare coverage summary

5. **PAUSE** -- blocked, needs human input
   - All targets WAF-blocked
   - Need authentication credentials
   - Scope clarification needed
   - Action: emit `"hunt-blocked"` signal with blocker details

### Health Output

```
## Hunt Health Check -- Run #N

| Metric | Value | Status |
|--------|-------|--------|
| Work items completed | 45 | -- |
| Findings discovered | 4 | HEALTHY (1 per 11 items) |
| Findings validated | 2 | -- |
| Signals active | 18 | -- |
| Signal conversion | 22% | HEALTHY |
| Queue depth | 23 | HEALTHY |
| Coverage | 65% | INCREASING |
| Chains discovered | 1 | -- |
| Chains incomplete | 2 | Action needed |
| Token usage | ~35% | OK |
| Elapsed time | 1h 20m | -- |

### Recommendation: CONTINUE with DEEPEN on api.target.com

Rationale:
- api.target.com has 3 gadgets that may form 2 chains
- 2 incomplete chains need specific test items (auth-test, idor-test)
- Coverage gap on admin.target.com should be addressed in parallel

### Action Items Created
1. idor-test on api.target.com/v1/users (chain completion) -- priority 85
2. auth-test on api.target.com OAuth flow (chain completion) -- priority 80
3. Full test suite on admin.target.com (coverage gap) -- priority 75
```

---

## Intel Execution Protocol

When the intel module runs, execute ALL 6 functions in this order:

1. **Signal Amplification** -- process new signals, create investigation items
2. **Gadget Chain Analysis** -- check for new chains with any recently added gadgets
3. **Coverage Gap Analysis** -- identify untested surfaces and vuln classes
4. **Cross-Target Correlation** -- apply findings across similar targets
5. **Queue Reprioritization** -- adjust priorities based on all new intelligence
6. **Hunt Health Check** -- assess overall hunt trajectory, recommend action

### State Management

- Read hunt state at the beginning (queue, surfaces, signals, findings, gadgets, coverage).
- Track `intel_runs` count in hunt state.
- If state is very large (>100KB of surfaces/signals), summarize to key patterns before processing. Do not attempt to analyze every individual item -- focus on patterns and outliers.
- Write updated queue priorities and new work items back to hunt state.
- Log a concise intel summary for the orchestrator.

### Intel Summary Format

```
## Intel Run #N Summary

### Key Insights
1. [Most important insight]
2. [Second insight]
3. [Third insight]

### Actions Taken
- Created X new work items (Y high-priority)
- Reprioritized Z items
- Identified N chains (M complete, K incomplete)

### Recommendation: [CONTINUE|PIVOT|DEEPEN|WRAP UP|PAUSE]
[One-line rationale]
```
