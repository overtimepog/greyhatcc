---
name: dupes
description: "Check finding against database of commonly rejected bug types"
aliases:
  - common-dupes
  - rejected
allowed-tools: Read, Glob, Grep
argument-hint: "check <finding> | list"
skill: greyhatcc:common-dupes
---

# Common Duplicate Patterns

Invoke the `greyhatcc:common-dupes` skill with: {{ARGUMENTS}}

Checks a finding description against 24+ patterns of commonly rejected findings and advises
whether to submit, chain, or skip.

**Always Rejected (do not submit alone):**
- Missing HSTS header without demonstrated MitM exploitation path
- Missing X-Frame-Options / CSP frame-ancestors without clickjacking PoC on sensitive action
- Missing X-Content-Type-Options without demonstrated MIME sniffing exploitation
- Cookie without Secure flag on HTTPS-only site (no HTTP downgrade path)
- Cookie without HttpOnly flag without XSS chain to steal it
- SPF/DKIM/DMARC misconfiguration without demonstrated email spoofing impact
- CORS misconfiguration with non-credentialed requests only
- Clickjacking on static or non-sensitive pages
- Self-XSS without CSRF or login CSRF chain
- Open redirect without OAuth token theft or phishing chain

**Usually Rejected (submit only with strong chain):**
- Rate limiting absence without demonstrated abuse (brute force, scraping, DoS)
- Verbose error messages / stack traces without sensitive data exposure
- Software version disclosure without associated CVE exploitation
- Directory listing on non-sensitive paths
- Username enumeration without credential stuffing demonstration
- CSRF on non-state-changing or low-impact operations
- Host header injection without cache poisoning or password reset exploitation

**Program-Specific Rejections:**
- Some programs exclude all informational findings regardless of chain
- Some programs exclude third-party service findings (e.g., hosted CDN, SaaS integrations)
- Check program policy page for explicit exclusion lists before submitting

**Verdict Output:**
- SUBMIT: Finding has direct impact, not in any rejection category
- CHAIN: Finding is a known low-value type but has chain potential (add to gadgets)
- SKIP: Finding matches a common rejection pattern with no viable chain path
