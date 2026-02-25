---
name: context-loader
description: Shared context injection pattern - loads scope, findings, program guidelines, recon artifacts, and engagement state for any skill invocation
---

# Context Loader (Internal Skill)

**This skill is not invoked directly.** It defines the context-loading pattern that ALL other skills MUST follow.

## Why This Exists

Skills that operate without context produce hallucinated reports, miss chaining opportunities, duplicate work, test out-of-scope targets, submit excluded vuln types, and ignore existing findings. Every skill invocation must begin by loading the engagement state, the operational guidelines, AND the program's specific rules about what counts and what doesn't.

## Context Loading Protocol

### 1. Determine the Engagement

From the user's input, identify the program/target. The program directory is:
```
bug_bounty/<program>_bug_bounty/
```

### 2. Load Guidelines (Parallel Reads — First Priority)

Guidelines define HOW we operate. Load these before anything else:

| File | Purpose | Required By |
|------|---------|-------------|
| `CLAUDE.md` | Master operating guidelines — persona, methodology, attack vectors, chaining philosophy, WAF bypass playbook, report format, evasion techniques | ALL skills |
| `greyhatcc/agents/templates/base-agent.md` | Core agent principles — validation-first, scope enforcement, parallel execution | ALL agent delegations |
| `greyhatcc/agents/templates/tier-instructions.md` | Tier behavior (LOW/MEDIUM/HIGH) — what each tier can and cannot do | ALL agent delegations |

Key guidelines to extract and inject:
- **Core principles**: Think like XBOW, depth over breadth, chain everything, business logic first, parallel execution
- **Required methodology**: 60-70% effort on recon, validate every finding with deterministic proof, never report a low alone
- **Attack vector knowledge**: OAuth/OIDC abuse, GraphQL exploitation, race conditions, SSRF chains, request smuggling, SSTI, supply chain
- **WAF bypass techniques**: HPP, oversized requests, encoding tricks, content-type switching, CDN-specific bypasses
- **Rate limit evasion**: Header rotation, HTTP/2 sync, GraphQL alias batching, IP rotation
- **Report quality bar**: Title format, TLDR structure, business-focused impact, remediation with code

### 3. Load Program Guidelines (CRITICAL — This Gets Reports Accepted or Rejected)

From `scope.md`, extract and structure these three categories:

#### 3a. In-Scope Assets (What You CAN Test)
Extract every asset with its exact name, type, and notes:
```
ASSETS:
- asset_name (type) — notes/restrictions
- asset_name (type) — notes/restrictions
```
**Use the EXACT asset name from the program when referencing targets in reports and findings.**

#### 3b. Program Rules (How You Must Test)
Extract every rule that constrains testing behavior:
```
RULES:
- Required headers: e.g., "X-HackerOne-Research: overtimedev"
- Account restrictions: e.g., "Sign up with @wearehackerone.com email only"
- Test account requirements: e.g., "Use provided test credentials on UAT"
- Validation requirements: e.g., "UAT findings must be reproducible on prod"
- Static analysis rules: e.g., "APK analysis must be validated against latest prod build"
- Rate limits: e.g., "10 req/s max"
- Prohibited methods: e.g., "No DoS, no social engineering"
- Scope boundaries: e.g., "Ask program team BEFORE testing unscoped subdomains"
```

#### 3c. Non-Qualifying / Exclusions (What Will Get You Rejected)

**This is the most important section. Every finding MUST be checked against this list before writing a report.**

Extract the FULL exclusion list. Real examples from programs:

```
NON-QUALIFYING (will be marked N/A, Informational, or Won't Fix):
- Missing SSL/TLS best practices
- Missing email best practices (SPF/DKIM/DMARC)
- Missing cookie flags (non-security)
- Missing X-Frame-Options / clickjacking
- Rate limiting (unless ATO or financial damage)
- Open redirect (unless additional security impact)
- Self XSS / File Upload XSS
- User enumeration
- Vulnerable libraries without working PoC
- CORS issues without data exfiltration proof
- Info disclosure on test/UAT environments
- Content injection with minimal impact
- CSRF with low security implications
- Host header issues without PoC
- Banner grabbing / stack traces from public repos
- SPF misconfigurations
- robots.txt disclosure
- CSP unsafe-inline
- Root detection / Jailbreak detection / SSL Pinning bypass
- ... (program-specific exclusions)
```

