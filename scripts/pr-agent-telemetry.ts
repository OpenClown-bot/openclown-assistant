export const TELEMETRY_SCHEMA_VERSION = "1.0.0";

export interface PrAgentTelemetryOutput {
  schema_version: string;
  pr_number: number;
  repo: string;
  model: string;
  ci_step_setup_ms: number | null;
  ttft_ms: number | null;
  ttlt_ms: number | null;
  total_ci_stage_ms: number | null;
  reason?: string;
}

export interface TokenPhaseTimestamps {
  ciStepEntry: string;
  llmRequestEmission: string | null;
  firstTokenAt: string | null;
  lastTokenAt: string | null;
  ciStepExit: string;
}

export interface GithubActionStep {
  name: string;
  number: number;
  status: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface GithubActionJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  started_at: string;
  completed_at: string | null;
  steps: GithubActionStep[];
}

export interface WorkflowTimingData {
  jobStartedAt: string;
  jobCompletedAt: string | null;
  prAgentStepStartedAt: string | null;
  prAgentStepCompletedAt: string | null;
}

const PR_AGENT_STEP_NAME_PATTERN = /PR\s*Agent/i;
const PR_AGENT_JOB_NAME_PATTERN = /PR\s*Agent/i;

export function parseIsoToMs(iso: string): number {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) {
    throw new Error(`invalid ISO timestamp: ${iso}`);
  }
  return ms;
}

export function computePhases(timestamps: TokenPhaseTimestamps): Omit<PrAgentTelemetryOutput, "pr_number" | "repo" | "model"> {
  const ciStepEntryMs = parseIsoToMs(timestamps.ciStepEntry);
  const ciStepExitMs = parseIsoToMs(timestamps.ciStepExit);

  const totalCiStageMs = ciStepExitMs - ciStepEntryMs;

  const hasTokenPhases =
    timestamps.llmRequestEmission !== null &&
    timestamps.firstTokenAt !== null &&
    timestamps.lastTokenAt !== null;

  if (!hasTokenPhases) {
    return {
      schema_version: TELEMETRY_SCHEMA_VERSION,
      ci_step_setup_ms: null,
      ttft_ms: null,
      ttlt_ms: null,
      total_ci_stage_ms: totalCiStageMs,
      reason: "token_phase_unavailable",
    };
  }

  const llmEmissionMs = parseIsoToMs(timestamps.llmRequestEmission!);
  const firstTokenMs = parseIsoToMs(timestamps.firstTokenAt!);
  const lastTokenMs = parseIsoToMs(timestamps.lastTokenAt!);

  return {
    schema_version: TELEMETRY_SCHEMA_VERSION,
    ci_step_setup_ms: llmEmissionMs - ciStepEntryMs,
    ttft_ms: firstTokenMs - llmEmissionMs,
    ttlt_ms: lastTokenMs - firstTokenMs,
    total_ci_stage_ms: totalCiStageMs,
  };
}

export function extractWorkflowTiming(jobs: GithubActionJob[]): WorkflowTimingData | null {
  const prAgentJob = jobs.find((j) => PR_AGENT_JOB_NAME_PATTERN.test(j.name));
  if (!prAgentJob) {
    return null;
  }

  const prAgentStep = prAgentJob.steps.find((s) =>
    PR_AGENT_STEP_NAME_PATTERN.test(s.name),
  );

  return {
    jobStartedAt: prAgentJob.started_at,
    jobCompletedAt: prAgentJob.completed_at,
    prAgentStepStartedAt: prAgentStep?.started_at ?? null,
    prAgentStepCompletedAt: prAgentStep?.completed_at ?? null,
  };
}

export function buildTimestampsFromTiming(
  timing: WorkflowTimingData,
): TokenPhaseTimestamps | null {
  const ciStepEntry = timing.prAgentStepStartedAt ?? timing.jobStartedAt;
  const ciStepExit =
    timing.prAgentStepCompletedAt ?? timing.jobCompletedAt;

  if (!ciStepExit) {
    return null;
  }

  return {
    ciStepEntry,
    llmRequestEmission: null,
    firstTokenAt: null,
    lastTokenAt: null,
    ciStepExit,
  };
}

