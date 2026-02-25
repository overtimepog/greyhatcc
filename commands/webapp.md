---
name: webapp
description: "Run OWASP web application security tests against a URL"
aliases:
  - web
  - owasp
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<URL to test>"
skill: greyhatcc:webapp-testing
---

# Web Application Testing

Invoke the `greyhatcc:webapp-testing` skill for: {{ARGUMENTS}}

Performs comprehensive web application security testing covering the OWASP Top 10 and beyond:

**OWASP Top 10 Coverage:**
1. **A01 Broken Access Control** - IDOR, privilege escalation, forced browsing, CORS misconfig
2. **A02 Cryptographic Failures** - Weak TLS, exposed sensitive data, insecure storage
3. **A03 Injection** - SQLi, NoSQLi, LDAP, OS command, SSTI, expression language
4. **A04 Insecure Design** - Business logic flaws, missing rate limits, enumeration
5. **A05 Security Misconfiguration** - Default creds, verbose errors, directory listing, debug endpoints
6. **A06 Vulnerable Components** - Outdated libraries, known CVEs in dependencies
7. **A07 Authentication Failures** - Credential stuffing, weak lockout, session fixation
8. **A08 Software/Data Integrity** - Insecure deserialization, CI/CD compromise, unsigned updates
9. **A09 Logging Failures** - Missing audit trails, log injection
10. **A10 SSRF** - Cloud metadata access, internal service discovery, protocol smuggling

**Beyond OWASP:**
- CORS misconfiguration with credential reflection and null origin bypass
- CSRF on state-changing operations with token bypass techniques
- HTTP request smuggling (CL.TE, TE.CL, H2.CL, HTTP/2 desync)
- WebSocket security: CSWSH, message injection, origin validation bypass
- GraphQL: introspection abuse, batching attacks, nested query DoS, field-level authz
- JWT attacks: algorithm confusion, kid injection, JKU/X5U manipulation, none algorithm
- Cache poisoning: unkeyed headers, parameter cloaking, fat GET requests
- Prototype pollution: server-side and client-side chains
- Race conditions: TOCTOU, limit-overrun via HTTP/2 single-packet attack
- Host header injection: password reset poisoning, SSRF via Host, cache poisoning

Findings are automatically added to the gadget inventory for chain analysis.
