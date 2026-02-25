---
name: js-analysis
description: Automated JavaScript bundle analysis pipeline - source map extraction, API endpoint discovery, secret detection, and client-side vulnerability hunting
---

# JavaScript Analysis Pipeline

## Usage
`/greyhatcc:js <URL or domain>`

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

Also:
1. Read scope.md, findings_log.md for the target program
2. Read recon/ artifacts if they exist (tech stack, subdomains)
3. Validate target is in scope

## Why This Matters

JavaScript bundles are the single highest-ROI target for bug bounty hunters. They contain:
- API endpoints the UI never exposes
- Hardcoded secrets (API keys, tokens, DSNs)
- Debug flags and feature toggles
- Internal hostnames and infrastructure details
- Source maps that reconstruct the entire original source code
- Business logic that reveals authentication flows, payment processing, admin features

Source map disclosure alone has paid $25k+. Exposed API keys in JS pay $500-$5k routinely.

## Phase 1: Bundle Discovery

### 1a. Crawl for JS Files
```bash
# Use Playwright to load the page and capture all JS requests
# OR extract from page source
```

Use Playwright MCP `browser_navigate` to load the target URL, then `browser_network_requests` to capture all loaded JS files. Filter for `.js` and `.chunk.js` URLs.

Also check:
- View page source for inline `<script>` tags
- `/_next/static/` for Next.js apps
- `/static/js/` for React/CRA apps
- `/assets/` for Vite/Vue apps
- Wayback Machine for historical JS files: `https://web.archive.org/cdx/search/cdx?url=<domain>/*.js&output=text&fl=original&collapse=urlkey&limit=200`

### 1b. Download All Bundles
```bash
# Download each discovered JS file
curl -sk -o bundle_main.js "https://target.com/static/js/main.abc123.js"
```

Save to `bug_bounty/<program>_bug_bounty/recon/js/`

## Phase 2: Source Map Extraction

### 2a. Check for Source Maps
For every JS bundle, check:
```bash
# Check for sourceMappingURL comment at end of file
tail -5 bundle_main.js | grep sourceMappingURL

# Try common source map paths
curl -sk -o /dev/null -w "%{http_code}" "https://target.com/static/js/main.abc123.js.map"
curl -sk -o /dev/null -w "%{http_code}" "https://target.com/static/js/main.abc123.map"
```

Also check:
- `SourceMap` HTTP header in the response
- `.map` extension appended to any JS URL
- Next.js: `/_next/static/chunks/*.js.map`
- Webpack dev server: `/webpack-internal://`

### 2b. Reconstruct Source from Maps
If source maps are found, they contain the original source code. Extract with:
```bash
# Parse the source map JSON to extract original files
python3 -c "
import json, os, sys
with open('bundle.js.map') as f:
    sm = json.load(f)
for i, src in enumerate(sm.get('sources', [])):
    content = sm.get('sourcesContent', [None]*len(sm['sources']))[i]
    if content:
        path = f'reconstructed/{src.lstrip(\"./\").lstrip(\"webpack:///\")}'
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as out:
            out.write(content)
print(f'Extracted {len(sm.get(\"sources\", []))} source files')
"
```

**This is a HIGH-severity finding if source maps are publicly accessible in production.** Document immediately.

## Phase 3: Static Analysis

### 3a. API Endpoint Extraction
Search all JS files for:
```
Patterns to grep:
- /api/v[0-9]+/          → Versioned API paths
- /graphql               → GraphQL endpoints
- fetch\(["']            → Fetch calls with URLs
- axios\.(get|post|put)  → Axios HTTP calls
- \.ajax\(               → jQuery AJAX
- XMLHttpRequest         → Raw XHR
- baseURL.*["']          → Base URL configurations
- endpoint.*["']         → Endpoint definitions
- /v[0-9]+/              → API version paths
- ws://|wss://           → WebSocket endpoints
```