export interface RollingStats {
  p50_total_ci_stage_ms: number;
  p100_total_ci_stage_ms: number;
  count: number;
}

export function computeRollingStats(
  entries: Pick<PrAgentTelemetryOutput, "total_ci_stage_ms">[],
): RollingStats {
  const validDurations = entries
    .map((e) => e.total_ci_stage_ms)
    .filter((v): v is number => v !== null);

  if (validDurations.length === 0) {
    return { p50_total_ci_stage_ms: 0, p100_total_ci_stage_ms: 0, count: 0 };
  }

  const sorted = [...validDurations].sort((a, b) => a - b);
  const count = sorted.length;

  const p50Index = Math.floor((count - 1) * 0.5);
  const p100Index = count - 1;

  return {
    p50_total_ci_stage_ms: sorted[p50Index],
    p100_total_ci_stage_ms: sorted[p100Index],
    count,
  };
}

const FORBIDDEN_OUTPUT_FIELDS: readonly string[] = [
  "raw_prompt",
  "raw_transcript",
  "raw_audio",
  "raw_photo",
  "telegram_bot_token",
  "provider_key",
  "username",
  "first_name",
  "last_name",
  "callback_payload_meal_text",
  "provider_response_raw",
  "review_text",
  "pr_body",
  "meal_text",
];

const ALLOWED_OUTPUT_FIELDS: readonly string[] = [
  "schema_version",
  "pr_number",
  "repo",
  "model",
  "ci_step_setup_ms",
  "ttft_ms",
  "ttlt_ms",
  "total_ci_stage_ms",
  "reason",
];

