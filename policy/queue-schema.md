# Queue Item Schema

Work items follow this minimal schema. See src/shared/hunt-types.ts for full TypeScript types.

## Required Fields

| Field | Type | Description |
|-------|------|-------------|
| type | string | recon, test, exploit, validate, report |
| subtype | string | specific task (e.g., subdomain-enum, xss-test) |
| target | string | URL, domain, or IP |
| priority | 0-100 | scheduling priority (higher = sooner) |
| model_tier | haiku/sonnet/opus | LLM tier for execution |

## Priority Reference

| Base Priority | Scenario |
|--------------|----------|
| 90-100 | Critical finding validation, active chain exploitation |
| 75-89 | High-confidence signal follow-up, proof validation |
| 60-74 | Standard testing, targeted recon |
| 45-59 | Broad recon, coverage gap filling |
| 30-44 | Low-priority exploration |
| 0-29 | Background/speculative |

## Priority Adjustments

| Condition | Delta |
|-----------|-------|
| Signal amplification match | +20 |
| High bounty scope | +15 |
| Parent high confidence (>0.6) | +15 |
| Chain opportunity | +25 |
| Needs validation | +30 |
| Failed once | -10 |
| Failed twice | -25 |
| Low confidence signal (<0.3) | -15 |
| Duplicate risk | -20 |
| Coverage gap | +10 |

## Model Tier Defaults

| Worker Category | Default Tier |
|----------------|-------------|
| recon/* | haiku |
| test/quick-scan, test/cors, test/redirect | haiku |
| test/* (other) | sonnet |
| exploit/* | opus |
| validate/scope, validate/dedup | sonnet |
| validate/proof | opus |
| report/* | sonnet |
