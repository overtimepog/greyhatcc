---
name: cve
description: "Search and analyze CVE vulnerabilities by ID, product, or keyword"
aliases:
  - vuln
  - vulnerability
allowed-tools: Task, Bash, Read, Write, Glob, Grep, WebFetch, WebSearch
argument-hint: "<CVE-YYYY-NNNNN or keyword>"
skill: greyhatcc:cve-lookup
---

# CVE Research

Invoke the `greyhatcc:cve-lookup` skill for: {{ARGUMENTS}}

Comprehensive CVE intelligence gathering and analysis:

**Lookup Modes:**
- By CVE ID: `CVE-2024-12345` - Full detail on a specific vulnerability
- By product: `Apache Struts` - All CVEs affecting a product or library
- By keyword: `JWT bypass` - Search for CVEs matching a vulnerability pattern
- By CWE: `CWE-89` - All CVEs in a specific weakness category

**Analysis Output:**
- Vulnerability description with root cause analysis
- Affected product versions and confirmed vulnerable configurations
- CVSS v3.1 score breakdown with individual metric rationale
- Attack vector, complexity, privileges required, user interaction
- Known exploits: ExploitDB entries, Metasploit modules, GitHub PoCs
- Patch availability and specific remediation versions
- Related CVEs and vulnerability family analysis

**Exploit Correlation:**
- Cross-references ExploitDB, PacketStorm, and GitHub for public exploits
- Identifies Nuclei templates available for automated detection
- Maps CVE to MITRE ATT&CK techniques for kill chain context
- Checks if the target's detected tech stack versions are in the vulnerable range

**Integration:**
- Feeds discovered CVEs into the gadget inventory for chain analysis
- Links CVE findings to specific target assets from recon data
- Generates exploit command templates ready for adaptation