export function validateTelemetryOutput(
  output: Record<string, unknown>,
): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const forbidden of FORBIDDEN_OUTPUT_FIELDS) {
    if (forbidden in output) {
      violations.push(`forbidden_field_present:${forbidden}`);
    }
  }

  for (const key of Object.keys(output)) {
    if (
      !ALLOWED_OUTPUT_FIELDS.includes(key) &&
      !FORBIDDEN_OUTPUT_FIELDS.includes(key)
    ) {
      violations.push(`unexpected_field:${key}`);
    }
  }

  for (const [key, value] of Object.entries(output)) {
    if (typeof value === "string") {
      if (/\bsk-[A-Za-z0-9]{20,}\b/.test(value)) {
        violations.push(`secret_leak:${key}`);
      }
      if (/\b\d{8,10}:[A-Za-z0-9_-]{30,}\b/.test(value)) {
        violations.push(`secret_leak:${key}`);
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

export function validateTelemetrySchema(
  output: Record<string, unknown>,
): { valid: boolean; missing: string[] } {
  const required: string[] = [
    "schema_version",
    "pr_number",
    "repo",
    "model",
    "ci_step_setup_ms",
    "ttft_ms",
    "ttlt_ms",
    "total_ci_stage_ms",
  ];
  const missing = required.filter((f) => !(f in output));
  return { valid: missing.length === 0, missing };
}

export async function fetchJobsForRun(params: {
  token: string;
  repo: string;
  runId: number;
}): Promise<GithubActionJob[]> {
  const [owner, repoName] = params.repo.split("/");
  const url = `https://api.github.com/repos/${owner}/${repoName}/actions/runs/${params.runId}/jobs`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!resp.ok) {
    throw new Error(
      `GitHub API error: ${resp.status} ${resp.statusText} for ${url}`,
    );
  }
  const body = (await resp.json()) as { jobs: GithubActionJob[] };
  return body.jobs;
}

export async function fetchRunForPr(params: {
  token: string;
  repo: string;
  prNumber: number;
  workflowFileName: string;
}): Promise<{ runId: number; headSha: string } | null> {
  const [owner, repoName] = params.repo.split("/");
  const url = `https://api.github.com/repos/${owner}/${repoName}/actions/runs?event=pull_request&per_page=100`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${params.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!resp.ok) {
    throw new Error(
      `GitHub API error: ${resp.status} ${resp.statusText} for ${url}`,
    );
  }
  const body = (await resp.json()) as {
    workflow_runs: Array<{
      id: number;
      head_sha: string;
      pull_requests: Array<{ number: number }>;
      path: string;
    }>;
  };

  const match = body.workflow_runs.find(
    (r) =>
      r.pull_requests?.some((pr) => pr.number === params.prNumber) &&
      r.path.endsWith(params.workflowFileName),
  );
  if (!match) return null;
  return { runId: match.id, headSha: match.head_sha };
}

export async function computeTelemetryForRun(params: {
  token: string;
  repo: string;
  runId: number;
  prNumber: number;
  model: string;
}): Promise<PrAgentTelemetryOutput> {
  const jobs = await fetchJobsForRun({
    token: params.token,
    repo: params.repo,
    runId: params.runId,
  });

  const timing = extractWorkflowTiming(jobs);
  if (!timing) {
    return {
      schema_version: TELEMETRY_SCHEMA_VERSION,
      pr_number: params.prNumber,
      repo: params.repo,
      model: params.model,
      ci_step_setup_ms: null,
      ttft_ms: null,
      ttlt_ms: null,
      total_ci_stage_ms: null,
      reason: "token_phase_unavailable",
    };
  }

  const timestamps = buildTimestampsFromTiming(timing);
  if (!timestamps) {
    return {
      schema_version: TELEMETRY_SCHEMA_VERSION,
      pr_number: params.prNumber,
      repo: params.repo,
      model: params.model,
      ci_step_setup_ms: null,
      ttft_ms: null,
      ttlt_ms: null,
      total_ci_stage_ms: null,
      reason: "token_phase_unavailable",
    };
  }

  const phases = computePhases(timestamps);
  return {
    ...phases,
    pr_number: params.prNumber,
    repo: params.repo,
    model: params.model,
  };
}

const DEFAULT_MODEL = "deepseek-v4-pro";
const PR_AGENT_WORKFLOW_FILE = "pr_agent.yml";

async function main(): Promise<void> {
  const token =
    process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "";
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const runIdStr = process.env.GITHUB_RUN_ID ?? "";
  const prNumberStr = process.env.PR_NUMBER ?? process.env.INPUT_PR_NUMBER ?? "";
  const model = process.env.PR_AGENT_MODEL ?? DEFAULT_MODEL;

  if (!token) {
    process.stderr.write("ERROR: GITHUB_TOKEN or GH_TOKEN env var required\n");
    process.exit(1);
  }
  if (!repo) {
    process.stderr.write("ERROR: GITHUB_REPOSITORY env var required\n");
    process.exit(1);
  }

  let prNumber: number;
  let runId: number | null = null;

  if (runIdStr) {
    runId = parseInt(runIdStr, 10);
  }

  prNumber = parseInt(prNumberStr, 10) || 0;

  if (!runId && prNumber > 0) {
    const runInfo = await fetchRunForPr({
      token,
      repo,
      prNumber,
      workflowFileName: PR_AGENT_WORKFLOW_FILE,
    });
    if (!runInfo) {
      process.stderr.write(
        `ERROR: no PR-Agent workflow run found for PR #${prNumber}\n`,
      );
      process.exit(1);
    }
    runId = runInfo.runId;
  } else if (!runId) {
    process.stderr.write("ERROR: GITHUB_RUN_ID or PR_NUMBER required\n");
    process.exit(1);
  }

  const output = await computeTelemetryForRun({
    token,
    repo,
    runId: runId!,
    prNumber,
    model,
  });

  const validation = validateTelemetryOutput(output as unknown as Record<string, unknown>);
  if (!validation.valid) {
    process.stderr.write(
      `WARN: telemetry output validation violations: ${validation.violations.join(", ")}\n`,
    );
  }

  const jsonStr = JSON.stringify(output, null, 2);
  process.stdout.write(jsonStr + "\n");

  if (output.reason === "token_phase_unavailable") {
    process.stderr.write(
      "INFO: token-level phases unavailable; telemetry validation step fails per AC3\n",
    );
    process.exit(1);
  }
}

const isDirectRun =
  process.argv[1] !== undefined &&
  process.argv[1].includes("pr-agent-telemetry");

if (isDirectRun) {
  main().catch((err: unknown) => {
    process.stderr.write(
      `FATAL: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(2);
  });
}
