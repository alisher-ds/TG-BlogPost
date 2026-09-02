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
