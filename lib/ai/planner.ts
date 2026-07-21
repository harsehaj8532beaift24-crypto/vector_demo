import { z } from "zod";
import { validate, type PlanEdge, type PlanNode } from "@/lib/engine";
import type { LlmClient, CompletionRequest } from "./client";
import {
  FORMATS,
  PlanSchema,
  DiscoverySchema,
  RecommendationsSchema,
  type Plan,
  type Discovery,
  type Recommendations,
  type JsonSchemaFormat,
} from "./schemas";
import {
  systemPrompt,
  discoveryPrompt,
  initialPlanPrompt,
  replanPrompt,
  recommendationsPrompt,
  type GoalInput,
  type ReplanInput,
} from "./prompts";

/**
 * Planning Service — the reasoning layer.
 *
 * It never trusts raw model output. Every response is:
 *   1. JSON-parsed and Zod-validated (shape),
 *   2. for plans, checked by the dependency engine (a valid DAG, no dangling
 *      references, no duplicate keys, every workstream reference resolvable).
 * On any failure it retries, feeding the specific error back to the model so
 * it can self-correct — bounded, then a typed, graceful failure.
 *
 * The engine check here is the guarantee behind the whole system: an invalid
 * plan cannot be returned to a caller, so it can never be persisted.
 */

export class PlanningError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly lastIssues: string[],
  ) {
    super(message);
    this.name = "PlanningError";
  }
}

const MAX_ATTEMPTS = 3;

/** Semantic checks beyond shape — returns human-readable issues for the model. */
export function checkPlan(plan: Plan): string[] {
  const issues: string[] = [];

  const taskKeys = new Set<string>();
  for (const t of plan.tasks) {
    if (taskKeys.has(t.key)) issues.push(`duplicate task key "${t.key}"`);
    taskKeys.add(t.key);
  }

  const wsKeys = new Set(plan.workstreams.map((w) => w.key));
  if (wsKeys.size !== plan.workstreams.length) {
    issues.push("duplicate workstream keys");
  }

  for (const t of plan.tasks) {
    if (!wsKeys.has(t.workstreamKey)) {
      issues.push(`task "${t.key}" references unknown workstream "${t.workstreamKey}"`);
    }
    for (const d of t.dependsOn) {
      if (d === t.key) issues.push(`task "${t.key}" depends on itself`);
    }
  }

  for (const m of plan.milestones) {
    for (const k of m.taskKeys) {
      if (!taskKeys.has(k)) {
        issues.push(`milestone "${m.key}" references unknown task "${k}"`);
      }
    }
  }

  // The core guarantee: the dependency graph must be a valid DAG.
  const nodes: PlanNode[] = plan.tasks.map((t) => ({
    id: t.key,
    status: "todo",
    estimatedHours: t.estimatedHours,
  }));
  const edges: PlanEdge[] = plan.tasks.flatMap((t) =>
    t.dependsOn.map((d) => ({ taskId: t.key, dependsOnTaskId: d })),
  );
  const v = validate(nodes, edges);
  if (v.cycle) {
    issues.push(`dependency cycle: ${v.cycle.join(" → ")}`);
  }
  if (v.unknownRefs.length > 0) {
    issues.push(`dependencies reference unknown tasks: ${v.unknownRefs.join(", ")}`);
  }

  return issues;
}

export class Planner {
  constructor(private readonly client: LlmClient) {}

  /** Ask clarifying questions before planning. */
  async discover(goal: string): Promise<Discovery> {
    return this.run(DiscoverySchema, FORMATS.discovery, {
      system: systemPrompt(),
      user: discoveryPrompt(goal),
      format: FORMATS.discovery,
    });
  }

  /** Generate the initial roadmap from a goal. */
  async generateRoadmap(input: GoalInput): Promise<Plan> {
    return this.runPlan({
      system: systemPrompt(),
      user: initialPlanPrompt(input),
      format: FORMATS.plan,
    });
  }

  /** Adapt an existing roadmap to changed requirements, preserving completed work. */
  async updateRoadmap(input: ReplanInput): Promise<Plan> {
    return this.runPlan({
      system: systemPrompt(),
      user: replanPrompt(input),
      format: FORMATS.plan,
    });
  }

  async recommend(input: ReplanInput["graph"]): Promise<Recommendations> {
    return this.run(RecommendationsSchema, FORMATS.recommendations, {
      system: systemPrompt(),
      user: recommendationsPrompt(input),
      format: FORMATS.recommendations,
    });
  }

  /** Plan generation with shape + engine validation and self-correcting retry. */
  private async runPlan(req: CompletionRequest): Promise<Plan> {
    let user = req.user;
    const allIssues: string[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await this.client.complete({ ...req, user });
      const parsed = safeParseJson(raw, PlanSchema);

      if (!parsed.ok) {
        allIssues.push(...parsed.issues);
        user = withCorrection(req.user, parsed.issues);
        continue;
      }

      const issues = checkPlan(parsed.value);
      if (issues.length === 0) return parsed.value;

      allIssues.push(...issues);
      user = withCorrection(req.user, issues);
    }

    throw new PlanningError(
      "Could not produce a valid roadmap after retries",
      MAX_ATTEMPTS,
      allIssues,
    );
  }

  /** Generic shape-only validation + retry for non-plan outputs. */
  private async run<T>(
    schema: z.ZodType<T>,
    format: JsonSchemaFormat,
    req: CompletionRequest,
  ): Promise<T> {
    let user = req.user;
    const allIssues: string[] = [];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const raw = await this.client.complete({ ...req, user });
      const parsed = safeParseJson(raw, schema);
      if (parsed.ok) return parsed.value;
      allIssues.push(...parsed.issues);
      user = withCorrection(req.user, parsed.issues);
    }

    throw new PlanningError(
      `Could not produce a valid ${format.name} after retries`,
      MAX_ATTEMPTS,
      allIssues,
    );
  }
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

function safeParseJson<T>(raw: string, schema: z.ZodType<T>): ParseResult<T> {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, issues: ["response was not valid JSON"] };
  }
  const result = schema.safeParse(json);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    issues: result.error.issues.map(
      (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
    ),
  };
}

function withCorrection(baseUser: string, issues: string[]): string {
  return `${baseUser}\n\nYour previous attempt was invalid. Fix these problems and return corrected output:\n${issues.map((i) => `- ${i}`).join("\n")}`;
}