**For every finding, answer**: "Is this on the exclusion list?" If YES, you have three options:
1. **Don't submit** — it's excluded, move on
2. **Prove the exclusion doesn't apply** — e.g., "CORS without data exfil" is excluded but you HAVE a working PoC that exfils data
3. **Chain it** — the excluded low becomes part of a higher-severity chain

#### 3d. Bounty Table (What's It Worth)
Extract the bounty ranges:
```
BOUNTY TABLE:
- Critical: $X - $Y
- High: $X - $Y
- Medium: $X - $Y
- Low: $X - $Y
```
This informs severity calibration and whether a finding is worth the submission effort.

### 4. Load Engagement Context (Parallel Reads)

Every skill MUST read these files if they exist:

| File | Purpose | Required By |
|------|---------|-------------|
| `bug_bounty/<program>_bug_bounty/scope.md` | Source for all program guidelines above | ALL skills |
| `bug_bounty/<program>_bug_bounty/findings_log.md` | All findings to date (dedup, chaining, gadget awareness) | ALL skills |
| `.greyhatcc/scope.json` | Machine-readable scope for automated validation | ALL skills |

### 5. Load Phase-Specific Context

Depending on what the skill does, also read:

| File/Directory | Purpose | Required By |
|----------------|---------|-------------|
| `bug_bounty/<program>_bug_bounty/recon/` | Recon artifacts (subdomains, tech stack, Shodan, JS analysis) | webapp-testing, api-testing, exploit-assist, hunt, js-analysis |
| `bug_bounty/<program>_bug_bounty/reports/*.md` | Existing reports (cross-reference, avoid dupes, chain linking) | h1-report, report-writing, findings-log, dedup-checker |
| `bug_bounty/<program>_bug_bounty/evidence/` | Evidence files for findings | h1-report, report-writing |
| `bug_bounty/<program>_bug_bounty/gadgets.json` | Gadget inventory for vulnerability chaining | ALL testing/exploitation skills |
| `bug_bounty/<program>_bug_bounty/tested.json` | What has been tested (avoid redundant work) | ALL testing skills |
| `bug_bounty/<program>_bug_bounty/attack_plan.md` | Prioritized attack plan with target ranking | hunt, bug-bounty-workflow |
| `bug_bounty/<program>_bug_bounty/notes/` | Researcher notes, observations, hunches | ALL skills |
| `bug_bounty/<program>_bug_bounty/submissions.json` | Previously submitted reports with H1 IDs and status | dedup-checker, h1-report |

### 6. Load Memory Context

Check persistent memory for target-specific learnings:

| File | Purpose |
|------|---------|
| `~/.claude/projects/-Users-overtime-pentest/memory/MEMORY.md` | Cross-session learnings — target-specific notes, key lessons, tool notes |

Search memory for the program name — previous sessions may have documented target-specific behaviors (e.g., "Akamai WAF blocks curl", "api-au.syfe.com has weakest CORS", "Bumba Cognito pools exposed").

### 7. Inject Into Agent Prompts

When delegating to a subagent via the Task tool, the prompt MUST include:

```
## Guidelines
- Core principles: [extracted from CLAUDE.md — chain everything, validate with proof, business logic first]
- Methodology: [relevant methodology section for this task type]
- Report quality bar: [title format, evidence requirements]

## Program Guidelines
- Program: <program_name> (<HackerOne URL if known>)
- Operator: overtimedev
- In-scope assets:
  <list each asset with EXACT name and type from scope.md>
- Exclusions:
  <FULL exclusion list from scope.md — every non-qualifying vuln type>
- Program rules:
  <all testing constraints — required headers, account rules, validation rules>
- Bounty range: <tier table from scope.md>

## Current Engagement State
- Existing findings: <summary of findings_log.md with IDs, severities, and statuses>
- Previously submitted: <summary of submissions.json — H1 IDs, statuses, to avoid dupes>
- Gadget inventory: <summary of gadgets.json — what can be chained>
- Recon completed: <what recon artifacts exist>
- Already tested: <summary of tested.json — what to skip>
- Program directory: bug_bounty/<program>_bug_bounty/

## Target-Specific Notes
- <any relevant notes from MEMORY.md for this target>
```

