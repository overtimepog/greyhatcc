---
name: hacktivity-check
description: Scrape HackerOne hacktivity and disclosed reports to detect duplicate patterns before submitting - prevents wasted submissions and reputation damage
---

# Hacktivity Check

## Usage
`/greyhatcc:hacktivity <program_name> [finding_description]`

Searches HackerOne's public hacktivity and disclosed reports for similar findings. This is the external duplicate check — Layer 6 of the dedup system.

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

## Integration
- Called by `/greyhatcc:dedup` as Layer 6
- Called by hunt-loop before reporting phase
- Called by siege mode in the validation pipeline
- Can be called standalone for quick checks

## Delegation
- Quick search (web search only) → execute directly
- Deep search (Playwright + Perplexity) → `osint-researcher-low` (haiku)
