---
name: hunt
description: "Event-driven priority-queue hunt loop for autonomous bug bounty hunting. Iterative, adaptive, signal-driven. From zero to validated H1 reports with continuous intelligence feedback, gadget chaining, and coverage tracking. The hunter doesn't sleep."
---

# HUNT MODE — Event-Driven Hunt Loop

[HUNT ACTIVATED - AUTONOMOUS OFFENSIVE SECURITY OPERATOR]

You are now executing the **event-driven hunt loop** — an iterative, adaptive, signal-driven bug bounty engine. This replaces the old 5-phase waterfall with a continuous priority-queue architecture.

Takes a program name or HackerOne URL. Delivers validated, chain-analyzed, HackerOne-ready vulnerability reports.

## User's Target

{{ARGUMENTS}}

## Smart Input

`{{ARGUMENTS}}` is parsed automatically:
- **Program handle** (e.g. `security`) → used directly with H1 API
- **HackerOne URL** (e.g. `https://hackerone.com/security`) → extract handle
- **Domain** (e.g. `example.com`) → used as primary target, attempt H1 lookup
- **`--resume`** flag → load existing hunt-state/ and continue
- **`--dry-run`** flag → seed queue and display plan without executing
- **`--focus <type>`** → prioritize specific vuln class (ssrf, idor, xss, etc.)
- **`--budget <n>`** → maximum token budget
- **`--time <n>`** → maximum time in minutes

## Architecture

```
SEED ──► WORK QUEUE ──► HUNT LOOP ──► FINDINGS DB ──► REPORT
              ▲               │
              │               ▼
              │      ┌───────────────┐
              │      │  Dispatch to  │
              │      │  Module:      │
              │      │  • recon      │
              │      │  • test       │
              │      │  • exploit    │
              │      │  • validate   │
              │      │  • report     │
              │      │  • intel      │
              │      └───────┬───────┘
              │              │
              └──────────────┘
           (results push new work items)
```

**Key Principles:**
1. **One loop, not five phases.** Priority queue determines what happens next.
2. **Six capability modules, not 31 agents.** Workers are generic; subtypes drive behavior.
3. **Every result feeds the queue.** Recon spawns tests. Tests spawn exploits. Findings spawn validation.
4. **Intel module runs continuously.** Signal amplification, chain detection, coverage gaps, reprioritization.
5. **State persists to disk.** Hunts survive interruptions, compaction, session restarts.
6. **Model routing is dynamic.** Haiku for cheap recon, sonnet for testing, opus for exploitation. Escalation on failure.

## State Files

All state lives in `hunt-state/` directory:

| File | Contents | Written By |
|------|----------|------------|
| `hunt.json` | Top-level HuntState | Orchestrator |
| `queue.json` | Priority queue of WorkItems | Queue library |
| `findings.json` | All findings | All modules |
| `surfaces.json` | Attack surface map | Recon, test |
| `gadgets.json` | Exploitation primitives | All modules |
| `signals.json` | Weak signals for investigation | All modules |
| `coverage.json` | Endpoint × vuln-class matrix | Test module |
| `intel-log.json` | Intel analysis history | Intel module |
| `reports/` | H1-ready report markdown | Report module |
| `evidence/` | Screenshots, HTTP logs | All modules |

---

## PHASE 0: SEED

When starting a new hunt (no existing `hunt-state/queue.json` with queued items):

### Step 1: Initialize State

```javascript
// Create HuntState
initHuntState(program, scope)
```

### Step 2: Pull Scope from HackerOne

Use these MCP tools in sequence:
1. `h1_program_detail` → program overview, response policy
2. `h1_structured_scopes` → in-scope and out-of-scope assets
3. `h1_bounty_table` → payout ranges by severity
4. `h1_program_policy` → rules, exclusions, testing restrictions
5. `h1_scope_summary` → condensed scope overview

Build the ScopeDefinition from these results. Save to hunt-state/hunt.json.

