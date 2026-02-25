---
name: reference-guides
description: Curated reference library of bug bounty hunting guides, cheatsheets, methodology resources, and vulnerability-specific playbooks for use during engagements
---

# Reference Guides Library

Quick-access reference library for bug bounty hunting. Use these when researching attack vectors, building payloads, or learning new vulnerability classes.

## Usage
- `/greyhatcc:guides` — Show full reference library
- `/greyhatcc:guides <topic>` — Show guides for a specific topic (e.g., "graphql", "oauth", "xss")

## Methodology & Workflow Guides

| Resource | URL | Focus |
|----------|-----|-------|
| **HowToHunt** (KathanP19) | https://kathan19.gitbook.io/howtohunt | End-to-end bug hunting — recon, vuln hunting (XSS, SSRF, IDOR, business logic), report writing, tool setup, checklists |
| **HackTricks** (carlospolop) | https://book.hacktricks.xyz/ | Massive pentesting reference — web, infra, cloud (K8s, AWS), crypto (JWT, OAuth), bypasses, methodology flows |
| **AllAboutBugBounty** (daffainfo) | https://github.com/daffainfo/all-about-bug-bounty | Methodologies, payloads, writeups — recon, web/API testing, OAuth, JWT, tools, program selection |
| **PayloadsAllTheThings** (swisskyrepo) | https://github.com/swisskyrepo/PayloadsAllTheThings | 20+ vuln type payloads — XSS, SQLi, SSRF, LFI, race conditions, NoSQLi. Copy-paste ready |
| **PortSwigger Web Security Academy** | https://portswigger.net/web-security | Interactive labs — XSS, SQLi, SSRF, auth, access control, prototype pollution, HTTP smuggling |
| **OWASP Testing Guide** (v4.2+) | https://owasp.org/www-project-web-security-testing-guide/ | Official testing methodology — 10+ categories, structured checklists, GraphQL & serverless |
| **Bug Bounty Roadmap** (bittentech) | https://github.com/bittentech/Bug-Bounty-Roadmap | Structured learning path — tools, recon, vuln deep-dives |

## Vulnerability-Specific Cheatsheets

### Authentication & Authorization

| Resource | URL | Covers |
|----------|-----|--------|
| **OAuth Attacks** (HackTricks) | https://book.hacktricks.xyz/pentesting-web/oauth-to-account-takeover | Token theft, redirect manipulation, scope escalation, PKCE bypass |
| **JWT Attacks** (HackTricks) | https://book.hacktricks.xyz/pentesting-web/jwt-json-web-tokens | None algorithm, RS256→HS256 confusion, key injection, kid manipulation |
| **JWT Tool** (ticarpi) | https://github.com/ticarpi/jwt_tool | Python JWT testing toolkit — automated attack modes |
| **SAML Attacks** | https://book.hacktricks.xyz/pentesting-web/saml-attacks | Signature wrapping, assertion replay, XXE in SAML |
| **OAuth Security Cheatsheet** (OWASP) | https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html | Defensive reference — useful for identifying what's missing |

### Injection

| Resource | URL | Covers |
|----------|-----|--------|
| **XSS Payloads** (payloadbox) | https://github.com/payloadbox/xss-payload-list | Comprehensive XSS payload collection — reflected, stored, DOM, filter bypass |
| **SQLi Payloads** (payloadbox) | https://github.com/payloadbox/sql-injection-payload-list | SQLi payloads for MySQL, PostgreSQL, MSSQL, Oracle, SQLite |
| **SSTI Payloads** (PayloadsAllTheThings) | https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Template%20Injection | Jinja2, Twig, Freemarker, Pebble, Velocity, Smarty |
| **SQLMap** | https://sqlmap.org/ | Automated SQL injection — detection, exploitation, data exfil |
| **XSS Hunter** | https://xsshunter.trufflesecurity.com/ | Blind XSS callback service |

### Server-Side Attacks

