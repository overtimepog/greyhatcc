---
name: osint
description: "Gather open source intelligence on a target domain or organization"
aliases:
  - intel
  - oi
allowed-tools: Task, Bash, Read, Write, Glob, Grep, WebFetch, WebSearch
argument-hint: "<organization or domain>"
skill: greyhatcc:osint
---

# OSINT Gathering

Invoke the `greyhatcc:osint` skill for target: {{ARGUMENTS}}

Multi-layered open source intelligence gathering for comprehensive target profiling:

**Employee Enumeration:**
- LinkedIn scraping for org structure, engineering team, and admin personnel
- theHarvester for email addresses, names, and associated metadata
- Hunter.io for email pattern detection and verified addresses
- GitHub profile discovery for developers and their public repositories
- Conference talks and blog posts revealing internal architecture decisions

**Job Postings Analysis:**
- Extract exact tech stack from job requirements (languages, frameworks, databases)
- Identify VPN products, internal tools, and security tooling from descriptions
- Map team structure: who is responsible for security, DevOps, infrastructure
- Detect security gaps: "we are building our security program" = immature posture

**Breach Intelligence:**
- HaveIBeenPwned API for known breaches affecting target email domains
- Email pattern inference (first.last, flast, firstl) + breach password correlation
- Credential stuffing wordlist generation with org-specific password patterns
- Historical breach timeline for understanding security incident response maturity

**Domain Portfolio:**
- Reverse WHOIS to discover all domains registered by the organization
- Acquisition research to identify recently merged/acquired company domains
- Brand monitoring: typosquat detection, phishing domain identification
- Expired domain monitoring for potential takeover opportunities

**Technology Stack Inference:**
- BuiltWith and Wappalyzer data for framework and library identification
- DNS TXT records revealing SaaS integrations (SPF includes, DKIM selectors)
- SSL certificate metadata: issuer, SAN entries, organization details
- Error page fingerprinting for backend technology identification
