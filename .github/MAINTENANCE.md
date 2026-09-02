# TG-BlogPost Maintenance and Architecture Guide

## System Overview

- **Engine**: Cloudflare Workers (TypeScript)
- **Database**: Cloudflare D1 (`DB`)
- **AI Integration**: Google Gemini REST API
- **Publishing Channel**: Telegram Bot API Webhook

## Scheduled Triggers

- `*/5 * * * *` (Every 5 minutes): Runs periodic editorial check, publication queues, and reminder dispatch.
