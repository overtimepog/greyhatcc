---
name: loop
description: Start persistent hunt loop that doesn't stop until triple-verification passes
allowed-tools: Task, Bash, Read, Write, Edit, Glob, Grep, WebFetch, WebSearch
skill: greyhatcc:hunt-loop
---
Invoke the `greyhatcc:hunt-loop` skill. This starts a persistent hunting loop for the given program. The hunter doesn't sleep — it keeps going until all scope assets are tested, all findings validated, and triple-verification passes.
