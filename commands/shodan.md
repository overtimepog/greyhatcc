---
name: shodan
description: "Run Shodan reconnaissance on a target IP or domain"
aliases:
  - sh
  - shodansearch
allowed-tools: Task, Bash, Read, Write, Glob, Grep
argument-hint: "<IP, domain, or search query>"
skill: greyhatcc:shodan-recon
---

# Shodan Reconnaissance

Invoke the `greyhatcc:shodan-recon` skill for target: {{ARGUMENTS}}

Leverages Shodan's internet-wide scanning data for passive infrastructure intelligence:

**Host Lookup:**
- Open ports, services, and version banners for a specific IP
- Operating system detection and device fingerprinting
- Historical scan data showing service changes over time
- Known vulnerabilities (CVEs) associated with detected service versions
- Geolocation, ASN, ISP, and organization information

**Search Queries:**
- SSL certificate matching: `ssl.cert.subject.CN:target.com` to find all IPs with target's certs
- Favicon hash matching: identify target infrastructure by favicon fingerprint across the internet
- HTTP title/body matching for discovering related or hidden infrastructure
- Organization search: `org:"Target Corp"` to find all internet-facing assets
- Product-specific queries: `product:nginx`, `product:Apache`, `product:IIS`

**DNS Intelligence:**
- Forward and reverse DNS resolution
- Domain-level DNS record enumeration
- Subdomain discovery via Shodan's DNS dataset

**Vulnerability Assessment:**
- Known CVEs mapped to detected services and versions
- Exploit availability check via Shodan exploits database
- SSL/TLS certificate analysis: expiration, chain validity, weak ciphers

**Origin IP Discovery:**
- Find the real IP behind Cloudflare, Akamai, or other CDN/WAF services
- Match SSL certificates across IPs to identify origin servers
- Historical DNS data to find pre-CDN IP addresses
- SPF/DKIM/MX record analysis for IP leakage

All Shodan findings are integrated into the engagement recon data and gadget inventory.