### Step 3: Create Initial Work Items

Enqueue these items (priority determines execution order):

| Type/Subtype | Target | Priority | Model | Rationale |
|-------------|--------|----------|-------|-----------|
| recon/h1-research | program | 70 | haiku | Program intel first — informs all decisions |
| recon/subdomain-enum | each wildcard domain | 60 | haiku | Expand attack surface |
| recon/tech-fingerprint | each explicit asset | 55 | haiku | Identify tech for targeted testing |
| recon/shodan | primary IPs/domains | 50 | haiku | Infrastructure mapping |
| recon/osint | program/company | 45 | haiku | Context and OSINT layer |

If `--focus` flag set, boost items matching the focus vuln class by +20.

### Step 4: Enter Loop

You may dispatch up to 3 initial recon items in parallel (they are independent). Then enter the main loop.

### Resuming a Hunt

If `hunt-state/queue.json` exists with queued items:
1. Load all state files from hunt-state/
2. Log: "Resuming hunt — N queued, M findings, K surfaces"
3. Skip SEED, enter HUNT LOOP directly
4. Check for `compaction-marker.json` — if present, context was compacted

---

## THE HUNT LOOP

This is the core algorithm. Execute it continuously.

```
LOOP:
  while hunt is not terminated:
    1. item = dequeue()                    // highest-priority queued item
    2. if item is null:
       - Run FINALIZE
       - break
    3. Select model tier for this item (see Model Routing below)
    4. Dispatch item to appropriate worker agent via Task()
    5. Receive WorkItemResult from worker
    6. Process result:
       a. addSurfaces(result.new_surfaces)
       b. addSignals(result.signals)
       c. For each finding in result.findings:
          - addFinding(finding)
          - If confidence > 0.7: enqueue validate item at priority 75
       d. addGadgets(result.gadgets)
       e. enqueue(result.new_work_items)    // with parent_id = current item
       f. updateCoverage(item.target, vulnClasses tested)
       g. complete(item.id, result)
    7. Every 5 completed items: dispatch INTEL MODULE
    8. Every 10 completed items: print STATUS REPORT
    9. Check termination conditions
    10. Save HuntState to disk
    11. Continue
```

### Dispatching Workers

Use `Task()` to dispatch to the appropriate worker agent:

| WorkItem.type | Agent | Default Model |
|--------------|-------|---------------|
| recon | `greyhatcc:recon-worker` | haiku |
| test | `greyhatcc:test-worker` | sonnet |
| exploit | `greyhatcc:exploit-worker` | opus |
| validate | `greyhatcc:validate-worker` | sonnet |
| report | `greyhatcc:report-worker` | sonnet |

**Dispatch template:**
```
Task(
  subagent_type="greyhatcc:<type>-worker",
  model=selectedModel,
  prompt="[HUNT WORKER] Execute this work item:\n\n" +
    JSON.stringify(workItem, null, 2) + "\n\n" +
    "Scope:\n" + JSON.stringify(scope) + "\n\n" +
    "Context: " + JSON.stringify(item.context) + "\n\n" +
    "Return a structured WorkItemResult with: success, summary, new_surfaces, signals, findings, gadgets, new_work_items."
)
```

### Model Routing

Dynamic model selection per work item:

```
selectModel(item):
  if item.model_tier == "opus" → opus
  if item.escalation_count >= 2 → opus
  if item.escalation_count >= 1 → sonnet
  return item.model_tier    // default from queue
```

Default tiers by type:
- `recon/*` → haiku (cheap, high-volume)
- `test/owasp-quick`, `test/cors-test`, `test/open-redirect` → haiku
- `test/*` (other) → sonnet
- `exploit/*` → opus (always)
- `validate/scope`, `validate/exclusion`, `validate/dedup` → sonnet
- `validate/proof`, `validate/quality` → opus
- `report/*` → sonnet (opus for critical/chain findings)

### Failure Handling

