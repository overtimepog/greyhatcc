---
name: subdomains
description: "Enumerate subdomains for a target domain using multiple sources"
aliases:
  - subs
  - subenum
allowed-tools: Task, Bash, Read, Write, Glob, Grep, WebFetch, WebSearch
argument-hint: "<domain>"
skill: greyhatcc:subdomain-enum
---

# Subdomain Enumeration

Invoke the `greyhatcc:subdomain-enum` skill for domain: {{ARGUMENTS}}

Multi-source subdomain discovery to map the complete attack surface:

**Passive Sources:**
- Certificate Transparency logs via crt.sh (%.domain.com for wildcards)
- Shodan SSL certificate subject matching (ssl.cert.subject.CN:domain.com)
- SecurityTrails historical and current DNS records
- VirusTotal, AlienVault OTX, and ThreatCrowd passive DNS
- Wayback Machine and Common Crawl URL extraction
- Search engine dorking (site:domain.com -www)

**Active Enumeration:**
- DNS brute force with curated wordlists (best-dns-wordlist, SecLists)
- Alterx permutation generation: dev-, staging-, api-, internal- prefix/suffix mutations
- Virtual host discovery via Host header fuzzing against known IPs
- Zone transfer attempts against all discovered nameservers
- NSEC/NSEC3 walking for DNSSEC-enabled zones

**Resolution and Filtering:**
- DNS resolution with dnsx to filter dead/unresolvable subdomains
- HTTP probing with httpx for live web services (title, status, tech detect)
- Wildcard DNS detection and filtering to prevent false positives
- CDN/WAF detection to identify assets behind Cloudflare, Akamai, etc.

**Post-Enumeration:**
- Subdomain takeover candidate identification (dangling CNAMEs, NXDOMAIN responses)
- Service categorization: web apps, APIs, mail servers, VPN endpoints, CI/CD
- Screenshot capture for visual recon of discovered web services
- Results saved to engagement directory and fed into scope and recon pipelines
