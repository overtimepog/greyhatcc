---
name: recon
description: Multi-phase target reconnaissance combining passive and active techniques for comprehensive attack surface mapping
---

# Reconnaissance Workflow

You are executing the greyhatcc reconnaissance skill. Perform a comprehensive multi-phase recon on the provided target.

## Usage
`/greyhatcc:recon <target>` where target is a domain, IP, or URL.

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


## Phase 1: Passive Reconnaissance

1. **CT Log Enumeration**: Query crt.sh for subdomains
   ```
   Use WebFetch: https://crt.sh/?q=%25.<domain>&output=json
   ```

2. **DNS Records**: Use MCP tool `greyhatcc_sec__dns_records` for comprehensive DNS data

3. **WHOIS**: Use MCP tool `greyhatcc_sec__whois_lookup` for registration data

4. **Shodan Intelligence**: Use MCP tool `greyhatcc_s__shodan_host_lookup` or `greyhatcc_s__shodan_search`

5. **Technology Fingerprinting**: Use MCP tool `greyhatcc_sec__header_analysis` for HTTP headers

6. **WAF Detection**: Use MCP tool `greyhatcc_sec__waf_detect` to identify protections

7. **Wayback Machine**: Use WebFetch on `https://web.archive.org/cdx/search/cdx?url=<domain>/*&output=text&fl=original&collapse=urlkey&limit=500`

## Phase 2: Active Reconnaissance

1. **Port Scanning**: Run nmap via Bash (use run_in_background for full scans)
   - Quick: `nmap -Pn -sV --top-ports 1000 <target>`
   - Full: `nmap -Pn -sV -sC -p- <target>` (background)

2. **SSL/TLS Analysis**: Use MCP tool `greyhatcc_sec__ssl_analysis`

3. **Service Enumeration**: Cross-reference detected services with Shodan data

## Phase 3: Analysis & Output

Delegate to `recon-specialist` agent via Task tool for standard recon, or `recon-specialist-high` for complex targets.

Save all outputs to `<target_dir>/recon/`:
- `subdomains.txt` - Discovered subdomains
- `dns_records.md` - DNS data
- `tech_stack.md` - Technology fingerprint
- `shodan_<ip>.md` - Shodan intelligence
- `recon_summary.md` - Executive summary with attack surface priorities

## Parallel Execution — Agent Dispatch Tables

### Phase 1 Parallel Dispatch (Core Recon)
| Agent | Task | Tier |
|-------|------|------|
| `recon-specialist-low` | CT logs + subdomain enumeration | Haiku |
| `recon-specialist-low` | DNS/WHOIS + DNS records | Haiku |
| `recon-specialist-low` | Shodan host lookup + SSL cert search | Haiku |
| `recon-specialist-low` | Tech fingerprinting + header analysis | Haiku |
| `recon-specialist` | WAF/CDN detection + bypass assessment | Sonnet |

### Phase 2 Parallel Dispatch (Deep Recon)
| Agent | Task | Tier |
|-------|------|------|
| `js-analyst` | Download and analyze all JS bundles — extract endpoints, secrets, source maps | Sonnet |
| `js-analyst-low` | Quick endpoint extraction from main page JS | Haiku |
| `cloud-recon` | S3/GCS/Azure bucket enumeration, Firebase discovery, CDN origin finding | Sonnet |
| `cloud-recon-low` | Quick bucket name guessing from domain patterns | Haiku |
| `subdomain-takeover` | BadDNS + dangling CNAME/NS/MX detection on all discovered subdomains | Sonnet |
| `network-analyst-low` | Port scanning + service enumeration on discovered IPs | Haiku |
| `osint-researcher-high` | Deep OSINT — employee enumeration, acquisition research, job posting analysis | Opus |

### Phase 3 Aggregation
After all agents complete, aggregate results with `recon-specialist` (Sonnet):
- Merge all subdomain lists, deduplicate
- Build unified tech stack profile
- Cross-reference Shodan data with discovered services
- Populate `attack_plan.md` with prioritized targets

## Post-Recon Actions
After recon completes:
1. **Update tested.json** — record which recon tasks were performed
2. **Update gadgets.json** — add informational findings with chaining potential (e.g., internal IPs in DNS = SSRF targets, CSP bucket names = takeover candidates)
3. **Trigger dependent skills** — if JS bundles found, suggest `/greyhatcc:js`; if cloud assets found, suggest `/greyhatcc:cloud`; if dangling subdomains found, suggest `/greyhatcc:takeover`
4. **Feed into attack plan** — update attack_plan.md with prioritized targets based on recon findings

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
