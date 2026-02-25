---
name: shodan-recon
description: Deep Shodan-powered reconnaissance for target hosts including ports, services, vulnerabilities, SSL certificates, and honeypot detection
---

# Shodan Reconnaissance

## Usage
`/greyhatcc:shodan <IP or domain>`

## Workflow

1. **Resolve Domain** (if domain provided):
   Use MCP tool `greyhatcc_s__shodan_dns_resolve` to get IP

2. **Host Lookup**:
   Use MCP tool `greyhatcc_s__shodan_host_lookup` for comprehensive host data

3. **Vulnerability Check**:
   Use MCP tool `greyhatcc_s__shodan_vulns` for known CVEs

4. **SSL Certificate Analysis**:
   Use MCP tool `greyhatcc_s__shodan_ssl_cert` for certificate discovery

5. **Honeypot Check**:
   Use MCP tool `greyhatcc_s__shodan_honeypot_check` to verify legitimacy

6. **CVE Enrichment**:
   For each CVE found, use `greyhatcc_sec__cve_detail` for full details

## Output
Save to `recon/shodan_<ip>.md` with:
- IP, Organization, ISP, Country
- Open Ports with service banners
- Detected vulnerabilities with CVSS scores
- SSL certificate details and SANs
- Honeypot probability
- Related infrastructure (via SSL cert search)
