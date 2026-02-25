---
name: js
description: "Analyze JavaScript bundles for API endpoints, secrets, source maps, and client-side vulnerabilities"
aliases:
  - js-analysis
  - javascript
allowed-tools: Task, Bash, Read, Write, Glob, Grep, WebFetch, WebSearch
argument-hint: "<URL or domain>"
skill: greyhatcc:js-analysis
---

# JavaScript Analysis

Invoke the `greyhatcc:js-analysis` skill for target: {{ARGUMENTS}}

Deep analysis of client-side JavaScript for hidden attack surface and sensitive data:

**Bundle Discovery and Download:**
- Crawl target pages to extract all JS file references (inline and external)
- Download and archive all JavaScript bundles for offline analysis
- Detect and download Webpack source maps (.map files) for full source reconstruction
- Historical JS versions via Wayback Machine for comparing changes and finding removed secrets

**Endpoint Extraction:**
- Regex and AST-based extraction of API endpoint paths from JS source
- Identification of internal/admin API routes not exposed in the UI
- GraphQL query and mutation extraction from client code
- WebSocket endpoint discovery (ws:// and wss:// URLs)
- Third-party API integrations and their authentication patterns

**Secret Detection:**
- API keys, tokens, and credentials hardcoded in JS bundles
- AWS access keys, S3 bucket names, and cloud resource identifiers
- Firebase configuration objects with database URLs and API keys
- OAuth client secrets and PKCE code verifiers
- Internal hostnames, IP addresses, and environment-specific URLs
- Debug flags and feature toggles (isAdmin, debugMode, internal_user)

**Framework Detection:**
- Identify frontend framework: React, Angular, Vue, Svelte, Next.js, Nuxt
- Detect state management: Redux, Vuex, MobX (reveals data flow patterns)
- Backend API client libraries revealing API structure and authentication scheme
- Version detection for known vulnerable library versions (e.g., jQuery < 3.5.0 XSS)

**Client-Side Vulnerability Analysis:**
- DOM XSS sinks: innerHTML, DOM write methods, eval, Function(), setTimeout with strings
- Prototype pollution gadgets in library code
- postMessage handlers without origin validation
- Open redirect patterns in client-side routing
- Insecure use of localStorage/sessionStorage for sensitive tokens
