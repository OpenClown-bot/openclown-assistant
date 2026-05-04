# Product Owner Self-Testing Guide — KBJU Coach v0.1

**Audience:** Product Owner (`@yourmomsenpai`).
**Purpose:** Step-by-step path to deploy the v0.1 KBJU Coach Telegram bot from `main`, become its first real-world user, and start generating empirical pilot data that the v0.2 PRDs (`PRD-002` Observability and Scale Readiness, `PRD-003` Tracking Modalities Expansion) will baseline against.
**Status:** authoritative for v0.1; will be **superseded section-by-section** as v0.2 ArchSpecs ship continuous breach detection (PRD-002 G1), automated stall recovery (PRD-002 G2), modalities expansion (PRD-003), and the config-driven access path (PRD-002 G7).

This guide is **not** a customer-facing user manual. It is the founder's operational runbook for becoming pilot-user-1 of the bot you commissioned.

---

## 0. Why this guide exists

Per `docs/prd/PRD-001-kbju-coach.md` v0.2.0 §6 KPI table, every K1–K7 pilot baseline is currently `n/a` — meaning no real-user 30-day pilot has run yet. The 5 Ticket Orchestrator pilots (TKT-010 through TKT-014, closed 2026-05-02; see `docs/session-log/2026-05-02-session-2.md` for the retrospective) implemented and reviewed all 15 v0.1 tickets end-to-end with **mocked** smoke tests (see `tests/pilot/` and `src/pilot/pilotReadinessReport.ts`). The product is implementation-complete and CI-validated, but unmeasured against real human behaviour.

You become pilot-user-1 when you:
1. Stand up the Docker Compose stack on your VPS (§1).
2. Wire the `TELEGRAM_PILOT_USER_IDS` allowlist to your own Telegram user ID (§2).
3. Run the canonical `/start` → onboarding → meal-log → summary loop end-to-end (§3).
4. Run the right-to-delete loop to verify tenant isolation (§4).
5. Generate a daily pilot-readiness report and review the K1–K7 KPI snapshot (§5).
6. Document any user-facing friction in `docs/backlog/` so it informs v0.2 dispatches (§6).

Sections §1–§6 are sequential. §7 (smoke tests) and §8 (troubleshooting) are reference material, not part of the pilot path.

---

## 1. Stand up the Docker Compose stack

The v0.1 deployment artifacts shipped in **TKT-013 (Deployment Packaging)**: `Dockerfile`, `docker-compose.yml`, `.env.example`, `src/deployment/healthCheck.ts`, plus the operations scripts in `scripts/migrate-vps*.sh` / `scripts/backup-kbju.sh` / `scripts/rollback-kbju.sh`. Everything you need to run the bot is on `main`.

### 1.1 Prerequisites on your VPS

