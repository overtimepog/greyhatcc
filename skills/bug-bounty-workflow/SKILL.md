---
name: bug-bounty-workflow
description: End-to-end bug bounty workflow from program research through HackerOne-ready report submission
---

# Bug Bounty Workflow

## Usage
`/greyhatcc:bounty <program_name or HackerOne URL>`

## MANDATORY: Load Context First
Before executing, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (full bug bounty methodology section)
2. If resuming an existing engagement: load scope.md, findings_log.md, gadgets.json, tested.json, attack_plan.md
3. Load memory: Check MEMORY.md for target-specific notes from previous sessions

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

## Key Principles
- Validate every finding with deterministic proof before reporting
- 60-70% effort on recon before touching endpoints
- Business logic first: automation handles CVEs, we handle logic
- Chain everything: never report a low alone when it can be chained
