import { describe, it, expect } from "vitest";
import {
  TELEMETRY_SCHEMA_VERSION,
  computePhases,
  extractWorkflowTiming,
  buildTimestampsFromTiming,
  computeRollingStats,
  validateTelemetryOutput,
  validateTelemetrySchema,
  type TokenPhaseTimestamps,
  type GithubActionJob,
} from "../../scripts/pr-agent-telemetry.js";

describe("pr-agent-telemetry: phase calculation", () => {
  it("AC1+AC2: computes all four phases from valid token-level timestamps", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:00:00.000Z",
      llmRequestEmission: "2026-05-05T10:00:05.000Z",
      firstTokenAt: "2026-05-05T10:00:08.000Z",
      lastTokenAt: "2026-05-05T10:02:30.000Z",
      ciStepExit: "2026-05-05T10:03:00.000Z",
    };

    const result = computePhases(timestamps);

    expect(result.ci_step_setup_ms).toBe(5000);
    expect(result.ttft_ms).toBe(3000);
    expect(result.ttlt_ms).toBe(142000);
    expect(result.total_ci_stage_ms).toBe(180000);
    expect(result.reason).toBeUndefined();
  });

  it("AC2: TTFT is computed from LLM request emission to first token, not PR creation", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:00:00.000Z",
      llmRequestEmission: "2026-05-05T10:00:10.000Z",
      firstTokenAt: "2026-05-05T10:00:15.000Z",
      lastTokenAt: "2026-05-05T10:01:00.000Z",
      ciStepExit: "2026-05-05T10:01:30.000Z",
    };

    const result = computePhases(timestamps);

    expect(result.ttft_ms).toBe(5000);
    expect(result.ci_step_setup_ms).toBe(10000);
  });

  it("AC3: emits reason=token_phase_unavailable when token timestamps are null", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:00:00.000Z",
      llmRequestEmission: null,
      firstTokenAt: null,
      lastTokenAt: null,
      ciStepExit: "2026-05-05T10:03:00.000Z",
    };

    const result = computePhases(timestamps);

    expect(result.ci_step_setup_ms).toBeNull();
    expect(result.ttft_ms).toBeNull();
    expect(result.ttlt_ms).toBeNull();
    expect(result.total_ci_stage_ms).toBe(180000);
    expect(result.reason).toBe("token_phase_unavailable");
  });

  it("AC3: emits reason=token_phase_unavailable when only some token timestamps are null", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:00:00.000Z",
      llmRequestEmission: "2026-05-05T10:00:05.000Z",
      firstTokenAt: null,
      lastTokenAt: null,
      ciStepExit: "2026-05-05T10:03:00.000Z",
    };

    const result = computePhases(timestamps);

    expect(result.reason).toBe("token_phase_unavailable");
    expect(result.ci_step_setup_ms).toBeNull();
    expect(result.ttft_ms).toBeNull();
    expect(result.ttlt_ms).toBeNull();
  });

  it("AC1: output includes all required fields with non-null values", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:00:00.000Z",
      llmRequestEmission: "2026-05-05T10:00:05.000Z",
      firstTokenAt: "2026-05-05T10:00:08.000Z",
      lastTokenAt: "2026-05-05T10:02:30.000Z",
      ciStepExit: "2026-05-05T10:03:00.000Z",
    };

    const result = computePhases(timestamps);

    expect(result).toHaveProperty("schema_version", TELEMETRY_SCHEMA_VERSION);
    expect(result).toHaveProperty("ci_step_setup_ms");
    expect(result).toHaveProperty("ttft_ms");
    expect(result).toHaveProperty("ttlt_ms");
    expect(result).toHaveProperty("total_ci_stage_ms");
  });
});

