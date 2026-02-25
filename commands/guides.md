---
name: guides
description: "Show bug bounty reference guides, cheatsheets, and methodology resources for vulnerability research"
aliases:
  - references
  - cheatsheets
  - playbooks
allowed-tools: Task, Read, Glob, Grep, WebFetch, WebSearch
argument-hint: "<topic or \"list\">"
skill: greyhatcc:reference-guides
---

# Reference Guides

Invoke the `greyhatcc:reference-guides` skill with: {{ARGUMENTS}}

Curated offensive security reference library organized by topic:

**General Methodology:**
- HackTricks (book.hacktricks.xyz) - Comprehensive pentesting encyclopedia
- HowToHunt (KathanP19/HowToHunt) - Bug bounty hunting methodology by vulnerability class
- PayloadsAllTheThings (swisskyrepo) - Payload lists for every attack vector
- OWASP Testing Guide v4 - Structured web application testing methodology
- OWASP Web Security Testing Guide - Checklist-driven approach

**Vulnerability-Specific:**
- XSS: PortSwigger XSS cheat sheet, Brute XSS, XSS Hunter payloads
- SQLi: PortSwigger SQLi cheat sheet, sqlmap tamper scripts reference
- SSRF: SSRF bible, cloud metadata endpoints list, protocol smuggling guides
- SSTI: tplmap payloads, engine-specific injection syntax reference
- Deserialization: ysoserial gadget chains, PHPGGC, marshalsec
- GraphQL: graphql-threat-matrix, InQL guide, batching attack references
- JWT: jwt.io debugger, algorithm confusion attack guides, kid injection techniques
- OAuth: PortSwigger OAuth labs, OAuth security best practices RFC
- Race Conditions: HTTP/2 single-packet attack methodology, Turbo Intruder scripts

**Tooling References:**
- Burp Suite: extension recommendations, configuration guides, macro setup
- Nuclei: custom template writing, workflow configuration
- ProjectDiscovery: subfinder + httpx + nuclei pipeline optimization
- Frida: mobile app hooking scripts, SSL pinning bypass snippets

**Operations:**
- `list` - Show all available guide categories
- `<topic>` - Fetch and summarize the most relevant guides for a specific topic
- Guides are fetched live via WebFetch for the most current content
