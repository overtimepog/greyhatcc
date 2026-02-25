---
name: waf
description: "Detect WAF/CDN protection and suggest bypass techniques"
aliases:
  - wafcheck
  - cdn
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
argument-hint: "<URL or domain>"
skill: greyhatcc:waf-detect
---

# WAF/CDN Detection and Bypass

Invoke the `greyhatcc:waf-detect` skill for: {{ARGUMENTS}}

Identifies WAF and CDN protection layers and generates targeted bypass strategies:

**WAF Detection:**
- Response header analysis for WAF signature headers (cf-ray, x-sucuri-id, x-akamai-transformed)
- Behavioral detection: send benign payloads vs known-bad payloads, compare responses
- Error page fingerprinting: WAF block pages have distinct templates per vendor
- Timing analysis: WAF inspection adds measurable latency patterns
- TLS fingerprint analysis: WAF/CDN terminates TLS with distinct certificate chains

**Per-WAF Bypass Playbook:**

**Cloudflare:**
- Origin IP discovery via Shodan SSL cert search, historical DNS, SPF/MX record leakage
- CrimeFlare database lookup for previously exposed origin IPs
- Favicon hash matching across Shodan to find direct-IP access
- Bot bypass: Playwright with real Chrome, curl_cffi with browser impersonation

**Akamai:**
- Cipher stunting: randomize TLS ClientHello per connection to avoid JA3/JA4 detection
- Session rotation before bot score accumulates past threshold
- Full Playwright automation for sensor data generation
- Content-type switching between JSON, multipart, and XML for rule bypass

**AWS WAF:**
- Body inspection limit bypass: pad request body past 8KB, place payload beyond inspected region
- Content-type switching to trigger different inspection code paths
- HTTP Parameter Pollution to split payloads across duplicate parameters

**Azure WAF:**
- OWASP CRS 3.2 bypass: escaped backslash techniques still effective
- Unicode normalization differences between WAF and backend
- Comment-padded SQL with mixed case for SQLi bypass

**General Bypass Techniques:**
- HTTP Parameter Pollution: duplicate params split payload across WAF boundaries
- Oversized request padding past WAF inspection limits
- Encoding tricks: double URL encoding, Unicode fullwidth, null byte injection
- Request smuggling: H2.TE via CRLF injection in HTTP/2 headers
- Content-type switching between JSON, multipart/form-data, and XML

**Rate Limit Evasion:**
- Header rotation: X-Forwarded-For, X-Client-IP, True-Client-IP, CF-Connecting-IP
- HTTP/2 single-frame burst for race condition exploitation
- GraphQL alias batching to multiplex operations in a single request
- IP rotation via residential proxies or cloud function endpoints

**Origin IP Discovery:**
- Shodan SSL certificate subject matching across all indexed IPs
- SecurityTrails and ViewDNS for historical DNS records (pre-CDN)
- SPF record analysis for include directives revealing mail server IPs
- MX record analysis for mail infrastructure on origin network
