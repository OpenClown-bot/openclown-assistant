---
id: ROADMAP-001
title: "v0.2 and beyond — strategic-direction anchor"
version: 0.1.0
status: approved
prd_refs:
  - "PRD-001@0.2.0"
  - "PRD-002@0.2.1"
  - "PRD-003@0.1.2"
arch_refs:
  - "ARCH-001@0.5.0"
author_model: "claude-opus-4.7-thinking"
reviewer_models:
  - "kimi-k2.6"
review_refs:
  - "RV-SPEC-011"
owner: "@OpenClown-bot"
created: 2026-05-06
updated: 2026-05-06
approved_at: 2026-05-06
approved_by: "lindwurm.22.shane (PO)"
approved_note: |
  ROADMAP-001@0.1.0 ratified by Reviewer (Kimi K2.6) per
  docs/reviews/RV-SPEC-011-roadmap-001.md verdict pass_with_changes on 2026-05-06.
  F-M1 (clerical: §6 F-C-1 factual error on PRD owner field) resolved by F-C-1 strike
  in this commit; PO authorised strike via 2026-05-06 chat after Reviewer independently
  verified that PRD-001@0.2.0 + PRD-002@0.2.1 + PRD-003@0.1.2 all use
  owner="@yourmomsenpai" while ARCH-001@0.5.0 + ROADMAP-001@0.1.0 use
  owner="@OpenClown-bot" (PO-owned vs. system-owned convention is intentional, not a bug).
  F-L1 (low: Russian verbatim fidelity unverifiable without PO chat transcript) accepted as
  deferrable. Q-RM-1..Q-RM-9 ratified per §5.10 ratification log (PO authorised Devin
  Orchestrator recommendations via 2026-05-06 chat "выбери лучший и оптимальный вариант";
  per-question answers logged inline). §9 PO sign-off checklist ratified in-full via Devin
  Orchestrator on the same authorisation. Owner-convention documentation queued as a
  separate Devin Orchestrator clerical follow-up against
  docs/meta/devin-session-handoff.md so future BP sessions do not repeat the F-C-1 misread.
supersedes: null
superseded_by: null
---

# ROADMAP-001: v0.2 and beyond — strategic-direction anchor

> Status: `draft`. Authored under a one-off Business-Planner write-zone extension to `docs/roadmap/`
> per Product-Owner authorisation 2026-05-06 (chat). This roadmap is the project's first artefact in
> `docs/roadmap/`; it is intended to be a strategic-direction anchor only, not a release plan, not a
> ticket pipeline, and not an architectural spec. Status flow per `docs/roadmap/README.md`:
> `draft` → `in_review` (Reviewer / RV-SPEC dispatch) → `approved` (PO sets after Reviewer verdict).

## 1. Long-horizon vision

The vision section is intentionally citation-heavy and quotes the Product Owner verbatim in the
original Russian, with a short English summary appended for downstream Architect / Reviewer
consumption. Per the Business-Planner anti-hallucination discipline, this roadmap does not
paraphrase the PO's own words; it cites them.

### 1.1 Canonical short statement (PRD-003 §1, 2026-05-03, verbatim Russian)

The single canonical short form of the long-horizon vision was first committed to the docs-as-code
record by the PO via PRD-003@0.1.2 §1 (Problem Statement, 2026-05-03):

> «персональный ассистент, который помогает графики строить жизни, учёбу планировать»
>
> — Product Owner, cited in `docs/prd/PRD-003-tracking-modalities-expansion.md` §1.

This phrasing is the docs-record-locked north-star. Every PRD listed in §3 below must visibly
converge on it. A PRD that does not converge fails the §1.5 acceptance criterion and should not
ship in the v0.2 band.

### 1.2 PO-elaborated long-horizon vision (this session, 2026-05-06, verbatim Russian)

In response to a Business-Planner clarifying-question batch posted earlier in this session, the
Product Owner expanded the §1.1 short form with a longer free-form statement of the same vision.
This expanded statement is treated as a co-canonical source: the §1.1 phrase remains the locked
short form, and the §1.2 elaboration is the locked long form. Both are quoted verbatim.

> это ассистент, который работает на базе какого-то агента(openclaw, hermes или каких-то других)
> именно такой умный помощник, который помогает пользователю жить.
> он следит за едой, сном, водой и прочим, помогает строить планы, планирует в календарь и тд, и
> тп. С ним можно поговорить и что-то обсудить насчет продуктивности жизни, но и не только.
> он помогает отслеживать тренировки в зале и тд и тп. по лучшим мировым практикам делает всё,
> помогает добиваться целей поставленных.
> так как мы делаем ассистента на агенте с памятью, то этот агент должен очень хорошо
> подстраиваться под пользователя, никогда не галлюцинировать и тд. так же можем прикрутить
> всякие разные плагины типо memos на openclaw, чтобы еще лучше ориентироваться в памяти.
>
> — Product Owner, in-session chat 2026-05-06.

### 1.3 English summary (for Architect / Reviewer)

In a single English paragraph (added strictly so non-Russian-reading downstream roles can consume
this section without re-translation; this paragraph is a summary, not a substitute for §1.1 or §1.2):

The long-horizon vision is a personal life-management assistant built atop a memory-bearing agent
runtime (current production runtime: openclaw, locked by PRD-001@0.2.0 §7; PO has authorised
re-evaluation in the next ArchSpec dispatch — see §6 F-S-1). It tracks food, water, sleep, workouts,
and other life modalities, helps the user build schedules and plan into a calendar, can hold a
free-form conversation about productivity and life topics, and uses persistent per-user memory to
adapt to each user across time. Two non-negotiable quality bars stated by the PO: the assistant
must adapt deeply to its user, and it must never hallucinate. Both bars are inherited by every PRD
in §3 below.

### 1.4 PO-authorised research input list (verbatim cluster headers + URLs)

In the same 2026-05-06 in-session chat, the PO appended a research-input list that the next
Architect dispatch is mandated to consume in full. The PO's strategic directive accompanying that
list is quoted verbatim below; it is a roadmap-level instruction to the next ArchSpec author and is
captured here so it is not lost in chat history. The URL list is reproduced from the PO's chat
verbatim in the same cluster grouping the PO used; the per-URL descriptive context the PO included
is elided here per Business-Planner anti-drift discipline (descriptions reference candidate
agent-runtime components and are Architect-territory, not roadmap-territory). The next Architect
dispatch should treat the elided context as canonical and consult the original chat or session-log
record if a description is needed.

> «сделай нормально, чтобы архитектор точно понял всё, глубоко залез в каждое репо и тд, всё
> внимательно изучил, нашер невероятно классные решения. можно даже где-то рискнуть, чтобы было
> очень круто и прорывно.»
>
> — Product Owner, in-session chat 2026-05-06.

> «архитектор так же провел очень глубокий ресерч, исследовал лучшие решения в агентах. вот
> приложу ссылки, чтобы было чуть легче»
>
> — Product Owner, in-session chat 2026-05-06.

