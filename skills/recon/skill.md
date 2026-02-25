---
name: recon
description: Multi-phase target reconnaissance combining passive and active techniques for comprehensive attack surface mapping
---

# Reconnaissance Workflow

You are executing the greyhatcc reconnaissance skill. Perform a comprehensive multi-phase recon on the provided target.

## Usage
`/greyhatcc:recon <target>` where target is a domain, IP, or URL.

## MANDATORY: Load Context First
Before executing, follow the context-loader protocol:
1. Load guidelines: CLAUDE.md (5-phase recon methodology, infrastructure mapping, code intelligence)
2. Load program guidelines: scope.md → verify target is in scope, note any testing restrictions
3. Load engagement: findings_log.md (avoid re-discovering known findings), tested.json
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions (WAF type, bypass techniques, known infrastructure)
5. If recon was partially done before, check existing artifacts in `recon/` to avoid duplicating work

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

## Parallel Execution
Launch multiple recon tasks in parallel using Task tool:
- Subdomain enum (recon-specialist-low)
- DNS/WHOIS (recon-specialist-low)
- Shodan lookup (recon-specialist-low)
- Tech fingerprint (recon-specialist-low)
Then aggregate results with recon-specialist.

## Post-Recon Actions
After recon completes:
1. **Update tested.json** — record which recon tasks were performed
2. **Update gadgets.json** — add informational findings with chaining potential (e.g., internal IPs in DNS = SSRF targets, CSP bucket names = takeover candidates)
3. **Trigger dependent skills** — if JS bundles found, suggest `/greyhatcc:js`; if cloud assets found, suggest `/greyhatcc:cloud`; if dangling subdomains found, suggest `/greyhatcc:takeover`
4. **Feed into attack plan** — update attack_plan.md with prioritized targets based on recon findings
