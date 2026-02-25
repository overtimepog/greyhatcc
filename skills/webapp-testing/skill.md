---
name: webapp-testing
description: OWASP-guided web application security testing covering injection, XSS, auth bypass, IDOR, SSRF, and beyond
---

# Web Application Security Testing

## Usage
`/greyhatcc:webapp <URL>`

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

Also follow the context-loader protocol:
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

### OWASP Top 10 — Specific Test Cases (delegate to webapp-tester)

#### A01: Broken Access Control
- [ ] IDOR on user-specific endpoints (change user ID in URL/body/JWT)
- [ ] Forced browsing to admin panels (`/admin`, `/dashboard`, `/internal`)
- [ ] Method-based access control bypass (GET vs POST vs PUT vs DELETE)
- [ ] Path traversal on file operations (`../../../etc/passwd`)
- [ ] Horizontal privilege escalation (user A accessing user B's data)
- [ ] Vertical privilege escalation (user role to admin role)
- [ ] Missing function-level access control (direct API call to admin-only endpoints)

#### A02: Cryptographic Failures
- [ ] Weak TLS configuration (MCP: `greyhatcc_sec__ssl_analysis`)
- [ ] Sensitive data in URLs (tokens, passwords in query strings)
- [ ] Hardcoded secrets in JS bundles (from js-analysis)
- [ ] Exposed source maps with credentials
- [ ] Weak password storage (if observable via timing or error messages)

#### A03: Injection
- [ ] SQL injection — error-based, UNION, blind boolean, blind time-based
- [ ] NoSQL injection — MongoDB `$gt`, `$regex`, `$where` operators
- [ ] Command injection — `;`, `|`, `&&`, `$(command)`, backticks
- [ ] SSTI — `{{7*7}}`, `${7*7}`, `<%= 7*7 %>` polyglot detection
- [ ] LDAP injection — `*`, `)(`, wildcard expansion
- [ ] XPath injection — `' or '1'='1`
- [ ] Header injection — CRLF `%0d%0a` in header values

#### A04: Insecure Design
- [ ] Business logic bypass — skip workflow steps, replay requests
- [ ] Race conditions — HTTP/2 single-packet on critical operations
- [ ] Price/quantity manipulation — negative values, overflow, type juggling
- [ ] Coupon/promo code abuse — reuse, brute force, race condition
- [ ] Flow manipulation — change order of multi-step processes

#### A05: Security Misconfiguration
- [ ] Default credentials on admin panels, databases, services
- [ ] Verbose error messages leaking stack traces, paths, SQL queries
- [ ] Exposed actuator/debug endpoints (`/actuator/*`, `/debug/*`, `/trace`)
- [ ] Directory listing enabled
- [ ] Unnecessary HTTP methods enabled (TRACE, OPTIONS with sensitive data)
- [ ] Missing security headers (check program exclusions first)

#### A06: Vulnerable Components
- [ ] Identify all libraries and versions (from tech-fingerprint + JS analysis)
- [ ] CVE lookup for each version (MCP: `greyhatcc_sec__cve_search`)
- [ ] Exploit availability check (MCP: `greyhatcc_sec__exploit_db_search`)
- [ ] Known Nuclei templates for detected versions
- [ ] NOTE: "Outdated library without working PoC" is usually EXCLUDED — need working exploit

#### A07: Authentication Failures
- [ ] Brute force protection (lockout after N attempts?)
- [ ] Credential stuffing resistance (rate limiting, CAPTCHA)
- [ ] Session fixation (does login create new session ID?)
- [ ] Session timeout (how long before expiry?)
- [ ] Password reset flow (token predictability, host header injection)
- [ ] JWT vulnerabilities (delegate to `/greyhatcc:auth`)

#### A08: Data Integrity Failures
- [ ] Insecure deserialization (Java/PHP/Python/Node.js endpoints)
- [ ] Missing integrity checks on file uploads
- [ ] Unsigned software updates/patches
- [ ] CI/CD pipeline exploitation (if accessible)

#### A09: Security Logging & Monitoring Failures
- [ ] Exposed log files (`/logs/`, `/var/log/`, application logs)
- [ ] Log injection (CRLF in logged inputs)
- [ ] Sensitive data in logs (tokens, passwords in verbose logging)

#### A10: Server-Side Request Forgery (SSRF)
- [ ] URL parameter manipulation to internal IPs (`127.0.0.1`, `169.254.169.254`)
- [ ] Protocol smuggling (`gopher://`, `dict://`, `file://`)
- [ ] DNS rebinding for SSRF amplification
- [ ] SSRF to cloud metadata endpoints (AWS/GCP/Azure)
- [ ] Blind SSRF detection (DNS callback, timing differences)

### Beyond OWASP — Advanced Tests (delegate to webapp-tester)
- [ ] CORS misconfiguration — origin reflection, null origin, wildcard with credentials
- [ ] JWT vulnerabilities — none alg, RS256-HS256 confusion, kid injection
- [ ] GraphQL introspection, batching, alias abuse, field-level authz, nested DoS
- [ ] HTTP request smuggling — CL.TE, TE.CL, H2.CL, HTTP/2 desync
- [ ] Cache poisoning — unkeyed headers, web cache deception, path confusion
- [ ] WebSocket hijacking — origin check bypass, CSWSH, message injection
- [ ] API rate limiting bypass — header rotation, alias batching, IP rotation
- [ ] Prototype pollution — server-side and client-side chains
- [ ] Subdomain takeover — dangling CNAMEs found in recon (delegate to `/greyhatcc:takeover`)
- [ ] Second-order vulnerabilities — stored payloads triggering in admin contexts
- [ ] HTTP parameter pollution — duplicate params for WAF bypass and logic manipulation
- [ ] Mass assignment — extra fields in JSON bodies (role, isAdmin, price)
- [ ] Host header attacks — password reset poisoning, cache poisoning, routing bypass

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

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
