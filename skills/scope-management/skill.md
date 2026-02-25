---
name: scope-management
description: Define, validate, and manage authorized target scope with asset tracking, vuln type exclusions, required headers, and testing constraints for penetration testing engagements
---

# Target Scope Management

## Usage
- `/greyhatcc:scope init <engagement_name>` - Create new scope
- `/greyhatcc:scope add <domain/IP>` - Add authorized target
- `/greyhatcc:scope exclude <domain/IP>` - Add domain exclusion
- `/greyhatcc:scope exclude-vuln <vuln_type>` - Add vulnerability type exclusion
- `/greyhatcc:scope check <target>` - Validate target against scope
- `/greyhatcc:scope check-vuln <vuln_type>` - Check if vuln type is excluded
- `/greyhatcc:scope show` - Display current scope with all rules
- `/greyhatcc:scope import <scope.md>` - Import from program scope.md file

## Scope File (Enhanced v2)
Location: `.greyhatcc/scope.json`

```json
{
  "engagement": "Bug Bounty - Program Name",
  "created": "2026-02-23",
  "version": 2,
  "authorized": {
    "domains": ["*.example.com", "api.example.com"],
    "ips": ["10.0.0.0/24"],
    "urls": ["https://api.example.com/*"],
    "assets": [
      { "name": "api.example.com", "type": "URL", "tier": 1, "notes": "Main API" },
      { "name": "*.example.com", "type": "Wildcard", "tier": 2, "notes": "All subdomains" },
      { "name": "com.example.app", "type": "Android App", "tier": 1, "notes": "" }
    ]
  },
  "excluded": {
    "domains": ["payments.example.com", "staging.example.com"],
    "paths": ["/admin/*"],
    "vulnTypes": [
      "Missing HSTS",
      "Missing X-Frame-Options",
      "Missing CSP",
      "Missing cookie flags",
      "Missing SPF/DKIM/DMARC",
      "Clickjacking",
      "Open redirect without additional impact",
      "CORS without data exfiltration proof",
      "Self-XSS",
      "User enumeration",
      "Rate limiting without ATO or financial impact",
      "Content injection with minimal impact",
      "Vulnerable library without working PoC",
      "SSL/TLS configuration issues",
      "Banner/version disclosure",
      "Root/jailbreak detection bypass",
      "SSL pinning bypass",
      "robots.txt disclosure",
      "Stack traces without sensitive data"
    ]
  },
  "rules": {
    "rateLimit": "10req/s",
    "noDoS": true,
    "noSocialEngineering": true,
    "testingHours": "24/7",
    "requiredHeaders": {
      "X-HackerOne-Research": "overtimedev"
    },
    "testAccounts": {
      "note": "Sign up with @wearehackerone.com email or use provided creds",
      "credentials": []
    },
    "uatToProd": false,
    "staticAnalysisOnly": false,
    "customRules": []
  },
  "bountyTable": {
    "critical": { "min": 1000, "max": 5000 },
    "high": { "min": 500, "max": 2000 },
    "medium": { "min": 150, "max": 800 },
    "low": { "min": 50, "max": 250 }
  },
  "platform": {
    "name": "HackerOne",
    "url": "https://hackerone.com/program",
    "username": "overtimedev"
  }
}
```

## Key Fields for Validation Pipeline

### `excluded.vulnTypes` (Critical)
This array is checked by:
- **report-validator hook** — warns when writing a report for an excluded vuln type
- **finding-tracker hook** — warns when a detected finding matches an excluded type
- **validate-report skill** — Gate 3 (Exclusion List) checks this
- **dedup-checker skill** — Layer 4 (Program Exclusion Check)

When setting up scope, **always extract the full non-qualifying list** from the program page.

### `rules.requiredHeaders` (Critical)
This object is checked by:
- **report-validator hook** — warns if curl commands in reports are missing these headers
- **proof-validator skill** — adds these headers when re-running PoC commands
- **context-loader** — injects into all agent prompts

### `authorized.assets` (New in v2)
Structured asset list with tiers. Used by:
- **validate-report skill** — Gate 1 (Asset Accuracy) matches report asset against this list
- **hunt-loop** — iterates through assets in tier order
- **siege mode** — uses tiers for ROI calculation

### `bountyTable`
Used by:
- **siege mode** — ROI calculation for target prioritization
- **h1-report** — severity calibration
- **hunt-loop** — deciding whether a Low finding is worth reporting

## Import from scope.md

When `/greyhatcc:scope import` is used, parse scope.md and extract:
1. All in-scope assets → `authorized.assets` + `authorized.domains`
2. All excluded domains → `excluded.domains`
3. Full non-qualifying vuln type list → `excluded.vulnTypes`
4. Program rules → `rules`
5. Bounty table → `bountyTable`
6. Platform info → `platform`

## Validation
- **scope-validator hook**: Checks Bash commands against authorized domains/IPs
- **report-validator hook**: Checks report assets against authorized.assets
- **finding-tracker hook**: Checks detected findings against excluded.vulnTypes
- **validate-report skill**: Comprehensive 8-gate validation uses all scope fields
