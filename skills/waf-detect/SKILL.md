---
name: waf-detect
description: Detect WAF/CDN protection on targets and suggest bypass techniques based on detected technology
---

# WAF Detection and Bypass

## Usage
Part of the recon workflow, or standalone for specific targets.

## Detection
Use MCP tool `greyhatcc_sec__waf_detect` to identify WAF/CDN.

## Bypass Techniques by WAF

### Akamai
- TLS fingerprint evasion: Use curl_cffi with Chrome impersonation or Playwright
- Randomize TLS ClientHello per-connection
- Rotate sessions before score accumulates
- Body padding past inspection limits

### Cloudflare
- Origin IP discovery: Shodan SSL cert search, historical DNS, SPF/MX leakage, favicon hash
- Use `greyhatcc_s__shodan_ssl_cert` to find origin

### AWS WAF
- Body inspection limit 8KB -- pad past it to bypass
- HTTP Parameter Pollution (70%+ bypass rate per WAFFLED 2024)

### General
- HTTP/2 downgrade attacks
- Unicode normalization tricks
- Content-Type switching
- Chunked transfer encoding manipulation
- GraphQL alias batching for rate limit bypass

## Output
Save to `recon/waf_detection.md` with detected WAF, confidence, and recommended bypass techniques.
