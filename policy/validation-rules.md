# Validation Rules

## 5-Gate Pipeline

| Gate | Check | Fail Action | Tier |
|------|-------|-------------|------|
| 1. Scope | Target in program scope? | REJECT (permanent) | sonnet |
| 2. Exclusion | Vuln type excluded by program? | REJECT or convert to gadget | sonnet |
| 3. Dedup | Already reported or disclosed? | REJECT if score >70 | sonnet |
| 4. Proof | PoC reproducible 2/3 times? | RETURN to test/exploit | opus |
| 5. Quality | Report meets H1 standards? | RETURN to report | opus |

## Dedup Scoring

| Source | Score |
|--------|-------|
| Internal match (our findings.json) | +100 |
| Already submitted | +100 |
| H1 dupe check: HIGH | +80 |
| H1 dupe check: MEDIUM | +40 |
| H1 dupe check: LOW | +10 |
| Hacktivity match | +60 |
| Web search match | +30 |

Thresholds: <40 = PASS, 40-70 = REVIEW, >70 = REJECT

## H1 Universal Exclusions

Never report standalone:
- Clickjacking on non-sensitive pages
- CSRF on non-sensitive forms
- CORS without demonstrated impact
- Version disclosure
- CSV injection
- Open redirects without chain
- SSL/TLS configuration
- Missing cookie flags
- Missing security headers
- SPF/DKIM/DMARC
- Rate limiting without proven impact
- Self-XSS without chain
- Broken link hijacking, tabnabbing

Exception: any excluded type is reportable when chained into demonstrated impact.
