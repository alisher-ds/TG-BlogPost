# TG-BlogPost

> **Agentic editorial automation for a personal Telegram blog.**

TG-BlogPost is a production-oriented AI editorial engine that researches topics, evaluates them against an editorial profile, drafts original Uzbek content, runs a dedicated QA pass, schedules publication, and asks for explicit human approval before anything is published.

The system is intentionally allowed to **publish nothing** when the available material is not original or valuable enough.

<div align="center">

**Research → Editorial reasoning → Drafting → QA → Scheduling → Human approval → Publishing**

</div>

---

## What it does

| Stage | Responsibility |
| --- | --- |
| **Research** | Finds current topics and source evidence from the open web. |
| **Scoring** | Evaluates novelty, value, source quality, urgency, and fit with the author's worldview. |
| **Editorial** | Turns research into an original post following the author's writing DNA. |
| **QA** | Checks Uzbek language quality, originality, tone, structure, and AI-like patterns. |
| **Scheduling** | Chooses a natural publishing window instead of forcing fixed posting slots. |
| **Approval** | Sends a preview to the admin roughly 20 minutes before publication. |
| **Revision** | Reworks rejected drafts using human feedback. |
| **Publishing** | Publishes only after explicit approval through Telegram. |

---

## Architecture

```text
                         ┌──────────────────────┐
                         │      Cloudflare       │
                         │        Worker        │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │       Editorial Engine        │
                    └───────────────┬───────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
   ┌────────────┐           ┌─────────────┐           ┌────────────┐
   │  Research  │           │  Editorial  │           │     QA     │
   │   Agent    │──────────▶│    Agent    │──────────▶│   Agent    │
   └────────────┘           └─────────────┘           └─────┬──────┘
                                                            │
                                                            ▼
                                                     ┌─────────────┐
                                                     │  Scheduler  │
                                                     └──────┬──────┘
                                                            │
                                                            ▼
                                                     ┌─────────────┐
                                                     │  D1 Memory  │
                                                     └──────┬──────┘
                                                            │
                                                            ▼
                                                     ┌─────────────┐
                                                     │   Telegram  │
                                                     │   Approval  │
                                                     └──────┬──────┘
                                                            │
                                                ┌───────────┴───────────┐
                                                │                       │
                                                ▼                       ▼
                                           Approved                 Revision
                                                │                       │
                                                └───────────┬───────────┘
                                                            ▼
                                                     ┌─────────────┐
                                                     │  Telegram   │
                                                     │  Publishing │
                                                     └─────────────┘
```

### Runtime model

The Worker runs on a five-minute cron. Each cycle bootstraps the D1 schema, maintains the Telegram webhook, publishes due posts, sends approval reminders, and starts a new editorial cycle only when there is no active post in the pipeline. fileciteturn27file0

---

## Editorial pipeline

```text
Open web
   ↓
Topic candidates
   ↓
Novelty / value / source-quality scoring
   ↓
Editorial fit
   ↓
Original draft
   ↓
Uzbek + originality + style QA
   ↓
Natural scheduling
   ↓
20-minute approval preview
   ↓
┌───────────────┐
│ Approve       │──────▶ Publish
│ Reject/Revise │──────▶ Feedback → Draft → QA
└───────────────┘
```

The current production behavior is deliberately conservative: no sufficiently good topic means **no post**. That is a feature, not a failure mode. fileciteturn28file0

---

## Technology

**Runtime**  
Cloudflare Workers · TypeScript · Wrangler

**Storage**  
Cloudflare D1 / SQLite

**AI**  
Gemini REST API · structured generation · editorial QA

**Messaging**  
Telegram Bot API · webhook · inline approval flow

**Operations**  
Cron Triggers · Cloudflare Observability · environment secrets

---

## Project structure

```text
src/
├── agents/          # research, editorial and QA intelligence
├── editorial/       # pipeline orchestration and scheduling
├── providers/       # external AI / web providers
├── prompts/         # editorial instructions and style DNA
├── telegram/        # webhook, approval and publishing
├── schema.ts        # D1 schema bootstrap
├── types.ts         # domain types
└── index.ts         # Worker entrypoint
```

The repository keeps domain responsibilities separated instead of putting the entire bot in one handler. The Worker entrypoint coordinates infrastructure and delegates editorial behavior to focused modules. fileciteturn36file0

---

## Production deployment

The production deployment uses the existing Cloudflare Worker configuration and dashboard-managed bindings. The repository does not provision or rename the production D1 database during deployment. `npm run deploy` resolves to the standard Wrangler deployment command. fileciteturn28file0

Required runtime configuration includes:

- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `ADMIN_TELEGRAM_ID`
- `ADMIN_SECRET`
- `BLOG_USERNAME`
- `TIMEZONE`
- posting-gap configuration

**Security note:** `ADMIN_TELEGRAM_ID` identifies the authorized Telegram administrator; `ADMIN_SECRET` is a separate secret used for HTTP admin endpoints. The Telegram ID must never be used as an authentication secret.

---

## Local development

```bash
npm install
npm run types
npm run check
npm run dev
```

Deploy:

```bash
npm run deploy
```

---

## Engineering decisions

### Human-in-the-loop by design

The system can research and draft autonomously, but publishing remains an explicit human decision. This prevents a low-quality generation from becoming a public post automatically.

### Irregular publishing

A personal blog should not behave like a news feed. The scheduler works within configurable time boundaries rather than publishing at a rigid daily slot.

### Editorial memory

D1 stores the system's state and editorial history so the pipeline can reason about active posts and avoid treating every execution as an isolated request.

### Fail closed

Missing infrastructure or schema initialization errors stop the relevant operation instead of silently continuing with an inconsistent state.

### Separate identity from authentication

Telegram identity determines who can approve or revise through the bot. HTTP admin access uses a dedicated secret, keeping authentication credentials independent from public identifiers.

---

## Status

**Production-oriented MVP** — actively iterating.

The core pipeline, Telegram approval flow, D1 state, scheduled execution, and Cloudflare deployment model are implemented. The next engineering focus is deeper automated testing, stronger webhook authentication, richer observability, and measurable editorial-quality evaluation.

---

## Roadmap

- [ ] Automated unit tests for editorial state transitions
- [ ] End-to-end pipeline tests with mocked providers
- [ ] Telegram webhook secret-token validation
- [ ] Editorial quality metrics and regression set
- [ ] Better source deduplication and provenance tracking
- [ ] More granular operational metrics
- [ ] Safer retry / idempotency controls for external calls

---

## Philosophy

> **A personal blog is better served by one genuinely valuable post than by ten mediocre automated posts.**

TG-BlogPost is built around that constraint.
