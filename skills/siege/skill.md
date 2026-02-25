---
name: siege
description: Full autonomous attack mode - from target research to validated, chain-analyzed, and reported findings with self-correction loops and parallel agent dispatch
---

# Siege Mode

## Usage
`/greyhatcc:siege <program_name or HackerOne URL>`

Full autonomous offensive mode. Unlike `/greyhatcc:hunt` which follows a linear workflow, siege uses an expand-plan-attack-validate cycle with self-correction at every stage and smart model routing for token efficiency.

## Architecture

```
EXPAND (Recon Agents)
    → What is the target? What's the full attack surface?
    → Parallel recon agents map everything
PLAN (Prioritize + Red Team Review)
    → Rank targets by ROI (bounty * probability / effort)
    → Review the plan for blind spots and scope violations
ATTACK (Hunt Loop + Parallel Agents)
    → Execute the plan with persistent hunt loop
    → Self-correct on failures, adapt to WAF/rate limits
VALIDATE (Quality Gates Pipeline)
    → Every finding goes through: scope → dedup → proof → quality gate
    → Reject bad findings, fix fixable ones, chain remaining lows
    → Loop back to Attack if coverage gaps found
REPORT (Reporter)
    → Generate H1 reports only for validated findings
    → Final dedup against hacktivity before submission
```

## Phase Details

### 1. Expand Phase
Dispatch parallel agents to map the full attack surface:

| Agent | Task | Tier |
|-------|------|------|
| `recon-specialist` | Full 5-phase recon | Sonnet |
| `osint-researcher-low` | Company OSINT, employees | Haiku |
| `recon-specialist-low` | Shodan + CT logs | Haiku |

All agents write to the same recon directory. No testing yet — recon only.

### 2. Plan Phase
Prioritize and review the attack plan:

1. Read ALL recon artifacts
2. Rank targets by: `ROI = (max_bounty * vuln_probability) / test_effort`
3. Identify zero-report targets (no disclosed vulnerabilities = fresh ground)
4. Map technology to attack vectors (Spring Boot → actuator, GraphQL → introspection/batching, etc.)
5. Write attack_plan.md with numbered, prioritized targets

**Red Team Review**: Before executing, self-review the plan for:
- Missing attack vectors for the identified tech stack
- Scope violations (anything excluded getting tested)
- Low-ROI targets that waste time
- Blind spots in recon coverage

### 3. Attack Phase
Start a persistent hunt loop (`/greyhatcc:loop`) with the validated plan.

Smart model routing for token efficiency:
- **Haiku agents**: Quick checks, header analysis, tech fingerprint, scope validation
- **Sonnet agents**: Testing workflows, exploit development, report writing
- **Opus agents**: Orchestration, chain analysis, complex business logic

### 4. Validate Phase (Quality Gates Pipeline)
Every finding goes through this validation pipeline:

```
Finding → Scope Gate → Exclusion Gate → Dedup Gate → Proof Gate → Quality Gate → ACCEPTED
              ↓              ↓              ↓            ↓             ↓
           REJECTED      REJECTED      REJECTED     RE-TEST      FIX REPORT
              ↓              ↓              ↓            ↓             ↓
           Remove        Chain or       Remove       Update        Re-validate
                         Remove                     evidence
```

**Scope Gate**: Is the asset listed in scope.md?
**Exclusion Gate**: Is the vuln type on the exclusion list? Can it be overcome?
**Dedup Gate**: 6-layer dedup check + hacktivity scrape
**Proof Gate**: Does the PoC actually work when re-run right now?
**Quality Gate**: Does the report have exact asset name, CVSS rationale, copy-pasteable steps?

### 5. Report Phase
Only validated findings reach this phase:
1. Run `/greyhatcc:hacktivity` — final external dupe check
2. Generate report via `/greyhatcc:h1-report`
3. Run `/greyhatcc:validate` on the generated report
4. If validation fails → fix and re-validate (loop)
5. Update submissions.json

## Stealth Routing (Token Efficiency)

When token budget is limited, siege uses tiered routing:
- Quick scope/dedup/exclusion checks → Haiku agents (cheap, fast)
- Testing and exploitation → Sonnet agents (balanced)
- Orchestration and chain analysis → Opus (only when needed)
- Never burn Opus tokens on simple file reads or scope lookups

## Self-Correction Triggers

| Trigger | Response |
|---------|----------|
| Finding rejected by validation gate | Remove or fix, loop back |
| WAF blocking all tests | Switch to Playwright browser automation, try encoding bypass |
| Rate limited | Rotate to different target, return later |
| Context compacting | PreCompact hook saves state, resume from hunt-state.json |
| All targets tested but coverage gaps | Identify untested vuln classes, add to plan |
| Low-only findings | Force chain analysis before reporting |
| PoC stopped working | Re-test with fresh session, update or remove finding |

## Delegation

```
Task(
  subagent_type="greyhatcc:bounty-hunter",
  model="opus",
  prompt="SIEGE MODE: Full autonomous attack for <program>.

  You are in SIEGE MODE. This means:
  1. EXPAND: Dispatch parallel recon agents to map the full attack surface
  2. PLAN: Prioritize targets by ROI, red-team review the plan for blind spots
  3. ATTACK: Start a persistent hunt loop (the hunter doesn't sleep)
  4. VALIDATE: Every finding through scope/dedup/proof/quality gates
  5. REPORT: Only validated findings get H1 reports

  ## Stealth Routing
  - Haiku for quick checks (scope, dedup, headers)
  - Sonnet for testing workflows
  - Opus for orchestration and chain analysis only

  ## Self-Correction
  - Bad findings are caught by validation gates and auto-fixed or removed
  - WAF blocks trigger technique switching
  - Rate limits trigger target rotation
  - Context compacts trigger state recovery from hunt-state.json

  <inject full context per context-loader protocol>
  "
)
```
