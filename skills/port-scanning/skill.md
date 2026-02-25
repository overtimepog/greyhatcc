---
name: port-scanning
description: Intelligent port scanning orchestration with nmap service detection and vulnerability scripting
---

# Port Scanning

## Usage
`/greyhatcc:portscan <target> [--quick|--full|--vuln|--udp]`

## Scan Profiles

### Quick (default)
```bash
nmap -Pn -sV --top-ports 1000 -T4 <target>
```

### Full
```bash
nmap -Pn -sV -sC -p- -T3 <target>
```
Use `run_in_background: true` for this - it takes time.

### Vulnerability
```bash
nmap -Pn -sV --script vuln -p <detected_ports> <target>
```

### UDP
```bash
nmap -Pn -sU --top-ports 100 <target>
```

## Post-Scan
1. Parse results
2. Cross-reference services with Shodan data (MCP: shodan_host_lookup)
3. Check detected versions against CVE database (MCP: cve_search)
4. Save to `recon/portscan_<timestamp>.md`
