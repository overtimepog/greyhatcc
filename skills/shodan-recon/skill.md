---
name: shodan-recon
description: Deep Shodan-powered reconnaissance for target hosts including ports, services, vulnerabilities, SSL certificates, and honeypot detection
---

# Shodan Reconnaissance

## Usage
`/greyhatcc:shodan <IP or domain>`

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

## All Shodan MCP Tools

| Tool | Use Case | When to Use |
|------|----------|-------------|
| `greyhatcc_s__shodan_dns_resolve` | Resolve domain to IP | First step when given a domain |
| `greyhatcc_s__shodan_dns_reverse` | Reverse DNS on IP | Find all domains hosted on an IP |
| `greyhatcc_s__shodan_dns_domain` | Full DNS dataset for domain | Comprehensive DNS records from Shodan |
| `greyhatcc_s__shodan_host_lookup` | Complete host profile | Ports, services, banners, org, ISP, OS |
| `greyhatcc_s__shodan_search` | Search Shodan index | Find hosts by query (SSL certs, headers, etc.) |
| `greyhatcc_s__shodan_count` | Count matching hosts | Estimate attack surface size |
| `greyhatcc_s__shodan_vulns` | Known CVEs for host | Vulnerability assessment |
| `greyhatcc_s__shodan_ssl_cert` | SSL certificate discovery | Find related hosts by cert, origin IP discovery |
| `greyhatcc_s__shodan_honeypot_check` | Detect honeypots | Verify target is legitimate before testing |
| `greyhatcc_s__shodan_exploits_search` | Find exploits for CVEs | Exploit availability for discovered vulns |
| `greyhatcc_s__shodan_ports` | Common ports list | Reference for scan planning |
| `greyhatcc_s__shodan_scan` | Active scan via Shodan | Trigger Shodan to rescan a target |
| `greyhatcc_s__shodan_scan_status` | Check scan status | Monitor active scan progress |
| `greyhatcc_s__shodan_internetdb` | Quick IP lookup (no API key) | Fast, keyless lookup for basic info |
| `greyhatcc_s__shodan_api_info` | Check API key status | Verify credits and plan |
| `greyhatcc_s__shodan_search_facets` | Available search facets | Discover filterable attributes |
| `greyhatcc_s__shodan_search_filters` | Available search filters | Build advanced queries |
| `greyhatcc_s__shodan_search_tokens` | Parse search query | Debug and validate search syntax |

## Workflow

### Step 1: Resolve Domain (if domain provided)
Use MCP tool `greyhatcc_s__shodan_dns_resolve` to get IP.
Also run `greyhatcc_s__shodan_dns_domain` for full DNS dataset.

### Step 2: Host Lookup
Use MCP tool `greyhatcc_s__shodan_host_lookup` for comprehensive host data.

### Step 3: Vulnerability Check
Use MCP tool `greyhatcc_s__shodan_vulns` for known CVEs.

### Step 4: SSL Certificate Analysis
Use MCP tool `greyhatcc_s__shodan_ssl_cert` for certificate discovery.
This is key for CDN origin discovery — find IPs serving the same cert without CDN proxy.

### Step 5: Honeypot Check
Use MCP tool `greyhatcc_s__shodan_honeypot_check` to verify legitimacy.

### Step 6: CVE Enrichment
For each CVE found, use `greyhatcc_sec__cve_detail` for full details.
Then use `greyhatcc_s__shodan_exploits_search` for exploit availability.

### Step 7: Related Infrastructure Discovery
Use advanced Shodan search queries to find related hosts:

```
Search Query Examples:
- ssl.cert.subject.CN:<domain>              → Find all hosts with matching SSL cert
- ssl.cert.issuer.O:<org>                    → Find all certs issued to the org
- http.favicon.hash:<hash>                   → Find hosts with same favicon (origin discovery)
- org:"<org_name>"                           → All hosts belonging to the org
- hostname:<domain>                          → All hosts with matching hostname
- http.title:"<unique_title>"               → Find hosts with same page title
- http.html:"<unique_string>"               → Find hosts with same HTML content
- "Set-Cookie: <unique_cookie>"              → Find hosts setting same cookies
- asn:AS<number>                             → All hosts in an ASN range
- net:<cidr>                                  → All hosts in a CIDR range
- port:8080,8443,9090 org:"<org>"           → Non-standard ports for the org
```

## Output
Save to `recon/shodan_<ip>.md` with:
- IP, Organization, ISP, Country
- Open Ports with service banners
- Detected vulnerabilities with CVSS scores
- SSL certificate details and SANs
- Honeypot probability
- Related infrastructure (via SSL cert search)
- CDN origin IP candidates (if behind CDN)

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