- Docker Engine 27+ with Compose v2 plugin
- `git`
- A domain or static IPv4 (for Telegram webhook delivery — the v0.1 bot uses long-polling so a public IP is **not** required, but you'll want one for v0.2 webhook migration if PRD-002 G7 ratifies that path)
- Outbound HTTPS to `api.telegram.org`, your `OMNIROUTE_BASE_URL`, `api.fireworks.ai` (fallback), and `api.nal.usda.gov` (USDA FDC for nutrition lookups)
- An empty database volume (Compose creates one automatically; ensure your VPS has ≥4 GB free disk for Postgres-17 + Docker images)

### 1.2 One-time setup

```bash
# On your VPS, in your repos directory:
git clone https://github.com/OpenClown-bot/openclown-assistant.git
cd openclown-assistant
cp .env.example .env
```

Then edit `.env` and fill **every** variable. Reference for what each one does:

| Variable | Source | What it gates |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) → `/newbot` → save the API token | Telegram bot API auth; without it the bot can't connect |
| `TELEGRAM_PILOT_USER_IDS` | Your own numeric Telegram user ID (get it from [@userinfobot](https://t.me/userinfobot)) — comma-separated, no spaces | The allowlist enforced by `src/telegram/`; the bot will silently ignore messages from any user ID not in this list. Per ARCH-001 v0.4.0 §3.1 access-control envelope. |
| `DATABASE_URL` | `postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/kbju` (the value you'll use because Compose names the DB service `postgres`) | Tenant-scoped store (C3) — meals, drafts, KBJU targets, summaries, audit events |
| `POSTGRES_PASSWORD` | Any strong random string (e.g. `openssl rand -base64 32`) | Postgres authentication; must match what `DATABASE_URL` uses |
| `OMNIROUTE_BASE_URL` | The VPS-internal address of your OmniRoute router (e.g. `http://omniroute:8000/v1` if you run OmniRoute as a Docker neighbour, OR `https://omniroute.infinitycore.space:8443/v1` if you point at the production router; whichever matches your operator setup) | Primary LLM router for KBJU estimation, voice transcription, photo recognition (C5/C6/C7) |
| `OMNIROUTE_API_KEY` | Your OmniRoute API key (the same one used by `.pr_agent.toml` / `.github/workflows/pr_agent.yml` for PR-Agent CI) | Auth for the router |
| `FIREWORKS_API_KEY` | Direct Fireworks API key (failover only when OmniRoute unreachable) | Per `infra/omniroute/README.md` §"Direct provider keys are runtime fallback only" — set it but the application code never reads it directly |
| `USDA_FDC_API_KEY` | Free key from [api.nal.usda.gov](https://api.nal.usda.gov) — sign up takes 1 minute | KBJU lookup for foods the LLM-classifier can't resolve via a model alone |
| `PERSONA_PATH` | Path inside the container to the persona JSON (default `dist/persona/kbju-coach.json` — bundled by the build) | Russian-language voice/style for bot replies |
| `PO_ALERT_CHAT_ID` | Your own Telegram user ID OR a private channel ID where you want to receive operational alerts | Per PRD-001 §6 K4 — tenant-isolation breach + cost-ceiling alerts go here |
| `MONTHLY_SPEND_CEILING_USD` | Default `10` — keep this small for your own pilot | Per ADR-006@0.1.0 — when monthly token spend approaches this, C10 stops accepting new LLM calls and emits a degrade event |
| `AUDIT_DB_URL` | Same as `DATABASE_URL` for v0.1 (audit events live in the main DB; PRD-002 v0.2.1 §7 may move audits to a separate store) | C11 right-to-delete + tenant audit service backing store |

### 1.3 First run

```bash
docker compose up -d --build
docker compose ps
```

Expect three healthy services: `app`, `postgres`, `metrics`. The `app` service runs the OpenClaw skill containing the Telegram bot in long-polling mode. The `metrics` service exposes Prometheus-compatible metrics at `127.0.0.1:9464/metrics` (port-bound to localhost only — do **not** expose externally without auth).

```bash
docker compose logs -f app | head -40
```

You should see the bot announce successful Telegram API connection and Postgres connection. If you see `ConfigError` on stdout, the variable named in the error is missing or malformed in `.env`.

### 1.4 Operational scripts

The scripts in `scripts/` are designed for VPS migration / backup / rollback workflows, **not** for first-time deployment. Familiarise yourself but do not run them on a fresh deploy:

- `scripts/backup-kbju.sh` — `pg_dump` of the Postgres volume; run nightly via cron
- `scripts/migrate-vps.sh` / `scripts/migrate-vps-kbju.sh` — VPS-to-VPS migration
- `scripts/rollback-kbju.sh` — restore from the most recent backup

---

## 2. Allowlist yourself + verify gating

The allowlist (`TELEGRAM_PILOT_USER_IDS`) is the v0.1 access-control mechanism per ARCH-001 v0.4.0 §3.1. Until PRD-002 G7 (config-driven user-access path) ratifies a successor mechanism, this static list is the only way the bot accepts traffic.

### 2.1 Find your Telegram user ID

Open Telegram → message [@userinfobot](https://t.me/userinfobot) → it replies with your numeric user ID (e.g. `123456789`).

### 2.2 Wire it into `.env`

```
TELEGRAM_PILOT_USER_IDS=123456789
```

If you want to invite a friend or partner as pilot-user-2 later, comma-separate: `TELEGRAM_PILOT_USER_IDS=123456789,987654321` — but for the **first 7 days** of your own pilot keep it just yourself, so K1–K7 baselines are not contaminated by mixed users.

### 2.3 Restart the app

```bash
docker compose restart app
docker compose logs -f app | grep -i "allowlist\|pilot"
```

### 2.4 Verify gating works

Open Telegram, find your bot (the username you registered with @BotFather), and send `/start`. Expect a Russian reply within ≤5s p95 per PRD-001 §7. If you receive nothing, see §8 Troubleshooting.

To verify the allowlist actually rejects non-allowed users: ask a friend (whose user ID is **not** in the list) to send `/start` to the bot. Their message should be silently ignored — the bot replies nothing. If they receive a reply, your allowlist is misconfigured; recheck §2.2.

---

## 3. The canonical pilot loop (run this for ≥7 days)

This is the K1–K7 measurement window for your own pilot. Run it daily.

### 3.1 Onboarding (first day only)

Send `/start`. The bot walks you through the C2 deterministic state machine (`src/onboarding/onboardingFlow.ts`):

1. Greeting + persona introduction.
2. Sex (`жен` / `муж`).
3. Age in years.
4. Height in cm.
5. Weight in kg.
6. Activity level (5 options: sedentary → very active).
7. Weight goal (`lose` / `maintain` / `gain`).
8. Confirmation: the bot computes Mifflin-St Jeor BMR + TDEE, then derives daily KBJU targets. If `goal=lose`, the calorie-floor cascade per ADR-010@0.1.0 clamps the result to your sex-specific floor (1200 kcal/day female, 1500 kcal/day male) and **discloses the clamp to you before confirmation**. Reply `да` to confirm.

After confirmation the bot is in C4 (meal-logging) state. C2 will not re-trigger unless you `/forget_me`.

### 3.2 Daily meal logging (test all 3 modalities)

The bot accepts three input modalities for meal logging:

**Text:**
```
Завтрак — омлет из двух яиц, ломтик сыра, помидор, чашка кофе с молоком.
```

The C6 KBJU Estimator routes through OmniRoute → Fireworks LLM, parses items, looks up KBJU values via FDC for known items + LLM-estimate for unknowns, returns a draft with item-level macros. Reply `да` to confirm, or send corrections (`без сыра`).

**Voice (this is the higher-latency path; PRD-001 §7 envelope is ≤8s p95 vs ≤5s for text):**

Record a Telegram voice message describing your meal. C5 transcribes via Fireworks (or whatever ASR alias your OmniRoute config maps), C6 estimates KBJU as above. Confirmation flow identical.

**Photo:**

Send a Telegram photo of a plate. C7 Photo Recognition Provider classifies via the configured vision model. **Note:** v0.1 PRD-001 §3 NG3 explicitly limits photo recognition to high-confidence cases — if the classifier returns confidence below the threshold, the bot replies «не уверен — опиши текстом» and waits for text/voice fallback. This is **not** a bug; it's the v0.1 NG. PRD-003 §5 US-3 bumps photo recognition coverage in v0.2.

For the first 7 days, log **at least 3 meals/day** using a mix of all 3 modalities. K1–K3 + K7 calibrate from this data.

### 3.3 Summary recommendation

The C9 Summary Recommendation Service runs daily (default 21:00 local time per ADR-009@0.1.0; configurable via `PERSONA_PATH` JSON). It calculates the day's KBJU consumption vs target and replies in Russian with one of three modes:

- `praise` — within ±5 % of all targets
- `course_correct` — outside band but recoverable
- `reset` — cumulative weekly drift exceeds threshold

You'll receive this automatically. To force-trigger for testing:
```
/summary
```
(Wait ~3-5s; this routes through C9 + the active LLM model for tone, not just deterministic math.)

### 3.4 History edits

If you mis-logged a meal:
```
история
```
(or `/history`). The bot replies with the day's confirmed meals and inline edit/delete controls (per TKT-010 H-Mutation-Flow). Tap delete on the affected meal — C8 will tombstone it (soft-delete; the row is retained for audit but excluded from KBJU sums).

---

## 4. Right-to-delete loop (run once per pilot)

Per PRD-001 §3 NG4 + ADR-008@0.1.0 + TKT-012, you have an enforceable right to total data erasure.

### 4.1 Trigger

```
/forget_me
```

The bot replies asking confirmation. Reply `да`.

### 4.2 What happens

C11 (Right-to-Delete and Tenant Audit Service) runs the cascading delete: meals, drafts, summaries, KBJU targets, onboarding state, audit events, voice/photo blobs (if any retained — v0.1 ARCH-001 §3.7 retention policy is delete-on-confirm). Replies with `MSG_FORGET_ME_DONE` (`src/telegram/messages.ts:7` — «Все данные удалены. Для начала заново отправь /start.»).

### 4.3 Verify

Send any message — bot should respond as if you're a brand-new user (no history, no targets, no persona memory). Run `/start` to re-onboard if you want to continue testing after the right-to-delete check.

This loop is the K4 baseline (tenant-isolation guarantee under right-to-delete). PRD-002 G1 promotes K4 from end-of-pilot audit to **continuous** breach detection — after PRD-002 ships, you should see the audit-cascade running on every storage operation, not just on `/forget_me`.

---

## 5. Pilot KPI snapshot

The K1–K7 KPI smoke suite was implemented in **TKT-014**. To generate a redacted pilot-readiness report:

```bash
docker compose exec app node dist/pilot/pilotReadinessReport.js
```

This runs the queries in `src/pilot/kpiQueries.ts` against your Postgres data and prints a markdown-formatted summary. It is intentionally **redacted** — meal text, exact timestamps, user IDs, and other PII are not printed; only counts, percentiles, and outcome flags. The redactions are validated in `tests/pilot/redaction.test.ts`.

What to look for:

| KPI | What it measures | What good looks like (PRD-001 §6 baseline target) |
|---|---|---|
| K1 | Onboarding-to-confirmed-target latency p95 | ≤120 s p95 |
| K2 | Text meal log → confirmation latency p95 | ≤5 s p95 |
| K3 | Voice meal log → confirmation latency p95 | ≤8 s p95 |
| K4 | Tenant-isolation audit (zero cross-tenant reads) | 0 breaches over the rolling window |
| K5 | Daily summary delivered on time | ≥95 % of pilot-days within ±10 minutes of configured time |
| K6 | Macro tolerance band over ≥7-day window | KBJU sum within ±5 % of target on ≥70 % of pilot-days |
| K7 | Confirmation turnaround (draft → confirmed) | p95 ≤45 s of bot response |

After ≥7 days of canonical loop usage, run the report and **paste the output to the next Devin Orchestrator session as a non-blocking message**. The v0.2 PRD-002 ArchSpec dispatch will use these numbers as the pre-instrumentation baseline (i.e. what the continuous-detection system in PRD-002 G1+G2+G3 has to be at least as good at catching).

---

## 6. Capturing user-facing friction → backlog

When you run into a UX rough edge (typo in a Russian reply, unclear prompt, slow modality, unexpected error), capture it in `docs/backlog/` rather than chat. The closest existing backlog files for v0.1 user-facing issues:

- `docs/backlog/history-followups.md` — TKT-010 history mutation friction
- `docs/backlog/summary-followups.md` — TKT-011 summary recommendation friction
- `docs/backlog/right-to-delete-followups.md` — TKT-012 RTD friction
- `docs/backlog/deployment-followups.md` — TKT-013 deployment friction (this is also where BACKLOG-009 lives)
- `docs/backlog/pilot-kpi-smoke-followups.md` — TKT-014 KPI smoke friction

Adding a backlog entry is a small clerical PR (Devin Orchestrator can author it for you on request). The DO has write-zone access to `docs/backlog/` per CONTRIBUTING.md row 17. Send a chat message like «друг, я заметил X — добавь в backlog Y» and the DO will open a clerical PR within minutes.

For substantive issues (e.g. the bot is silently dropping voice messages, K3 latency is consistently over budget) — these are **architectural feedback** for PRD-002 / PRD-003 ArchSpec dispatch, not just backlog entries. Tell the DO directly so they factor into the Architect boot kit.

---

## 7. Smoke-test reference (run before sharing the bot with non-pilot users)

```bash
# All of these run inside the app container — assume `docker compose up -d` is healthy.
docker compose exec app npm test -- tests/pilot/                  # Pilot KPI smoke (K1-K7)
docker compose exec app npm test -- tests/onboarding/             # C2 state machine
docker compose exec app npm test -- tests/meals/                  # C4 + C6 + C7 + C5 mocked
docker compose exec app npm test -- tests/history/                # TKT-010 mutation flow
docker compose exec app npm test -- tests/summary/                # TKT-011 scheduler
docker compose exec app npm test -- tests/privacy/                # TKT-012 right-to-delete + redaction
docker compose exec app npm test -- tests/deployment/             # TKT-013 compose smoke + .env.example
```

All seven groups should pass. If any fail on `main`, that is a CI regression — file it as a backlog item under `docs/backlog/deployment-followups.md` with the failing test name + `npm test` output, and ping the DO.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/start` produces no reply | `TELEGRAM_BOT_TOKEN` invalid OR `TELEGRAM_PILOT_USER_IDS` doesn't include your user ID | Verify token via `curl https://api.telegram.org/bot${TOKEN}/getMe` returns `ok: true`; double-check user ID via @userinfobot; restart `app` service |
| Bot replies but takes >30s | OmniRoute unreachable; failover to direct Fireworks key is happening (slow path) | Check `OMNIROUTE_BASE_URL` connectivity from container: `docker compose exec app curl -fsS ${OMNIROUTE_BASE_URL}/models` |
| Onboarding never confirms target | `USDA_FDC_API_KEY` invalid OR Postgres not reachable | Inspect `app` logs for `ConfigError` or `Pg connect refused` |
| Photo recognition returns «не уверен» on most photos | Expected v0.1 behaviour per PRD-001 §3 NG3 (high-confidence-only). PRD-003 §5 US-3 will improve this in v0.2. | Use text or voice modality instead, or wait for PRD-003 ArchSpec to ship |
| Daily summary doesn't arrive | C9 scheduler timezone misalignment — default is UTC, persona JSON may need `summary_local_tz: "Europe/Moscow"` | Edit the persona JSON path mapped via `PERSONA_PATH` and restart `app` |
| Cost ceiling alert spamming you | `MONTHLY_SPEND_CEILING_USD` set too low for your usage | Bump it in `.env` and `docker compose restart app`; or optimize via `infra/omniroute/README.md` §"Per-call budget guard" |
| `tests/pilot/` fails with `redactK1Report not found` | Old build artefact; rebuild | `docker compose build app && docker compose up -d --force-recreate app` |
| `pg_isready` timing out | Postgres volume corrupted or insufficient disk | `docker compose logs postgres` — if disk-full, free space and `docker compose restart postgres` |
| Stale `dist/` after a code update | TypeScript build didn't run inside the container | `docker compose build --no-cache app` |

---

## 9. What v0.2 will change (preview)

When PRD-002 v0.2.1 ArchSpec ratifies + implementation lands, this guide will be updated. Anticipated section deltas:

- **§4 right-to-delete** → augmented with continuous breach detection (PRD-002 G1). You'll see breach alerts in your `PO_ALERT_CHAT_ID` chat in real time, not just on `/forget_me`.
- **§3.2 voice / photo modalities** → expanded with the C5/C7 stall recovery path (PRD-002 G2). Stalls > 120 s will auto-detect and emit operator-actionable events.
- **§5 KPI snapshot** → augmented with the PR-Agent CI tail-latency phase metrics (PRD-002 G3) + the empirically-validated DeepSeek V4 Pro PR-Agent runtime (BACKLOG-009 closed 2026-05-04 via PR #101).
- **§2 allowlist** → superseded by the config-driven user-access path (PRD-002 G7). The static `TELEGRAM_PILOT_USER_IDS` env var becomes one config source among several (e.g. shared-secret invite codes, time-bounded allowlist entries).

When PRD-003 v0.1.2 ArchSpec ratifies + implementation lands:

- **§3 canonical pilot loop** → augmented with the four new modalities: water tracking (PRD-003 G2 / §5 US-1), sleep tracking (G2 / US-2), workout tracking (G3 / US-3), mood inference (G4 / US-4). Each gets its own command shortcut + canonical input shape.

The DO will ping you when each section is ready to be re-tested after a v0.2 implementation TKT lands.

---

## 10. Source-of-truth references (for the DO and Architect, not for you)

This guide cites the following authoritative artifacts (all at the version pinned below, on `main` 2026-05-04):

- `docs/prd/PRD-001-kbju-coach.md` v0.2.0 (approved)
- `docs/prd/PRD-002-observability-and-scale-readiness.md` v0.2.1 (approved)
- `docs/prd/PRD-003-tracking-modalities-expansion.md` v0.1.2 (approved)
- `docs/architecture/ARCH-001-kbju-coach-v0-1.md` v0.4.0 (approved)
- `docs/architecture/adr/ADR-001..ADR-010` (all approved)
- `docs/tickets/TKT-010..TKT-014` (all status `done`)
- `docs/reviews/RV-CODE-010..RV-CODE-014` + `RV-SPEC-001..RV-SPEC-009` (all merged)
- `Dockerfile`, `docker-compose.yml`, `.env.example`, `infra/omniroute/README.md`, `scripts/*.sh`
- `src/telegram/`, `src/onboarding/`, `src/meals/`, `src/voice/`, `src/photo/`, `src/history/`, `src/summary/`, `src/privacy/`, `src/store/`, `src/observability/`, `src/pilot/`, `src/deployment/`

When v0.2 ArchSpecs ship, this list will be re-pinned to the new artifact versions.
