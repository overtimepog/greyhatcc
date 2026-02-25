---
name: common-dupes
description: Database of commonly rejected finding types across bug bounty programs - check before wasting time on a finding that will be marked N/A
---

# Common Dupes Database

## Usage
`/greyhatcc:dupes <finding_description>`
`/greyhatcc:dupes list` — show all patterns

Checks a finding description against a curated database of findings that are commonly rejected across bug bounty programs. Saves you from writing a report that will be marked N/A, Informational, or Won't Fix.

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
