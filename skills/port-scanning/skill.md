---
name: port-scanning
description: Intelligent port scanning orchestration with nmap service detection and vulnerability scripting
---

# Port Scanning

## Usage
`/greyhatcc:portscan <target> [--quick|--full|--vuln|--udp|--stealth]`

## Context Loading (MANDATORY)
Before executing this skill:
1. Load scope: `.greyhatcc/scope.json` — verify target IP/domain is in scope, note exclusions
2. Load hunt state: `.greyhatcc/hunt-state.json` — check active phase, resume context
3. Load program files: `findings_log.md`, `tested.json`, `gadgets.json` — avoid duplicating work
4. Load memory: Check MEMORY.md for target-specific notes from previous sessions
5. Check program rules: respect rate limits, testing hours, prohibited methods (some programs ban aggressive scanning)

## Scan Profiles

### Quick (default) — 2-5 minutes
```bash
nmap -Pn -sV --top-ports 1000 -T4 <target>
```
Flags: `-Pn` skip host discovery (assume up), `-sV` version detection, `-T4` aggressive timing.

### Full — 15-60 minutes
```bash
nmap -Pn -sV -sC -p- -T3 <target>
```
Flags: `-p-` all 65535 ports, `-sC` default scripts, `-T3` normal timing (less likely to trigger rate limits).
Use `run_in_background: true` for this — it takes time.

### Vulnerability — 5-15 minutes
```bash
nmap -Pn -sV --script vuln -p <detected_ports> <target>
```
Run AFTER quick/full scan. Only scan ports already discovered. `--script vuln` runs vulnerability detection scripts.

### UDP — 10-30 minutes
```bash
nmap -Pn -sU --top-ports 100 -T4 <target>
```
Flags: `-sU` UDP scan (much slower than TCP). Focus on top 100 UDP ports.
Key UDP services: DNS (53), SNMP (161/162), TFTP (69), NTP (123), LDAP (389).

### Stealth — 10-30 minutes
```bash
nmap -Pn -sS -sV --top-ports 1000 -T2 --randomize-hosts --data-length 50 <target>
```
Flags: `-sS` SYN scan (half-open), `-T2` polite timing, `--randomize-hosts` random scan order, `--data-length` pad packets.
Use when: WAF/IDS is active, program requires low-noise testing.

## Nmap Flag Reference

| Flag | Purpose | When to Use |
|------|---------|-------------|
| `-Pn` | Skip host discovery | Always (assume host is up) |
| `-sV` | Version detection | Always (identify service versions) |
| `-sC` | Default scripts | Full scans (fingerprint + light vuln check) |
| `-sS` | SYN stealth scan | When avoiding detection |
| `-sU` | UDP scan | When looking for DNS, SNMP, NTP |
| `-p-` | All 65535 ports | Full scans |
| `--top-ports N` | Top N common ports | Quick scans |
| `-T0` to `-T5` | Timing (paranoid to insane) | T2-T4 typical for bug bounty |
| `--script <name>` | NSE script | Targeted vuln checking |
| `-oN`, `-oX`, `-oG` | Output format | Save results (normal, XML, grepable) |
| `--open` | Show only open ports | Reduce output noise |
| `-A` | Aggressive (OS + version + scripts + traceroute) | Deep enumeration |
| `--reason` | Show why port is open/closed | Debugging scan results |

## Background Execution

For long-running scans, use background execution:
```bash
# Full TCP scan in background
nmap -Pn -sV -sC -p- -T3 -oN recon/portscan_full.txt <target>
# Run with run_in_background: true
```

Monitor progress:
```bash
# Check if nmap is still running
ps aux | grep nmap
```

## Output Parsing

After scan completes, extract key findings:

| Service Found | Significance | Next Steps |
|--------------|-------------|------------|
| HTTP (80/443) | Web application | `/greyhatcc:webapp`, `/greyhatcc:js` |
| SSH (22) | Remote access | Check version, brute force if in scope |
| MySQL (3306) / PostgreSQL (5432) | Database | Check for default creds, public access |
| Redis (6379) | Cache/DB | Check for unauthenticated access |
| MongoDB (27017) | NoSQL DB | Check for unauthenticated access |
| Elasticsearch (9200) | Search engine | Check for open API, data exposure |
| Docker (2375/2376) | Container engine | Check for unauthenticated API |
| Kubernetes (6443/8443) | Orchestrator | Check for exposed API, RBAC bypass |
| RDP (3389) | Remote desktop | Check version, BlueKeep |
| SMB (445) | File sharing | Check for null session, EternalBlue |
| SNMP (161) | Network management | Check for public community string |
| FTP (21) | File transfer | Check for anonymous login |

## Post-Scan
1. Parse results and extract open ports + service versions
2. Cross-reference services with Shodan data (MCP: `greyhatcc_s__shodan_host_lookup`)
3. Check detected versions against CVE database (MCP: `greyhatcc_sec__cve_search`)
4. Save to `recon/portscan_<target>_<profile>.md`
5. Update `tested.json` with ports scanned
6. Feed non-standard ports into webapp-testing skill

## State Updates
After completing this skill:
1. Update `tested.json` — record what was tested (asset + vuln class)
2. Update `gadgets.json` — add any informational findings with provides/requires tags for chaining
3. Update `findings_log.md` — log any confirmed findings with severity
4. Update hunt-state.json if in active hunt — set lastActivity timestamp
