---
name: hunt-loop
description: Persistent hunting loop - keeps hunting until triple-verification confirms all targets exhausted. The hunter doesn't sleep.
---

# Hunt Loop (Persistent Autonomous Hunting)

## Usage
`/greyhatcc:loop <program_name>`

A self-correcting, persistent execution loop purpose-built for offensive security. Keeps hunting target-by-target until a triple-verification protocol confirms all scope assets have been exhausted and all findings validated.

## How It Works

```
START → Load Context → Phase Check → Execute Phase → Verify → Loop Back
                                                         ↓
                                                    All phases done?
                                                    ↓ NO: Loop back
                                                    ↓ YES: Architect Verify (3x)
                                                    ↓ PASS: Report + Stop
                                                    ↓ FAIL: Loop back
```

## MANDATORY: Context Loading
1. Load `.greyhatcc/hunt-state.json` — if active hunt exists, RESUME from last phase
2. Load scope.md, findings_log.md, gadgets.json, tested.json, submissions.json
3. Load MEMORY.md for target-specific learnings
4. Load attack_plan.md for prioritized targets

## Hunt State Machine

The loop maintains state in `.greyhatcc/hunt-state.json`:

```json
{
  "active": true,
  "phase": "recon",
  "program": "kong",
  "startedAt": "2026-02-25T00:00:00Z",
  "lastActivity": "2026-02-25T01:30:00Z",
  "iteration": 3,
  "currentTarget": "app.insomnia.rest",
  "pendingFindings": [],
  "blockers": [],
  "completedPhases": ["research", "recon"],
  "verificationsPassed": 0,
  "verificationsRequired": 3,
  "compactionCount": 0,
  "phaseResults": {
    "research": { "status": "complete", "assets": 14, "exclusions": 12 },
    "recon": { "status": "complete", "subdomains": 2305, "gadgets": 20 },
    "hunt": { "status": "in_progress", "findings": 6, "tested": 45 },
    "chain": { "status": "pending" },
    "report": { "status": "pending" }
  }
}
```

## Phase Definitions

### Phase 0: Research (if not done)
- Run `/greyhatcc:program` to extract scope, exclusions, bounty table
- Create all state files
- Write attack_plan.md with prioritized targets
- **Gate**: scope.md exists with assets AND exclusions listed → PASS

### Phase 1: Recon (parallel dispatch)
Dispatch these agents in parallel:
- `recon-specialist` → subdomain enum, DNS, tech fingerprint
- `osint-researcher-low` → company OSINT, employee enum
- `recon-specialist-low` → Shodan intelligence
- JS analysis agent → bundle analysis for secrets/endpoints
- Cloud recon agent → bucket/storage enumeration
- **Gate**: attack_plan.md updated with recon findings, gadgets.json has entries → PASS

### Phase 2: Hunt (iterative, target-by-target)
For EACH target in attack_plan.md priority order:
1. Check tested.json — skip if fully tested
2. Run appropriate testing skill (webapp, api, auth, js, cloud)
3. Log findings immediately to findings_log.md
4. Update gadgets.json with provides/requires tags
5. Update tested.json
6. Run `/greyhatcc:dedup` on each finding BEFORE accepting it
7. **Per-target gate**: All vuln classes tested for this target → move to next

### Phase 3: Chain Analysis
- Run `/greyhatcc:gadgets chain` — identify ALL chaining opportunities
- For each chain: verify both ends still work, document the full path
- Combine low-severity findings into medium/high chains
- **Gate**: All chainable gadgets have been analyzed → PASS

### Phase 4: Report
For EACH confirmed finding (not chain, not info-only):
1. Run `/greyhatcc:dedup` — final duplicate check
2. Run proof validation — verify PoC still works
3. Run `/greyhatcc:validate` — report quality gate
4. Generate report via `/greyhatcc:h1-report`
5. Update submissions.json
- **Gate**: All findings have reports, all reports pass validation → PASS

## Verification Protocol (The 3x Rule)

Before stopping the loop, THREE independent verification checks must pass:

### Verification 1: Coverage Check
- All in-scope assets have been tested (checked against scope.md asset list)
- All major vuln classes tested per asset (OWASP Top 10 minimum)
- tested.json covers every asset + every vuln class combination

### Verification 2: Quality Check
- All findings have deterministic proof (curl commands that reproduce)
- No findings are on the exclusion list (or exclusion is overcome with proof)
- All reports pass the report-validator checks
- CVSS scores are justified with per-metric rationale

### Verification 3: Completeness Check
- All chains have been evaluated (gadgets.json chain analysis complete)
- Dedup check passed for every finding
- Submissions.json is up to date
- No pending findings without reports
- No LOW findings that could be chained but weren't

If ANY verification fails → loop back to the failing phase.

## Self-Correction Patterns

| Problem Detected | Auto-Correction |
|-----------------|-----------------|
| Finding on exclusion list | Remove from findings_log, add to gadgets as chain-only |
| PoC no longer works | Re-test, update or remove finding |
| Asset not in scope | Drop finding, warn user |
| CVSS inflated | Recalculate with conservative rationale |
| Missing Steps to Reproduce | Re-run the test, capture exact commands |
| Rate limited | Back off, switch to different target, return later |
| WAF blocking | Switch technique (Playwright, encoding bypass, different path) |
| Hunt state lost (context compact) | Read .greyhatcc/hunt-state.json, resume from last phase |

## Loop Control

### Continue Signal
The default. After each phase gate passes, automatically advance to the next phase.
After all phases complete, run verification. If verification fails, loop back.

### Pause Signal
User says "pause", "stop", "cancel", or "break" → Save state, mark `active: false`

### Resume Signal
User says "resume", "continue", or starts a new session with active hunt-state.json → Resume from last phase

## Implementation

```
Task(
  subagent_type="greyhatcc:bounty-hunter",
  model="opus",
  prompt="HUNT LOOP: Execute persistent bug bounty hunt for <program>.

  ## LOOP RULES
  - You are in a PERSISTENT LOOP. Do NOT stop until 3 verification checks pass.
  - The hunter doesn't sleep. No target left behind.
  - After each phase, update .greyhatcc/hunt-state.json
  - If context compacts, read hunt-state.json to resume
  - Self-correct: if a finding fails validation, fix or remove it
  - Parallel dispatch: use background agents for independent recon tasks

  ## State
  <inject full state from hunt-state.json>
  <inject full context from context-loader protocol>

  ## Current Phase: <phase from hunt-state.json>
  Resume from this phase. Do NOT restart completed phases.

  ## Verification Checklist
  Before stopping, ALL must pass:
  [ ] Coverage: Every scope asset tested for OWASP Top 10
  [ ] Quality: Every finding has working PoC + CVSS rationale
  [ ] Completeness: All chains evaluated, dedup passed, reports written
  "
)
```

## Key Principles
- **Never stop early**: The loop continues until verified complete
- **Self-correcting**: Bad findings are caught and fixed automatically
- **State-persistent**: Survives context compaction via hunt-state.json + PreCompact hook
- **Parallel**: Independent tasks run concurrently via background agents
- **Verification-gated**: 3 independent checks prevent premature completion
- **Context-first**: Every phase loads full engagement state before executing