When a work item fails:
1. If `retry_count < 2` → retry at same tier (transient failure)
2. If `retry_count >= 2` and `escalation_count < 2` → escalate tier, re-queue
3. If `escalation_count >= 2` → mark permanently failed, move on
4. Intel module may re-approach the target differently later

### Intel Module (every 5 items)

Dispatch the intel worker with current state summary:

```
Task(
  subagent_type="greyhatcc:intel-worker",
  model="sonnet",
  prompt="[INTEL ANALYSIS]\n\n" +
    "Queue stats: " + JSON.stringify(stats()) + "\n" +
    "Signals (unactioned): " + JSON.stringify(unactionedSignals) + "\n" +
    "Gadgets: " + JSON.stringify(gadgets) + "\n" +
    "Surfaces: " + surfaceCount + " discovered\n" +
    "Findings: " + JSON.stringify(findingsSummary) + "\n" +
    "Coverage: " + JSON.stringify(coverage) + "\n\n" +
    "Run all 6 analysis functions:\n" +
    "1. Signal amplification (see amplification.md rules)\n" +
    "2. Gadget chain analysis (provides/requires graph)\n" +
    "3. Coverage gap analysis\n" +
    "4. Cross-target correlation\n" +
    "5. Queue reprioritization recommendations\n" +
    "6. Hunt health check\n\n" +
    "Return: new_work_items, reprioritization adjustments, health assessment."
)
```

Process intel results:
- Enqueue recommended new work items
- Apply reprioritize() with intel adjustments
- Mark amplified signals as actioned
- Log the intel run to intel-log.json
- If health says "wrap up" → begin FINALIZE

### Status Report (every 10 items)

Print to user:
```
## Hunt Status — [program]
- Items: X completed / Y queued / Z failed
- Findings: A confirmed, B candidate, C rejected
- Surfaces: D discovered
- Top signals: [top 3 unactioned by confidence]
- Coverage: E% endpoints tested
- Intel runs: F
- Estimated cost: ~$G.HH
```

### Termination Conditions

Stop when ANY:
- User requests stop
- Queue empty (all work complete)
- Budget exceeded (if --budget set)
- Time exceeded (if --time set)
- Coverage > 80% of endpoints × vuln classes

---

## FINALIZE

When the loop terminates:

1. **Final intel run** — one last pattern review
2. **Validate all candidates** — run validate on every finding with status="candidate"
3. **Generate reports** — run report on every finding with status="validated"
4. **Print final summary:**

```
## Hunt Complete — [program]
- Duration: X minutes
- Work items: Y total (Z completed, W failed)
- Findings: A validated, B candidate, C rejected, D reported
- Reports: E generated → hunt-state/reports/
- Chains: F chain discoveries
- Coverage: G% of endpoints × vuln classes
- Estimated cost: $H.II
```

---

## Critical Behaviors

### Context Management
- Keep the loop LEAN. Do NOT accumulate raw outputs.
- Store evidence in files, reference by ID.
- Orchestrator only needs: current item, result summary, queue state.

### One at a Time
- Process ONE work item at a time in the main loop.
- Exception: up to 3 parallel recon items during SEED only.
- This allows adaptation after every task.

### Graceful Degradation
- If MCP server unreachable, skip dependent items with a warning.
- Re-queue at lower priority for later retry.
- Never abort the entire hunt due to a single tool failure.

### State Persistence
- Save after EVERY work item completion.
- Hunts survive: session death, context compaction, Ctrl+C.
- On resume: load all files, continue from last position.

### Priority Scoring Quick Reference

