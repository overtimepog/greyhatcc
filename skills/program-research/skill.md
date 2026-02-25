---
name: program-research
description: Research bug bounty programs from HackerOne/Bugcrowd/Intigriti - extract scope, bounties, exclusions, rules, and program intel using Playwright browser automation, Perplexity AI search, and HackerOne API
---

# Program Research

Comprehensive bug bounty program research that extracts ALL program details needed before starting an engagement.

## Usage
- `/greyhatcc:program <HackerOne URL or program handle>` — Full program research
- `/greyhatcc:program <URL> --quick` — Scope-only extraction (skip deep research)

## Why This Exists

HackerOne pages require JavaScript rendering — WebFetch returns empty HTML. This skill orchestrates **Playwright browser automation** (primary), **HackerOne API** (when configured), and **Perplexity AI search** (supplementary) to extract every detail needed for Phase 0 of a bug bounty engagement.

Without this skill, Phase 0 requires manual browsing and copy-pasting. With it, the entire program research phase is automated into structured files ready for the engagement.

## Input Parsing

Parse the input to determine:
- **HackerOne URL**: `https://hackerone.com/<handle>` or `https://hackerone.com/<handle>?type=team` → extract `<handle>`
- **Bugcrowd URL**: `https://bugcrowd.com/<handle>` → extract handle, adjust scraping selectors
- **Plain handle**: `meesho_bbp` → assume HackerOne, construct URL

```
HANDLE = extracted program handle (e.g., "meesho_bbp")
PLATFORM_URL = full program URL
PROGRAM_DIR = bug_bounty/<handle>_bug_bounty/
```

## Execution Strategy

Use a **multi-source approach** — no single source has everything:

| Source | What It Gets | Reliability | Speed |
|--------|-------------|-------------|-------|
| **Playwright MCP** | Scope table, bounty table, exclusions, policy text, stats | HIGH (renders JS) | 10-20s |
| **HackerOne API** | Structured scopes, program metadata (when API token configured) | HIGH (structured JSON) | 1-2s |
| **Perplexity** | Program context, tech stack, previous disclosures, company intel | MEDIUM (AI search) | 3-5s |
| **WebSearch** | Additional program intel, disclosed reports, writeups | MEDIUM | 2-3s |

### Priority Order
1. **Always** use Playwright MCP — it's the most complete source
2. **If configured** (`hackerone.apiToken` in config), also hit the HackerOne API for structured data
3. **Always** use Perplexity for supplementary intel
4. **Always** use WebSearch for disclosed reports and writeups

## Step 1: Playwright Browser Extraction (PRIMARY)

Use the Playwright MCP tools to browse the HackerOne program page and extract all data.

### 1a. Navigate to Program Page

```
Use: mcp__plugin_playwright_playwright__browser_navigate
URL: https://hackerone.com/<HANDLE>
```

Wait for the page to fully load. HackerOne is a React SPA — content loads asynchronously.

```
Use: mcp__plugin_playwright_playwright__browser_wait_for
Wait for: text "Policy" or text "Scope" or text "In scope" (indicates page has loaded)
Timeout: 15000ms
```

### 1b. Take Screenshot for Reference

```
Use: mcp__plugin_playwright_playwright__browser_take_screenshot
```

Save to `PROGRAM_DIR/evidence/program_page.png`

### 1c. Extract Page Content via Snapshot

```
Use: mcp__plugin_playwright_playwright__browser_snapshot
```

From the accessibility snapshot, extract:
- **Program name and description**
- **Response efficiency** (time to first response, time to triage, time to bounty, time to resolution)
- **Statistics** (reports resolved, hackers thanked, bounties paid)
- **Managed/unmanaged** status

### 1d. Navigate to Policy/Scope Page

```
Use: mcp__plugin_playwright_playwright__browser_navigate
URL: https://hackerone.com/<HANDLE>/policy_scopes
```

Or click the "Policy" tab if visible. Wait for scope tables to render.

```
Use: mcp__plugin_playwright_playwright__browser_snapshot
```

### 1e. Extract Scope Data

From the snapshot, systematically extract:

**In-Scope Assets:**
- Asset identifier (domain, URL, app name, source code repo)
- Asset type (Domain, URL, Android App, iOS App, Hardware, Source Code, Executable, Other)
- Tier/Priority (if shown — Critical, Important, Normal)
- Bounty eligibility (eligible/not eligible)
- Max severity (if specified per asset)
- Notes/instructions per asset

**Out-of-Scope Assets:**
- All excluded domains, URLs, paths
- Reason for exclusion (if given)

**Bounty Table:**
- Severity level (Critical, High, Medium, Low)
- Dollar ranges (min - max)
- Any conditions or notes per tier

