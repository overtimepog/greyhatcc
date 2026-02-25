---
name: dedup
description: "Check if a bug has been previously found, reported, or submitted before writing a report"
aliases:
  - dup
  - duplicate
  - check
allowed-tools: Task, Bash, Read, Glob, Grep, WebFetch, WebSearch
argument-hint: "<finding title or description>"
skill: greyhatcc:dedup-checker
---

# Duplicate Finding Checker

Invoke the `greyhatcc:dedup-checker` skill with: {{ARGUMENTS}}

Six-layer deduplication check to prevent wasted effort on duplicate submissions:

**Layer 1 - Internal Findings Log:**
- Search the current engagement's findings.json for same or similar vulnerabilities
- Match by endpoint, vulnerability type, and affected parameter
- Detect findings that differ only in payload but exploit the same root cause

**Layer 2 - Previous Submissions:**
- Check against all previously submitted reports for this program
- Match by CWE, affected asset, and vulnerability pattern
- Identify findings already reported even if worded differently

**Layer 3 - Gadget Inventory:**
- Cross-reference with existing gadgets to check if this is a known building block
- Determine if the finding adds chain value even if the base vuln is known

**Layer 4 - Common Dupes Database:**
- Check against 24+ patterns of commonly rejected finding types
- Missing security headers (HSTS, X-Frame-Options, CSP) without demonstrable impact
- Cookie flags (HttpOnly, Secure, SameSite) without exploitation path
- Self-XSS without CSRF chain, open redirect without OAuth/token chain
- Rate limiting absence without demonstrated abuse scenario

**Layer 5 - Hacktivity Search:**
- Search HackerOne hacktivity for disclosed reports on the same program
- Match by vulnerability type, component, and endpoint pattern
- Check if a similar finding was already disclosed by another researcher

**Layer 6 - Program Exclusions:**
- Verify the finding type is not explicitly listed in program exclusions
- Check program-specific rules for known out-of-scope vulnerability classes
- Validate the affected asset is still in-scope (programs update scope regularly)

**Verdict:**
- SUBMIT: Finding is unique, in-scope, and not in any exclusion list
- CHAIN: Finding is low-value alone but could be chained (add to gadgets)
- SKIP: Finding matches a known duplicate, exclusion, or common rejection pattern
