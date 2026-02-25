---
name: subdomain-takeover
description: Automated subdomain takeover detection - dangling CNAME/NS/MX identification, cloud service enumeration, second-order takeover assessment, and takeover impact analysis
---

# Subdomain Takeover Hunting

## Usage
`/greyhatcc:takeover <domain>`

## MANDATORY: Load Context First
Before executing, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (DNS attack surface section, subdomain takeover methodology)
2. Load program guidelines: scope.md → verify subdomain is in scope (wildcard scope?)
3. Load engagement: findings_log.md, gadgets.json (takeovers chain with CORS, CSP, cookie scope)
4. Load recon: subdomains.txt, dns_records.md from prior recon
5. Load memory: Target-specific takeover notes from previous sessions

---

## Phase 1: Enumerate Subdomains for Takeover Candidates

### Source: Existing Recon
If subdomain enumeration has already been done (check recon/subdomains.txt), use that list. If not, run subdomain enumeration first via `/greyhatcc:subdomains`.

### Identify Candidates
For each discovered subdomain, resolve and check:

```bash
# Resolve the subdomain
dig +short <subdomain>
dig +short CNAME <subdomain>

# Check HTTP response
curl -sk -o /dev/null -w "%{http_code} %{redirect_url}" "https://<subdomain>/"
curl -sk -o /dev/null -w "%{http_code} %{redirect_url}" "http://<subdomain>/"
```

### Takeover Signatures

| Service | CNAME Pattern | Error Signature | Takeover Method |
|---------|--------------|-----------------|-----------------|
| **AWS S3** | `*.s3.amazonaws.com` | NoSuchBucket | Create bucket with same name |
| **AWS CloudFront** | `*.cloudfront.net` | Bad Request / no distribution | Claim the distribution |
| **AWS Elastic Beanstalk** | `*.elasticbeanstalk.com` | No environment found | Create environment with same name |
| **Azure** | `*.azurewebsites.net` | App not found | Create Azure web app with same name |
| **Azure TrafficManager** | `*.trafficmanager.net` | Profile not found | Create profile |
| **GitHub Pages** | `*.github.io` | 404 "There isn't a GitHub Pages site" | Create repo with matching name |
| **Heroku** | `*.herokuapp.com` | No such app | Create Heroku app |
| **Netlify** | `*.netlify.app` | Not found | Claim site |
| **Vercel** | `*.vercel.app` | 404 | Claim project |
| **Shopify** | `shops.myshopify.com` | "Sorry, this shop is currently unavailable" | Register Shopify store |
| **Cloudflare** | Cloudflare proxy IPs | Error 1016 (Origin DNS Error) | Claim the origin hostname |
| **Fastly** | `*.fastly.net` | Fastly error: unknown domain | Claim domain on Fastly |
| **Pantheon** | `*.pantheonsite.io` | 404 Platform | Claim site |
| **Surge.sh** | `*.surge.sh` | project not found | Claim project |
| **Unbounce** | `unbouncepages.com` | The requested URL was not found | Claim page |
| **WordPress.com** | `*.wordpress.com` | "doesn't exist" | Register site |
| **Tumblr** | `*.tumblr.com` | "There's nothing here" | Register blog |
| **Cargo** | `*.cargocollective.com` | 404 | Claim account |

### Beyond CNAMEs — NS and MX Takeover

```
NS Takeover (CRITICAL — full DNS zone control):
- Check if NS records point to decommissioned nameservers
- dig +short NS <subdomain>
- If NS resolves but the NS service is claimable → full zone control

MX Takeover (HIGH — email interception):
- Check if MX records point to decommissioned mail servers
- dig +short MX <subdomain>
- If MX is claimable → intercept all inbound email including password resets
```

---

## Phase 2: Validation

### Confirm Takeover (Non-Destructive)
For each candidate, validate WITHOUT actually claiming:

```
1. CNAME exists and resolves to service
2. Service responds with error signature (not a custom page)
3. Service allows new account/resource creation
4. Subdomain is under the target's domain (not a third-party)
```

**Do NOT actually perform the takeover** unless the program scope explicitly permits it and you have a plan for responsible cleanup.

### Assess Impact (This Is What Sets Severity)

| Context | Impact | Severity |
|---------|--------|----------|
| Subdomain in CSP `script-src` | Attacker serves JS → XSS on main site | **CRITICAL** |
| Subdomain trusted by CORS (`Access-Control-Allow-Origin`) | Cross-origin authenticated data theft | **HIGH** |
| Subdomain on cookie scope (same parent domain) | Cookie theft/setting on parent domain | **HIGH** |
| Subdomain used in OAuth redirect_uri | Token theft → ATO | **CRITICAL** |
| Subdomain with MX record | Email interception (password resets) | **CRITICAL** |
| Subdomain with NS record | Full DNS zone control | **CRITICAL** |
| Regular web subdomain | Content injection, phishing | **MEDIUM** |
| Subdomain not referenced anywhere | Brand risk only | **LOW** |

### Check Chain Potential
Cross-reference the takeover candidate with gadgets.json:
```
Does ANY existing finding:
- Reference this subdomain as a trusted origin? (CORS)
- Include this subdomain in CSP directives? (XSS chain)
- Use this subdomain for OAuth callbacks? (Token theft)
- Set cookies on the parent domain that this subdomain can access?
```

---

## Phase 3: Second-Order Takeover (Advanced)

### What Is Second-Order?
A second-order takeover isn't the target's subdomain directly — it's a domain the target TRUSTS that has a dangling resource.

```
Examples:
1. Target's CSP includes https://cdn.thirdparty.com
   → thirdparty.com has a dangling subdomain cdn.thirdparty.com
   → Takeover cdn.thirdparty.com → serve JS → XSS on target

2. Target's OAuth allows redirects to https://partner.com
   → partner.com has takeover-able subdomain
   → Redirect tokens through partner.com to attacker

3. Target includes JS from https://analytics.vendor.com
   → vendor.com S3 bucket hosting analytics.js is deletable
   → Replace analytics.js → supply chain XSS
```

### Where to Look for Second-Order
```
From target's CSP headers:
- script-src domains
- connect-src domains
- frame-src domains

From target's JS bundles:
- External script includes
- CDN references
- Third-party API endpoints

From target's DNS:
- CNAME chains (A points to B points to C — check each hop)
- NS delegation chains
```

Use BadDNS tool for automated second-order detection if available.

---

## Phase 4: Output

### Artifacts to Save
```
bug_bounty/<program>_bug_bounty/recon/takeover/
├── candidates.md          → All takeover candidates with evidence
├── validated.md           → Confirmed takeover-able subdomains
├── impact_analysis.md     → Impact assessment per candidate (chain context)
├── second_order.md        → Second-order takeover candidates
└── takeover_summary.md    → Executive summary
```

### Update Engagement State
1. Add findings to findings_log.md — each takeover-able subdomain is a finding
2. Add gadgets: subdomain takeover provides `trusted_origin`, `js_hosting`, `cookie_scope`
3. Run chain analysis: does this takeover chain with CORS, CSP, OAuth findings?
4. If CRITICAL chain exists (CSP XSS, MX intercept, NS control) → h1-report immediately
5. If standalone MEDIUM → check if it can be combined with other findings into one report

## Delegation
- Full subdomain takeover sweep → `recon-specialist` (sonnet) with this skill
- Quick CNAME check on specific subdomain → `recon-specialist-low` (haiku)
- Second-order analysis → `recon-specialist-high` (opus)
- Impact chain assessment → `vuln-analyst` (opus)
