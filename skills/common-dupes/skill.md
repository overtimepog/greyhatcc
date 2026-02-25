---
name: common-dupes
description: Database of commonly rejected finding types across bug bounty programs - check before wasting time on a finding that will be marked N/A
---

# Common Dupes Database

## Usage
`/greyhatcc:dupes <finding_description>`
`/greyhatcc:dupes list` — show all patterns

Checks a finding description against a curated database of findings that are commonly rejected across bug bounty programs. Saves you from writing a report that will be marked N/A, Informational, or Won't Fix.

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## How It Works

The database is implemented in `scripts/lib/dupes.mjs` and contains 24+ patterns categorized by rejection confidence:

### Confidence Levels

| Level | Rejection Rate | What To Do |
|-------|---------------|------------|
| **ALWAYS_REJECTED** | 95%+ | Don't submit. Only worth it if chained into something bigger. |
| **USUALLY_REJECTED** | 70-95% | Need very strong PoC + demonstrated impact to overcome. |
| **SOMETIMES_REJECTED** | 40-70% | Program-dependent. Check program's exclusion list and hacktivity. |
| **CONTEXT_DEPENDENT** | Varies | Entirely depends on the depth of your proof and impact. |

### ALWAYS_REJECTED (Don't Even Bother)

| Pattern | Why Rejected | Chain Opportunity |
|---------|-------------|-------------------|
| Missing HSTS | Universally excluded | HTTP downgrade + session hijack + cookie theft |
| Missing X-Frame-Options / Clickjacking | Universally excluded | Clickjack + sensitive action (password change) |
| Missing/weak CSP | Not a vulnerability alone | XSS + CSP bypass = full exploitation |
| Missing SPF/DKIM/DMARC | Not a web vulnerability | None — move on |
| Missing cookie flags | Universally excluded | XSS + missing HttpOnly = session theft |
| robots.txt / sitemap.xml disclosure | Public by design | None — move on |
| Weak SSL/TLS ciphers | Universally excluded | None practical |
| Server version disclosure | Not a vulnerability alone | Version + known CVE with working exploit |
| Self-XSS | Requires victim action | Self-XSS + CSRF = forced execution |
| Root/jailbreak detection bypass | The bypass isn't the bug | What you find AFTER bypass is the bug |

### USUALLY_REJECTED (Need Strong Proof)

| Pattern | Why Usually Rejected | How to Overcome |
|---------|---------------------|-----------------|
| Open redirect (standalone) | Low impact alone | Chain with OAuth token theft or SSRF |
| CORS without data exfil PoC | Theoretical without proof | Build working HTML page that reads data cross-origin |
| User enumeration | "By design" for most programs | Show bulk enumeration of ALL users or admin accounts |
| Content/HTML injection | No script execution | Escalate to stored XSS or credential phishing |
| CSRF on login/logout/preferences | Low impact | Chain login CSRF + self-XSS |
| Missing rate limiting (generic) | Excluded unless exploitable | Show OTP brute force, account takeover, or financial drain |
| Verbose errors / stack traces | Informational | Chain with leaked internal paths + LFI/SSRF |
| Outdated library without exploit | Theoretical | Write a working exploit against the target |

### SOMETIMES_REJECTED (Program-Dependent)

| Pattern | When Accepted | When Rejected |
|---------|--------------|---------------|
| Host header injection | Cache poisoning or password reset hijack | Simple reflection without impact |
| Subdomain takeover | Demonstrated claim with proof page | Dangling CNAME without claim proof |
| GraphQL introspection | Reveals sensitive mutations/data | Schema is already documented |
| Exposed actuator | /env, /heapdump leak secrets | /health and /info only |

### CONTEXT_DEPENDENT (Quality of Proof Decides)

