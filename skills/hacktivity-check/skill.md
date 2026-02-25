---
name: hacktivity-check
description: Scrape HackerOne hacktivity and disclosed reports to detect duplicate patterns before submitting - prevents wasted submissions and reputation damage
---

# Hacktivity Check

## Usage
`/greyhatcc:hacktivity <program_name> [finding_description]`

Searches HackerOne's public hacktivity and disclosed reports for similar findings. This is the external duplicate check — Layer 6 of the dedup system.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## Why This Exists

Internal dedup (layers 1-5) catches YOUR duplicates. Hacktivity check catches OTHER RESEARCHERS' duplicates. If someone already reported the same bug 3 months ago and it was resolved, yours will be marked duplicate.

## Method 1: Web Search (Fast, Always Available)

Search for disclosed reports matching the finding:

```
WebSearch: site:hackerone.com/reports "<vulnerability_type>" "<target_domain>"
WebSearch: site:hackerone.com "<program_name>" "<vulnerability_type>"
WebSearch: "<program_name>" bug bounty "<vulnerability_type>" disclosed
```

Parse results for:
- Report titles matching the vulnerability type
- Same asset/endpoint in disclosed reports
- Resolution status (resolved = your dupe will be marked duplicate)
- Disclosure date (recent = higher dupe risk)

## Method 2: Playwright Scrape (Thorough, Needs Browser)

If the program has public hacktivity:
1. Navigate to `https://hackerone.com/<program>/hacktivity`
2. Filter by "Disclosed" and "Resolved"
3. Search for vulnerability type keywords
4. Extract: report title, severity, asset, resolution date
5. Check for patterns matching the finding

If hacktivity is not public, Method 1 is the fallback.

## Method 3: Perplexity Deep Search (Broadest)

Use Perplexity to search across:
- HackerOne disclosed reports
- Bugcrowd disclosed reports
- Security blog posts about the target
- CVE databases for the same vulnerability
- Twitter/X security researcher discussions

```
perplexity_ask: "Has anyone reported <vulnerability_type> on <target_domain> on HackerOne or Bugcrowd? Look for disclosed bug bounty reports."
```

## Pattern Matching

After collecting search results, match against these patterns:

### High Dupe Risk (>70%)
- Same vuln type + same endpoint = almost certainly a dupe
- Same vuln type + same service = likely a dupe (root cause)
- Resolved within last 6 months = fix may still be deployed

### Medium Dupe Risk (30-70%)
- Same vuln type + different endpoint on same service = possible root cause dupe
- Similar vuln type + same technology (e.g., "Spring Boot actuator" on any endpoint)
- Program has disclosed many similar findings = they know about this class

### Low Dupe Risk (<30%)
- Different vuln type on same endpoint = probably unique
- Same vuln type but different service = probably unique
- No disclosed reports matching at all = fresh ground

## Output

```markdown
## Hacktivity Check: <finding_description>
### Program: <program_name>

### Disclosed Reports Found: <N>

| # | Report | Severity | Asset | Date | Similarity |
|---|--------|----------|-------|------|------------|
| 1 | "CORS misconfiguration on api.example.com" | Medium | api.example.com | 2025-11-15 | HIGH (same vuln + same endpoint) |
| 2 | "Reflected XSS via search parameter" | Low | www.example.com | 2025-09-01 | LOW (different vuln type) |

### Dupe Risk Assessment: [HIGH / MEDIUM / LOW / CLEAR]

### Recommendation: [SUBMIT / DO NOT SUBMIT / DIFFERENTIATE]

- SUBMIT: No similar disclosed reports found, or finding is clearly different
- DO NOT SUBMIT: High-confidence duplicate exists in hacktivity
- DIFFERENTIATE: Similar report exists but your finding has unique aspects — clearly articulate the difference in your report title and description

### If DIFFERENTIATE:
Suggested differentiators:
- Different endpoint/asset: "Your finding is on api-au.syfe.com, disclosed report was on api.syfe.com"
- Different impact: "Your finding demonstrates data exfiltration, disclosed report was CORS without proof"
- Chain component: "Your finding chains with F-003 to achieve ATO, disclosed report was standalone"
```

## Keyword Matching Strategy

### Building Search Queries
For each finding, generate multiple search queries covering different angles:

```
Query templates:
1. Exact: "<program_name>" "<exact_vuln_type>" "<exact_endpoint>"
2. Broad: "<program_name>" "<vuln_category>" site:hackerone.com
3. Tech: "<program_name>" "<technology>" vulnerability disclosed
4. Endpoint: "<program_name>" "<endpoint_path>" security
5. CWE: "<program_name>" "CWE-<number>" disclosed
```

### Keyword Expansion
Map the finding to multiple search terms:

| Finding Type | Search Keywords |
|-------------|----------------|
| CORS misconfiguration | "CORS", "cross-origin", "Access-Control", "origin reflection" |
| IDOR | "IDOR", "insecure direct object", "broken access control", "unauthorized access" |
| XSS | "XSS", "cross-site scripting", "script injection", "reflected", "stored" |
| SSRF | "SSRF", "server-side request", "internal access", "metadata" |
| SQL injection | "SQL injection", "SQLi", "database", "query injection" |
| JWT manipulation | "JWT", "token", "algorithm confusion", "none algorithm" |
| OAuth bypass | "OAuth", "redirect_uri", "token theft", "authorization bypass" |
| Subdomain takeover | "subdomain takeover", "dangling CNAME", "unclaimed", "takeover" |
| GraphQL | "GraphQL", "introspection", "batching", "query abuse" |
| Actuator exposure | "actuator", "Spring Boot", "health endpoint", "env exposure" |

### False Positive Filtering

After collecting search results, filter out false positives:

| False Positive Signal | Action |
|----------------------|--------|
| Different program, same vuln type | Ignore — not a dupe for YOUR program |
| Same program, different asset entirely | Likely not a dupe — different asset |
| Same program, same vuln, but 2+ years old | Low dupe risk — likely different root cause |
| Blog post discussing the vuln type generically | Ignore — not a program-specific disclosure |
| Report marked "Informational" or "N/A" | Note — your report may face same fate |
| Report marked "Duplicate" with original visible | Check original — YOUR finding may also be a dupe of that original |
| Report resolved but fix confirmed incomplete | Your finding may be a VARIANT — clearly differentiate in report |

### API-Based Search (When H1 API Available)

If `H1_API_TOKEN` is configured, query the HackerOne API directly:

```
Use: mcp__plugin_greyhatcc_sec__h1_program_fetch
Arguments: { handle: "<program_handle>" }

Then search the returned data for:
- Disclosed reports matching the vulnerability type
- Resolved reports on the same asset
- Reporter activity patterns (frequent reporters on same asset)
```

This provides structured JSON data that is more reliable than scraping.

## Integration
- Called by `/greyhatcc:dedup` as Layer 6
- Called by hunt-loop before reporting phase
- Called by siege mode in the validation pipeline
- Can be called standalone for quick checks

## Delegation
- Quick search (web search only) → execute directly
- Deep search (Playwright + Perplexity) → `osint-researcher-low` (haiku)

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
