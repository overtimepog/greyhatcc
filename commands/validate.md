---
name: validate
description: Multi-gate report quality validation before HackerOne submission
allowed-tools: Task, Bash, Read, Glob, Grep, WebFetch, WebSearch
skill: greyhatcc:validate-report
---
Invoke the `greyhatcc:validate-report` skill. Runs 8 quality gates on a report: asset accuracy, scope compliance, exclusion list, duplicate check, proof of exploitation, CVSS integrity, report completeness, and program rule compliance.