**Do NOT just say "read the scope file"** — subagents may not know where it is or may skip it. Include the actual extracted data in the prompt. This is the single most important thing for agent quality.

### 8. Scope & Eligibility Validation Gate

Before any testing action or report submission, verify ALL of these:

1. **Asset check**: Target is in the authorized asset list from scope.md
2. **Exclusion check**: Target is NOT in the exclusion list
3. **Vuln type check**: The vulnerability type is NOT on the "non-qualifying" list (unless you can prove it doesn't apply or you're chaining it)
4. **Method check**: Testing method is not prohibited by program rules
5. **Header check**: Required research headers are included in all requests
6. **Account check**: You're using the correct account type per program rules
7. **Environment check**: If testing on UAT, finding must reproduce on prod (if rules require it)
8. **Dedup check**: Finding hasn't already been submitted (check submissions.json and findings_log.md)
9. **Quality check**: Finding has deterministic proof (working PoC, not theoretical)

**If any check fails, STOP and inform the user. Don't auto-submit.**

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## File-by-File Loading Protocol

Load files in this exact order. Each step depends on the previous:

### Step 1: Root Configuration (BLOCKING — must succeed)
```
File: CLAUDE.md
Action: READ
Required: YES (always exists in workspace root)
Extract: Core principles, methodology, attack vectors, WAF bypass, report format
On Missing: FATAL — this file must exist. Alert user.
```

### Step 2: Engagement Identification (BLOCKING — must succeed)
```
File: bug_bounty/<program>_bug_bounty/scope.md
Action: READ
Required: YES for any testing activity
Extract: Assets, exclusions, rules, bounty table, platform info
On Missing: WARN user → suggest /greyhatcc:program or /greyhatcc:scope first → STOP testing
On Partial: If scope.md exists but has empty sections, WARN about incomplete setup
```

### Step 3: Machine-Readable Scope (NON-BLOCKING)
```
File: .greyhatcc/scope.json
Action: READ
Required: NO (scope.md is authoritative, scope.json is for automation)
Extract: authorized domains/IPs, excluded vulnTypes, rules, bountyTable
On Missing: WARN → suggest /greyhatcc:scope import → continue with scope.md data
```

### Step 4: Engagement State Files (CREATE IF MISSING)
```
File: bug_bounty/<program>_bug_bounty/findings_log.md
Action: READ or CREATE
Required: YES
On Missing: CREATE with template:
  # Findings Log: <Program Name>
  | # | Date | Asset | Title | Severity | Status | Report |
  |---|------|-------|-------|----------|--------|--------|

File: bug_bounty/<program>_bug_bounty/gadgets.json
Action: READ or CREATE
Required: YES
On Missing: CREATE with: {"program": "<program>", "last_updated": "<today>", "gadgets": [], "chains": []}

File: bug_bounty/<program>_bug_bounty/tested.json
Action: READ or CREATE
Required: YES
On Missing: CREATE with: {"program": "<program>", "last_updated": "<today>", "tested": [], "coverage": {}}

File: bug_bounty/<program>_bug_bounty/submissions.json
Action: READ or CREATE
Required: YES
On Missing: CREATE with: {"submissions": []}
```

### Step 5: Hunt State (NON-BLOCKING)
```
File: .greyhatcc/hunt-state.json
Action: READ
Required: NO (only exists during active hunts)
Extract: active phase, current target, pending findings, blockers
On Missing: Not in hunt mode — proceed normally
On Found: Resume from last phase, check lastActivity timestamp
```

