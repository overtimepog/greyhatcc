# Severity Definitions

| Level | CVSS Range | Description | Examples |
|-------|-----------|-------------|----------|
| Critical | 9.0-10.0 | Full system compromise, mass data breach, RCE | SQLi with data extraction, RCE, full ATO chain, cloud credential theft |
| High | 7.0-8.9 | Significant data access, auth bypass, targeted compromise | IDOR on PII, privilege escalation, stored XSS on auth domain, SSRF to internal |
| Medium | 4.0-6.9 | Limited data access, requires conditions | Reflected XSS, CSRF on sensitive action, information disclosure of internal paths |
| Low | 0.1-3.9 | Minimal impact, informational | Version disclosure, missing headers (only if chainable), open redirect (standalone) |
| Informational | 0 | No direct security impact | Gadget inventory items, signals for chain building |

## Chain Severity Uplift

| Chain Length | Uplift |
|-------------|--------|
| 2 gadgets | highest individual + 1 level |
| 3 gadgets | highest individual + 2 levels |
| 4+ gadgets | cap at Critical |

## CVSS Quick Reference

- AV:N = remotely exploitable (most web vulns)
- AC:L = no special conditions needed
- PR:N = no authentication required
- UI:N = no user interaction
- S:C = crosses trust boundary (XSS: web→browser)
- C:H/I:H/A:H = full confidentiality/integrity/availability impact