### 3b. Secret Detection
Search for:
```
Patterns to grep:
- ['"](AKIA|ASIA)[A-Z0-9]{16}['"]    → AWS Access Keys
- sk[-_]live[-_][a-zA-Z0-9]+          → Stripe Secret Keys
- ghp_[a-zA-Z0-9]{36}                → GitHub Personal Access Tokens
- glpat-[a-zA-Z0-9\-]{20}            → GitLab Access Tokens
- xox[bporas]-[a-zA-Z0-9-]+          → Slack Tokens
- AIza[0-9A-Za-z\-_]{35}             → Google API Keys
- sk-[a-zA-Z0-9]{48}                 → OpenAI API Keys
- eyJ[a-zA-Z0-9_-]*\.eyJ             → JWT Tokens (base64)
- -----BEGIN (RSA |EC )?PRIVATE KEY   → Private Keys
- password\s*[:=]\s*["'][^"']+["']   → Hardcoded Passwords
- api[_-]?key\s*[:=]\s*["'][^"']+    → Generic API Keys
- secret\s*[:=]\s*["'][^"']+         → Generic Secrets
- token\s*[:=]\s*["'][^"']+          → Generic Tokens
- dsn.*https://.*@.*sentry            → Sentry DSNs
- phc_[a-zA-Z0-9]+                   → PostHog Project Keys
```

### 3c. Infrastructure & Config Extraction
Search for:
```
Patterns to grep:
- s3\.amazonaws\.com                  → S3 Bucket references
- \.blob\.core\.windows\.net          → Azure Blob Storage
- storage\.googleapis\.com            → GCP Storage
- \.cloudfront\.net                   → CloudFront distributions
- \.herokuapp\.com                    → Heroku apps
- \.firebaseio\.com                   → Firebase databases
- \.firebaseapp\.com                  → Firebase apps
- cognito-idp\.[a-z-]+\.amazonaws    → Cognito User Pools
- launchdarkly                        → Feature flag services
- \.auth\.[a-z-]+\.amazoncognito      → Cognito auth domains
- DEBUG|debug.*true                   → Debug flags
- NODE_ENV.*development               → Environment leaks
- localhost:[0-9]+                    → Local dev URLs left in prod
- 10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+ → Internal IPs
```

### 3d. Business Logic Analysis
Search for:
```
Patterns to identify:
- Redux action names (dispatch, reducer, action types) → API operation map
- Route definitions (react-router, vue-router) → Hidden admin/internal routes
- Role checks (isAdmin, hasPermission, role ===) → Authorization logic
- Payment/pricing logic (price, amount, discount, coupon) → Business logic targets
- Feature flags (featureFlag, isEnabled, flagsmith, launchdarkly) → Toggle state
- Error messages with internal details → Information disclosure patterns
```

## Phase 4: Output

### Artifacts to Save
```
bug_bounty/<program>_bug_bounty/recon/js/
├── bundles/                    → Downloaded JS files
├── source_maps/                → Downloaded .map files (if found)
├── reconstructed/              → Extracted source (if maps available)
├── api_endpoints.md            → All discovered API endpoints
├── secrets_found.md            → Any secrets/keys detected
├── infrastructure.md           → Internal URLs, S3 buckets, services
├── routes.md                   → Client-side routes (admin panels, etc.)
└── js_analysis_summary.md      → Executive summary with findings
```

### Finding Documentation
For each significant discovery:
1. Add to findings_log.md via `/greyhatcc:findings`
2. Add to gadgets.json with `chaining_potential` (e.g., "discovered API endpoint feeds into IDOR testing")
3. If HIGH/CRITICAL (source maps, secrets, admin routes) → generate h1-report immediately

## Delegation
- Full analysis → `recon-specialist` (sonnet) with this skill as instruction
- Quick endpoint extraction → `recon-specialist-low` (haiku)
- Source map reconstruction + deep analysis → `recon-specialist-high` (opus)


## Agent Dispatch Protocol
When delegating to agents via Task(), ALWAYS:
1. **Prepend worker preamble**: "[WORKER] Execute directly. No sub-agents. Output ≤500 words. Save findings to disk. 3 failures = stop and report."
2. **Set max_turns**: haiku=10, sonnet=25, opus=40
3. **Pass full context**: scope, exclusions, existing findings, recon data
4. **Route by complexity**: Quick checks → haiku agents (-low). Standard work → sonnet agents. Deep analysis/exploitation → opus agents.

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