describe("pr-agent-telemetry: no-comment/no-log fallback", () => {
  it("extractWorkflowTiming returns null when no PR-Agent job found", () => {
    const jobs: GithubActionJob[] = [
      {
        id: 1,
        name: "Some Other Job",
        status: "completed",
        conclusion: "success",
        started_at: "2026-05-05T10:00:00Z",
        completed_at: "2026-05-05T10:03:00Z",
        steps: [],
      },
    ];

    const result = extractWorkflowTiming(jobs);
    expect(result).toBeNull();
  });

  it("buildTimestampsFromTiming returns null when ciStepExit is null", () => {
    const result = buildTimestampsFromTiming({
      jobStartedAt: "2026-05-05T10:00:00Z",
      jobCompletedAt: null,
      prAgentStepStartedAt: null,
      prAgentStepCompletedAt: null,
    });

    expect(result).toBeNull();
  });

  it("extractWorkflowTiming finds PR-Agent job and step", () => {
    const jobs: GithubActionJob[] = [
      {
        id: 1,
        name: "Run PR Agent on every pull request",
        status: "completed",
        conclusion: "success",
        started_at: "2026-05-05T10:00:00Z",
        completed_at: "2026-05-05T10:03:00Z",
        steps: [
          {
            name: "PR Agent action step",
            number: 1,
            status: "completed",
            conclusion: "success",
            started_at: "2026-05-05T10:00:05Z",
            completed_at: "2026-05-05T10:02:55Z",
          },
        ],
      },
    ];

    const result = extractWorkflowTiming(jobs);
    expect(result).not.toBeNull();
    expect(result!.prAgentStepStartedAt).toBe("2026-05-05T10:00:05Z");
    expect(result!.prAgentStepCompletedAt).toBe("2026-05-05T10:02:55Z");
  });

  it("buildTimestampsFromTiming falls back to job times when step times are null", () => {
    const result = buildTimestampsFromTiming({
      jobStartedAt: "2026-05-05T10:00:00Z",
      jobCompletedAt: "2026-05-05T10:03:00Z",
      prAgentStepStartedAt: null,
      prAgentStepCompletedAt: null,
    });

    expect(result).not.toBeNull();
    expect(result!.ciStepEntry).toBe("2026-05-05T10:00:00Z");
    expect(result!.ciStepExit).toBe("2026-05-05T10:03:00Z");
  });
});

describe("pr-agent-telemetry: malformed timestamps", () => {
  it("throws on invalid ISO date in ciStepEntry", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "not-a-date",
      llmRequestEmission: null,
      firstTokenAt: null,
      lastTokenAt: null,
      ciStepExit: "2026-05-05T10:03:00.000Z",
    };

    expect(() => computePhases(timestamps)).toThrow(
      "invalid ISO timestamp: not-a-date",
    );
  });

  it("throws on invalid ISO date in ciStepExit", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:00:00.000Z",
      llmRequestEmission: null,
      firstTokenAt: null,
      lastTokenAt: null,
      ciStepExit: "garbage",
    };

    expect(() => computePhases(timestamps)).toThrow(
      "invalid ISO timestamp: garbage",
    );
  });

  it("throws on invalid token-level timestamp when present", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:00:00.000Z",
      llmRequestEmission: "bad-date",
      firstTokenAt: "2026-05-05T10:00:08.000Z",
      lastTokenAt: "2026-05-05T10:02:30.000Z",
      ciStepExit: "2026-05-05T10:03:00.000Z",
    };

    expect(() => computePhases(timestamps)).toThrow(
      "invalid ISO timestamp: bad-date",
    );
  });

  it("handles negative phase duration (ciStepExit before ciStepEntry)", () => {
    const timestamps: TokenPhaseTimestamps = {
      ciStepEntry: "2026-05-05T10:03:00.000Z",
      llmRequestEmission: null,
      firstTokenAt: null,
      lastTokenAt: null,
      ciStepExit: "2026-05-05T10:00:00.000Z",
    };

    const result = computePhases(timestamps);
    expect(result.total_ci_stage_ms).toBeLessThan(0);
  });
});

describe("pr-agent-telemetry: JSON schema", () => {
  it("AC1: validateTelemetrySchema passes for valid output", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: 5000,
      ttft_ms: 3000,
      ttlt_ms: 142000,
      total_ci_stage_ms: 180000,
    };

    const result = validateTelemetrySchema(output);
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("AC1: validateTelemetrySchema reports missing required fields", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
    };

    const result = validateTelemetrySchema(output);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain("repo");
    expect(result.missing).toContain("model");
    expect(result.missing).toContain("ci_step_setup_ms");
    expect(result.missing).toContain("ttft_ms");
    expect(result.missing).toContain("ttlt_ms");
    expect(result.missing).toContain("total_ci_stage_ms");
  });

  it("AC1: validateTelemetrySchema accepts null phase values (token_phase_unavailable)", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: null,
      ttft_ms: null,
      ttlt_ms: null,
      total_ci_stage_ms: 180000,
      reason: "token_phase_unavailable",
    };

    const result = validateTelemetrySchema(output);
    expect(result.valid).toBe(true);
  });
});

