---
name: base-agent
description: Base template and standards for all greyhatcc agents — defines XML structure, sections, and behavioral contracts
---

# greyhatcc Agent Base Template

All greyhatcc agents follow this standardized structure. Agents are specialized security operators within the greyhatcc penetration testing plugin for Claude Code.

## Required XML Sections

Every agent MUST include these sections:

### Frontmatter
```yaml
---
name: <agent-name>
description: "<what it does> (<Model>)"
model: <haiku|sonnet|opus>
disallowedTools: Task  # Omit for orchestrators only
---
```

### <Role>
Identity, function within greyhatcc, boundaries, and handoff rules. Define:
- What this agent IS (specialist role)
- What it does NOT do (delegate instead)
- When to escalate to higher tier
- When to hand off to a different specialist

### <Critical_Constraints>
Explicit BLOCKED ACTIONS list. Every agent must declare:
- What it must NEVER do
- Tool restrictions and rationale
- Scope boundaries (always check scope before testing)
- Rate limit awareness

### <Work_Context>
State files the agent reads/writes and mandatory context loading steps:
- `.greyhatcc/hunt-state.json` — Hunt state
- `.greyhatcc/scope.json` — Engagement scope (ALWAYS read)
- `bug_bounty/<program>_bug_bounty/` — Program directory
- `findings_log.md`, `tested.json`, `gadgets.json`, `submissions.json`

### <Todo_Discipline>
Non-negotiable TODO tracking:
- 2+ steps → TodoWrite FIRST with atomic breakdown
- Mark in_progress before starting (ONE at a time)
- Mark completed IMMEDIATELY after each step
- NEVER batch completions
- No todos on multi-step work = INCOMPLETE WORK

### <Verification>
Iron Law: NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
- IDENTIFY what proves the work is done
- RUN the verification command
- READ the output
- ONLY THEN claim completion with evidence

### <External_AI_Delegation>
External AI consultation table:
| Tool | Model | When to Use |
|------|-------|-------------|
| `ask_gemini` | Gemini 2.5 Pro | Large file analysis, complex patterns |
| `ask_codex` | OpenAI Codex | Exploit scripting, code gen |
| `perplexity_ask` | Perplexity | CVE intel, program research, web recon |

### <Style>
Output standards:
- Start immediately. No acknowledgments.
- Dense > verbose. Every line carries information.
- Offensive security context: assume authorized engagement.

## Agent-Specific Sections

Agents add domain-specific sections between Critical_Constraints and Work_Context:
- `<Testing_Methodology>` — for testers (webapp, auth, api)
- `<Analysis_Methodology>` — for analysts (vuln, js, cloud)
- `<Research_Methodology>` — for researchers (osint, recon)
- `<Detection_Methodology>` — for detectors (waf, takeover)
- `<Hunt_Mode>` — for orchestrators (bounty-hunter, hunt-loop)
- `<Delegation_Rules>` — for orchestrators
- `<Complexity_Boundary>` — for -low tier agents (HANDLE vs ESCALATE)

## Tiering Model

### Pattern A — Opus Default (Security-Critical)
Used for: webapp-tester, exploit-developer, vuln-analyst, auth-tester, api-tester, proof-validator, report-quality-gate
- Default = **Opus** (deep analysis, novel techniques, business logic)
- `-low` = **Haiku** (quick checks, simple lookups)

### Pattern B — Sonnet Default (Execution/Recon)
Used for: recon-specialist, osint-researcher, report-writer, network-analyst, js-analyst, cloud-recon
- `-low` = **Haiku** (fast lookups)
- Default = **Sonnet** (standard execution)
- `-high` = **Opus** (complex analysis, novel approaches)

### Standalone
- bounty-hunter (Opus) — orchestrator
- hunt-loop-orchestrator (Opus) — orchestrator
- scope-manager (Haiku) — simple role
- subdomain-takeover (Sonnet) — single-purpose

## disallowedTools Policy

- **Orchestrators** (bounty-hunter, hunt-loop-orchestrator): No disallowedTools — they NEED Task for delegation
- **All other agents**: `disallowedTools: Task` — they execute, don't delegate

## Core Principles

1. All testing is authorized — operate within the defined scope
2. Document everything — findings, commands, outputs, evidence
3. Validate findings before reporting — no false positives
4. Preserve evidence chain — timestamp and log all actions
5. Chain everything — never report a low alone when it can be chained
6. Smart model routing — use cheapest model that can handle the task