### Step 6: Phase-Specific Context (CONDITIONAL)
```
File: bug_bounty/<program>_bug_bounty/recon/*
Action: READ (if skill requires recon data)
Required: CONDITIONAL — required by testing/exploitation skills
On Missing: WARN that recon hasn't been done → suggest Phase 1 first
Files to check:
  - recon/subdomains.txt (subdomain list)
  - recon/tech_stack.md (technology fingerprint)
  - recon/dns_records.md (DNS data)
  - recon/shodan_*.md (Shodan intelligence)
  - recon/js/ (JS analysis output)
  - recon/api/ (API discovery output)
  - recon/cloud/ (Cloud recon output)
  - recon/waf_detection.md (WAF/CDN detection)

File: bug_bounty/<program>_bug_bounty/reports/*.md
Action: READ filenames + titles (not full content unless needed)
Required: CONDITIONAL — required by report-writing/dedup skills
On Missing: No reports written yet — this is fine for early phases

File: bug_bounty/<program>_bug_bounty/evidence/*
Action: READ directory listing
Required: CONDITIONAL — required by h1-report and report-writing
On Missing: No evidence captured yet

File: bug_bounty/<program>_bug_bounty/attack_plan.md
Action: READ
Required: CONDITIONAL — required by hunt and bug-bounty-workflow
On Missing: WARN → suggest creating one after recon
```

### Step 7: Memory Context (NON-BLOCKING)
```
File: ~/.claude/projects/-Users-overtime-pentest/memory/MEMORY.md
Action: READ + search for program name
Required: NO
Extract: Target-specific learnings from previous sessions
On Missing: No persistent memory — first session for this target
```

### Handling Partial State

When resuming an engagement that was partially completed:

| State Indicator | Meaning | Action |
|----------------|---------|--------|
| scope.md exists, no recon/ | Program researched, recon not started | Start at Phase 1 recon |
| recon/ exists, empty tested.json | Recon done, testing not started | Start at Phase 2 testing |
| tested.json has entries, empty findings_log | Testing started, no vulns found yet | Continue testing |
| findings_log has entries, no reports/ | Vulns found, reports not written | Start reporting phase |
| reports/ has files, empty submissions.json | Reports written, not submitted | Review and submit |
| hunt-state.json exists, active=true | Hunt was interrupted | Resume from hunt-state phase |

## File Not Found Behavior

If a context file doesn't exist:
- `CLAUDE.md` missing → This should never happen. It's the workspace root file.
- `scope.md` missing → WARN the user, suggest running `/greyhatcc:scope` first. Do NOT proceed with testing.
- `findings_log.md` missing → Create it with the header template. This is the first finding.
- `gadgets.json` missing → Create it with empty structure `{"gadgets": [], "chains": []}`.
- `tested.json` missing → Create it with empty structure `{"tested": []}`.
- `submissions.json` missing → Create it with empty structure `{"submissions": []}`.
- `recon/` missing → WARN that recon hasn't been done, suggest Phase 1 first.
- `attack_plan.md` missing → WARN, suggest creating one.

## Pattern for Skill Authors

Every skill should start with this block:

```markdown
## MANDATORY: Load Context First
Before executing this skill, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md + agent templates (methodology, operating principles)
2. Load program guidelines: scope.md → extract assets, exclusions, rules, bounty table
3. Load engagement state: findings_log.md, submissions.json, scope.json
4. Load phase-specific: recon artifacts, reports, evidence, gadgets.json, tested.json
5. Load memory: Check MEMORY.md for target-specific learnings from previous sessions
6. Validate scope + eligibility: Confirm target is in-scope, vuln type is not excluded, finding is not a dupe
```

## Anti-Patterns (What Goes Wrong Without This)

| Without Context | What Happens |
|-----------------|-------------|
| No scope.md | Agent tests out-of-scope assets, report gets rejected |
| No exclusion list | Agent submits "missing HSTS" to a program that explicitly excludes it → instant N/A |
| No program rules | Agent tests without required headers → finding isn't reproducible by triage |
| No findings_log.md | Agent reports duplicate findings, misses chaining opportunities |
| No submissions.json | Agent re-submits a finding already on H1 → duplicate, reputation damage |
| No CLAUDE.md guidelines | Agent operates at basic scanner level, misses business logic, doesn't chain |
| No recon artifacts | Agent starts testing blind, misses known tech stack, duplicates recon |
| No gadgets.json | Agent can't identify chaining potential, reports lows instead of chained mediums |
| No tested.json | Agent re-tests endpoints already covered, wastes time |
| No memory | Agent repeats mistakes from previous sessions (e.g., using curl against Akamai) |
| No bounty table | Agent wastes time on a $25 low when there's a $1500 critical available |

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
