# TG-BlogPost Maintenance and Architecture Guide

## System Overview

- **Engine**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (`DB`)
- **AI Integration**: Google Gemini REST API
- **Publishing Channel**: Telegram Bot API Webhook

## Scheduled Triggers

- `*/5 * * * *` (Every 5 minutes): Runs periodic editorial check, publication queues, and reminder dispatch.

## Resilience and Rate-Limits
- Exponential backoff is applied for external AI and search provider calls.
- D1 migrations maintain schema backward compatibility across Worker releases.

- Gemini model temperature is pinned to maintain predictable editorial consistency.
- Webhook payload headers are verified against secret tokens on each incoming request.
- Cloudflare D1 query lifecycle respects per-request execution context.
- Publishing window operates during peak reader engagement hours.

- Worker memory allocation is set to standard tier with adequate headroom for JSON payload parsing.
- Cloudflare D1 handles automated WAL checkpointing without blocking read queries.
- Posts exceeding 4096 characters are split at natural paragraph boundaries.
- Topics scoring below 0.65 in novelty are filtered out prior to drafting.
