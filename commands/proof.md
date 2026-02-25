---
name: proof
description: Verify PoC reproducibility - re-run commands and confirm findings still work
allowed-tools: Task, Bash, Read, Glob, Grep
skill: greyhatcc:proof-validator
---
Invoke the `greyhatcc:proof-validator` skill. Re-runs PoC commands from a finding or report to confirm they still reproduce. Catches stale findings before submission.
