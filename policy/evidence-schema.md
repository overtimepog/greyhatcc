# Evidence Schema

## Evidence File Format

All evidence stored as JSON in hunt-state/evidence/:

```json
{
  "id": "ev-{uuid}",
  "type": "http_exchange | screenshot | tool_output | js_bundle | file_content",
  "created_at": "ISO-8601",
  "work_item_id": "parent work item UUID",
  "target": "URL or host",
  "summary": "one-line description",
  "data": {
    // type-specific payload
  }
}
```

### HTTP Exchange
```json
{
  "type": "http_exchange",
  "data": {
    "request": { "method": "GET", "url": "...", "headers": {}, "body": "" },
    "response": { "status": 200, "headers": {}, "body_preview": "first 500 chars", "body_file": "path if large" }
  }
}
```

### Screenshot
```json
{
  "type": "screenshot",
  "data": { "file": "hunt-state/evidence/ss-{uuid}.png", "page_url": "...", "description": "..." }
}
```

### Tool Output
```json
{
  "type": "tool_output",
  "data": { "tool": "shodan_host_lookup", "input": {}, "output_preview": "first 500 chars", "full_output_file": "path if large" }
}
```

## Evidence Index

Workers update hunt-state/evidence-index.md with one line per evidence item:
```
| ID | Type | Target | Summary | Work Item |
```