| Resource | URL | Covers |
|----------|-----|--------|
| **SSRF Bible** (PayloadsAllTheThings) | https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/Server%20Side%20Request%20Forgery | Cloud metadata, internal service discovery, protocol smuggling, bypass techniques |
| **XXE Payloads** (PayloadsAllTheThings) | https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XXE%20Injection | OOB exfiltration, blind XXE, parameter entities |
| **Deserialization** (HackTricks) | https://book.hacktricks.xyz/pentesting-web/deserialization | Java (ysoserial), PHP (phar://), Python, .NET, Ruby gadget chains |
| **Prototype Pollution** (HackTricks) | https://book.hacktricks.xyz/pentesting-web/deserialization/nodejs-proto-prototype-pollution | Client-side, server-side, PP-to-RCE chains |

### API & GraphQL

| Resource | URL | Covers |
|----------|-----|--------|
| **GraphQL Attacks** (HackTricks) | https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/graphql | Introspection, batching, DoS, field-level authz, alias abuse |
| **GraphQL Voyager** | https://graphql-kit.com/graphql-voyager/ | Visual GraphQL schema exploration |
| **Clairvoyance** | https://github.com/nikitastupin/clairvoyance | Blind GraphQL schema reconstruction when introspection disabled |
| **API Security** (OWASP) | https://owasp.org/API-Security/ | OWASP API Top 10 — BOLA, broken auth, excessive data exposure |
| **Swagger/OpenAPI finder** | Common paths: `/docs`, `/api-docs`, `/v3/api-docs`, `/openapi.json`, `/swagger.json`, `/swagger-ui.html` | API spec discovery |

### HTTP Smuggling & Race Conditions

| Resource | URL | Covers |
|----------|-----|--------|
| **HTTP Request Smuggling** (PortSwigger) | https://portswigger.net/web-security/request-smuggling | CL.TE, TE.CL, H2.CL, HTTP/2 desync |
| **Race Conditions** (HackTricks) | https://book.hacktricks.xyz/pentesting-web/race-condition | TOCTOU, limit-overrun, HTTP/2 single-packet attack |
| **Race Conditions** (PortSwigger) | https://portswigger.net/web-security/race-conditions | Labs + methodology for race condition exploitation |

### Cloud & Infrastructure

| Resource | URL | Covers |
|----------|-----|--------|
| **HackTricks Cloud** | https://cloud.hacktricks.xyz/ | AWS, GCP, Azure pentesting — IAM, S3, Lambda, metadata abuse |
| **CloudSec Resources** (toniblyx) | https://github.com/toniblyx/my-arsenal-of-aws-security-tools | AWS security tool collection |
| **S3 Bucket Finder** | https://github.com/gwen001/s3-buckets-finder | Enumerate and test S3 bucket permissions |
| **Cloud Enum** | https://github.com/initstring/cloud_enum | Multi-cloud storage enumeration (AWS, Azure, GCP) |

### Mobile & Client-Side

| Resource | URL | Covers |
|----------|-----|--------|
| **OWASP Mobile Testing Guide** | https://mas.owasp.org/ | Mobile app security testing methodology |
| **Frida** | https://frida.re/ | Dynamic instrumentation — SSL pinning bypass, hooking, runtime manipulation |
| **Objection** | https://github.com/sensepost/objection | Runtime mobile exploration using Frida |
| **MobSF** | https://github.com/MobSF/Mobile-Security-Framework-MobSF | Automated mobile app security testing |

### Subdomain & DNS

| Resource | URL | Covers |
|----------|-----|--------|
| **Can I Take Over XYZ?** | https://github.com/EdOverflow/can-i-take-over-xyz | Subdomain takeover reference — service-by-service fingerprints |
| **Subdomain Takeover** (HackTricks) | https://book.hacktricks.xyz/pentesting-web/domain-subdomain-takeover | Methodology, tools, CNAME/NS/MX takeover |
| **DNS Rebinding** | https://book.hacktricks.xyz/pentesting-web/dns-rebinding | SSRF amplification via DNS rebinding |

## Expert Methodology Videos & Courses