### 1f. Extract Policy Text

Look for these sections in the page content:
- **Program Policy** / **Program Rules**
- **Non-Qualifying Vulnerabilities** / **Exclusions** / **Out of Scope Vulnerabilities**
- **Safe Harbor** statement
- **Disclosure Policy** (coordinated, full, etc.)
- **Testing Restrictions** (rate limits, no DoS, required headers, account rules)
- **Eligibility** requirements (country restrictions, KYC, etc.)

### 1g. Extract via JavaScript (Fallback)

If the snapshot doesn't capture table data well, use browser_evaluate to extract via DOM:

```
Use: mcp__plugin_playwright_playwright__browser_evaluate
Script: |
  // Extract scope tables
  const tables = document.querySelectorAll('table');
  const data = [];
  tables.forEach(t => {
    const rows = [...t.querySelectorAll('tr')].map(r =>
      [...r.querySelectorAll('td, th')].map(c => c.textContent.trim())
    );
    data.push(rows);
  });

  // Extract policy text
  const policySections = document.querySelectorAll('[class*="policy"], [class*="scope"], [class*="markdown"]');
  const policyText = [...policySections].map(s => s.textContent.trim());

  JSON.stringify({ tables: data, policy: policyText });
```

## Step 2: HackerOne API (SECONDARY — when configured)

If `hackerone.apiToken` is set in greyhatcc config or `H1_API_TOKEN` env var exists, use the MCP tool:

```
Use: mcp__plugin_greyhatcc_sec__h1_program_fetch
Arguments: { handle: "<HANDLE>" }
```

This returns structured JSON with scope, bounty ranges, and program metadata. Cross-reference with Playwright data to fill gaps.

If the MCP tool is not available or fails, skip — Playwright data is sufficient.

## Step 3: Perplexity Deep Research (SUPPLEMENTARY)

Run these queries in parallel using `mcp__perplexity-ask__perplexity_ask`:

### 3a. Program Intel
```
Query: "<COMPANY_NAME> bug bounty program scope technology stack infrastructure 2025 2026"
Extract: Tech stack, known infrastructure, cloud providers, key domains
```

### 3b. Previous Disclosures
```
Query: "<COMPANY_NAME> HackerOne disclosed reports vulnerabilities hacktivity 2024 2025"
Extract: Previously found vuln types, researcher names, bounty amounts paid
```

### 3c. Company Tech Intel
```
Query: "<COMPANY_NAME> engineering blog tech stack microservices API architecture"
Extract: Internal tech choices, API patterns, frameworks, mobile app tech
```

## Step 4: WebSearch Supplementary Intel

Run in parallel with Perplexity:

```
Use: WebSearch
Query: "site:hackerone.com <HANDLE> disclosed"
```

```
Use: WebSearch
Query: "<COMPANY_NAME> bug bounty writeup 2024 2025"
```

## Step 5: Structure Output Files

### 5a. Create Program Directory

```
bug_bounty/<HANDLE>_bug_bounty/
  scope.md              ← Full program scope document
  attack_plan.md        ← Prioritized attack plan
  findings_log.md       ← Empty findings log (template)
  gadgets.json          ← Empty gadget inventory
  tested.json           ← Empty tested tracker
  submissions.json      ← Empty submissions tracker
  recon/                ← Recon artifacts directory
  reports/              ← Reports directory
  evidence/             ← Evidence directory
    program_page.png    ← Screenshot from Step 1b
  scripts/              ← Custom scripts directory
  notes/                ← Research notes directory
    program_research.md ← Full research notes from all sources
```

### 5b. Write scope.md

This is the most critical file. It feeds into ALL other skills via the context-loader protocol.

```markdown
# <Program Name> Bug Bounty Program

**Platform:** HackerOne
**URL:** https://hackerone.com/<HANDLE>
**Researcher:** overtimedev
**Date Researched:** YYYY-MM-DD
**Program Type:** Managed / Community / Private

## Response Targets
| Metric | Target |
|--------|--------|
| Time to first response | X business days |
| Time to triage | X business days |
| Time to bounty | X business days |
| Time to resolution | X business days |

## Program Statistics
- Reports resolved: X
- Hackers thanked: X
- Bounties paid: $X
- Average bounty: $X (if available)

## Bounty Table
| Severity | Range |
|----------|-------|
| Critical | $X - $Y |
| High | $X - $Y |
| Medium | $X - $Y |
| Low | $X - $Y |

## In-Scope Assets
| Asset | Type | Priority/Tier | Bounty Eligible | Notes |
|-------|------|--------------|-----------------|-------|
| example.com | Domain | Critical | Yes | Main domain |
| ... | ... | ... | ... | ... |

## Out-of-Scope Assets
| Asset | Type | Reason |
|-------|------|--------|
| ... | ... | ... |

## Program Rules
- [ list every rule that constrains testing ]
- Required headers: ...
- Account restrictions: ...
- Rate limits: ...
- Prohibited methods: ...

## Non-Qualifying Vulnerabilities (EXCLUSION LIST)
**CHECK EVERY FINDING AGAINST THIS LIST BEFORE WRITING A REPORT**

- [ full list of excluded vulnerability types ]

## Safe Harbor
[ safe harbor statement if present ]

## Disclosure Policy
[ coordinated / full / private — terms ]

## Additional Notes
[ any program-specific notes, special instructions, tips from research ]
```

