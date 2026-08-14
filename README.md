# TG-BlogPost

AI editorial engine for Alisher's personal Telegram blog.

## Architecture

- Cloudflare Worker + Cron
- D1 for editorial memory and state
- Gemini REST API for research, writing and QA
- Telegram Bot API for approval and publishing
- No image generation in the core pipeline
- Irregular editorial timing instead of a fixed posting schedule

## Pipeline

1. Research the open web.
2. Score topics for novelty, value and fit with Alisher's worldview.
3. Write an original post using the style DNA.
4. Run a strict Uzbek-language and anti-AI QA pass.
5. Schedule naturally, without fixed recurring slots.
6. Send an approval preview 20 minutes before publication.
7. Publish only after explicit approval.
8. If rejected, collect feedback and revise.

## Secrets

Never commit these values:

- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`

Set them in the Cloudflare Worker production environment/secrets.

## Cloudflare D1

This project is designed to use the **existing D1 database binding managed by the Cloudflare Worker dashboard**. The repository intentionally does not create, rename, or provision a D1 database during deployment.

The Worker bootstraps its application tables at runtime, so a separate migration step is not required for the production deployment path.

## Local development

```bash
npm install
npm run types
npm run check
npm run dev
```

## Deployment

```bash
npm run check
npm run deploy
```

The production Cloudflare deployment uses the Worker configuration in `wrangler.jsonc`. Existing dashboard-managed bindings and production secrets must remain configured in Cloudflare.

After deployment, configure Telegram's webhook to point to:

`https://YOUR_WORKER_DOMAIN/telegram/webhook`

## Important behavior

The system is allowed to produce **no post** when no sufficiently original or valuable topic is found. This is intentional. The blog is a personal blog, not a news feed.
