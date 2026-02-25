---
name: hunt
description: Full autonomous bug bounty hunting - orchestrates the complete lifecycle from target selection to report submission with context-aware state management
---

# Autonomous Bug Bounty Hunt

## Usage
`/greyhatcc:hunt <program_name or HackerOne URL>`

## This is the "autopilot" of pentesting.

## MANDATORY: Load Context First
Before executing, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (full methodology — 5-phase recon, attack vectors, chaining, WAF bypass, report format)
2. If resuming: load scope.md, findings_log.md, gadgets.json, tested.json, submissions.json, attack_plan.md
3. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## Orchestration

Delegate to the `bounty-hunter` agent (opus) which orchestrates the full lifecycle:

```
Task(
  subagent_type="greyhatcc:bounty-hunter",
  model="opus",
  prompt="HUNT: Execute full bug bounty lifecycle for <target>.

  ## Guidelines (from CLAUDE.md)
  - Core: Think like XBOW, depth over breadth, chain everything, business logic first
  - Methodology: 60-70% effort on recon, validate every finding with deterministic proof
  - Never report a low alone when it can be chained

  ## Program Guidelines (from scope.md)
  - In-scope assets: <FULL asset list with exact names and types>
  - NON-QUALIFYING / EXCLUSIONS: <FULL exclusion list — this is critical>
  - Program rules: <required headers, account restrictions, testing constraints>
  - Bounty table: <tier ranges>

  ## Engagement State
  - Existing findings: <summary from findings_log.md>
  - Submissions: <summary from submissions.json>
  - Gadgets: <summary from gadgets.json>
  - Already tested: <summary from tested.json>
  - Recon completed: <what artifacts exist>

  ## Workflow
  Phase 0: Program research and scope setup
    - Extract FULL exclusion list and bounty table into scope.md
    - Create gadgets.json, tested.json, submissions.json
    - Write attack_plan.md

  Phase 1: Multi-agent parallel reconnaissance (60-70% effort)
    - Subdomain enum → then /greyhatcc:takeover on results
    - Port scanning + service enumeration
    - Tech fingerprinting + WAF detection
    - OSINT gathering
    - JS bundle analysis → /greyhatcc:js
    - Cloud asset discovery → /greyhatcc:cloud
    - Update gadgets.json with all informational findings

  Phase 2: Vulnerability hunting (business logic focus)
    - /greyhatcc:auth for OAuth/JWT/Cognito testing
    - /greyhatcc:api for REST/GraphQL endpoint testing
    - /greyhatcc:webapp for OWASP Top 10
    - Check tested.json before each test (avoid redundancy)
    - Update findings_log.md, gadgets.json, tested.json after each finding
    - CHECK EVERY FINDING against exclusion list before proceeding to report

  Phase 3: Chaining and reporting
    - Run /greyhatcc:gadgets chain — identify ALL chaining opportunities
    - Run /greyhatcc:dedup on each finding before writing reports
    - Generate H1 reports via /greyhatcc:h1-report (auto-loads all context)
    - Update submissions.json when submitted

  Use TODO list to track progress.
  Delegate ALL scanning/testing to specialist agents.
  PASS FULL CONTEXT to every agent (scope, exclusions, existing findings, recon).
  NEVER run scans directly."
)
```

## Related Modes

| Mode | Command | Difference |
|------|---------|------------|
| **Hunt** (this) | `/greyhatcc:hunt` | Single-pass: research → recon → test → report |
| **Hunt Loop** | `/greyhatcc:loop` | Persistent loop with triple-verification — doesn't stop until all targets exhausted |
| **Siege** | `/greyhatcc:siege` | Full autonomous: expand → plan → attack → validate → report with self-correction |

Use `/greyhatcc:hunt` for a focused single-program run. Use `/greyhatcc:loop` when you want persistence. Use `/greyhatcc:siege` when you want full autonomy with validation gates.

## Key Principles
- The bounty-hunter agent orchestrates but never implements
- Specialist agents do all the actual work
- **Every agent receives full context** via context-loader protocol (scope, exclusions, findings, recon)
- **Every finding is checked against the exclusion list** before writing a report
- **Every finding is dedup-checked** against findings_log.md and submissions.json
- Findings are validated with deterministic proof before reporting
- Reports combine related findings for maximum impact
- Everything is documented in the standard directory structure
- **State files are updated after every phase** (gadgets.json, tested.json, findings_log.md)

## State Files Managed

| File | Created | Updated By |
|------|---------|-----------|
| `scope.md` | Phase 0 | scope-management |
| `attack_plan.md` | Phase 0 | bounty-hunter |
| `gadgets.json` | Phase 0 | ALL testing skills |
| `tested.json` | Phase 0 | ALL testing skills |
| `submissions.json` | Phase 0 | h1-report, report-writing |
| `findings_log.md` | Phase 1+ | findings-log |
| `recon/*` | Phase 1 | recon, js-analysis, cloud-misconfig |
| `evidence/*` | Phase 2+ | evidence-capture |
| `reports/*` | Phase 3 | h1-report, report-writing |
