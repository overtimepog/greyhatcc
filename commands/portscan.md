---
name: portscan
description: "Run intelligent port scanning with service detection"
aliases:
  - nmap
  - scan
  - ps
allowed-tools: Task, Bash, Read, Write, Glob, Grep
argument-hint: "<IP or domain>"
skill: greyhatcc:port-scanning
---

# Port Scanning

Invoke the `greyhatcc:port-scanning` skill for target: {{ARGUMENTS}}

Intelligent port scanning with adaptive strategies based on target type and scope:

**Scan Types:**
- **Quick** (top 1000) - Fast initial reconnaissance, identifies common services in seconds
- **Extended** (top 10000) - Broader coverage for uncommon service ports
- **Full** (-p-) - All 65535 ports, run in background for comprehensive coverage
- **Service Detection** (-sV -sC) - Version fingerprinting and default script execution
- **UDP** - Top 100 UDP ports for DNS, SNMP, TFTP, NTP, and other UDP services
- **Stealth** (-sS) - SYN scan for reduced detection footprint

**Execution Strategy:**
- Quick scan runs first for immediate results while full scan runs in background
- Service version detection triggers automatic CVE correlation
- Banner grabbing extracts detailed version strings for vulnerability matching
- OS fingerprinting when permitted by scope rules

**Post-Scan Analysis:**
- Map discovered services to known attack vectors
- Identify unusual ports that may indicate backdoors, debug interfaces, or admin panels
- Cross-reference with Shodan data for historical service information
- Flag services running outdated or vulnerable versions
- Detect services that should not be publicly exposed (databases, admin consoles, internal APIs)

**Output:**
- Structured port/service/version table saved to engagement directory
- Automatic findings generation for exposed sensitive services
- Service-to-attack-vector mapping for prioritized testing
- Integration with recon pipeline for continuous monitoring