| Pattern | Critical Version | N/A Version |
|---------|-----------------|-------------|
| IDOR | Cross-user PII access with enumerable IDs | Reading your own data with different ID format |
| SSRF | Cloud metadata + IAM cred extraction | DNS callback only, no response data |
| CSRF | Account takeover via password/email change | Preference toggle, language change |
| Prototype pollution | Server-side PP → RCE, or client-side PP → XSS | PP in library with no exploitable gadget |
| Information disclosure | Leaked credentials, PII, internal IPs leading to SSRF | Generic error messages, public repo info |
| Race condition | Double-spend on payments, OTP brute force | Like button count inflation, non-critical counters |

### Program-Specific Exceptions

Some programs have unique acceptance/rejection patterns. Always check the specific program's exclusion list and hacktivity:

| Pattern | Exception Programs | Notes |
|---------|-------------------|-------|
| Open redirect | Some fintech programs accept standalone | Financial apps: phishing risk is higher |
| User enumeration | Healthcare/HIPAA-regulated programs | Patient/user existence is sensitive in healthcare |
| Missing rate limiting | Programs with payment/financial flows | Brute force on OTP = account takeover |
| GraphQL introspection | Programs with sensitive internal schemas | When schema reveals admin mutations or PII fields |
| Subdomain takeover (no claim) | Some programs accept evidence-only | If program policy says "do not claim subdomains" |

### Chain-Only Escalation Paths

When a finding matches a rejected pattern, these are the escalation paths to turn it into an accepted report:

| Rejected Pattern | Chain With | Escalated To |
|-----------------|-----------|--------------|
| Self-XSS | CSRF on same form | Forced XSS execution → session hijack (HIGH) |
| Open redirect | OAuth redirect_uri on same domain | Token theft → ATO (CRITICAL) |
| Missing cookie flags (HttpOnly) | XSS on same domain | Session cookie theft via document.cookie (HIGH) |
| Missing X-Frame-Options | Sensitive action page (password change, transfer) | Clickjacking → unauthorized action (MEDIUM-HIGH) |
| User enumeration | Credential stuffing with breach data | Bulk account compromise (HIGH) |
| CORS without exfil | Subdomain takeover on trusted origin | Cross-origin authenticated data theft (HIGH) |
| Content injection | Credential phishing via injected login form | Credential theft (MEDIUM-HIGH) |
| Server version disclosure | Known CVE with working exploit for that version | RCE/auth bypass (CRITICAL) |
| Missing rate limiting | OTP/2FA endpoint brute force | Account takeover via OTP bypass (HIGH) |
| Verbose errors/stack traces | Leaked internal paths + LFI/SSRF on same host | Internal file read / SSRF pivot (HIGH) |
| GraphQL introspection | Hidden admin mutations + auth bypass | Unauthorized admin actions (HIGH-CRITICAL) |
| Root/jailbreak detection bypass | Discovered hardcoded credentials in app | Credential theft → backend access (HIGH) |
| SSL pinning bypass | MitM reveals undocumented API with auth flaws | API exploitation (varies) |

## Usage in Code

The database is also available programmatically via the finding-tracker hook and report-validator hook. Both automatically check findings against these patterns and warn before you invest time in a report.

## Maintenance

This database should be updated when:
- A new finding type gets consistently rejected across multiple programs
- A previously-rejected type starts getting accepted (new attack chains, new impact demonstrations)
- Program-specific exclusion patterns are identified

## Delegation
- No delegation needed — this is a lookup tool
- Results feed into: `/greyhatcc:dedup`, `/greyhatcc:validate`, report-validator hook


## Agent Dispatch Protocol
When delegating to agents via Task(), ALWAYS:
1. **Prepend worker preamble**: "[WORKER] Execute directly. No sub-agents. Output ≤500 words. Save findings to disk. 3 failures = stop and report."
2. **Set max_turns**: haiku=10, sonnet=25, opus=40
3. **Pass full context**: scope, exclusions, existing findings, recon data
4. **Route by complexity**: Quick checks → haiku agents (-low). Standard work → sonnet agents. Deep analysis/exploitation → opus agents.

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
