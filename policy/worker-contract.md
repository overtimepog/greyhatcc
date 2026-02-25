# Worker Output Contract

Every worker returns a compact result. Never return raw tool output in context.

## Required Fields

- `summary`: 1-3 sentences, max 200 chars
- `evidence_ids`: array of evidence file paths (e.g., `hunt-state/evidence/ev-{uuid}.json`)
- `signals`: array of `{type, target, confidence, description}` — max 5
- `findings`: array of `{id, title, severity, confidence, target}` — summaries only, full finding written to hunt-state/findings.json
- `gadgets`: array of `{id, type, target, provides, requires}` — max 5
- `next_actions`: array of `{type, subtype, target, priority, reason}` — max 10
- `decision`: brief reason for key choices made during execution
- `stage_status`: "complete" | "partial" | "blocked" | "failed"

## Evidence Storage

Raw outputs go to files, never to return values:
- HTTP request/response → `hunt-state/evidence/http-{uuid}.json`
- Screenshots → `hunt-state/evidence/ss-{uuid}.png`
- Tool output → `hunt-state/evidence/tool-{uuid}.json`
- JS analysis → `hunt-state/evidence/js-{uuid}.json`

Reference by ID only: `evidence_ids: ["hunt-state/evidence/http-abc123.json"]`

## Size Limits

- summary: ≤200 characters
- signals: ≤5 items
- findings: ≤3 items (summaries only)
- gadgets: ≤5 items
- next_actions: ≤10 items
- total return: aim for ≤500 tokens
