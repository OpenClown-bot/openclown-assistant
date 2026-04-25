# awesome-openclaw-skills — fork-candidate audit

> Required reading for: **Architect** (Phase 0: Recon — non-negotiable input).
> Helpful for: **Reviewer** (SPEC mode — to detect a sloppy or skipped Phase 0).
> NOT for: **Business Planner** (these are implementation choices).

**Source of truth:** <https://github.com/VoltAgent/awesome-openclaw-skills>

This file is a **starting point**, not an exhaustive catalogue. The Architect MUST go to the source repo, audit at least 3 candidates per major capability the PRD requires, and record findings in the ArchSpec §0 Recon Report. The audit categories below are the ones relevant to the v0.1 KBJU Coach scope; future PRDs may add categories.

## Why this file exists

Earlier in this project we discovered fork-candidates (`diet-tracker`, `calorie-counter`, `opencal`, `faster-whisper`) **after** the tech stack was already locked. That is malpractice — we lost an opportunity to fork instead of build, and we could only learn it had been wasted retrospectively.

This file, plus the mandatory Phase 0 in `docs/prompts/architect.md`, prevents that recurrence. If you are the Architect and you skip this file, the Reviewer will fail your ArchSpec automatically and the PO will reject the PR.

## How to audit a candidate

For each candidate skill listed below (and any others you find at the source), the Architect must:

1. **Open the source.** README, license, last commit date, dependency list.
2. **Map to PRD.** Which PRD §/Goal/US would this skill close, and how completely?
3. **Score the verdict:**
   - **fork** — copy the skill into our repo (vendored under `src/skills/<name>/` if Architect proposes this layout in an ADR), modify for our needs.
   - **reference** — read the source for design inspiration, write our own.
   - **reject** — does not fit; explain concretely why (license, abandoned, wrong language, wrong domain, etc.).
4. **Record in ArchSpec §0.2 audit table** with the URL, verdict, and one-line rationale.

If you find a candidate not listed below that is relevant — audit it too. The list here is seed material, not a closed set.

## Categories relevant to v0.1

### A. KBJU / nutrition / calorie tracking

The PRD will likely require: lookup of macronutrients per food item (per 100g and per portion), daily aggregation, weekly trends.

Seed candidates to audit (verify each at the source repo):

- `diet-tracker` — generic diet logging skill.
- `calorie-counter` — calorie estimation by food name.
- `opencal` — open-source calorie database wrapper.

**Known limitation:** none are reportedly Russian-localized out of the box. The Architect should test on Russian food names ("гречка", "творог 5%", "блины"), or add an ADR for the Russification approach (e.g. translate query → lookup → translate back, or fork and add localised name aliases).

### B. Voice transcription (Russian)

The PRD will require: voice → text in Russian with reasonable WER on conversational speech, latency budget set in PRD §7.

Seed candidates:

- `faster-whisper` — local CTranslate2-based Whisper. Lower memory than vanilla Whisper. Russian works.
- `auto-whisper-safe` — safety wrapper around Whisper.
- `assemblyai-transcribe` — paid API, cited high accuracy.
- `deepgram` — paid API, real-time.
- `elevenlabs-transcribe` — paid API.
- `eachlabs-voice-audio` — voice audio toolchain.

**v0.1 default (per project lock-in):** OpenAI Whisper API (~$0.006/min, ≈$1.50/month for 2 users at our usage envelope). This is an *external API call*, not one of the awesome-skills candidates above.

**v0.2 deferred:** local `faster-whisper` for cost / privacy. The Architect should design the voice-transcription component with a **provider-abstraction interface** so v0.1 → v0.2 swap is a single ADR + Ticket, not a redesign.

### C. Photo recognition for meals (v0.1 — labelled "оценочно")

The PRD will likely require: photo → estimated macros, with `confidence=low` flag and explicit user confirmation.

Seed candidates: search the catalogue for `vision`, `food-photo`, `meal-photo`, `macro-from-image`. This category is sparser than A and B.

**Important caveat to record in ADR:** vision models give ±30–40% error on macros. The PRD must explicitly accept this and require user-confirmation UX.

### D. Summary / coach (LLM with prompt)

Generic LLM call wrappers in the catalogue (search for `summarise`, `coach`, `advisor`). Most likely **reference**, not fork — our prompts will be domain-specific to KBJU.

### E. Scheduling

OpenClaw's `cron-tools` plugin is the main path; no skill fork needed unless we want a richer "send daily summary at user's local time" wrapper.

## What to do if no candidate fits

- State explicitly in §0.4 of the Recon Report: "Capability X has no suitable fork-candidate. Will write from scratch."
- The Architect then designs the component normally and writes Tickets for it.

## After Phase 0

Once the Recon Report is in the ArchSpec, the rest of the workflow proceeds (Phase 1 Bootstrap, etc.). The Recon Report is **versioned with the ArchSpec** — if a new candidate appears later, that's a new ArchSpec revision, not a retroactive edit.
