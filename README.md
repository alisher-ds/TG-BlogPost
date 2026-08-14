# TG-BlogPost

AI editorial engine for Alisher's personal Telegram blog.

- Cloudflare Worker + Cron
- D1 for editorial memory and state
- Gemini REST API for research, writing and QA
- Telegram Bot API for approval and publishing
- No image generation in the core pipeline
- Irregular editorial timing instead of a fixed posting schedule

## Production deployment

The production deployment intentionally uses the existing Cloudflare Worker configuration and dashboard-managed bindings. The repository does **not** create, rename, or provision a D1 database during deployment.

`npm run deploy` is the only deployment command used by the Cloudflare build configuration and resolves to the standard `wrangler deploy` command in `package.json`.

Existing Cloudflare production secrets and dashboard bindings must remain configured in Cloudflare.

The Worker bootstraps its application tables at runtime, so a separate production migration step is not required.

## Pipeline

1. Research the open web.
2. Score topics for novelty, value and fit with Alisher's worldview.
3. Write an original post using the style DNA.
4. Run a strict Uzbek-language and anti-AI QA pass.
5. Schedule naturally, without fixed recurring slots.
6. Send an approval preview 20 minutes before publication.
7. Publish only after explicit approval.
8. If rejected, collect feedback and revise.

## Local development

```bash
npm install
npm run types
npm run check
npm run dev
```

## Important behavior

The system is allowed to produce **no post** when no sufficiently original or valuable topic is found. This is intentional. The blog is a personal blog, not a news feed.

<!-- deployment sanity marker: 2026-08-14 -->
