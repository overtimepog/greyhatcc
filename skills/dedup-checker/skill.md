---
name: dedup-checker
description: Check if a discovered bug has been previously found, reported, or submitted — prevents duplicate submissions and wasted effort
---

# Duplicate Finding Checker

## Usage
`/greyhatcc:dedup <finding description or vuln type + endpoint>`

Example:
```
/greyhatcc:dedup "CORS misconfiguration on api.example.com"
/greyhatcc:dedup "IDOR on /api/v2/users/{id}"
/greyhatcc:dedup "exposed actuator on api-au.syfe.com"
```

## MANDATORY: Load Context First
Before checking, follow the context-loader protocol:
1. Load scope.md for the target program
2. Load findings_log.md — ALL existing findings
3. Load reports/*.md — ALL existing report filenames and titles
4. Load submissions.json — ALL previously submitted H1 reports
5. Load memory (MEMORY.md) — any cross-session notes about prior submissions

---

## Check Layers (Run ALL of These)

### Layer 1: Local Findings Log
Read `bug_bounty/<program>_bug_bounty/findings_log.md` and check:
- **Exact match**: Same vulnerability type on the same endpoint/asset
- **Root cause match**: Different endpoint, but same underlying root cause (programs pay one bounty per root cause)
- **Related findings**: Same vulnerability class on a different endpoint of the same service (may be consolidated)

Output:
```
LOCAL FINDINGS CHECK:
- Exact match: [YES/NO] — [finding ID if found]
- Root cause match: [YES/NO] — [finding ID if found]
- Related findings: [list any related findings with IDs]
```

### Layer 2: Existing Reports
Read all files in `bug_bounty/<program>_bug_bounty/reports/*.md` (just titles/headers, not full content) and check:
- Does any report already cover this vulnerability?
- Does any report cover the same endpoint?
- Is this finding already included as part of a chain in another report?

Output:
```
EXISTING REPORTS CHECK:
- Covered by report: [YES/NO] — [report filename if found]
- Same endpoint in another report: [YES/NO] — [report filename]
- Part of existing chain: [YES/NO] — [chain description if found]
```

### Layer 3: Submission History
Read `bug_bounty/<program>_bug_bounty/submissions.json` (if exists) and check:
- Has this exact finding been submitted to HackerOne?
- What was the status? (Triaged, Duplicate, N/A, Informational, Resolved, Bounty)
- If it was a dupe — what was the original report ID?

Output:
```
SUBMISSION HISTORY CHECK:
- Previously submitted: [YES/NO]
- H1 Report ID: [ID if submitted]
- Status: [status]
- Date submitted: [date]
- Notes: [any notes about triage response]
```

### Layer 4: Program Exclusion Check
Read `scope.md` exclusion list and check:
- Is this vulnerability TYPE on the non-qualifying list?
- If yes, does the specific finding overcome the exclusion? (e.g., "CORS without data exfil" is excluded but this finding HAS data exfil proof)

Output:
```
EXCLUSION CHECK:
- Vuln type excluded: [YES/NO] — [which exclusion rule]
- Exclusion overcome: [YES/NO] — [how: e.g., "has working PoC with data exfil"]
- Safe to submit: [YES/NO]
```

### Layer 5: Common Dupe Patterns
Check against known patterns that programs frequently mark as duplicates:

| Pattern | Check |
|---------|-------|
| **Same root cause, different endpoint** | "We consider all instances of [vuln] on [service] as one report" |
| **Informational + exploitable** | If an informational version was already submitted, submitting exploitable version may be marked dupe |
| **Cascading findings** | If A causes B causes C, only the root cause gets bounty |
| **Same finding, different severity argument** | Re-submitting a downgraded finding with better impact argument = dupe |
| **Known issues** | Check if program has public disclosure or known issues list |
| **Recently fixed** | If the program recently resolved a similar finding, yours might be the same |

### Layer 6: HackerOne Hacktivity Check (Auto-Invoked)
**This layer is now automated via `/greyhatcc:hacktivity`.**

Run the hacktivity-check skill which uses 3 methods:
1. **Web Search** — `site:hackerone.com/reports "program_name" "vulnerability_type"`
2. **Playwright Scrape** — Navigate to program hacktivity page if public
3. **Perplexity Deep Search** — Broad search across disclosed reports and security blogs

The hacktivity-check skill returns a dupe risk assessment:
- **HIGH** (>70%): Same vuln + same endpoint in disclosed reports
- **MEDIUM** (30-70%): Same vuln + same service, or same tech pattern
- **LOW** (<30%): No matching disclosed reports
- **CLEAR**: No results found at all

### Layer 7: Common Dupes Database (Auto-Invoked)
**This layer is now automated via the `dupes.mjs` library.**

Checks the finding against 24+ patterns of commonly rejected findings:
- ALWAYS_REJECTED (95%+): Missing headers, cookie flags, self-XSS, banner disclosure
- USUALLY_REJECTED (70-95%): Open redirect without chain, CORS without exfil proof
- SOMETIMES_REJECTED (40-70%): Subdomain takeover, GraphQL introspection
- CONTEXT_DEPENDENT: IDOR, SSRF — depends on depth of proof

If a finding matches an ALWAYS_REJECTED pattern, the recommendation is automatically DO NOT SUBMIT unless a chain is identified.

---

## Decision Matrix

After running all checks, output a clear recommendation:

```
## Dedup Check Result

### Finding: [description]
### Program: [program_name]

| Check | Result | Details |
|-------|--------|---------|
| Local findings log | CLEAR/DUPE | [details] |
| Existing reports | CLEAR/DUPE | [details] |
| Submission history | CLEAR/DUPE | [details] |
| Program exclusions | CLEAR/EXCLUDED | [details] |
| Common dupe patterns | CLEAR/RISK | [details] |
| Hacktivity (if checked) | CLEAR/LIKELY_DUPE | [details] |

### Recommendation: [SUBMIT / DO NOT SUBMIT / CHAIN FIRST / NEEDS MORE EVIDENCE]

Reasoning: [why]
```

### Recommendation Values

| Recommendation | When |
|----------------|------|
| **SUBMIT** | All checks clear, finding is unique, has proof, not excluded |
| **DO NOT SUBMIT** | Finding is a confirmed dupe or is on the exclusion list with no override |
| **CHAIN FIRST** | Finding is too low alone or is excluded, but could be chained with another finding to overcome |
| **NEEDS MORE EVIDENCE** | Finding is unique but lacks deterministic proof (theoretical, no PoC) |
| **ASK PROGRAM** | Asset is questionably in-scope, or finding type is borderline excluded |

---

## Submissions Tracking

When a report IS submitted, update `submissions.json`:

```json
{
  "submissions": [
    {
      "id": "S-001",
      "finding_id": "F-006",
      "h1_report_id": null,
      "program": "bumba",
      "title": "Back-office Cognito pool exposed via unauth GraphQL",
      "asset": "exchange-api.bumba.global",
      "vuln_type": "CWE-200",
      "severity": "HIGH",
      "cvss": 7.5,
      "date_submitted": "2026-02-24",
      "status": "pending",
      "triage_response": null,
      "bounty": null,
      "report_file": "reports/006_cognito_backoffice_exposure.md",
      "notes": ""
    }
  ]
}
```

Update the status field as the report progresses through triage:
- `pending` → submitted, waiting for triage
- `triaged` → accepted by triage team
- `duplicate` → marked as dupe (note original report ID)
- `informational` → downgraded to informational
- `na` → marked Not Applicable
- `resolved` → vulnerability fixed
- `bounty` → bounty awarded (note amount)

---

## Integration with Other Skills

This skill is called automatically by:
- **h1-report** — runs dedup check before generating a report
- **findings-log** — runs dedup check when adding a new finding
- **hunt** — runs dedup check on every discovered vulnerability

Manual invocation is for when you want to quickly check before investing time in a full report.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## Delegation
- Quick local dedup → no delegation needed (just file reads)
- Hacktivity research → `osint-researcher-low` (haiku) for fast web search

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