### 5c. Write attack_plan.md

Based on the scope and research, create a prioritized attack plan:

```markdown
# Attack Plan: <Program Name>

## Priority Targets (by bounty potential and attack surface)

### Tier 1 — Highest Value
1. **[asset]** — [why it's high value: large attack surface, complex auth, payment flows, etc.]
   - Test vectors: [specific tests to run]
   - Tools: [specific skills/tools to use]

### Tier 2 — Medium Value
...

### Tier 3 — Quick Wins
...

## Attack Vectors to Prioritize
Based on tech stack (<identified tech>):
1. [vector] — [why]
2. [vector] — [why]

## Known Previous Findings
From disclosed reports and research:
- [finding type] — [was it patched? can we find variants?]

## Recon Tasks (Phase 1)
- [ ] Subdomain enumeration → /greyhatcc:subdomains
- [ ] Port scanning → /greyhatcc:portscan
- [ ] JS analysis → /greyhatcc:js
- [ ] Cloud recon → /greyhatcc:cloud
- [ ] Shodan intel → /greyhatcc:shodan
- [ ] Tech fingerprint on each in-scope domain
- [ ] WAF detection on each in-scope domain
```

### 5d. Write Initial State Files

**findings_log.md:**
```markdown
# Findings Log: <Program Name>

| # | Date | Asset | Title | Severity | Status | Report |
|---|------|-------|-------|----------|--------|--------|
```

**gadgets.json:**
```json
{"gadgets": [], "chains": []}
```

**tested.json:**
```json
{"tested": []}
```

**submissions.json:**
```json
{"submissions": []}
```

### 5e. Write notes/program_research.md

Dump ALL raw research data here — Perplexity responses, search results, API data, page content. This is the reference document for the full engagement.

## Step 6: Initialize Scope

After creating all files, auto-invoke the scope-management skill to create `.greyhatcc/scope.json` from the extracted data:

```
Invoke: scope-management skill
Action: init <HANDLE> with extracted scope data
```

## Step 7: Summary Report

Print a summary to the user:

```
## Program Research Complete: <Program Name>

**Scope:** X in-scope assets, Y out-of-scope, Z exclusion rules
**Bounties:** $Low_min-$Critical_max range
**Stats:** X reports resolved, $Y avg bounty

### Top Priority Targets
1. [target] — [why]
2. [target] — [why]
3. [target] — [why]

### Key Exclusions to Watch
- [most important exclusions that could waste submissions]

### Recommended Next Steps
1. `/greyhatcc:recon <primary_target>` — Start Phase 1 recon
2. `/greyhatcc:subdomains <root_domain>` — Subdomain enumeration
3. `/greyhatcc:shodan <primary_target>` — Shodan intelligence

Files created in: bug_bounty/<HANDLE>_bug_bounty/
```

## Step 8: Context7 Live Documentation Lookup

