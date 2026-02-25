---
name: h1-report
description: Format security findings into HackerOne-ready vulnerability reports with automatic scope/asset/evidence injection, CVSS rationale, vulnerability chaining, and program-specific context
---

# HackerOne Report Generator

## Usage
`/greyhatcc:h1-report <finding_id or description> [program_name]`

## MANDATORY: Context Loading (Before Writing Anything)

**Every report MUST begin by loading context. Never write from memory alone.**

### Step 1: Identify the Program
Determine the program from the finding or argument. The program directory is `bug_bounty/<program>_bug_bounty/`.

### Step 2: Read These Files (ALL of them, in parallel)

```
Required reads — do NOT skip any:
1. bug_bounty/<program>_bug_bounty/scope.md          → Scope, assets, exclusions, rules, bounty tiers
2. bug_bounty/<program>_bug_bounty/findings_log.md   → All findings (for chaining + dedup)
3. bug_bounty/<program>_bug_bounty/reports/*.md       → Existing reports (for cross-references)
4. evidence/<finding_id>/*                            → All evidence files for this finding
5. .greyhatcc/scope.json                              → Machine-readable scope (if exists)
```

If any file is missing, note it but continue — do not halt.

### Step 3: Extract Key Context

From the loaded files, extract and hold:
- **Asset name** exactly as listed in scope (e.g., `api-au.syfe.com` not just "the API")
- **Asset type** (URL, Android App, iOS App, Hardware, etc.)
- **Bounty range** for the severity tier you're targeting
- **Program exclusions** — check your finding is NOT on the exclusion list
- **Program rules** — special headers required? Test account restrictions? UAT-to-prod validation?
- **Other findings** — which ones chain with this finding? Which are prerequisites?
- **Evidence files** — curl commands, HTTP responses, screenshots, tool outputs

### Step 4: Scope Validation Gate

**BEFORE writing the report, answer these questions:**
1. Is the affected asset explicitly listed in scope? If NOT → add a `> **HOLD** ...` notice at the top
2. Is the vulnerability type on the exclusion list? (e.g., "CORS without data exfil proof", "open redirect without impact") If YES → either prove it doesn't apply or don't submit
3. Does the finding meet the program's minimum bar? (e.g., "UAT findings must reproduce on prod")
4. Are there related findings that should be combined into one report for higher impact?

---

## Report Structure

The report file is saved to: `bug_bounty/<program>_bug_bounty/reports/<number>_<short_name>.md`

Use sequential numbering matching the findings log.

```markdown
# [Vulnerability Type] in [Exact Asset Name] Allows [Specific Impact to Users/Business]

**Researcher:** overtimedev
**Date:** YYYY-MM-DD
**Asset:** <exact asset name from scope> (<asset type>)
**Program:** <program name> (<HackerOne URL>)

---

## Severity

**<SEVERITY_WORD>**

CVSS v3.1 Vector: `CVSS:3.1/AV:../AC:../PR:../UI:../S:../C:../I:../A:..`
**Score: X.X**

| Metric | Value | Rationale |
|---|---|---|
| Attack Vector | Network/Adjacent/Local/Physical | Why this value |
| Attack Complexity | Low/High | What preconditions exist |
| Privileges Required | None/Low/High | What auth is needed |
| User Interaction | None/Required | Does victim need to act |
| Scope | Unchanged/Changed | Does it cross trust boundaries |
| Confidentiality | None/Low/High | What data is exposed |
| Integrity | None/Low/High | What can be modified |
| Availability | None/Low/High | What is disrupted |

**Every CVSS metric MUST have a written rationale.** Do not just pick values — justify each one with specifics about this vulnerability. Common mistakes to avoid:
- AC:L when a precondition exists (subdomain takeover, specific config, race window)
- S:U when the vuln crosses a trust boundary (e.g., API vuln exploited from different origin)
- PR:N when you actually need a low-priv account
- Inflating C/I/A beyond what the PoC demonstrates

## Vulnerability Type

- **CWE-XXX** — Description (primary)
- **CWE-YYY** — Description (secondary, if applicable)

## TLDR

3 sentences maximum:
1. What is vulnerable and where (exact URL/endpoint)
2. What an attacker can do (specific actions, not generic "compromise")
3. What is the real-world impact (user count, data type, financial exposure, regulatory)

## Description

Detailed technical description. Include:
- The root cause mechanism (not just symptoms)
- Why the vulnerability exists (misconfiguration, logic flaw, missing validation)
- What the attacker controls and what they don't
- Boundary analysis: what works, what doesn't, what's correctly handled
- If this is a chain: explain each link and how they connect

### [Subsection per chain component if applicable]

## Steps to Reproduce

Numbered steps with EXACT commands. Every step must be copy-pasteable.

1. Each step has a specific command (curl, browser action, script)
2. Include ALL required headers (especially program-required research headers)
3. Show expected output after each step
4. Include a test matrix if multiple endpoints/origins/methods were tested

```bash
# Include the program's required research header
curl -sk \
  -H "X-HackerOne-Research: overtimedev" \
  -H "Origin: https://example.com" \
  -D - -o /dev/null \
  "https://target.example.com/endpoint"
