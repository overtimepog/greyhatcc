---
name: fingerprint
description: "Detect technology stack, frameworks, and versions on a target"
aliases:
  - fp
  - techstack
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<URL or domain>"
skill: greyhatcc:tech-fingerprint
---

# Technology Fingerprinting

Invoke the `greyhatcc:tech-fingerprint` skill for: {{ARGUMENTS}}

Comprehensive technology stack detection for attack surface mapping:

**Detection Methods:**

**HTTP Response Analysis:**
- Server header parsing (Apache, Nginx, IIS, Cloudflare, etc.)
- X-Powered-By and custom framework headers
- Set-Cookie patterns (PHPSESSID, JSESSIONID, ASP.NET_SessionId, _csrf)
- Cache headers revealing CDN and proxy infrastructure
- Security headers inventory (CSP, HSTS, X-Frame-Options, Permissions-Policy)

**HTML and DOM Analysis:**
- Meta generator tags revealing CMS (WordPress, Drupal, Joomla, Ghost)
- CSS and JS framework fingerprints (Bootstrap version, jQuery version, React, Angular)
- HTML comment patterns left by build tools and templating engines
- Favicon hash matching against known application databases

**JavaScript Bundle Analysis:**
- Framework detection: React (ReactDOM), Angular (ng-version), Vue (Vue.config)
- Build tool fingerprints: Webpack, Vite, Rollup, esbuild chunk naming patterns
- Library version extraction from bundle comments and source maps
- API client libraries revealing backend framework (Axios config, fetch wrappers)

**Error Page Fingerprinting:**
- Trigger error responses (404, 500, 403) to reveal default error page templates
- Stack trace analysis for language and framework version detection
- Custom error pages revealing application framework and configuration

**CVE Correlation:**
- Map detected versions to known CVEs in NVD and ExploitDB
- Flag critically vulnerable versions with available public exploits
- Generate a prioritized vulnerability assessment based on detected stack
- Cross-reference with Nuclei templates for automated verification

**Output:**
- Technology stack table with product, version, and confidence score
- Associated CVEs for each detected component
- Attack surface summary based on known weaknesses per technology
- Integration with recon and webapp testing pipelines
