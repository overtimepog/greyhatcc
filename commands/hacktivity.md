---
name: hacktivity
description: "Search HackerOne hacktivity for disclosed reports matching your finding"
aliases:
  - h1-search
  - disclosed
allowed-tools: Task, Bash, Read, Glob, Grep, WebFetch, WebSearch
argument-hint: "<program handle or URL>"
skill: greyhatcc:hacktivity-check
---

# Hacktivity Search

Invoke the `greyhatcc:hacktivity-check` skill for: {{ARGUMENTS}}

Searches HackerOne hacktivity, disclosed reports, and public security research for findings
similar to yours. Prevents submitting duplicates of other researchers' work.

**Search Methods:**

**Playwright Browser Scraping:**
- Navigate to HackerOne program hacktivity page directly
- Scroll through disclosed reports to extract titles, severity, and bounty amounts
- Handle JavaScript-rendered content that static fetching misses
- Extract researcher names, disclosure dates, and report summaries

**HackerOne API Queries:**
- Search hacktivity by program handle for all disclosed reports
- Filter by severity, vulnerability type, and date range
- Extract structured data: CWE, CVSS, bounty amount, resolution time

**Keyword Matching:**
- Compare your finding's title, vulnerability type, and affected component
- against all disclosed reports for the same program
- Fuzzy matching for different phrasings of the same vulnerability
- Component matching: same endpoint or parameter in a different context

**Public Research:**
- WebSearch for blog posts and writeups about the target program
- Check for CVE assignments related to previously disclosed bugs
- Search security conference presentations mentioning the target
- Monitor Twitter/X security research threads for informal disclosures

**Output:**
- List of potentially matching disclosed reports with similarity scores
- Direct links to disclosed HackerOne reports for manual review
- Recommendation: likely duplicate, possibly related, or no match found
- Historical bounty data for similar findings to estimate payout potential
