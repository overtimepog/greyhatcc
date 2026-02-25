---
name: hunt
description: "Event-driven priority-queue hunt loop for autonomous bug bounty hunting. Iterative, adaptive, signal-driven. From zero to validated H1 reports with continuous intelligence feedback, gadget chaining, and coverage tracking. The hunter doesn't sleep."
---

# HUNT MODE — Staged Pipeline

[HUNT ACTIVATED - AUTONOMOUS OFFENSIVE SECURITY OPERATOR]

Takes a program name or HackerOne URL. Delivers validated, chain-analyzed, HackerOne-ready vulnerability reports.

## User's Target

{{ARGUMENTS}}

## Smart Input

`{{ARGUMENTS}}` is parsed automatically:
- **Program handle** (e.g. `security`) -> used directly with H1 API
- **HackerOne URL** (e.g. `https://hackerone.com/security`) -> extract handle
- **Domain** (e.g. `example.com`) -> used as primary target, attempt H1 lookup
- **`--resume`** flag -> load existing hunt-state/ and continue
- **`--dry-run`** flag -> seed queue and display plan without executing
- **`--focus <type>`** -> prioritize specific vuln class (ssrf, idor, xss, etc.)
- **`--budget <n>`** -> maximum token budget
- **`--time <n>`** -> maximum time in minutes

## Architecture: Thin Skill + Dispatcher + Narrow Workers

This skill is a **thin entry point**. It does NOT carry attack methodology, MCP tool catalogs, or worker playbooks. Those live in:
- `policy/` — centralized rules (worker contracts, severity, evidence, chaining, validation, etc.)
- `stages/` — stage controllers that define what happens in each pipeline phase
- `agents/` — narrow, single-mission workers that know their own tools

```
This skill          Dispatcher agent         Narrow workers
(entry point)  ->   (state + routing)   ->   (single mission each)
     |                    |                        |
     |                    v                        v
     |              hunt-state/ files         policy/ files
     |              (JSON state)             (shared rules)
     |                    |
     v                    v
  stages/            decision-log.md
  (phase defs)       (audit trail)
```

## Execution

### Step 1: Parse Input

Extract program handle from `{{ARGUMENTS}}`. Detect flags (--resume, --dry-run, --focus, --budget, --time).

### Step 2: Check for Resume

If `--resume` or `hunt-state/hunt.json` exists with status "running":
1. Read `hunt-state/current-stage.md` for where we left off
2. Read `hunt-state/next-actions.md` for what to do next
3. Read `hunt-state/decision-log.md` for recent decisions (last 20 lines)
4. Skip to Step 4 with the loaded stage

### Step 3: Initialize (new hunt only)

1. Read `stages/hunt-plan.md` for initialization instructions
2. Pull scope from HackerOne using H1 MCP tools:
   - `h1_program_detail` -> program overview
   - `h1_structured_scopes` -> in-scope and out-of-scope assets
   - `h1_bounty_table` -> payout ranges
   - `h1_program_policy` -> rules and exclusions
3. Initialize hunt-state/ directory and JSON files
4. Write `hunt-state/current-stage.md` with content: `hunt-plan`
5. Write initial `hunt-state/next-actions.md`

### Step 4: Dispatch to Dispatcher

This is the core loop. Dispatch to the dispatcher agent which handles all state management and worker coordination:

```
Task(
  subagent_type="greyhatcc:dispatcher",
  model="opus",
  prompt="Hunt: " + program_handle + "\n" +
    "Stage: " + current_stage + "\n" +
    "Flags: " + flags_summary + "\n" +
    "Resume: read hunt-state/ for full context.\n" +
    "Stage controller: read stages/" + current_stage + ".md\n" +
    "Execute the current stage. Dispatch narrow workers for each work item.\n" +
    "Save state after every item. Write decision-log entries.\n" +
    "When stage is complete, update current-stage.md and return."
)
```

### Step 5: Stage Progression

After the dispatcher returns from a stage:
1. Read `hunt-state/current-stage.md` for the next stage
2. Read the dispatcher's return summary
3. If next stage exists -> go to Step 4
4. If hunt is complete -> go to Step 6

Stage flow:
```
hunt-plan -> hunt-recon -> hunt-test -> hunt-validate -> hunt-confirm -> hunt-report
                 ^              |             |
                 +-- hunt-fix --+             |
                        ^                     |
                        +---------------------+
```

### Step 6: Finalize

1. Print final hunt summary (findings, reports, coverage, cost)
2. Update hunt-state/hunt.json status to "complete"
3. List all reports in hunt-state/reports/

## State Files

All state lives in `hunt-state/` directory. The dispatcher owns these files.

| File | Purpose |
|------|---------|
| `hunt.json` | Top-level HuntState (program, status, stats) |
| `queue.json` | Priority queue of WorkItems |
| `findings.json` | All findings with validation status |
| `surfaces.json` | Discovered attack surface |
| `gadgets.json` | Exploitation primitives with provides/requires |
| `signals.json` | Weak signals for investigation |
| `coverage.json` | Endpoint x vuln-class coverage matrix |
| `current-stage.md` | Human-readable current stage + context |
| `next-actions.md` | Queue head and upcoming work |
| `decision-log.md` | Running audit log of dispatch decisions |
| `intel-log.json` | Intel module run history |
| `reports/` | Generated H1-ready reports |
| `evidence/` | Screenshots, HTTP logs, extracted data |

## Compaction Resilience

This skill is designed to survive context compaction:
- All state is in files, not in chat memory
- The PreCompact hook writes a handoff bundle automatically
- On resume, Step 2 reconstructs context from files alone
- The dispatcher reads policy/ and stages/ files as needed (not carried in prompt)

## Termination

Stop when ANY:
- User requests stop
- Queue empty (all work complete)
- Budget exceeded (if --budget set)
- Time exceeded (if --time set)
- Coverage > 80% of endpoints x vuln classes
- Dispatcher returns with stage "complete"

## Policy References

Workers and the dispatcher read these as needed. They are NOT injected into this skill's context:
- `policy/worker-contract.md` — output format all workers must follow
- `policy/severity.md` — severity definitions and chain uplift
- `policy/evidence-schema.md` — evidence file format
- `policy/queue-schema.md` — work item schema and priority reference
- `policy/mcp-tools.md` — complete MCP tool catalog (71 tools)
- `policy/compaction.md` — compaction protocol
- `policy/recovery.md` — post-compaction recovery steps
- `policy/amplification-rules.md` — signal -> investigation mapping
- `policy/chaining-rules.md` — gadget graph methodology
- `policy/reporting-standards.md` — H1 report format
- `policy/validation-rules.md` — 5-gate validation pipeline
