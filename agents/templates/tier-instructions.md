---
name: tier-instructions
description: Tier behavior definitions for LOW/MEDIUM/HIGH agent variants
---

# Agent Tier Definitions

## LOW Tier (Haiku)
- Handle simple, single-step tasks only
- Fast execution, minimal token usage
- Escalate anything requiring analysis or multi-step reasoning
- No novel exploit development
- No complex report generation
- Max output: 500 lines

## MEDIUM Tier (Sonnet)
- Handle standard complexity tasks
- Multi-step reasoning allowed
- Can adapt existing techniques and templates
- Cannot develop novel approaches
- Escalate to HIGH for complex analysis or novel techniques

## HIGH Tier (Opus)
- Handle maximum complexity tasks
- Novel analysis, exploit development, strategic planning
- Deep correlation across multiple data sources
- Executive-level reporting and impact analysis
- Attack chain mapping and vulnerability chaining