After identifying the tech stack from fingerprinting (Step 1) and Perplexity research (Step 3), use **Context7 MCP** to pull up-to-date documentation for each identified technology. This reveals:
- Default security configurations (what's insecure out-of-the-box)
- Known security-relevant APIs and endpoints
- Authentication/authorization patterns
- Common misconfigurations

### How to Use Context7

For each major technology identified in the target's stack:

```
Step 1: Resolve the library ID
Use: mcp__Context7__resolve-library-id
  libraryName: "<technology name>"  (e.g., "next.js", "spring-boot", "express", "django")
  query: "security configuration authentication vulnerabilities"

Step 2: Query security-relevant docs
Use: mcp__Context7__query-docs
  libraryId: "<resolved library ID>"  (e.g., "/vercel/next.js")
  topic: "security configuration authentication middleware CORS headers"
```

### Priority Technologies to Look Up

| If Detected | Context7 Query Focus | What to Extract |
|-------------|---------------------|-----------------|
| **Next.js** | Auth middleware, API routes, CORS, CSP, rewrites | Default CORS behavior, middleware bypass patterns, API route auth |
| **Spring Boot** | Actuator, security config, CORS, CSRF | Default actuator endpoints, security filter chain, CORS config |
| **Express/Node** | Middleware, CORS, helmet, session, auth | Default middleware order, session config, CORS options |
| **Django** | Security settings, CSRF, auth, middleware | SECURE_* settings defaults, middleware stack, auth backends |
| **React** | XSS sink patterns, security best practices | Unsafe rendering patterns, CSP integration |
| **GraphQL** (Apollo/Yoga) | Introspection, depth limiting, auth directives | Default introspection behavior, query complexity settings |
| **AWS SDK** | S3 permissions, IAM, Cognito, Lambda | Default bucket policies, Cognito user pool config |
| **Firebase** | Security rules, auth, storage rules | Default Firestore/Storage rules, auth config |
| **WordPress** | REST API, authentication, plugins | REST API default exposure, xmlrpc, auth endpoints |

### What to Do With Context7 Results

1. **Compare defaults vs target**: If docs say "introspection enabled by default" and target has GraphQL, test introspection
2. **Find hidden endpoints**: Framework docs reveal standard paths (e.g., Spring Boot actuator endpoints, Next.js `/_next/data/`)
3. **Identify security settings**: Know what configs SHOULD be set so you can test if they're missing
4. **Add to attack_plan.md**: Include framework-specific test vectors based on docs

## Step 9: Consult Reference Guides

After identifying the tech stack, consult the reference-guides skill to identify attack vectors:

```
Invoke: reference-guides skill
Query: <identified tech stack components>
```

Cross-reference the identified technologies with vulnerability-specific cheatsheets:

| Tech Detected | Primary Reference | Attack Vectors |
|--------------|------------------|----------------|
| React/Next.js | HackTricks + PayloadsAllTheThings | Prototype pollution, DOM XSS, SSRF via SSR |
| GraphQL | HackTricks GraphQL + clairvoyance | Introspection, batching, alias abuse, field-level authz |
| OAuth/OIDC | HackTricks OAuth + OWASP cheatsheet | Token theft, redirect manipulation, scope escalation |
| JWT | HackTricks JWT + jwt_tool | None alg, RS256→HS256, kid injection |
| AWS/S3 | HackTricks Cloud + cloud_enum | Bucket takeover, IAM abuse, SSRF to metadata |
| Spring Boot | PayloadsAllTheThings + HackTricks | Actuator exposure, SSTI, deserialization |
| WordPress | HackTricks + WPScan | REST API abuse, plugin vulns, xmlrpc |
| Mobile App | OWASP MAS + Frida + objection | SSL pinning bypass, deeplink injection, local storage |

### Key Reference URLs for Quick Access

**Methodology:**
- HowToHunt: https://kathan19.gitbook.io/howtohunt
- HackTricks: https://book.hacktricks.xyz/
- PayloadsAllTheThings: https://github.com/swisskyrepo/PayloadsAllTheThings
- OWASP Testing Guide: https://owasp.org/www-project-web-security-testing-guide/
- PortSwigger Academy: https://portswigger.net/web-security

**Payloads:**
- XSS: https://github.com/payloadbox/xss-payload-list
- SQLi: https://github.com/payloadbox/sql-injection-payload-list
- AllAboutBugBounty: https://github.com/daffainfo/all-about-bug-bounty

**Tools:**
- jwt_tool: https://github.com/ticarpi/jwt_tool
- clairvoyance (blind GraphQL): https://github.com/nikitastupin/clairvoyance
- can-i-take-over-xyz: https://github.com/EdOverflow/can-i-take-over-xyz

Include relevant references in the `attack_plan.md` for each priority target.

## Error Handling

| Error | Recovery |
|-------|----------|
| Playwright fails to load page | Retry once, then fall back to Perplexity + WebSearch only |
| HackerOne returns 403/404 | Program may be private or handle is wrong — ask user to verify |
| No scope tables found | Try `/policy_scopes` URL directly, or extract from policy text |
| Rate limited | Wait 30s and retry |
| Cloudflare challenge | Use `browser_handle_dialog` if prompted, or wait for challenge to pass |
| Empty page after load | Increase wait time to 30s, scroll to trigger lazy loading |

## Delegation

For parallel execution, delegate research tasks to agents:
- `osint-researcher` — Company OSINT, employee enumeration, tech stack research
- `recon-specialist-low` — Quick tech fingerprint and DNS lookup on scope assets

But the **Playwright browsing must happen in the main context** (MCP tools aren't available to subagents).
