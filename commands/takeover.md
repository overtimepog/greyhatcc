---
name: takeover
description: "Hunt for subdomain takeover vulnerabilities - dangling CNAMEs, NS/MX takeover, second-order"
aliases:
  - sto
  - dangling
allowed-tools: Task, Bash, Read, Write, Glob, Grep, WebFetch, WebSearch
argument-hint: "<domain or subdomain list>"
skill: greyhatcc:subdomain-takeover
---

# Subdomain Takeover Hunting

Invoke the `greyhatcc:subdomain-takeover` skill for target: {{ARGUMENTS}}

Systematic detection of subdomain takeover vulnerabilities across all DNS record types:

**CNAME Takeover:**
- Detect dangling CNAMEs pointing to deprovisioned cloud services
- Service fingerprinting: match CNAME targets to known vulnerable services
- Supported services: AWS S3, CloudFront, Heroku, GitHub Pages, Azure, Shopify, Fastly,
  Pantheon, Tumblr, WordPress.com, Zendesk, Unbounce, Surge.sh, and 60+ more
- Verify exploitability by checking if the service allows claiming the subdomain

**NS Takeover:**
- Detect nameserver delegations pointing to expired or unclaimed domains
- NS takeover = full zone control: create any DNS record, intercept all traffic
- Impact: complete domain hijacking, email interception, SSL cert issuance

**MX Takeover:**
- Detect mail exchange records pointing to deprovisioned mail services
- MX takeover = intercept all inbound email including password reset links
- Impact: account takeover across every service using that email domain

**Second-Order Takeover:**
- Identify domains trusted by the target (CDN origins, SSO providers, webhook URLs)
- Check if those trusted domains have takeover vulnerabilities
- Second-order chain: takeover trusted domain to attack the primary target

**Impact Classification:**
- Critical: NS takeover (full zone control), wildcard CNAME takeover
- High: MX takeover (email interception), CNAME on auth/SSO subdomain
- Medium: CNAME on marketing/blog subdomain with cookie scope implications
- Low: CNAME on isolated subdomain with no cookie or trust relationship
