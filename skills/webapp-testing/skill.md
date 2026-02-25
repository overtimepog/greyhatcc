---
name: webapp-testing
description: OWASP-guided web application security testing covering injection, XSS, auth bypass, IDOR, SSRF, and beyond
---

# Web Application Security Testing

## Usage
`/greyhatcc:webapp <URL>`

## MANDATORY: Load Context First
Before executing, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (attack vectors table, WAF bypass playbook, chaining methodology)
2. Load program guidelines: scope.md → assets, exclusions (check EVERY finding against the non-qualifying list), rules (required headers!), bounty table
3. Load engagement: findings_log.md (dedup + chain awareness), gadgets.json, tested.json (skip already-tested)
4. Load recon: tech_stack.md, subdomains.txt, JS analysis output (api_endpoints.md, secrets_found.md)
5. Load memory: Target-specific notes (WAF type, bypass techniques that worked, rate limit behavior)
6. Validate: Target URL is in scope, check program exclusions before reporting any finding

**Key exclusion check**: Many programs exclude missing headers, cookie flags, clickjacking, self-XSS, user enumeration, rate limiting, open redirects without impact. Check the FULL exclusion list BEFORE writing up any finding.

## Testing Checklist

### Quick Checks (delegate to webapp-tester-low)
- [ ] Security headers analysis (MCP: header_analysis)
- [ ] SSL/TLS configuration (MCP: ssl_analysis)
- [ ] WAF detection (MCP: waf_detect)
- [ ] Cookie security flags
- [ ] CORS policy

### OWASP Top 10 (delegate to webapp-tester)
- [ ] A01: Broken Access Control - IDOR, privilege escalation, forced browsing
- [ ] A02: Cryptographic Failures - weak TLS, exposed secrets
- [ ] A03: Injection - SQL, NoSQL, command, template injection
- [ ] A04: Insecure Design - business logic, race conditions
- [ ] A05: Security Misconfiguration - default creds, verbose errors
- [ ] A06: Vulnerable Components - outdated libraries, known CVEs
- [ ] A07: Auth Failures - brute force, session management
- [ ] A08: Data Integrity - insecure deserialization
- [ ] A09: Logging Failures - insufficient monitoring
- [ ] A10: SSRF - internal service access, cloud metadata

### Advanced (delegate to webapp-tester)
- [ ] CORS misconfiguration exploitation
- [ ] JWT vulnerabilities (none alg, key confusion)
- [ ] GraphQL introspection and batching
- [ ] HTTP request smuggling
- [ ] Cache poisoning
- [ ] WebSocket security
- [ ] API rate limiting bypass

## Evidence Collection
For each finding, capture:
1. Full curl command (reproducible) — include program-required headers (e.g., `X-HackerOne-Research: overtimedev`)
2. HTTP response (relevant portion)
3. Impact demonstration
4. Save to evidence/ directory

## Post-Testing Updates
After each test, update engagement state:
1. **tested.json** — mark endpoint + vuln class as tested with result
2. **findings_log.md** — add any confirmed findings
3. **gadgets.json** — add findings with chaining potential (provides/requires tags)
4. **Run dedup-checker** — before writing a report, verify finding isn't a duplicate
5. **Run chain analysis** — check if new finding chains with existing gadgets

## Delegation
- Quick security checks → `webapp-tester-low` (sonnet)
- OWASP Top 10 + Advanced → `webapp-tester` (opus)
- **Always pass full context** (scope, exclusions, existing findings, recon data) to agents via context-loader pattern
