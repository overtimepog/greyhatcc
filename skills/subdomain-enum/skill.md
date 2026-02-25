---
name: subdomain-enum
description: Multi-source subdomain enumeration using CT logs, DNS bruteforce, web scraping, and Shodan certificate search
---

# Subdomain Enumeration

## Usage
`/greyhatcc:subdomains <domain>`

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target domain is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions
5. Check existing `recon/subdomains.txt` — if prior enumeration exists, merge results

## Enumeration Sources (run ALL in parallel)

### 1. CT Logs (crt.sh) — Always Available
```
WebFetch: https://crt.sh/?q=%25.<domain>&output=json
```
Parse JSON, extract unique `name_value` fields. Split multi-domain entries on newlines.

### 2. Shodan SSL Cert Search — Via MCP
Use MCP tool `greyhatcc_s__shodan_ssl_cert` to find certificates mentioning the domain.
Also try: `greyhatcc_s__shodan_search` with query `ssl.cert.subject.CN:<domain>`

### 3. DNS Records — Via MCP
Use MCP tool `greyhatcc_sec__dns_records` to validate discovered subdomains.
Also use `greyhatcc_s__shodan_dns_domain` for Shodan's DNS dataset.

### 4. subfinder (if installed)
```bash
subfinder -d <domain> -all -silent
```
Uses 40+ passive sources (VirusTotal, SecurityTrails, Censys, etc.)

### 5. Reverse DNS — Via MCP
Use `greyhatcc_s__shodan_dns_reverse` on discovered IPs to find additional hostnames.

### 6. Web Archives (Wayback Machine)
```
WebFetch: https://web.archive.org/cdx/search/cdx?url=*.<domain>&output=text&fl=original&collapse=urlkey&limit=500
```
Extract unique hostnames from archived URLs.

### 7. Google/Web Search Dorking
```
WebSearch: site:<domain> -www
WebSearch: site:*.<domain>
```

### 8. ASN/BGP Expansion
If the target has known ASN ranges:
```
WebSearch: "<org_name>" ASN bgp.he.net
```
Map ASN → IP ranges → reverse DNS → additional subdomains.

## Alterx Mutations (Permutation-Based Discovery)

After initial enumeration, generate permutations to find undiscovered subdomains:

```
Mutation patterns:
- api-<word>.<domain>     → api-v2, api-staging, api-internal
- <word>-api.<domain>     → dev-api, test-api, admin-api
- <env>.<domain>          → dev, staging, uat, preprod, qa, sandbox
- <env>-<service>.<domain> → dev-app, staging-api, qa-admin
- <service>.<domain>       → mail, vpn, portal, dashboard, admin, cms
- <geo>.<domain>           → us, eu, ap, au, uk, sg
- <geo>-<service>.<domain> → us-api, eu-app, ap-admin
```

Validate mutations via DNS resolution (batch with `dig` or `dnsx` if available).

## DNS Validation

For each discovered subdomain:
```bash
# Resolve A record
dig +short A <subdomain>

# Check for CNAME (takeover potential)
dig +short CNAME <subdomain>

# Check for wildcard DNS
dig +short A randomnonexistent.<domain>
# If this returns an IP, the domain has wildcard DNS — filter accordingly
```

## Live Host Detection

For all resolved subdomains, check HTTP/HTTPS availability:
```bash
# Quick check with curl
curl -sk -o /dev/null -w "%{http_code} %{redirect_url}" "https://<subdomain>/" --connect-timeout 5

# Or use httpx if available
cat subdomains.txt | httpx -silent -status-code -title -tech-detect
```

## Post-Processing
1. Deduplicate all discovered subdomains (sort -u)
2. Resolve each to check if live (DNS A record)
3. Filter out wildcard DNS false positives
4. Check HTTP/HTTPS status for web servers
5. Categorize: live-web, live-non-web, dead, wildcard, CNAME-dangling
6. Flag dangling CNAMEs for takeover analysis (`/greyhatcc:takeover`)

## Output
- `recon/subdomains.txt` - One subdomain per line (sorted, deduplicated)
- `recon/subdomains.md` - Formatted with live/dead status, IP addresses, CNAME targets, HTTP status codes

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining (e.g., dangling CNAMEs provide `trusted_origin`)
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