URL list (cluster headers and URLs verbatim from PO's 2026-05-06 message; per-URL descriptive
context elided per BP anti-drift; cluster headers are PO's words):

#### 1.4.1 Hermes Agent — primary sources (PO verbatim cluster header)

- <https://github.com/nousresearch/hermes-agent>
- <https://hermes-agent.nousresearch.com/docs/>
- <https://hermes-agent.nousresearch.com/docs/skills/>
- <https://hermes-agent.nousresearch.com/docs/integrations/>

#### 1.4.2 Hermes Agent — community / curated sources (PO verbatim cluster header)

- <https://github.com/42-evey/hermes-plugins>
- <https://hermesatlas.com/>
- <https://github.com/0xNyk/awesome-hermes-agent>
- <https://felo.ai/blog/best-hermes-agent-skills-2026/>
- <https://github.com/amanning3390/hermeshub>

#### 1.4.3 OpenClaw Ecosystem — primary sources (PO verbatim cluster header)

- <https://openclaw.ai/>
- <https://docs.openclaw.ai/tools/skills>
- <https://docs.openclaw.ai/tools/plugin>
- <https://docs.openclaw.ai/plugins/community>
- <https://docs.openclaw.ai/plugins/bundles>
- <https://github.com/openclaw/openclaw>

#### 1.4.4 OpenClaw Ecosystem — community / curated sources (PO verbatim cluster header)

- <https://github.com/VoltAgent/awesome-openclaw-skills>
- <https://mojafirma.ai/blog/openclaw-10-skills>
- <https://www.digitalocean.com/resources/articles/what-are-openclaw-skills>
- <https://composio.dev/content/top-openclaw-skills>
- <https://composio.dev/content/top-openclaw-plugins>
- <https://www.datacamp.com/blog/top-agent-skills>
- <https://levelup.gitconnected.com/5-openclaw-plugins-that-actually-make-it-production-ready-524168333bac>
- <https://www.freecodecamp.org/news/openclaw-a2a-plugin-architecture-guide/>

#### 1.4.5 OpenClaw "forks" (PO verbatim cluster header)

- <https://github.com/HKUDS/nanobot>
- <https://github.com/sipeed/picoclaw>
- <https://github.com/zeroclaw-labs/zeroclaw>
- <https://github.com/nearai/ironclaw>

The next ArchSpec dispatch (the one that synthesises PRD-003 implementation, per §3 below) is
mandated by this roadmap to include a structured research-section that visibly engages each of the
~27 inputs above and reports back to the PO with: (a) which capabilities each input clusters around,
(b) which existing PRD requirements each candidate runtime satisfies and which it does not, (c)
whether the current runtime lock under PRD-001@0.2.0 §7 should remain, be expanded, or be replaced.
The Architect is explicitly authorised by the PO ("можно даже где-то рискнуть, чтобы было очень
круто и прорывно") to recommend ambitious / non-obvious designs; the runtime lock is not sacred
under this directive.

### 1.5 Convergence test (acceptance criterion for §3 sequence)

This roadmap is acceptable if and only if every PRD in §3 visibly converges on §1.1 + §1.2. The
convergence test is informal but binding: a Reviewer (RV-SPEC) dispatched to ratify ROADMAP-001
should reject a §3 entry that cannot be traced to one or more sentences of §1.1 + §1.2 within a
single hop of plain reasoning. Convergence is the only acceptance criterion at the roadmap level;
individual PRD acceptance criteria are PRD-internal and do not bubble up here.

## 2. Current state (post-PRD-002 G1–G4 closure)

This section summarises what the project ships today, what is approved-but-not-yet-built, what is
actively in BP / Architect cycle, and what the operational envelope looks like. All numbers are
sourced; no figure in this section is unsourced.

### 2.1 Shipped to production (in continuous use by 2 active users)

PRD-001@0.2.0 (KBJU Coach v0.1) is in production for the Product Owner and the partner persona.
Source: `docs/prd/PRD-001-kbju-coach.md` frontmatter `status: approved` + body §5 user-stories
US-1..US-9. Concretely shipped:

- KBJU food-logging via Telegram, on three input modalities: voice messages (US-2), free-form text
  (US-3), and photo input (US-4). Latency envelopes per PRD-001@0.2.0 §7: voice ≤ 8 s p95, text
  ≤ 5 s p95, photo ≤ 12 s p95.
- Daily / weekly / monthly summaries of KBJU intake (US-7).
- History mutation (US-6) — the user can correct any past KBJU entry; this is a hard PRD-001
  requirement, not a stretch goal.
- Right-to-delete (US-8) — `/forget_me` removes all user data from every storage tier; reaffirmed
  in PRD-002 §5 US-5 telemetry-trace deletion semantics.
- Multi-tenant data isolation (US-9 + ARCH-001 §10) — partner data is unreachable from the PO's
  context and vice-versa; isolation is now continuously verified in production by PRD-002 G1.
- Russian-only UX. Telegram-only channel.
- Allowlist-based access — currently 2 users. Allowlist mechanism is config-driven per PRD-002 G4.

PRD-002@0.2.1 (Observability + Scale Readiness) closed all four gates on 2026-05-06. Source:
`docs/session-log/2026-05-06-session-1.md` §6 + closure-PR commit `369a3bd`. Concretely shipped as
infrastructure (not as user-facing features):

- G1 — Continuous tenant-isolation breach detection. Closed by TKT-017@0.1.0 (PR #119). Detector +
  store-wrapper now run in production; cross-tenant violations are detected at runtime and surface
  alerts.
- G2 — Automated model-stall detection + kill-switch. Closed by TKT-018@0.1.0 (PR #125). Stalled
  upstream model calls trigger fail-closed behaviour; 11 synthetic tests guard the boundary.
- G3 — Pull-request-bot CI tail-latency telemetry. Closed by TKT-019@0.1.0 (PR #130). The SDLC
  pipeline now self-observes its own latency budget.
- G4 — Config-driven Telegram allowlist with documented load-test envelope of 10 000 users on a
  single instance. Closed by TKT-020@0.1.0 (PR #131). 22 unit tests + 30 load tests guard the
  envelope. (See §6 F-S-4 below for the scale-pattern audit finding tied to G4.)

### 2.2 Approved but not yet built

PRD-003@0.1.2 (Tracking Modalities Expansion) is the next active PRD. Source:
`docs/prd/PRD-003-tracking-modalities-expansion.md` frontmatter `status: approved` (2026-05-04
Reviewer ratification). Six goals (G1 water, G2 sleep, G3 workouts, G4 mood, G5 per-modality
on/off, G6 adaptive summary integration) are defined in §2 and §5 of that PRD. The corresponding
ArchSpec has not yet been authored — the next Architect dispatch is the natural successor to this
roadmap. See §6 F-S-3 for an audit finding on the six PRD-003 §9 open questions that are still
unresolved despite the `status: approved` flag.

### 2.3 Architecture coverage

ARCH-001@0.5.0 covers PRD-001@0.2.0 + PRD-002@0.2.1 jointly. Source: ARCH-001 frontmatter
`prd_ref: PRD-001@0.2.0; PRD-002@0.2.1` + `status: approved` (2026-05-04, ratified by Reviewer
RV-SPEC-010). Thirteen ADRs (ADR-001..ADR-013) and twenty Tickets (TKT-001..TKT-020) all close
under this ArchSpec. PRD-003 has no architectural coverage as of this roadmap's authorship; the
next ArchSpec dispatch is responsible for either extending ARCH-001 (e.g. ARCH-001@0.6.0) or
authoring a fresh ARCH-002 — the choice is the Architect's per PRD-003 OQ-3 default and per the
PO's Q9 reply in this session ("c — пусть Architect решает"). See §5 Q-RM-9 for the surfaced
question, §3 PRD-NEXT.d for how this affects sequencing.

### 2.4 Open PRs / active tickets

As of 2026-05-06, after the merge of PR #135 (ARCH-001 status flip to approved) and PR #136
(`docs/roadmap/` artefact-type registration), there are zero open PRs on `main` from active SDLC
cycles. There are zero active tickets — TKT-016..TKT-020 are all `done`, no PRD-003 tickets have
been authored yet (the Architect dispatch that produces them has not started). PR #107 is noted in
the cold-handoff as "still open but should not be touched unless PO asks"; status unverified by
this BP author. This roadmap does not change PR #107's status; it surfaces it as part of the
operational state.

### 2.5 Scale envelope (as of 2026-05-06)

The deployed product runs on one VPS with two active users. The infrastructure (PRD-002 G4) is
load-tested to a 10 000-user envelope on a single instance (one bot process serving up to 10 000
allowlisted users). The PRD-001 §7 + ARCH-001 §10 multi-tenant isolation guarantees hold across
that envelope. No external integrations exist (no Apple Health, no Google Fit, no Strava, no
calendar sync — see PRD-003 §3 NG4 for the explicit deferral). No web UI exists (deferred to the
calendar-and-web-view PRD per PRD-003 §3 NG5). No monetisation exists and none is planned for the
v0.2 band per PRD-003 §3 NG8 + the PO's 2026-05-06 Q4 reply. See §6 F-S-4 for the audit finding
that the PO's "thousands users" framing in PRD-002 §1 + §4 P3 has shifted under the PO's 2026-05-06
Q5 clarification (per-user-instance fan-out, not 10 000-users-on-one-instance).

## 3. Next-PRD canonical sequence

This section enumerates the next four-to-six PRDs after PRD-003 in the canonical order they should
ship. PRD-NNN ids are tentative — they remain `PRD-NEXT`, `PRD-NEXT+1`, etc. until the PO
authorises the next Business-Planner dispatch and assigns concrete numerical ids. The order, the
problem framings, and the dependency notes are roadmap-binding (subject to §9 PO sign-off). The
sequencing principle is: PRDs that establish foundations for several downstream PRDs ship before
PRDs that consume those foundations, with maximum permissible parallelism applied per the PO's
Q3 directive ("максимально параллелить"). Each entry follows the same four-field shape per
bootstrap §5: (a) tentative id, (b) one-paragraph problem statement, (c) why-this-position
rationale, (d) blockers / dependencies / parallelism opportunities.

### 3.1 PRD-NEXT — Proactive coaching + adaptive memory

(a) **Tentative id:** PRD-NEXT.

(b) **Problem statement.** PRD-001 + PRD-003 together establish a passive-tracking layer: the
assistant logs events the user reports, summarises them on demand, but emits no proactive nudges,
no cross-modality recommendations, no adaptive guidance. PRD-003 §3 NG1 + NG2 explicitly defer all
of these to "the proactive-coaching PRD that follows PRD-003". This PRD activates the agent's
memory + behaviour layer: the assistant begins to nudge ("ты сегодня выпил мало воды"), correlate
across modalities ("энергия низкая после поздних тренировок"), and adapt its tone, depth, and
cadence to each user based on accumulated history. Two PO-stated quality bars from §1.2 are
binding: deep per-user adaptation and zero hallucination. The PO's Q7 reply in this session adds a
specific research mandate: agent-runtime built-in personality-formation tooling (the runtime
features that let an agent shape persona / voice / disposition) must be studied by the Architect
before ArchSpec design begins; this is roadmap-level guidance, not an Architect free choice. The
adaptive-UX subset of personality (the from-memory part) lives in this PRD; the explicit user-facing
preset picker lives in §3.5 (PRD-NEXT+M). See §6 F-S-2 for the audit finding that splits these two
slices clearly.

(c) **Why this position.** First in the post-PRD-003 sequence because every later PRD assumes a
working memory + behaviour layer. Calendar planning (§3.2), per-user-instance rollout (§3.3),
life-manager modules (§3.4), and the explicit personality picker (§3.5) all depend on a coherent
adaptive-memory baseline. Shipping any of those before this PRD risks them being built against an
uncoordinated memory model and re-doing the work after this PRD lands.

(d) **Blockers / dependencies.** Must wait for the next ArchSpec dispatch (PRD-003 implementation
ArchSpec) to reach `status: approved` before this PRD's own ArchSpec begins, because the
agent-runtime decisions made there (including the runtime re-evaluation per §6 F-S-1 and the
personality-tooling research per PO Q7 reply) propagate forward. Six PRD-003 §9 open questions
(OQ-1..OQ-6) must be ratified or revised first per §6 F-S-3 — these block the PRD-003 ArchSpec
which in turn blocks this PRD. This PRD itself is on the critical path; nothing parallel to it
unblocks the rest of the sequence.

### 3.2 PRD-NEXT+1 — Calendar + read-only web view

(a) **Tentative id:** PRD-NEXT+1.

(b) **Problem statement.** The PO's 2026-05-06 vision (§1.2) explicitly mentions calendar planning
("планирует в календарь и тд, и тп"). This PRD introduces the assistant's first external-system
sync surface (an external calendar, e.g. provider-agnostic at this roadmap level) and the project's
first read-only web visualisation surface so the user can see their own data outside Telegram on
demand. PRD-003 §3 NG4 + §3 NG5 explicitly defer these two capabilities to "the calendar-and-web-
view PRD"; this PRD picks them up. Scope is narrow: calendar read + write of agent-generated plans
(study sessions, workouts, meal windows), and a read-only web view of historical tracking data (no
write surface in the web view, no edits — the user still mutates history through Telegram per
PRD-001 §5 US-6). Web-view authentication / authorisation is itself an Architect-level concern;
the PRD only states the requirement.

(c) **Why this position.** Second after proactive coaching because calendar usefulness is gated on
the assistant having something useful to put on the calendar (proactive suggestions, planned
sessions, agent-recommended schedules) — without §3.1 the calendar is an empty shell the user fills
manually. Equally, the web visualisation has limited value before tracking is rich (PRD-003) and
adaptive (§3.1). However, this PRD is partially-parallelisable with §3.3 because per-user-instance
rollout is an operational concern with little overlap on the calendar / web surface; see (d).

(d) **Blockers / dependencies.** Hard blocker: §3.1 PRD-NEXT must reach `status: approved`. Soft
parallelism: this PRD can run in parallel with §3.3 PRD-NEXT+2 once shared-interface checks pass
(zero file overlap between calendar + web view §5 Outputs and per-user-instance §5 Outputs is
plausible but must be confirmed at the §5-Outputs design pass). The PO's Q3 reply in this session
authorises the parallelism in principle; the gate per §3.0 (and per the dual-cycle pattern proven
on TKT-019 + TKT-020 per `docs/session-log/2026-05-06-session-1.md` §3) is that no two parallel
PRDs may write to the same file or data-model namespace.

### 3.3 PRD-NEXT+2 — Per-user-instance rollout (Q5 = A)

(a) **Tentative id:** PRD-NEXT+2.

(b) **Problem statement.** The PO's 2026-05-06 Q5 clarification asks for the ability to provision a
new personal-assistant instance per user with one button: "если я хочу раздать его 10ти людям
(каждому личный ассистент), то это должно происходить очень удобно для меня, буквально одной
кнопкой". The PO further confirmed the per-user-instance pattern explicitly: "q5 - a, каждому
отдельную память, ведь только так можно будет подстроиться под каждого пользователя отдельно
полноценно, верно?". This PRD ships the operational mechanism: from a single PO-side action, a new
fully-isolated assistant instance comes online for a named user, with isolated memory, isolated
configuration, and isolated extensibility surface. This is distinct from the existing PRD-002 G4
allowlist (which scales one instance to many users on shared infrastructure); this is N independent
instances. Out-of-scope at the PRD level: pricing, public self-service signup, advertising —
monetisation is deferred entirely to §3.6 (PRD-NEXT+M+1) per the PO's Q4 reply. The scaling
question raised by the PO ("сможем ли мы А вариантом пользоваться, когда у нас будет 1000 или 10000
клиентов?") is a roadmap-level strategic risk (see §8 R-RM-1) and an Architect-level question; it
does not change this PRD's scope, only its delivery confidence.

(c) **Why this position.** This PRD is the foundation for life-manager modules (§3.4) because the
life-manager modules plan study + schedule + habits at a depth that demands per-user-instance
memory isolation (a shared-instance model would dilute the personalisation in a way the §1.2 PO
quality bar — "очень хорошо подстраиваться под пользователя" — cannot tolerate at scale). It is
also a precondition for §3.5 (explicit personality customisation at preset-picker depth) because
the picker only makes sense if the user actually has a "their own" assistant. Sequencing-wise,
this PRD can run in parallel with §3.2 because the calendar + web view operates above the runtime
boundary while per-user-instance operates at the runtime / deployment boundary; their §5 Outputs
should not collide.

(d) **Blockers / dependencies.** Hard blocker: §3.1 PRD-NEXT must be `status: approved` (this PRD
inherits memory-model + agent-runtime decisions that §3.1 ratifies). Hard blocker: the next
ArchSpec dispatch must complete the PO-mandated runtime re-evaluation per §1.4 + §6 F-S-1 before
this PRD's ArchSpec begins, because per-user-instance fan-out depends on properties of the chosen
runtime (isolation, provisioning, memory-attachment surface). Cross-PRD parallelism: parallel with
§3.2 PRD-NEXT+1 conditional on §5-Outputs disjointness check.

### 3.4 PRD-NEXT+3..N — Life-manager modules (study, schedule, habit)

(a) **Tentative id:** PRD-NEXT+3 through PRD-NEXT+N (count to be ratified — see §5 Q-RM-4).

(b) **Problem statement.** The PO's §1.1 short vision explicitly names "графики строить жизни,
учёбу планировать"; the §1.2 elaboration adds productivity discussions, gym tracking already
covered partly by PRD-003, and goal achievement at large. This range of capabilities is too broad
to fit a single PRD without violating the project's "1 epic = 1 PRD" rule (`docs/prd/README.md`
authoring rules). The roadmap therefore reserves a sub-sequence of N PRDs for this band, each
narrowly scoped to one life-management modality: e.g. study planning (one PRD), recurring-schedule
authoring (one PRD), habit tracking + reinforcement (one PRD). The exact decomposition (single PRD
covering all three vs. three separate PRDs vs. some other split) is itself the open question
Q-RM-4. PRD-003 §10 OoS uses the plural "life-manager PRDs" which suggests N>1; this roadmap
inherits that plural framing as the default but does not lock it.

(c) **Why this position.** Lands after §3.3 because each life-manager module assumes per-user-
instance memory (otherwise the personalisation depth that turns "study planning" into useful
behaviour is unattainable). Lands after §3.2 because life-manager modules are the most natural
consumers of the calendar surface (a study plan that cannot be put on a calendar is barely a plan).
Within the §3.4 sub-sequence the PRDs can be parallelised heavily once their §5 Outputs are
disjoint, because each life-manager modality is largely orthogonal to the others (study planning
does not write the same data as habit tracking).

(d) **Blockers / dependencies.** Hard blockers: §3.1, §3.2, §3.3 all `status: approved`. Within
the sub-sequence, intra-§3.4 parallelism is the default per the PO's Q3 reply, gated by
shared-interface check.

### 3.5 PRD-NEXT+M — Explicit personality preset picker

(a) **Tentative id:** PRD-NEXT+M (where M is the position after the §3.4 sub-sequence completes).

(b) **Problem statement.** Personality has two slices that are easy to conflate (and PRD-003 §3
NG9 ↔ §10 OoS conflates them — see §6 F-S-2). Slice 1 is *adaptive-from-memory personality*: the
assistant's tone, depth, and cadence shift to match the user's behaviour over time without any
explicit user choice; this slice belongs to §3.1 PRD-NEXT (proactive coaching + adaptive memory).
Slice 2 is *explicit-preset personality*: the user picks a tone preset ("friendly" / "formal" /
"coach" / etc.) and the assistant adopts it deterministically; this slice is the subject of §3.5.
The PO's 2026-05-06 Q7 reply locks the two-slice split and adds a research mandate: agent-runtime
built-in personality-formation tooling must be studied by the Architect before §3.5's ArchSpec
begins ("у агентов с памятью есть специальные инструменты для формирования личности, архитектор
должен это внимательно изучить и учесть"). The picker UX, the preset taxonomy, and the depth of
override (does the picker cap adaptive personality, or layer with it?) are all PRD-internal.

(c) **Why this position.** Lands after the life-manager sub-sequence because preset choice is most
useful once the assistant has a wide behavioural surface to apply the preset to (a friendly KBJU-
only assistant feels token; a friendly assistant that helps you study, schedule, and track habits
feels coherent). Could conceivably ship earlier as a stretch experiment, but the §1.2 quality bar
("очень хорошо подстраиваться под пользователя") implies the adaptive slice must be substantial
before the explicit slice adds value.

(d) **Blockers / dependencies.** Hard blockers: §3.1 PRD-NEXT (adaptive-from-memory must be the
existing baseline that the explicit slice layers on). §3.4 sub-sequence ratified (preset choice is
fullness-gated on the surface it applies to). §1.4 Architect research on agent-runtime personality
tooling reflected in the next-ArchSpec preamble per §5 Q-RM-2.

### 3.6 PRD-NEXT+M+1 — Monetisation tier

(a) **Tentative id:** PRD-NEXT+M+1.

(b) **Problem statement.** The PO's 2026-05-06 Q4 reply: "пока не делаем, это сделаем ближе к
концу проекта". This PRD is the placeholder slot for monetisation when the PO authorises it. Scope
is intentionally undefined at the roadmap level (subscription? one-time? per-instance pricing?) —
it is reserved as the final v0.2-band PRD and will be authored at the time the PO opens the
Business-Planner dispatch for it. PRD-001 §3 NG4, PRD-002 §3 NG6, and PRD-003 §3 NG8 all
explicitly defer monetisation; this roadmap inherits all three deferrals into the v0.2 band and
adds the slot itself.

(c) **Why this position.** Last in the v0.2-band sequence because charging users for an assistant
that has not yet matured (life-manager modules + explicit personality both shipped) risks erosion
of trust in the §1.2 quality bars (deep personalisation, no hallucination). Once the §3.5 ratifies
shipped surface is wide and behaviourally consistent, the PO can decide whether v0.3 opens with a
monetised baseline or stays PO-funded into v0.3+.

(d) **Blockers / dependencies.** Hard blockers: §3.1 through §3.5 all `status: approved`. Soft
blocker: at-this-time the PO has not signalled which monetisation pattern (subscription vs.
per-instance vs. tier-of-features) maps best to the per-user-instance fan-out from §3.3. That
mapping is itself a Business-Planner concern at PRD-authoring time, not at roadmap time.

## 4. Cross-PRD dependency edges (DAG)

This section makes the §3 dependencies explicit as a directed acyclic graph. No edge in this DAG
forms a cycle; if a downstream review identifies a cycle, that is a finding (and would force a §3
re-ordering before this roadmap can promote past `draft`).

### 4.1 Edge list (one row per directed edge)

| From | To | Edge type | Source citation in this roadmap |
|---|---|---|---|
| PRD-001@0.2.0 | PRD-003@0.1.2 | hard (already shipped → already approved) | §2.1 + §2.2 |
| PRD-002@0.2.1 | PRD-003@0.1.2 | hard (already shipped → already approved) | §2.1 + §2.2 |
| PRD-003@0.1.2 | PRD-NEXT (proactive coaching) | hard (PRD-003 modalities-tracking surface is the input data for proactive recs) | §3.1 (b) |
| Next ArchSpec dispatch | PRD-NEXT (proactive coaching) | hard (runtime re-evaluation per §1.4 must complete) | §3.1 (d) + §6 F-S-1 |
| PRD-003 §9 OQ-1..OQ-6 ratification | Next ArchSpec dispatch | hard (per §6 F-S-3) | §6 F-S-3 |
| PRD-NEXT (proactive coaching) | PRD-NEXT+1 (calendar + web) | hard (§3.2 (c) — calendar usefulness gated on proactive content) | §3.2 |
| PRD-NEXT (proactive coaching) | PRD-NEXT+2 (per-user-instance) | hard (§3.3 (d) — memory-model decisions inherited) | §3.3 |
| PRD-NEXT+1 (calendar + web) | PRD-NEXT+3..N (life-manager modules) | hard (§3.4 (c) — life-manager modules consume calendar) | §3.4 |
| PRD-NEXT+2 (per-user-instance) | PRD-NEXT+3..N (life-manager modules) | hard (§3.4 (c) — life-manager personalisation gated on per-user-instance) | §3.4 |
| PRD-NEXT+3..N (life-manager modules) | PRD-NEXT+M (personality picker) | hard (§3.5 (c) — picker richness gated on behavioural surface) | §3.5 |
| PRD-NEXT+M (personality picker) | PRD-NEXT+M+1 (monetisation) | hard (§3.6 (c) — monetisation gated on full surface ratified) | §3.6 |

### 4.2 Parallelism opportunities (soft edges)

| Pair | Parallelism gate |
|---|---|
| PRD-NEXT+1 ‖ PRD-NEXT+2 | §5-Outputs disjointness check; per the PO's Q3 reply ("максимально параллелить") and the dual-cycle precedent in `docs/session-log/2026-05-06-session-1.md` §3 |
| Within PRD-NEXT+3..N sub-sequence (study ‖ schedule ‖ habit) | §5-Outputs disjointness check; intra-§3.4 parallelism is the default |

### 4.3 ASCII DAG sketch

```
[PRD-001@0.2.0 shipped]   [PRD-002@0.2.1 shipped]
            \                       /
             \                     /
              v                   v
           [PRD-003@0.1.2 approved, ArchSpec pending]
                          |
                          | (next ArchSpec dispatch, runtime re-evaluation gate)
                          v
              [PRD-NEXT proactive coaching]
                  /                       \
                 /                         \
                v                           v
   [PRD-NEXT+1 calendar+web]      [PRD-NEXT+2 per-user-instance]
                 \                          /
                  \________________________/
                              |
                              v
              [PRD-NEXT+3..N life-manager modules]
                              |
                              v
              [PRD-NEXT+M personality preset picker]
                              |
                              v
              [PRD-NEXT+M+1 monetisation tier]
```

No cycles. Every edge in §4.1 is hard (must be `status: approved` before downstream begins) except
the §4.2 soft parallelism edges, which are conditional on the disjointness check.

## 5. Open strategic questions for PO ratification

These are questions this roadmap could not answer from existing PRDs, AGENTS.md, or in-session PO
input alone. Each Q-RM-N awaits PO ratification before the corresponding §3 entry can promote past
its current state. If a question is left unanswered at the time of `status: approved` ratification,
the answer must be explicitly captured as "deferred to <next-cycle Y>".

### Q-RM-1 — Per-user-instance scaling viability at 1 000–10 000 instances

The PO's 2026-05-06 follow-up question — "сможем ли мы А вариантом пользоваться, когда у нас будет
1000 или 10000 клиентов?" — is a roadmap-level question with no roadmap-level answer. It is an
Architect-level question about the operational viability of N independent assistant instances at
the 1K–10K count, given the current single-VPS deployment and the runtime properties of the
chosen runtime (current lock: openclaw; lock subject to re-evaluation per §6 F-S-1). The next
ArchSpec dispatch is mandated by this roadmap to address this question explicitly in its preamble
or Phase-0 recon section. **PO ratification needed:** confirm that the next Architect dispatch
preamble must report on the N-instance viability question, citing this Q-RM-1.

### Q-RM-2 — Next-ArchSpec preamble must include §1.4 research-section

§1.4 of this roadmap captures a PO directive that the next Architect dispatch perform a deep
research pass on the ~27 inputs grouped under §1.4.1–§1.4.5, and that the Architect is authorised
to recommend ambitious / non-obvious designs ("можно даже где-то рискнуть, чтобы было очень круто и
прорывно"). **PO ratification needed:** confirm this research-section is *mandatory* for the next
ArchSpec dispatch (no ArchSpec accepted into review without it) versus *recommended*. If
mandatory, this becomes a hard precondition on §4.1 edge "Next ArchSpec dispatch → PRD-NEXT".

### Q-RM-3 — PRD-003 §9 OQ-1..OQ-6 — surface as roadmap-level blockers, or PRD-003-internal?

PRD-003@0.1.2 is `status: approved` in the docs record, yet its §9 lists six open questions
(OQ-1 water presets, OQ-2 workout taxonomy, OQ-3 golden-set, OQ-4 mood inference, OQ-5 settings
label, OQ-6 K7 cadence) marked "resolve BEFORE handoff to Architect" with default-if-unset values.
The PO's 2026-05-06 Q8 reply — "доделываем/переделываем, чтобы было правильно" — authorises rework
but does not specify whether rework happens via (a) BP-revision-cycle on PRD-003 (status flips
back to `in_review`, defaults are ratified inline, version bumps to 0.1.3 or 0.2.0); or (b) the
defaults are ratified as-is in the next Architect dispatch preamble without a PRD revision-cycle.
**PO ratification needed:** choose (a) or (b). See §6 F-S-3 for the formal audit finding.

### Q-RM-4 — Life-manager sub-sequence: single PRD or N PRDs?

PRD-003 §10 OoS uses the plural "life-manager PRDs". The §1.2 PO vision names study, schedule, and
goal-pursuit as separate threads. This roadmap defaults to N ≥ 2 (study + schedule + habit as
three candidate threads, with the exact split deferred to the BP-dispatch time per the §3.4
problem statement). **PO ratification needed:** confirm N ≥ 2 default; or set N = 1 (single
life-manager PRD covering all threads); or set N = 3 with concrete thread names (study, schedule,
habit) locked at roadmap time.

### Q-RM-5 — PRD-NNN id assignment cadence

Tentative ids in §3 (`PRD-NEXT`, `PRD-NEXT+1`, …) are placeholders. Concrete numerical ids
(`PRD-004`, `PRD-005`, …) are PO-assigned at the time the BP dispatch for that PRD is authorised.
**PO ratification needed:** confirm the assignment cadence (one-by-one, at dispatch time) versus
roadmap-time bulk assignment. The default per `docs/prd/README.md` is one-by-one at scaffold time.

### Q-RM-6 — Personality customisation: confirm the two-PRD split + research mandate

This roadmap proposes resolving the PRD-003 §3 NG9 ↔ §10 OoS personality split by treating the
adaptive-from-memory slice as part of §3.1 (PRD-NEXT proactive coaching) and the explicit-preset-
picker slice as §3.5 (PRD-NEXT+M). The PO's 2026-05-06 Q7 reply ratifies this split in spirit and
adds the agent-runtime built-in personality-tooling research mandate. **PO ratification needed:**
confirm two-PRD split is locked; confirm research mandate goes into next ArchSpec preamble per
Q-RM-2.

### Q-RM-7 — Migration cost of any runtime change (to existing shipped code)

The §1.4 research mandate explicitly authorises the Architect to consider replacing the current
runtime (openclaw, locked by PRD-001@0.2.0 §7) with an alternative. Doing so would require
migrating the already-shipped PRD-001@0.2.0 + PRD-002@0.2.1 G1–G4 surface onto the new runtime.
Migration is Architect / Executor territory, but the *roadmap-level* question is whether such
migration is captured as (a) an ADR + ticket family under the current ARCH-001 lineage, or
(b) a fresh ARCH-002 with explicit "supersedes ARCH-001" semantics. **PO ratification needed:**
choose (a) or (b); or defer to Architect choice at next ArchSpec time per the PO's Q9 reply ("c").

### Q-RM-8 — Parallel BP / Architect / Executor dispatches: confirm policy

The PO's 2026-05-06 Q3 reply authorises maximum parallelism. This roadmap inherits that as the
default for §3.2 ‖ §3.3 and intra-§3.4. The dual-cycle precedent (TKT-019 + TKT-020 ran in parallel
per `docs/session-log/2026-05-06-session-1.md` §3) covers parallel Executor dispatches; it does
not cover parallel BP or Architect dispatches. **PO ratification needed:** confirm the project's
parallelism policy explicitly (parallel-Executor only, or parallel-BP also, or parallel-Architect
also). The default this roadmap proposes is: parallel-Executor by default; parallel-BP / parallel-
Architect on a per-cycle basis after PO authorisation.

### Q-RM-9 — ArchSpec identity for PRD-003 onward

The PO's 2026-05-06 Q9 reply: "c — пусть Architect решает (в §3 dependency edges использую generic
'PRD-003 ArchSpec' без id)". This roadmap honours that choice in §3.1 (d) + §4.1 by writing
"next ArchSpec dispatch" without locking the id. **PO ratification needed:** explicit confirmation
that the Architect chooses ARCH-001@0.6.0 (extension) versus ARCH-002 (fresh) at dispatch time, and
that this roadmap does not prejudge.

### Q-RM ratification log (PO 2026-05-06)

PO authorised "agree with Devin Orchestrator recommendations" via 2026-05-06 chat
("выбери лучший и оптимальный вариант"). Per-question ratification:

- **Q-RM-1:** (a) — next-ArchSpec preamble MUST answer the 1K–10K per-user-instance
  hardware-envelope viability question, citing this Q-RM-1 + §1.4 PO research mandate.
- **Q-RM-2:** (a) — §1.4 research-section is **mandatory** for the next ArchSpec dispatch
  (no ArchSpec accepted into RV-SPEC review without it). This becomes a hard precondition
  on the §4.1 edge "Next ArchSpec dispatch → PRD-NEXT".
- **Q-RM-3:** (a) — PRD-003 §9 OQ-1..OQ-6 resolution path is **BP revision-cycle**
  (PRD-003@0.1.2 → 0.1.3 with each OQ resolved inline). Architect dispatch waits on the
  cleaned PRD; default-if-unset values from PRD-003 §9 are the BP's starting point but
  must be ratified by PO inline before the version bump.
- **Q-RM-4:** (b) — life-manager sub-sequence shape is **N ≥ 2**; default candidate threads
  are study + schedule + habit (three threads); the final split is deferred to the BP at
  scaffold time per §3.4 problem-statement (BP may merge or further split based on UX /
  data-shape overlap discovered at scaffold time).
- **Q-RM-5:** (a) — PRD-NNN id assignment cadence is **one-by-one at BP-dispatch time** per
  the default in `docs/prd/README.md`. No bulk assignment at roadmap time.
- **Q-RM-6:** (a) — personality two-PRD split is **locked**: adaptive-from-memory slice in
  §3.1 (PRD-NEXT proactive coaching), explicit-preset-picker slice in §3.5 (PRD-NEXT+M).
  The agent-runtime built-in personality-tooling research mandate is routed to the next
  ArchSpec preamble per Q-RM-2.
- **Q-RM-7:** (c) — runtime-migration capture path is **deferred to Architect at next
  ArchSpec dispatch time** (per PO 2026-05-06 Q9 reply). The roadmap does not prejudge
  ARCH-001 lineage extension vs. fresh ARCH-002; the Architect chooses based on the
  outcome of the §1.4 research pass.
- **Q-RM-8:** (a) — parallelism policy: **parallel-Executor by default** (TKT-019 + TKT-020
  precedent); **parallel-BP / parallel-Architect on a per-cycle basis** after explicit PO
  authorisation. Default reflects safety: BP / Architect dispatches make scope-decisions at
  artefact boundaries; concurrent dispatches risk conflicting decisions that require expensive
  reconciliation.
- **Q-RM-9:** (c) — ArchSpec-id choice **deferred to Architect at dispatch time** (per PO
  2026-05-06 Q9 reply). §3 + §4 use generic "next ArchSpec dispatch" language without
  locking the id; Architect resolves to ARCH-001@0.6.0 (extension) or ARCH-002 (fresh) based
  on the runtime decision in Q-RM-7.

## 6. Audit findings on existing PRDs

Findings are classified as: **(S)ubstantive** — requires a PRD revision-cycle dispatch; **(C)lerical
** — handled by the Devin Orchestrator clerical-PR pipeline; **(D)eferrable** — captured here, no
immediate action needed (often because a downstream PRD or external decision absorbs the gap).

This roadmap does not edit any existing PRD. Findings are surfaced; resolution is the PO's choice.

### Substantive findings

#### F-S-1 — Runtime-lock contradiction (PRD-001@0.2.0 §7 / ARCH-001@0.5.0 §0.1)

**Severity:** substantive. **Target:** PRD-001@0.2.0 §7 (and downstream ARCH-001@0.5.0 §0.1
implicit reaffirmation). **Description:** PRD-001@0.2.0 §7 ("External dependencies and locked
choices") states the production runtime is openclaw and frames it as a Product-Owner-locked
decision. ARCH-001@0.5.0 §0.1 reaffirms the lock in its OpenClaw capability map. The PO's
2026-05-06 in-session message (§1.2 + §1.4 of this roadmap) authorises the next Architect
dispatch to perform a deep research pass over a list of alternative agent-runtime candidates and
authorises ambitious / non-obvious recommendations including potentially superseding the current
lock. This is in tension with the PRD-001 §7 lock-language. **Proposed action:** open a BP
revision-cycle on PRD-001 §7 to update the lock-language to "current production runtime: openclaw;
re-evaluation authorised in next ArchSpec dispatch per ROADMAP-001 §1.4"; OR add an explicit
Architect-preamble ack in the next ArchSpec citing ROADMAP-001 §1.4 + §6 F-S-1 as the
authorisation. Either path is acceptable; the choice is the PO's.

#### F-S-2 — Personality scope under-specified (PRD-003@0.1.2 §3 NG9 ↔ §10 OoS)

**Severity:** substantive (borderline clerical — see proposed action). **Target:** PRD-003@0.1.2
§3 NG9 + §10 OoS. **Description:** §3 NG9 says "the proactive-coaching PRD will revisit only the
narrow adaptive-UX subset" of personality customisation. §10 OoS says "Per-user personality
customization (preset picker: friendly / formal / coach / etc.) deferred to life-manager PRDs".
Read together, these two sentences neither contradict nor disambiguate the scope split: a reader
cannot tell whether the entire personality surface is in proactive coaching (§3 NG9 reading), or
the entire personality surface is in post-life-manager (§10 OoS reading), or both with a defined
seam (the two-slice reading this roadmap proposes). The PO's 2026-05-06 Q7 reply authorises the
two-slice reading and adds an agent-runtime built-in personality-tooling research mandate. The
research mandate is new content not present in PRD-003 today; that elevates this finding from
clerical to substantive. **Proposed action:** open a PRD-003 revision-cycle that (a) rewrites §3
NG9 + §10 OoS to explicitly state the two-slice split (adaptive-from-memory in §3.1; explicit
preset picker in §3.5 of this roadmap), and (b) adds a §3 NG entry capturing the research mandate
on agent-runtime personality tooling. Version bump on PRD-003 expected: 0.1.2 → 0.1.3 (clerical
revision) or 0.1.2 → 0.2.0 (substantive — depending on whether (b) is read as a new requirement).

#### F-S-3 — PRD-003@0.1.2 §9 has six open questions while frontmatter is `status: approved`

**Severity:** substantive. **Target:** PRD-003@0.1.2 §9 OQ-1..OQ-6 + frontmatter `status` field.
**Description:** PRD-003@0.1.2 frontmatter is `status: approved`, meaning the PRD is BP-final and
ready for the next Architect dispatch. PRD-003 §9 explicitly lists six open questions
(OQ-1 water presets, OQ-2 workout taxonomy, OQ-3 golden-set, OQ-4 mood inference, OQ-5 settings
label, OQ-6 K7 cadence) marked "resolve BEFORE handoff to Architect" with default-if-unset values.
This is a contradiction: a PRD cannot simultaneously be `status: approved` and have explicit
"resolve BEFORE handoff" markers. The PO's 2026-05-06 Q8 reply ("доделываем/переделываем, чтобы
было правильно") authorises rework. **Proposed action:** open a PRD-003 revision-cycle. Two paths
are roadmap-acceptable: (a) ratify each of the six defaults inline (lightweight; PRD-003 version
bumps 0.1.2 → 0.1.3); (b) re-author the affected goals (G2 sleep, G3 workouts, G4 mood) with the
chosen answers replacing the OQs (heavier; version bumps to 0.2.0). The PO's Q-RM-3 ratification
selects between (a) and (b).

#### F-S-4 — "Thousands of users" framing in PRD-002 / PRD-003 vs. PO's per-user-instance clarification

**Severity:** substantive. **Target:** PRD-002@0.2.1 §1 + §4 P3 + G4/K4 wording; PRD-003@0.1.2 §4
P3 wording. **Description:** Both PRD-002 and PRD-003 frame the long-horizon user-count target as
"thousands of users" or "up to 10 000 concurrent users", with PRD-002 G4/K4 closing on a
load-tested envelope of 10 000 users on a single instance. The PO's 2026-05-06 Q5 reply clarifies
that the actual operational pattern envisioned is N ∈ {10, 100, 1 000, 10 000} *independent
per-user instances*, each with isolated memory, provisioned by the PO with one button. This is an
operationally different shape from "10 000 users on one instance": the latter is a load-handling
property of one shared service, the former is a fan-out property of a fleet of services. PRD-002's
load test does not validate the fan-out shape. **Proposed action:** open a PRD-002 revision-cycle
that disambiguates §1 + §4 P3 wording to either (a) reaffirm one-instance-many-users at the 10K
envelope and explicitly add a forward reference to §3.3 PRD-NEXT+2 of this roadmap as the home of
the per-user-instance pattern; OR (b) supersede the §1 + §4 P3 wording entirely with the
per-user-instance pattern, in which case G4/K4 closure semantics need to be reaffirmed (the load
test is still valid for one-instance baseline performance but no longer the project's primary
scale story). Path (a) is lighter; path (b) is more honest to the new direction. PO's choice.

### Clerical findings

#### ~~F-C-1~~ — STRUCK (RV-SPEC-011 F-M1, 2026-05-06)

**Status:** struck. **Original target:** PRD-003@0.1.2 frontmatter `owner` field. **Reason:** the
original finding asserted that PRD-001@0.2.0 + PRD-002@0.2.1 use `owner: "@OpenClown-bot"` and that
PRD-003@0.1.2 was inconsistent. Reviewer (Kimi K2.6) RV-SPEC-011 F-M1 independently verified that
PRD-001@0.2.0 + PRD-002@0.2.1 + PRD-003@0.1.2 all use `owner: "@yourmomsenpai"`, while
ARCH-001@0.5.0 + ROADMAP-001@0.1.0 use `owner: "@OpenClown-bot"`. The actual repo convention is
intentional: PRDs are PO-owned (`@yourmomsenpai`); ArchSpecs and roadmaps are system-owned
(`@OpenClown-bot`). The original F-C-1 proposed action would have broken this convention. PO
authorised the strike on 2026-05-06; the convention is documented for future BPs in a separate
Devin Orchestrator clerical follow-up against `docs/meta/devin-session-handoff.md`.

#### F-C-2 — PAT secret name mismatch (bootstrap §-1b vs. actual env)

**Severity:** clerical. **Target:** the Business-Planner-bootstrap text used to start this session
(not a repo file). **Description:** the bootstrap §-1b refers to `GITHUB_TOKEN_OPENCLOWN` as the
PAT name; the actual org-scoped secret available in the Devin VM is named `GITHUB_PAT_OPENCLOWN_BOT`.
Verified during §-1d pre-flight: `gh api repos/OpenClown-bot/openclown-assistant` returned
`permissions.admin/push/pull = true` under the actual name. **Proposed action:** Devin Orchestrator
chooses one of (a) update the bootstrap text to `GITHUB_PAT_OPENCLOWN_BOT`; (b) create a second
org-scoped secret named `GITHUB_TOKEN_OPENCLOWN` aliasing the same PAT; (c) rename the existing
secret. Path (a) is least disruptive. Not roadmap-blocking.

#### F-C-3 — `pyyaml` missing from fresh-VM repo-setup

**Severity:** clerical. **Target:** repo env-config / Devin VM repo-setup procedure.
**Description:** on a fresh Devin VM, `python3 scripts/validate_docs.py` fails immediately with
`ERROR: pyyaml is required` until `pip install pyyaml` runs. Verified during §-1d pre-flight (this
session). The validator is a hard precondition for every BP / Architect / Executor / Reviewer
session per `docs/session-log/2026-05-06-session-1.md` §1c. **Proposed action:** Devin Orchestrator
adds `pyyaml` install to the repo's environment-config maintenance step so future sessions start
clean. Not roadmap-blocking.

### Deferrable findings

#### F-D-1 — "Thousands users" had no owning PRD before this roadmap

**Severity:** deferrable. **Target:** none — resolved by this roadmap. **Description:** prior to
this roadmap, PRD-002 §1 + PRD-003 §4 P3 referenced "thousands of users" / "eventually thousands"
without naming a PRD that owned the scaling step. ROADMAP-001 §3.3 (PRD-NEXT+2) now owns the
per-user-instance pattern that operationalises the PO's actual scaling intent. F-S-4 covers the
PRD-002 / PRD-003 wording correction. **Proposed action:** none additional; ratifying §3.3 in this
roadmap closes the prior gap.

#### F-D-2 — KBJU repo-wide rebrand (PRD-003@0.1.2 §10 OoS)

**Severity:** deferrable. **Target:** repo-wide naming. **Description:** PRD-003 §10 OoS notes
that "Repo-wide rebrand of «KBJU» — tracked separately as a follow-up coordinated by Devin
Orchestrator". Per the PO's Q10 reply in this session ("решай сам, примени лучшие практики") this
roadmap routes the rebrand to the Devin Orchestrator clerical-PR pipeline, not to a future PRD.
**Proposed action:** Devin Orchestrator schedules the rebrand at a quiet point in the cycle (e.g.
between PRD-NEXT BP dispatch and PRD-NEXT ArchSpec dispatch). No roadmap impact.

## 7. Out-of-scope for this roadmap (belongs in ROADMAP-002 or later)

Items in this section are explicitly *not* part of the v0.2-band sequence in §3. They are listed
here so a downstream Reviewer or BP can avoid quietly absorbing them into a §3 PRD. ROADMAP-002
(version-band v0.3 onward) inherits these as the seed for its own §3.

| Item | Rationale for v0.3+ deferral | Source citation |
|---|---|---|
| Mobile-native client (iOS / Android / Apple Watch) | PRD-001 §3 NG10 + PRD-003 §3 NG5 reaffirm Telegram as the only channel for v0.2; no mobile-native client exists or is planned in the v0.2 band. | PRD-001@0.2.0 §3 NG10; PRD-003@0.1.2 §3 NG5 |
| Languages beyond Russian (i18n) | PRD-001 §3 NG locks Russian-only UX; broadening is a v0.3-band concern at earliest. | PRD-001@0.2.0 §3 |
| External health / fitness tracker integrations (Apple Health, Google Fit, Oura, Whoop, Garmin, Fitbit, Strava, MyFitnessPal) | PRD-003 §3 NG4 explicitly defers; the calendar+web PRD §3.2 introduces *only* calendar sync (Google / Yandex) as the first external-system instance, not health/fitness sync. | PRD-003@0.1.2 §3 NG4 |
| Public self-service signup at scale (open SaaS) | The §3.3 per-user-instance PRD covers PO-controlled rollout to ~10–10 000 named users. Truly public self-service signup (anyone-can-sign-up) is a v0.3+ concern that depends on the §3.6 monetisation PRD landing first. | §3.3 + §3.6 (this roadmap); PRD-003@0.1.2 §3 NG8 |
| KBJU repo-wide rebrand | F-D-2 above. Devin Orchestrator clerical track, not a PRD. | §6 F-D-2 |
| SDLC pipeline cost / token / role-attribution telemetry | PRD-002 §3 NG9 + PRD-003 §3 NG10 reaffirm OoS for the entire v0.2 cycle. | PRD-002@0.2.1 §3 NG9; PRD-003@0.1.2 §3 NG10 |
| Non-Telegram channels (SMS, email, Slack, web app as primary surface, Apple Watch app) | PRD-003 §3 NG5 reaffirms Telegram as primary; web view is read-only, secondary. | PRD-003@0.1.2 §3 NG5 |
| Medical / clinical advice across any modality | PRD-001 §3 NG7 + PRD-003 §3 NG7 hard-out for the entire v0.2 cycle. | PRD-001@0.2.0 §3 NG7; PRD-003@0.1.2 §3 NG7 |
| Retroactive past-date data entry across modalities | PRD-003 §3 NG11 hard-out for v0.2; reconsidered only if a future PRD ratifies a need. | PRD-003@0.1.2 §3 NG11 |

ROADMAP-002 (when authored) will pick up the items above as candidate v0.3-band PRDs.

## 8. Strategic risks / unknowns

These are roadmap-level risks (about sequence, cohesion, or vision-fit), distinct from the
PRD-internal risks each PRD enumerates in its own §8.

### R-RM-1 — Per-user-instance scaling at 1K–10K instances (operational viability)

**Description.** The PO's 2026-05-06 Q5 reply commits §3.3 PRD-NEXT+2 to a per-user-instance
fan-out model. The PO's same-message follow-up question — "сможем ли мы А вариантом пользоваться,
когда у нас будет 1000 или 10000 клиентов?" — explicitly flags the unknown: at high N, can a
single VPS provision and run N instances? Probably not; the actual deployment shape at high N is
unproven. **Roadmap impact.** Sequencing-binding: §3.3 ArchSpec must answer this question before
the PRD enters Executor cycle. **Mitigation.** Q-RM-1 surfaces this for explicit PO ratification
that the next ArchSpec preamble must address the scaling question. Architect-side answer expected.
**PO post-draft clarification (2026-05-06 chat, verbatim):** «если вопрос только в железе, то
когда будет много киентов, мы железо будем менять на более мощное. просто тут вопрос разумности,
хватит ли нам вообще железа.» This reduces R-RM-1 from a strategic-architecture risk to a
hardware-ceiling planning concern: the next ArchSpec preamble must report on the upper-bound
hardware envelope per per-user-instance (i.e. how many instances fit on what tier of hardware,
and at what tier the per-user-instance pattern stops being sane regardless of hardware spend),
but is not required to rethink the per-user-instance pattern itself. PO accepts hardware-scaling
cost as the operational answer.

### R-RM-2 — Runtime re-evaluation may force migration of already-shipped code

**Description.** The §1.4 + §6 F-S-1 authorisation to re-evaluate the runtime lock means the next
Architect dispatch may legitimately recommend replacing the current openclaw-based runtime. If
that recommendation lands, every shipped PRD-001 user-story (US-1..US-9) and every shipped PRD-002
G1–G4 component (BreachDetector, StallWatchdog, PR-Agent CI telemetry, allowlist) must be migrated
to the replacement runtime. Migration cost is unestimated and may dominate the v0.2-band budget.
**Roadmap impact.** Cross-cutting; affects every PRD in §3 if the migration is ratified.
**Mitigation.** Q-RM-7 surfaces the migration-capture question (under-current-ARCH-001 vs.
fresh-ARCH-002). The Architect's research-section per Q-RM-2 should include an explicit migration
cost estimate alongside any replacement recommendation, so the PO can do an informed go/no-go.
**PO post-draft clarification (2026-05-06 chat, verbatim):** «насчет бюджетов не переживаем».
This frees the next Architect dispatch to recommend the most strategically-correct runtime
regardless of migration cost; the migration cost estimate per Q-RM-2 is reported for the record
but does not gate the Architect's recommendation. Cost is no longer a blocker on R-RM-2.

### R-RM-3 — Six-PRD-deep sequence without time-box → focus drift / abandonment risk

**Description.** §3 enumerates six PRDs (proactive coaching, calendar+web, per-user-instance,
life-manager × N, personality picker, monetisation). The PO's 2026-05-06 Q5 + Q6 replies
explicitly deprioritise calendar-time deadlines ("мы не говорим про сроки"). This is honest to the
PO's preferences but creates a strategic risk: a six-PRD-deep sequence with no deadline can drift,
priorities can re-order mid-band, and individual PRDs can become abandoned half-built. **Roadmap
impact.** The §3 sequencing is durable only if ratified; otherwise re-litigation per cycle is
likely. **Mitigation.** This roadmap proposes (in §9) that the v0.2-band rollover criterion is
sequencing-driven (all §3.1–§3.4 PRDs `status: approved` AND first-instance per-user-rollout
shipped per §3.3) rather than calendar-driven; this gives the band an explicit completion
definition without imposing a date.

### R-RM-4 — Parallelism may regress data-model invariants

**Description.** The PO's 2026-05-06 Q3 reply authorises maximum parallelism for §3.2 ‖ §3.3 and
intra-§3.4. The dual-cycle precedent (TKT-019 + TKT-020 in parallel per
`docs/session-log/2026-05-06-session-1.md` §3) showed the model is viable when shared-interface
checks pass. The risk is that parallel BP / Architect dispatches (rather than parallel Executor
dispatches) introduce cross-PRD scope decisions that conflict at Outputs-merge time, e.g. the
calendar PRD assumes a per-user shared event store while the per-user-instance PRD assumes
fully-isolated stores. **Roadmap impact.** Q-RM-8 surfaces the explicit parallelism-policy
ratification. Mitigation per the §4.2 disjointness gate; if disjointness fails, sequentialise.

### R-RM-5 — "Never hallucinate" quality bar is currently unprovable

**Description.** The PO's §1.2 vision states the assistant "никогда не галлюцинировать". This is
a hard quality bar that no agent-runtime currently guarantees in the literal sense; "no
hallucination ever" is a property no contemporary assistant can fully assert. The closest
currently-deliverable shape is verification + grounding + tight memory-confidence thresholds plus
explicit "I don't know" semantics. **Roadmap impact.** Every PRD in §3 inherits this bar, but no
single PRD can fulfil it alone — the assistant's cross-modality behaviour and memory layer have to
collectively meet it. **Mitigation.** The Architect's research-section per Q-RM-2 must include an
explicit grounding / verification / "I don't know" strategy. The Reviewer (RV-SPEC) ratifying the
next ArchSpec must verify the bar is addressed at the architectural level, not punt it to runtime.

## 9. PO sign-off checklist

The following items must each be explicitly ratified by the PO (in chat, in a session-log entry, or
in a comment on this PR) before this ROADMAP-001 promotes from `draft` to `in_review`. After the
Reviewer (RV-SPEC) verdict, the PO sets `approved` per the lifecycle in `docs/roadmap/README.md`.

- [x] §1.1 + §1.2 vision quotes are the canonical co-locked sources.
- [x] §1.4 PO-authorised research input list (5 cluster headers, ~27 URLs) is correctly captured;
      no URL is missing; no URL is added that the PO did not authorise.
- [x] §3 sequence (PRD-NEXT through PRD-NEXT+M+1) ratified in this order.
- [x] §4.1 dependency edges ratified; no cycle exists.
- [x] §4.2 parallelism opportunities ratified (with the §5-Outputs disjointness gate).
- [x] §5 Q-RM-1 — PO confirms the next-ArchSpec preamble must answer the 1K–10K instance
      viability question.
- [x] §5 Q-RM-2 — PO confirms the §1.4 research-section is *mandatory* for the next ArchSpec.
- [x] §5 Q-RM-3 — PO chooses the PRD-003 §9 OQ-1..OQ-6 resolution path (revision-cycle vs.
      next-ArchSpec preamble).
- [x] §5 Q-RM-4 — PO confirms the life-manager sub-sequence shape (single PRD vs. N PRDs).
- [x] §5 Q-RM-5 — PO confirms PRD-NNN id assignment cadence (one-by-one vs. bulk).
- [x] §5 Q-RM-6 — PO confirms personality two-PRD split + research mandate.
- [x] §5 Q-RM-7 — PO chooses migration-capture path (current-ARCH-001 lineage vs. fresh-ARCH-002).
- [x] §5 Q-RM-8 — PO confirms parallelism policy (parallel-Executor default; parallel-BP /
      parallel-Architect per-cycle).
- [x] §5 Q-RM-9 — PO confirms ArchSpec-id choice deferred to Architect (per Q9 reply in this
      session).
- [x] §6 substantive findings F-S-1, F-S-2, F-S-3, F-S-4 — PO chooses resolution path per finding
      (revision-cycle vs. next-ArchSpec preamble ack vs. defer).
- [x] §6 clerical findings F-C-2, F-C-3 — PO acks routing to Devin Orchestrator clerical-PR
      pipeline (F-C-1 struck per RV-SPEC-011 F-M1; see §6 strike notice + frontmatter
      `approved_note`).
- [x] §6 deferrable findings F-D-1, F-D-2 — PO acks no-action / Devin-Orchestrator routing.
- [x] §7 Out-of-scope list — PO acks; ROADMAP-002 will inherit these as v0.3-band candidates.
- [x] §8 strategic risks R-RM-1..R-RM-5 — PO acks; mitigations are routed.
- [x] PO authorises status flip `draft` → `in_review` and triggers the Reviewer (RV-SPEC,
      Kimi K2.6) dispatch per `docs/prompts/reviewer.md`.

After Reviewer ratification (verdict `pass` or `pass_with_changes`), the PO sets `status: approved`
per `docs/roadmap/README.md` lifecycle. ROADMAP-001 then becomes the strategic-direction anchor for
every subsequent BP / Architect / Executor / Reviewer dispatch in the v0.2 band, and supersedes any
chat-only sequencing assumptions accumulated to date.