| Expert | Resource | URL |
|--------|----------|-----|
| **Nahamsec** | Bug Bounty Methodology (2026) | https://www.youtube.com/watch?v=oFxcG7yerG4 |
| **Jason Haddix** | The Bug Hunter's Methodology (classic) | https://www.youtube.com/watch?v=1KqSnK0b5jE |
| **STOK** | Live hacking, XSS/SSRF chains | https://www.youtube.com/c/STOKfredrik |
| **Nahamsec** | Training course + labs | https://bugbounty.nahamsec.training |
| **InsiderPhD** | Beginner methodology | https://www.youtube.com/c/InsiderPhD |
| **John Hammond** | CTF + real-world exploitation | https://www.youtube.com/c/JohnHammond010 |

## Books

| Book | Author | Focus |
|------|--------|-------|
| **Bug Bounty Bootcamp** | Vickie Li | Comprehensive beginner-to-intermediate guide |
| **Web Hacking 101** | Peter Yaworski | Real-world HackerOne report breakdowns |
| **The Web Application Hacker's Handbook** | Stuttard & Pinto | Deep web app security methodology |
| **Real-World Bug Hunting** | Peter Yaworski | Curated disclosed bug writeups |

## Context7 Live Documentation (MCP)

In addition to static references above, use **Context7 MCP** to pull up-to-date documentation for any technology found in the target's stack. This gives you framework-specific security details that static cheatsheets may not cover.

### Usage Pattern

```
Step 1: Resolve the library
Use: mcp__Context7__resolve-library-id
  libraryName: "<framework>"
  query: "security vulnerabilities configuration"

Step 2: Query relevant docs
Use: mcp__Context7__query-docs
  libraryId: "<resolved ID>"
  topic: "<security-relevant topic>"
```

### Recommended Queries by Tech

| Technology | libraryName | Query Topic |
|-----------|-------------|-------------|
| Next.js | `next.js` | `security middleware CORS authentication API routes` |
| Spring Boot | `spring-boot` | `actuator security configuration CORS CSRF` |
| Express | `express` | `security middleware CORS helmet session` |
| Django | `django` | `security settings CSRF authentication middleware` |
| Apollo GraphQL | `apollo-server` | `introspection depth limiting authentication plugins` |
| Flask | `flask` | `security CORS session secret key` |
| Laravel | `laravel` | `authentication CORS middleware CSRF` |
| Rails | `ruby-on-rails` | `security CSRF authentication strong parameters` |
| FastAPI | `fastapi` | `security OAuth2 CORS dependencies authentication` |
| AWS CDK/SDK | `aws-cdk` | `S3 bucket policy IAM Cognito Lambda permissions` |
| Firebase | `firebase` | `security rules authentication storage Firestore` |
| WordPress | `wordpress` | `REST API authentication hooks security` |

### Why Context7 Matters for Bug Bounty

Static cheatsheets show attack patterns. Context7 shows **what the framework does by default** — the gap between default behavior and secure configuration is where bugs live. If the docs say "CORS allows all origins by default" and the target uses that framework, you have a high-confidence test vector.

## How to Use During an Engagement

1. **Before testing a vuln type**: Open the relevant cheatsheet section above
2. **Building payloads**: Start with PayloadsAllTheThings, adapt to target
3. **Stuck on a vuln class**: Read the HackTricks page + PortSwigger labs for that class
4. **Reviewing attack surface**: Cross-reference HowToHunt checklist per asset type
5. **Writing reports**: Follow OWASP naming for vuln types, reference CWE IDs from HackTricks

## Quick Lookup by Vulnerability Type

```
XSS        → PayloadsAllTheThings + payloadbox/xss-payload-list + PortSwigger labs
SQLi       → PayloadsAllTheThings + payloadbox/sql-injection-payload-list + sqlmap
SSRF       → PayloadsAllTheThings SSRF section + HackTricks
IDOR       → HowToHunt IDOR section + AllAboutBugBounty
OAuth      → HackTricks OAuth + OWASP cheatsheet
JWT        → HackTricks JWT + jwt_tool
GraphQL    → HackTricks GraphQL + clairvoyance
Race Cond  → HackTricks + PortSwigger race conditions
SSTI       → PayloadsAllTheThings SSTI section
Smuggling  → PortSwigger request smuggling labs
Subdomain  → can-i-take-over-xyz + HackTricks
Cloud      → HackTricks Cloud + cloud_enum
Mobile     → OWASP MAS + Frida + objection
```
