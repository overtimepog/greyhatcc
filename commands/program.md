---
name: program
description: "Research a bug bounty program - extract scope, bounties, exclusions, rules, and program intel"
aliases:
  - research
  - bbp
  - program-research
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<program URL>"
skill: greyhatcc:program-research
---

# Program Research

Invoke the `greyhatcc:program-research` skill for program: {{ARGUMENTS}}

This automates Phase 0 of any bug bounty engagement:
1. **Browse** the program page via Playwright (renders JS-heavy HackerOne pages)
2. **Extract** scope, bounty table, exclusions, rules, response targets, stats
3. **Research** tech stack, previous disclosures, company intel via Perplexity + WebSearch
4. **Lookup** framework-specific security docs via Context7
5. **Create** full engagement directory with scope.md, attack_plan.md, state files
6. **Initialize** scope.json for all greyhatcc hooks (scope validation, finding tracking)

**What Gets Extracted:**
- Complete in-scope and out-of-scope asset lists with asset types
- Bounty table: severity tiers, minimum/maximum payouts, bonus criteria
- Program exclusions: specific vulnerability types they will not accept
- Rules of engagement: required headers, test account usage, rate limit policies
- Response SLA targets: time to first response, triage, bounty, resolution
- Program statistics: reports resolved, average bounty, response efficiency
- Required report format: any program-specific submission requirements
- Test accounts: credentials or signup procedures for authenticated testing

**Intel Gathering:**
- Company acquisitions and subsidiary domains
- Technology stack from job postings, BuiltWith, Wappalyzer
- Previous disclosed reports from hacktivity for pattern analysis
- Known CVEs affecting their disclosed tech stack
- Organizational structure and key engineering contacts
