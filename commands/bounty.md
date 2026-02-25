---
name: bounty
description: "Start a bug bounty workflow for a target program"
aliases:
  - bb
  - bugbounty
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<program handle>"
skill: greyhatcc:bug-bounty-workflow
---

# Bug Bounty Workflow

Invoke the `greyhatcc:bug-bounty-workflow` skill for program: {{ARGUMENTS}}

Orchestrates a complete bug bounty engagement from program selection through report submission:

**Workflow Phases:**
1. **Scope Setup** - Extract program scope, exclusions, bounty table, and rules via Playwright
2. **Recon** - Full 5-phase reconnaissance against all in-scope assets
3. **Attack** - Systematic vulnerability testing prioritized by asset value and ROI
4. **Validate** - Confirm exploitability, check for duplicates, maximize chains
5. **Report** - Generate H1-ready reports for validated findings only

**Program Selection Criteria:**
- Asset density: programs with many subdomains and large wildcard scope
- Complex tech stacks: GraphQL, OAuth, microservices, multi-tenant architectures
- Recent acquisitions: newly acquired companies have the weakest security posture
- Payout ceiling: prioritize programs with high maximum bounties
- Program age: new programs (first 2-4 weeks) have the highest ROI
- Response efficiency: favor programs with fast triage and fair severity ratings

**Engagement Lifecycle:**
- Creates full engagement directory with scope.json, attack_plan.md, and state files
- Tracks tested endpoints and vuln classes to avoid redundant work
- Builds gadget inventory from every finding for chain analysis
- Runs dedup checks against internal log, hacktivity, and common rejection patterns
- Generates H1-ready reports with CVSS rationale and business impact

All engagement state persists across sessions for continuous hunting.