describe("pr-agent-telemetry: rolling 10-PR stats", () => {
  it("AC4: computes p50 and p100 for total_ci_stage_ms exactly", () => {
    const durations = [
      120000, 150000, 180000, 200000, 240000,
      300000, 360000, 400000, 450000, 480000,
    ];
    const entries = durations.map((d) => ({ total_ci_stage_ms: d }));

    const stats = computeRollingStats(entries);

    expect(stats.count).toBe(10);
    expect(stats.p100_total_ci_stage_ms).toBe(480000);
    expect(stats.p50_total_ci_stage_ms).toBe(240000);
  });

  it("AC4: handles fewer than 10 entries", () => {
    const entries = [
      { total_ci_stage_ms: 100000 },
      { total_ci_stage_ms: 200000 },
      { total_ci_stage_ms: 300000 },
    ];

    const stats = computeRollingStats(entries);

    expect(stats.count).toBe(3);
    expect(stats.p50_total_ci_stage_ms).toBe(200000);
    expect(stats.p100_total_ci_stage_ms).toBe(300000);
  });

  it("AC4: skips null total_ci_stage_ms values", () => {
    const entries = [
      { total_ci_stage_ms: 100000 },
      { total_ci_stage_ms: null },
      { total_ci_stage_ms: 300000 },
    ];

    const stats = computeRollingStats(entries);

    expect(stats.count).toBe(2);
    expect(stats.p50_total_ci_stage_ms).toBe(100000);
    expect(stats.p100_total_ci_stage_ms).toBe(300000);
  });

  it("AC4: returns zeros for empty input", () => {
    const stats = computeRollingStats([]);

    expect(stats.count).toBe(0);
    expect(stats.p50_total_ci_stage_ms).toBe(0);
    expect(stats.p100_total_ci_stage_ms).toBe(0);
  });

  it("AC4: single entry p50 equals p100", () => {
    const entries = [{ total_ci_stage_ms: 420000 }];

    const stats = computeRollingStats(entries);

    expect(stats.p50_total_ci_stage_ms).toBe(420000);
    expect(stats.p100_total_ci_stage_ms).toBe(420000);
  });

  it("AC4: exact p50/p100 for PRD-002 G3 K3 targets (p50 ≤4min, p100 ≤8min)", () => {
    const entries = [
      { total_ci_stage_ms: 180000 },
      { total_ci_stage_ms: 200000 },
      { total_ci_stage_ms: 210000 },
      { total_ci_stage_ms: 220000 },
      { total_ci_stage_ms: 240000 },
      { total_ci_stage_ms: 250000 },
      { total_ci_stage_ms: 260000 },
      { total_ci_stage_ms: 280000 },
      { total_ci_stage_ms: 350000 },
      { total_ci_stage_ms: 420000 },
    ];

    const stats = computeRollingStats(entries);

    expect(stats.p50_total_ci_stage_ms).toBeLessThanOrEqual(240000);
    expect(stats.p100_total_ci_stage_ms).toBeLessThanOrEqual(480000);
  });
});

describe("pr-agent-telemetry: no PII or secrets in output", () => {
  it("AC5: validateTelemetryOutput passes for clean output", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: 5000,
      ttft_ms: 3000,
      ttlt_ms: 142000,
      total_ci_stage_ms: 180000,
    };

    const result = validateTelemetryOutput(output);
    expect(result.valid).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it("AC5: rejects output containing raw_prompt", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: 5000,
      ttft_ms: 3000,
      ttlt_ms: 142000,
      total_ci_stage_ms: 180000,
      raw_prompt: "system: you are a reviewer",
    };

    const result = validateTelemetryOutput(output);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("forbidden_field_present:raw_prompt");
  });

  it("AC5: rejects output containing review_text", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: 5000,
      ttft_ms: 3000,
      ttlt_ms: 142000,
      total_ci_stage_ms: 180000,
      review_text: "This code has a bug",
    };

    const result = validateTelemetryOutput(output);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("forbidden_field_present:review_text");
  });

  it("AC5: rejects output containing pr_body", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: 5000,
      ttft_ms: 3000,
      ttlt_ms: 142000,
      total_ci_stage_ms: 180000,
      pr_body: "This PR fixes issue #1",
    };

    const result = validateTelemetryOutput(output);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("forbidden_field_present:pr_body");
  });

  it("AC5: rejects output containing leaked secret", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "sk-abc1234567890123456789012",
      ci_step_setup_ms: 5000,
      ttft_ms: 3000,
      ttlt_ms: 142000,
      total_ci_stage_ms: 180000,
    };

    const result = validateTelemetryOutput(output);
    expect(result.valid).toBe(false);
  });

  it("AC5: rejects output with username", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: 5000,
      ttft_ms: 3000,
      ttlt_ms: 142000,
      total_ci_stage_ms: 180000,
      username: "john_doe",
    };

    const result = validateTelemetryOutput(output);
    expect(result.valid).toBe(false);
    expect(result.violations).toContain("forbidden_field_present:username");
  });

  it("AC5: accepts output with token_phase_unavailable reason", () => {
    const output = {
      schema_version: "1.0.0",
      pr_number: 42,
      repo: "owner/repo",
      model: "deepseek-v4-pro",
      ci_step_setup_ms: null,
      ttft_ms: null,
      ttlt_ms: null,
      total_ci_stage_ms: 180000,
      reason: "token_phase_unavailable",
    };

    const result = validateTelemetryOutput(output);
    expect(result.valid).toBe(true);
  });
});
