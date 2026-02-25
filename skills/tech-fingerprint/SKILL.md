---
name: tech-fingerprint
description: Detect and document target technology stack including web frameworks, servers, CDNs, JavaScript libraries, and third-party services
---

# Technology Stack Fingerprinting

## Usage
Part of the recon workflow.

## Detection Methods

1. **HTTP Headers**: Use MCP tool `greyhatcc_sec__header_analysis`
   - Server header (Apache, nginx, IIS)
   - X-Powered-By (PHP, ASP.NET, Express)
   - Set-Cookie names (JSESSIONID=Java, PHPSESSID=PHP, connect.sid=Express)

2. **Shodan Banners**: Use MCP tool `greyhatcc_s__shodan_host_lookup`
   - Service versions from banner grabbing

3. **HTML/JavaScript Analysis**: Parse page source
   - Meta generator tags
   - JavaScript library fingerprints
   - CSS framework indicators
   - Framework-specific paths (/wp-content/, /static/admin/)

4. **Error Pages**: Trigger errors to reveal stack information

## CVE Correlation
For each detected technology+version:
- Use MCP tool `greyhatcc_sec__cve_search` for known vulnerabilities
- Cross-reference with Shodan vulnerability data

## Output
`recon/tech_stack.md` with:
- Detected technologies and versions
- Associated CVEs
- Confidence levels
- Recommended testing priorities
