---
name: hunt
description: "Ultra-autonomous bug bounty hunting - the offensive security autopilot"
aliases:
  - h
  - autohunt
  - fullsend
  - siege
  - loop
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<program URL or handle>"
skill: greyhatcc:hunt
---

# HUNT MODE

Invoke the `greyhatcc:hunt` skill for target: {{ARGUMENTS}}

This is the ultimate autonomous bug bounty pipeline. It will:
1. **EXPAND** - Research program + map full attack surface with parallel agents
2. **PLAN** - Prioritize targets by ROI + red-team review for blind spots
3. **ATTACK** - Persistent hunt loop, target-by-target, every vuln class
4. **VALIDATE** - Chain analysis + 5-gate quality pipeline
5. **REPORT** - H1-ready reports for validated findings only

Then **triple-verification** before declaring complete. The hunter doesn't sleep.

Hunt mode is the full-send autonomous offensive pipeline. It combines every other command
into a continuous loop:
- Program research and scope extraction
- Multi-phase recon (subdomains, ports, JS analysis, cloud, OSINT)
- Gadget inventory construction from every low-severity finding
- Systematic webapp and API testing across every in-scope asset
- Automatic chain analysis: does bug A feed into bug B?
- Dedup checks against internal log, hacktivity, and common rejection patterns
- H1-ready report generation only for validated, unique, chain-maximized findings

The loop continues until every in-scope asset has been tested against every relevant
vulnerability class, or until explicitly stopped. Coverage gaps are tracked and
re-attacked in subsequent iterations.
