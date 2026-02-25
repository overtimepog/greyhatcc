---
name: recon
description: "Run multi-phase reconnaissance on a target domain, IP, or URL"
aliases:
  - r
  - enumerate
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<domain, IP, or URL>"
skill: greyhatcc:recon
---

# Reconnaissance

Invoke the `greyhatcc:recon` skill for target: {{ARGUMENTS}}

Runs a comprehensive 5-phase reconnaissance operation that goes far beyond basic scanning:

**Phase 1 - Scope Expansion:**
- ASN/BGP mapping via bgp.he.net, bgpview.io, and Amass intel to discover the full IP range
- Reverse WHOIS and acquisition research to find all org-owned domains
- Certificate Transparency log monitoring via crt.sh for staging, pre-launch, and internal infrastructure

**Phase 2 - Infrastructure Mapping:**
- Passive DNS and historical DNS via SecurityTrails and ViewDNS to find origin IPs behind CDNs
- Cloud recon for S3 buckets, GCS, Azure blobs, Firebase instances, and Cognito pools
- WAF/CDN fingerprinting with timing-based rule detection for targeted bypass
- Shodan and Censys queries using SSL cert matching, favicon hashing, and service banner correlation

**Phase 3 - Code Intelligence:**
- JavaScript bundle analysis to extract API endpoints, secrets, internal paths, and debug flags
- Source map detection (.map files) for full original source reconstruction
- GitHub dorking for leaked secrets, internal configs, and commit history analysis
- API discovery at /docs, /api-docs, /v3/api-docs, /openapi.json, /graphql
- Wayback Machine and GAU for historical URLs, .env files, .bak files, old admin panels

**Phase 4 - DNS Attack Surface:**
- Zone transfer attempts against all nameservers
- Subdomain takeover detection for dangling CNAMEs, NS records, and MX records
- DNS rebinding potential assessment for SSRF amplification against internal services

**Phase 5 - OSINT Layer:**
- Employee enumeration via LinkedIn, theHarvester, and Hunter.io
- Job posting analysis to reveal tech stack, VPN products, and internal tools
- Breach intelligence correlation for credential stuffing patterns

All findings are saved to the engagement directory and fed into the gadget inventory.