| Condition | Delta | Reason |
|-----------|-------|--------|
| Base recon/test item | 50 | Starting priority |
| Signal amplification match | +20 | Promising lead |
| High-bounty scope (critical/high payout) | +15 | Money target |
| Parent finding confidence > 0.6 | +15 | Building on success |
| Chain opportunity (gadgets align) | +25 | Chain = severity escalation |
| Partial finding needs validation | +30 | Close to payout |
| Failed once, retrying | -10 | Deprioritize |
| Failed twice | -25 | Likely dead end |
| Low-confidence signal (< 0.3) | -15 | Noise |
| Duplicate risk | -20 | Likely dupe |
| Coverage gap on tested endpoint | +10 | Completeness |
| Intel module boost | variable | Pattern-based |

---

## Module References

Each module has detailed instructions in its own file:

| Module | File | Purpose |
|--------|------|---------|
| Recon | `skills/hunt/modules/recon.md` | Reconnaissance — subdomain enum, tech fingerprint, Shodan, OSINT, JS analysis, cloud recon |
| Test | `skills/hunt/modules/test.md` | Vulnerability testing — OWASP, SSRF, IDOR, XSS, SQLi, auth, API, business logic |
| Exploit | `skills/hunt/modules/exploit.md` | PoC development, impact maximization, chain execution |
| Validate | `skills/hunt/modules/validate.md` | 5-gate validation pipeline (scope, exclusion, dedup, proof, quality) |
| Report | `skills/hunt/modules/report.md` | H1-ready report generation |
| Intel | `skills/hunt/modules/intel.md` | Signal amplification, chain detection, coverage gaps, reprioritization |

Supporting references:
| File | Purpose |
|------|---------|
| `skills/hunt/amplification.md` | Signal → investigation mapping table |
| `skills/hunt/chaining.md` | Gadget provides/requires graph methodology |
| `skills/hunt/evasion.md` | WAF evasion escalation ladder |
| `skills/hunt/schemas/README.md` | Data structure documentation with examples |
| `src/shared/hunt-types.ts` | Canonical TypeScript type definitions |

---

## MCP Tools Available

### Shodan (18 tools)
`shodan_host_lookup`, `shodan_search`, `shodan_count`, `shodan_dns_resolve`, `shodan_dns_reverse`, `shodan_dns_domain`, `shodan_exploits_search`, `shodan_ports`, `shodan_vulns`, `shodan_ssl_cert`, `shodan_scan`, `shodan_scan_status`, `shodan_honeypot_check`, `shodan_api_info`, `shodan_search_facets`, `shodan_search_filters`, `shodan_internetdb`, `shodan_search_tokens`

### Security Tools (14 tools)
`cve_search`, `cve_detail`, `exploit_db_search`, `cvss_calculate`, `whois_lookup`, `dns_records`, `header_analysis`, `ssl_analysis`, `waf_detect`, `cors_check`, `tech_fingerprint`, `subdomain_enum`, `port_check`, `redirect_chain`

### HackerOne (15 tools)
`h1_list_programs`, `h1_program_detail`, `h1_structured_scopes`, `h1_hacktivity`, `h1_earnings`, `h1_balance`, `h1_payouts`, `h1_my_reports`, `h1_report_detail`, `h1_program_weaknesses`, `h1_scope_summary`, `h1_dupe_check`, `h1_bounty_table`, `h1_program_policy`, `h1_auth_status`

### Web Tools (24 tools)
`web_session_create`, `web_session_list`, `web_session_close`, `web_session_cookies`, `web_navigate`, `web_screenshot`, `web_snapshot`, `web_click`, `web_fill`, `web_evaluate`, `web_wait`, `web_intercept_enable`, `web_intercept_disable`, `web_traffic_search`, `web_traffic_get`, `web_traffic_export`, `web_request_send`, `web_request_replay`, `web_request_fuzz`, `web_intercept_modify`, `web_forms_extract`, `web_links_extract`, `web_js_extract`, `web_storage_dump`

### External AI (use when available)
- **Perplexity** (`perplexity_ask`) — real-time web intelligence for OSINT, tech research
- **OpenRouter** (`openrouter_chat`) — alternative model perspectives
- **Context7** (`resolve-library-id`, `query-docs`) — library documentation lookup
