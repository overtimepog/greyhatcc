---
name: tier-instructions
description: Comprehensive tier behavior definitions with Pattern A (Opus-default) and Pattern B (Sonnet-default) specifications
---

# Agent Tier Definitions

## Tiering Patterns

greyhatcc uses two tiering patterns aligned with OMC conventions:

### Pattern A — Opus Default (Security-Critical Roles)

For roles where mistakes have high consequences: missed vulnerabilities, false reports, flawed exploit logic.

| Tier | Model | Token Budget | Capabilities | Agents |
|------|-------|-------------|-------------|--------|
| Default | **Opus** | High | Deep analysis, novel techniques, business logic testing, complex chains, executive reasoning | webapp-tester, exploit-developer, vuln-analyst, auth-tester, api-tester, proof-validator, report-quality-gate |
| -low | **Haiku** | Minimal | Quick checks, single-step lookups, basic validation, simple extraction | webapp-tester-low, exploit-developer-low, vuln-analyst-low, auth-tester-low, api-tester-low |

**Escalation Protocol**: -low agents MUST escalate when:
- Task requires multi-step reasoning
- Novel technique development needed
- Business logic analysis required
- Result has security implications beyond basic check
- Confidence in result is below 90%

### Pattern B — Sonnet Default (Execution/Recon Roles)

For roles where standard execution suffices for most tasks, with Opus reserved for exceptional complexity.

| Tier | Model | Token Budget | Capabilities | Agents |
|------|-------|-------------|-------------|--------|
| -low | **Haiku** | Minimal | Quick lookups, single-source queries, basic parsing | recon-specialist-low, osint-researcher-low, report-writer-low, network-analyst-low, js-analyst-low, cloud-recon-low |
| Default | **Sonnet** | Standard | Multi-step execution, template adaptation, standard analysis, report writing | recon-specialist, osint-researcher, report-writer, network-analyst, js-analyst, cloud-recon |
| -high | **Opus** | High | Complex multi-source correlation, novel approaches, deep analysis, strategic planning | recon-specialist-high, osint-researcher-high, report-writer-high |

**Escalation Protocol**:
- Haiku → Sonnet: When task needs multi-step reasoning or cross-source correlation
- Sonnet → Opus: When task needs novel approaches, deep analysis, or strategic planning

### Standalone Agents

| Agent | Model | Rationale |
|-------|-------|-----------|
| bounty-hunter | Opus | Top-level orchestrator — manages entire hunt lifecycle |
| hunt-loop-orchestrator | Opus | Phase management — critical state machine |
| scope-manager | Haiku | Simple read/validate operations |
| subdomain-takeover | Sonnet | Single-purpose detection workflow |

## disallowedTools by Tier

| Role | disallowedTools | Rationale |
|------|----------------|-----------|
| Orchestrators | (none) | Need Task tool for agent delegation |
| All others | Task | Execute directly, don't spawn sub-agents |

## Model Selection Guide

When dispatching agents, choose the right tier:

| Scenario | Use Tier | Example |
|----------|---------|---------|
| "Is this IP in scope?" | Haiku | scope-manager |
| "Check if port 443 is open" | Haiku (-low) | network-analyst-low |
| "Run OWASP Top 10 on this endpoint" | Opus (Pattern A) | webapp-tester |
| "Enumerate subdomains for target.com" | Sonnet (Pattern B) | recon-specialist |
| "Map the org's full ASN infrastructure" | Opus (-high) | recon-specialist-high |
| "Develop a custom deserialization exploit" | Opus (Pattern A) | exploit-developer |
| "Quick-check JWT algorithm" | Haiku (-low) | auth-tester-low |
| "Write H1 report for finding F-007" | Sonnet (Pattern B) | report-writer |
| "Executive pen-test report with chains" | Opus (-high) | report-writer-high |

## Token Efficiency Rules

1. **Never use Opus for lookups** — Haiku handles scope checks, port lookups, JWT decode
2. **Never use Opus for template work** — Sonnet handles standard reports, recon execution
3. **Reserve Opus for judgment** — Business logic, novel exploits, chain analysis, quality gates
4. **Parallel dispatch at lowest viable tier** — Run 5 Haiku agents instead of 1 Opus agent where possible
5. **Escalate, don't retry** — If Haiku can't handle it, escalate to Sonnet/Opus instead of retrying
