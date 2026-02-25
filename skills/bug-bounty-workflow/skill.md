---
name: bug-bounty-workflow
description: End-to-end bug bounty workflow from program research through HackerOne-ready report submission
---

# Bug Bounty Workflow

## Usage
`/greyhatcc:bounty <program_name or HackerOne URL>`

## Smart Input
`{{ARGUMENTS}}` is parsed automatically:
- **Program handle** (e.g. `security`) → used directly with H1 API
- **H1 URL** (https://hackerone.com/security) → program handle extracted
- **Domain** (example.com) → search H1 programs for matching domain
- **Empty** → error: "Usage: /greyhatcc:<skill> <program>"

No format specification needed — detect and proceed.


## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions


## Hunt Mode (Recommended)

For autonomous bug bounty hunting, use `/greyhatcc:hunt <program>` instead. Hunt mode uses
the **v7 event-driven priority-queue architecture** that replaces the manual phase workflow below.

Hunt mode advantages over manual workflow:
- **Iterative**: Recon findings immediately spawn tests (no waiting for recon to finish)
- **Adaptive**: Intel module reprioritizes based on signals and patterns
- **Persistent**: State survives interruptions, compaction, session restarts
- **Cost-efficient**: Dynamic model routing (haiku for recon, sonnet for testing, opus for exploitation)
- **Chain-aware**: Automatic gadget graph analysis identifies chaining opportunities

The manual workflow below is still valid for when you want fine-grained control over each phase.

## Phases

### Phase 0: Program Research
**Use `/greyhatcc:program <URL>` to automate this entire phase.** It uses Playwright browser automation to extract scope from JS-rendered HackerOne pages, Perplexity for supplementary intel, and the HackerOne API when configured.

1. **Run program-research skill** → extracts scope, bounty table, exclusions, rules, stats
2. Identify in-scope assets, excluded targets, and testing restrictions
3. **Extract and document the FULL non-qualifying/exclusion list** — this prevents wasted submissions
4. **Document the bounty table** — prioritize testing toward highest-paying severity tiers
5. **Consult reference guides** (`/greyhatcc:guides <vuln_type>`) for attack vectors matching the target tech stack
6. Set up scope via scope-management skill
7. Create directory: `bug_bounty/<program>_bug_bounty/{recon,findings,reports,evidence,scripts,notes}`
8. Create initial state files: `gadgets.json`, `tested.json`, `submissions.json`
9. Write `attack_plan.md` with prioritized targets

### Phase 1: Reconnaissance (60-70% of effort)
Delegate to recon skill with parallel agents:
- Subdomain enumeration → then `/greyhatcc:takeover` on results
- Port scanning
- Technology fingerprinting
- OSINT gathering
- Shodan intelligence
- **JS analysis** → `/greyhatcc:js` on all discovered web assets
- **Cloud recon** → `/greyhatcc:cloud` for bucket/CDN origin discovery
- Update `tested.json` and `gadgets.json` with all recon findings

### Phase 2: Vulnerability Hunting
Focus on business logic first (automation handles CVEs):
- IDOR and broken access control
- Authentication/authorization bypass → `/greyhatcc:auth` for dedicated OAuth/JWT testing
- Business logic flaws
- Race conditions
- SSRF chains
- API security issues → `/greyhatcc:api` for dedicated REST/GraphQL testing
- GraphQL vulnerabilities

**Before testing each endpoint**: check `tested.json` to avoid redundant work.
**After each finding**: update `findings_log.md`, `gadgets.json`, and `tested.json`.
**Check exclusions**: verify every finding against the program's non-qualifying list from scope.md.

Delegate to webapp-tester agent for systematic testing. **Pass full context** (scope, exclusions, existing findings, recon data) per context-loader protocol.

### Phase 3: Reporting
- **Run `/greyhatcc:gadgets chain`** — identify all chaining opportunities before writing reports
- **Run `/greyhatcc:dedup`** on each finding — verify it hasn't been reported or submitted before
- Document each finding via `/greyhatcc:findings`
- Generate HackerOne reports via `/greyhatcc:h1-report` (which auto-loads scope, evidence, chain context)
- Chain related findings: never report a low alone when it chains into medium/high
- Combine related low-severity findings into one medium report
- **Update `submissions.json`** when reports are submitted to HackerOne

## Workflow Decision Points

### Decision: When to Stop Recon and Start Testing
```
STOP recon and START testing when:
- All in-scope domains have been enumerated and resolved
- Tech stack identified for all primary assets
- JS bundles analyzed for at least the top 3 assets
- WAF/CDN identified for all web assets
- attack_plan.md has been written with prioritized targets
- 60-70% of allocated time has been spent on recon
```

### Decision: When to Report vs Chain
```
REPORT immediately if:
- Finding is HIGH or CRITICAL standalone
- Finding has working PoC with clear impact
- Finding is not on the exclusion list

CHAIN FIRST if:
- Finding is LOW or MEDIUM standalone
- Finding is on the exclusion list but has chain potential
- gadgets.json has a complementary gadget (provides/requires match)
- Classic chain pattern applies (self-XSS+CSRF, redirect+OAuth, SSRF+metadata)

DO NOT REPORT if:
- Finding is on the ALWAYS_REJECTED dupe list
- Finding cannot be chained
- Finding has no working PoC
- Finding is a duplicate (dedup check fails)
```

### Decision: When to Move to Next Target
```
MOVE to next target when:
- All vuln classes from OWASP Top 10 tested
- All tech-stack-specific tests run (e.g., GraphQL tests for GraphQL endpoints)
- tested.json shows full coverage for this asset
- No more untested endpoints from recon data
- Diminishing returns: 3+ consecutive tests with no findings
```

## Program Selection Criteria (ROI Calculation)

When choosing between multiple programs:

```
ROI Score = (max_bounty * asset_density * tech_complexity) / (competition * program_age)

Factors:
- max_bounty: Critical tier maximum ($)
- asset_density: Number of in-scope assets (more = more surface area)
- tech_complexity: Score 1-5 based on tech stack complexity
  * 5: GraphQL + OAuth + microservices + mobile + cloud
  * 4: REST API + JWT + cloud services
  * 3: Standard web app + API
  * 2: Simple web app, minimal API
  * 1: Static site, minimal attack surface
- competition: Estimated researcher count (from hacktivity volume)
  * New program (< 4 weeks): competition = 1 (LOW — best ROI)
  * Active program (4-12 weeks): competition = 2
  * Mature program (> 12 weeks): competition = 3
- program_age: Weeks since launch (newer = more low-hanging fruit)
```

### High-ROI Program Indicators
- New program (first 2-4 weeks) — highest ROI window
- Wildcard scope (*.domain.com) — largest attack surface
- High bounty ceiling ($10k+ critical) — worth the investment
- Complex tech stack (GraphQL, OAuth, microservices) — more bug classes
- Recent acquisition — acquired assets often have weakest security
- Low hacktivity volume — less competition

## Key Principles
- Validate every finding with deterministic proof before reporting
- 60-70% effort on recon before touching endpoints
- Business logic first: automation handles CVEs, we handle logic
- Chain everything: never report a low alone when it can be chained

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
