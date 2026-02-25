---
name: hunt
description: "Autonomous bug bounty hunting with event-driven priority-queue hunt loop"
aliases:
  - h
  - autohunt
  - fullsend
  - siege
  - loop
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<program URL or handle> [--resume] [--dry-run] [--focus <type>] [--budget <n>] [--time <n>]"
skill: greyhatcc:hunt
---

# HUNT MODE — Event-Driven Hunt Loop

Invoke the `greyhatcc:hunt` skill for target: {{ARGUMENTS}}

This is the **event-driven priority-queue hunt engine** — an iterative, adaptive, signal-driven
bug bounty pipeline that replaces the old 5-phase waterfall.

## How It Works

1. **SEED** — Research program, pull scope from H1, create initial work items
2. **LOOP** — Pop highest-priority item, dispatch to module, process results, enqueue follow-ups
3. **INTEL** — Every 5 items: signal amplification, chain detection, coverage gaps, reprioritization
4. **FINALIZE** — Validate all findings, generate H1-ready reports

## Key Features

- **Priority queue** determines execution order — not fixed phases
- **Six capability modules**: recon, test, exploit, validate, report, intel
- **Dynamic model routing**: haiku for recon, sonnet for testing, opus for exploitation
- **Persistent state**: hunts survive interruptions, compaction, session restarts
- **Signal amplification**: weak signals automatically spawn targeted investigations
- **Gadget chaining**: provides/requires graph for automatic chain discovery

## Options

- `--resume` — Resume a previous hunt from hunt-state/ directory
- `--dry-run` — Seed the queue and show planned work items without executing
- `--focus <type>` — Prioritize a specific vuln class (ssrf, idor, xss, etc.)
- `--budget <n>` — Maximum token budget
- `--time <n>` — Maximum time in minutes
- `--no-intel` — Disable periodic intel module runs

## State

All state persists in `hunt-state/` directory:
- `queue.json` — Priority queue of work items
- `findings.json` — All discovered findings
- `surfaces.json` — Attack surface map
- `gadgets.json` — Exploitation primitives for chaining
- `signals.json` — Weak signals worth investigating
- `coverage.json` — Endpoint × vuln-class coverage tracker
- `reports/` — Generated H1-ready report files
