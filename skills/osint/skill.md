---
name: osint
description: Open source intelligence gathering for targets including organizational profiling, infrastructure mapping, and attack surface discovery
---

# OSINT Gathering

## Usage
`/greyhatcc:osint <target domain or organization>`

## Smart Input
`{{ARGUMENTS}}` is parsed automatically — just provide a target in any format:
- **URL** (https://example.com/path) → extracted domain + full URL used as target
- **Domain** (example.com) → https:// prepended, used as target  
- **IP** (1.2.3.4) → used directly for infrastructure testing
- **H1 URL** (hackerone.com/program) → program handle extracted, scope loaded via H1 API
- **Empty** → error: "Usage: /greyhatcc:<skill> <target>"

No format specification needed from user — detect and proceed.


## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions

---

## OSINT Layers (from CLAUDE.md Phase 5 Methodology)

### Layer 1: Organizational Profiling
```
WebSearch queries:
- "<org_name>" company overview technology
- "<org_name>" engineering team blog
- "<org_name>" careers technology stack
- "<org_name>" about page team
- site:linkedin.com "<org_name>" employees
```

Extract:
- Company size and structure
- Key personnel (CTO, CISO, engineering leads)
- Office locations (for geo-targeted assets)
- Business model (fintech, healthcare, SaaS = different compliance)

### Layer 2: Employee Enumeration
```
Sources:
- LinkedIn: Search "<org_name>" employees → map team structure
- theHarvester (if installed): theHarvester -d <domain> -b all
- Hunter.io: Email patterns and employee list
- GitHub: Org members and contributors → org:<org_name>
```

Extract:
- Email pattern: firstname.lastname@domain, f.lastname@domain, etc.
- Developer names → search their personal repos for org secrets
- Admin/DevOps names → higher-value targets for social engineering context

### Layer 3: Job Posting Analysis
```
WebSearch queries:
- "<org_name>" careers engineer developer
- site:linkedin.com/jobs "<org_name>"
- site:greenhouse.io "<org_name>"
- site:lever.co "<org_name>"
```

**Job postings reveal exact tech stack, VPN products, internal tool names, and security gaps:**

| Job Posting Mentions | Intelligence Value |
|---------------------|-------------------|
| "Experience with AWS, Kubernetes" | Cloud infra = test S3, metadata SSRF, RBAC |
| "GraphQL, Apollo Server" | GraphQL endpoints = introspection, batching, authz |
| "Cognito, Auth0, Firebase" | Auth provider = provider-specific attack vectors |
| "Jenkins, GitLab CI" | CI/CD = pipeline exploitation, artifact exposure |
| "Elasticsearch, Redis" | Data stores = check for public access |
| "Microservices architecture" | Many services = more API endpoints, SSRF targets |
| "We're hiring a security engineer" | Security team is understaffed = more likely to have gaps |

### Layer 4: GitHub Intelligence
```
Search queries:
- org:<org_name> — All public repos
- "<domain>" password OR secret OR api_key OR token — Leaked secrets
- "<domain>" extension:env — Environment files
- "<domain>" extension:json firebase OR aws — Config files
- "<org_name>" filename:.env — Environment files
- "<org_name>" filename:docker-compose.yml — Infrastructure configs
- "<org_name>" filename:config.yml — Configuration files
```

Use TruffleHog or Gitleaks patterns to search commit history for rotated secrets. 23.8M secrets leaked on public GitHub in 2024 (25% YoY increase).

### Layer 5: Breach Intelligence
```
Sources:
- HaveIBeenPwned: Check domain email pattern for breaches
- WebSearch: "<domain>" data breach leaked
- WebSearch: "<domain>" credentials dump pastebin
```

Extract:
- Breached email addresses → credential stuffing targets
- Password patterns (if available) → password spraying wordlists
- Breach dates → old passwords may still work on legacy systems

### Layer 6: Infrastructure Intelligence
```
Sources:
1. Web Search: "<domain>" infrastructure architecture blog
2. Shodan: org:"<org_name>" — all indexed infrastructure
3. Shodan: ssl.cert.subject.CN:<domain> — SSL cert matching
4. DNS History: WebSearch for SecurityTrails, ViewDNS results
5. BGP/ASN: WebSearch for "<org_name>" ASN bgp.he.net
```

### Layer 7: Cloud Asset Discovery
```
Sources:
1. GrayHatWarfare: Search for org-related bucket names
2. S3 bucket guessing: <domain>, <domain>-assets, <domain>-backup
3. Azure blob: <org>.blob.core.windows.net
4. GCS: storage.googleapis.com/<domain>
5. Firebase: <project>.firebaseio.com/.json
```

## Delegate to:
- `osint-researcher-high` (opus) for deep multi-source OSINT with analysis
- `osint-researcher` (sonnet) for comprehensive multi-source OSINT
- `osint-researcher-low` (haiku) for quick single-source lookups

## Output
Save to `recon/osint/` directory:
- `osint_summary.md` — Executive summary with key findings
- `employees.md` — Employee enumeration results
- `tech_intel.md` — Technology stack from job postings and blogs
- `github_intel.md` — GitHub intelligence and potential leaks
- `breach_intel.md` — Breach exposure assessment
- `infrastructure.md` — Infrastructure mapping from passive sources

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
