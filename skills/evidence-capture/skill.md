---
name: evidence-capture
description: Capture and organize evidence for vulnerability findings including HTTP request/response logs, screenshots, and tool outputs
---

# Evidence Capture

## Usage
Typically called from within other skills/workflows, not directly.

## Evidence Types

1. **HTTP Logs**: Save curl commands and responses
   ```
   evidence/<finding_id>/request.txt  - curl command
   evidence/<finding_id>/response.txt - HTTP response
   ```

2. **Tool Output**: Save scan/test tool outputs
   ```
   evidence/<finding_id>/nmap_output.txt
   evidence/<finding_id>/nuclei_output.txt
   ```

3. **Screenshots**: Via Playwright browser
   ```
   evidence/<finding_id>/screenshot.png
   ```

## Directory Convention
```
evidence/
├── finding_001/
│   ├── request.txt
│   ├── response.txt
│   └── screenshot.png
├── finding_002/
│   ├── nmap_output.txt
│   └── nuclei_output.txt
└── README.md
```

Link evidence files to findings in FINDINGS_LOG.md.
