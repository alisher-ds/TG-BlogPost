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

Set them with Wrangler secrets in the production environment.

## D1

Create the database, put its ID in `wrangler.jsonc`, then apply migrations:

```bash
npx wrangler d1 create tg-blogpost-db
npx wrangler d1 migrations apply tg-blogpost-db --remote
```

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
npx wrangler deploy
```

After deployment, configure Telegram's webhook to point to:

`https://YOUR_WORKER_DOMAIN/telegram/webhook`

## Important behavior

The system is allowed to produce **no post** when no sufficiently original or valuable topic is found. This is intentional. The blog is a personal blog, not a news feed.
