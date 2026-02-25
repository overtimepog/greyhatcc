---
name: dupes
description: Check finding against database of commonly rejected bug types
allowed-tools: Read, Glob, Grep
skill: greyhatcc:common-dupes
---
Invoke the `greyhatcc:common-dupes` skill. Checks a finding description against 24+ patterns of commonly rejected findings (missing headers, cookie flags, open redirects without chain, etc.) and advises whether to submit, chain, or skip.
