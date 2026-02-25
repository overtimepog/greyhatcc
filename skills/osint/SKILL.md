---
name: osint
description: Open source intelligence gathering for targets including organizational profiling, infrastructure mapping, and attack surface discovery
---

# OSINT Gathering

## Usage
`/greyhatcc:osint <target domain or organization>`

## Intelligence Sources

1. **Web Search**: Use WebSearch for organizational info, news, technology disclosures
2. **GitHub**: Search for repos, leaked secrets, API endpoints
   - `site:github.com "<domain>"` for code references
   - `site:github.com "<org>" password OR secret OR api_key` for leaks
3. **Shodan**: Infrastructure intelligence via MCP tools
4. **DNS History**: Historical DNS records for origin IP discovery
5. **CT Logs**: Certificate transparency for subdomain discovery
6. **Cloud Assets**: S3 buckets, Azure blobs, GCP storage enumeration

## Delegate to:
- `osint-researcher` (sonnet) for comprehensive multi-source OSINT
- `osint-researcher-low` (haiku) for quick single-source lookups

## Output
Structured OSINT report with:
- Organizational profile
- Technology stack
- Infrastructure map
- Discovered assets
- Potential attack vectors
- Credential exposure assessment