```

**Observed response:**
```http
HTTP/2 200
[relevant headers]
```

### PoC Script/Page (if applicable)

Full working PoC code — not pseudocode. Include:
- What it does (comments)
- How to run it
- What output proves exploitation

## Impact

Structure impact by CIA triad categories that apply:

### 1. [Confidentiality Impact] (C:H/L)
Specific data that can be read. Name the data types, estimate scope.

### 2. [Integrity Impact] (I:H/L)
Specific mutations that can be performed. Name the endpoints/actions.

### 3. [Availability Impact] (A:H/L)
What can be disrupted. Quantify if possible.

### Business Impact
- User count affected (if estimable)
- Financial exposure
- Regulatory implications (GDPR, PCI-DSS, SOX, HIPAA, local regs)
- Reputational risk

## Vulnerability Chain Table

**Include this section if ANY other findings relate to this one.**

| Finding | Relationship | Combined Impact |
|---|---|---|
| #XXX — [Title] (Report #XXX) | Prerequisite / Amplifier / Parallel path | How severity changes when combined |

Explicitly answer: "Does bug A produce input for bug B?"

## Suggested Remediation

1. **Immediate** — What to do right now (specific code changes, config changes)
2. **Short Term** — What to do this sprint
3. **Medium Term** — Architectural improvements, CI/CD checks

Include code examples in the target's tech stack when possible (Spring Boot for Java APIs, Express for Node, etc.)

## Raw Evidence

Include verbatim HTTP request/response pairs. Reference evidence files:
```
See: evidence/<finding_id>/request.txt
See: evidence/<finding_id>/response.txt
See: evidence/<finding_id>/screenshot.png
```

## Technical Summary Table

| Property | Value |
|---|---|
| Affected URL | `https://exact-url.com/path` |
| Method | GET/POST/etc |
| Auth Required | Yes (session cookie) / No |
| Backend Framework | Identified tech |
| CDN/WAF | Identified protection |
| CWE | CWE-XXX |
| CVSS v3.1 | Vector — **Score Severity** |

## References

- OWASP reference link
- CWE reference link
- PortSwigger/research reference
- Relevant CVE if applicable
- Regulatory reference if applicable
```

---

## Auto-Validation (Runs Automatically)

After writing the report file, the **report-validator hook** automatically runs and checks:
- Asset name matches scope
- Vuln type not on exclusion list
- Steps to Reproduce exist with curl commands
- Required research headers present
- CVSS score has rationale
- Not a duplicate of existing submission

If the hook reports errors, **fix them before proceeding**. For a full 8-gate validation, run `/greyhatcc:validate <report_file>`.

## Quality Checklist (Verify Before Saving)

Run through this before finalizing:

- [ ] **Title** follows `[Type] in [Asset] allows [Impact]` — is it under 100 chars?
- [ ] **Asset name** matches EXACTLY what's in the program scope
- [ ] **Finding is NOT on the exclusion list** — or you've proven the exclusion doesn't apply
- [ ] **CVSS rationale** exists for every metric — no unjustified values
- [ ] **Steps to Reproduce** are copy-pasteable — includes ALL headers, exact URLs
- [ ] **Program research header** is in every curl command (e.g., `X-HackerOne-Research: overtimedev`)
- [ ] **Impact is specific** — names data types, user actions, not "an attacker could compromise the system"
- [ ] **Evidence files exist** and are referenced
- [ ] **Chain table populated** if other findings relate
- [ ] **Remediation is actionable** — not just "fix the bug" but specific code/config changes
- [ ] **No false positives** — every claim is backed by deterministic proof in the evidence
- [ ] **Scope hold notice** added at top if the asset is questionably in-scope

## Common Rejection Reasons (Avoid These)

| Rejection Reason | How to Prevent |
|---|---|
| "Out of scope" | Verify asset is listed in scope.md. Add HOLD notice if uncertain |
| "Informational" / "N/A" | Prove exploitable impact, not just theoretical. Include working PoC |
| "Duplicate" | Check findings_log.md and existing reports for overlap. If similar, chain instead |
| "Won't fix" / "Accepted risk" | Focus on business impact and regulatory exposure, not just technical severity |
| "Not reproducible" | Steps must be copy-pasteable. Test your own steps before writing |
| "CORS without data exfil" | Always include a PoC page showing actual data read cross-origin |
| "Open redirect without impact" | Chain with OAuth token theft or phishing escalation |
| "Missing cookie flags" | Almost always OOS. Don't submit unless you chain it |
| "Severity inflated" | Justify every CVSS metric. Triage teams downgrade aggressive scoring |

## Delegation

- Standard reports → `report-writer` (sonnet) with this skill as instruction
- Executive/complex chain reports → `report-writer-high` (opus)
- Quick finding notes → `report-writer-low` (haiku) with findings-log skill instead

**The report-writer agent MUST read all context files listed in Step 2 before writing.**
