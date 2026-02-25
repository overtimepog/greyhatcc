---
name: subdomain-enum
description: Multi-source subdomain enumeration using CT logs, DNS bruteforce, web scraping, and Shodan certificate search
---

# Subdomain Enumeration

## Usage
`/greyhatcc:subdomains <domain>`

## Sources (run in parallel)

1. **CT Logs** (crt.sh):
   ```
   WebFetch: https://crt.sh/?q=%25.<domain>&output=json
   ```
   Parse JSON, extract unique domain names.

2. **Shodan SSL Cert Search**:
   Use MCP tool `greyhatcc_s__shodan_ssl_cert` to find certs mentioning the domain.

3. **DNS Resolution**:
   Use MCP tool `greyhatcc_sec__dns_records` to validate discovered subdomains.

4. **subfinder** (if installed):
   ```bash
   subfinder -d <domain> -silent
   ```

## Post-Processing
1. Deduplicate all discovered subdomains
2. Resolve each to check if live (DNS A record)
3. Check HTTP status for web servers
4. Categorize: live, dead, wildcard

## Output
- `recon/subdomains.txt` - One subdomain per line (sorted, deduplicated)
- `recon/subdomains.md` - Formatted with live/dead status and IP addresses
