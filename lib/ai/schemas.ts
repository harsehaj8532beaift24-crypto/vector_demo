import { z } from "zod";
import { TaskPriority } from "@/lib/types/domain";

/**
 * The contract for what Claude must return. Two representations of the same
 * shape:
 *   - `PlanSchema` (Zod) validates the parsed response at runtime.
 *   - `PLAN_JSON_SCHEMA` is handed to the Messages API `output_config.format`
 *     so the model is *constrained* to emit this shape (structured outputs).
 *
 * Claude works in slug `key`s, not UUIDs — it doesn't know database ids. The
 * persistence layer (Phase 5) maps keys → UUIDs when writing. Within the AI
 * layer and the dependency engine, a task's `key` IS its node id.
 *
 * Structured-outputs constraints: every object sets additionalProperties:false
 * and lists all properties as required; optionality is expressed with nullable
 * types, never by omission.
 */

const KEY = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "must be a lowercase kebab-case slug");

export const PlanWorkstream = z.object({
  key: KEY,
  name: z.string().min(1).max(200),
  description: z.string(),
});

export const PlanTask = z.object({
  key: KEY,
  title: z.string().min(1).max(200),
  description: z.string(),
  priority: TaskPriority,
  estimatedHours: z.number().positive().nullable(),
  workstreamKey: KEY,
  dependsOn: z.array(KEY),
});

export const PlanMilestone = z.object({
  key: KEY,
  title: z.string().min(1).max(200),
  taskKeys: z.array(KEY),
});

export const PlanSchema = z.object({
  summary: z.string(),
  workstreams: z.array(PlanWorkstream).min(1),
  tasks: z.array(PlanTask).min(1),
  milestones: z.array(PlanMilestone),
});
export type Plan = z.infer<typeof PlanSchema>;
export type PlanTask = z.infer<typeof PlanTask>;

export const DiscoverySchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1),
        why: z.string().min(1),
      }),
    )
    .min(1)
    .max(6),
});
export type Discovery = z.infer<typeof DiscoverySchema>;

export const RecommendationsSchema = z.object({
  recommendations: z
    .array(
      z.object({
        message: z.string().min(1),
        reasoning: z.string().min(1),
        impact: z.string(),
      }),
    )
    .max(10),
});
export type Recommendations = z.infer<typeof RecommendationsSchema>;

// --- JSON Schemas for output_config.format (structured outputs) -------------
// Hand-written to guarantee the strict-mode requirements the SDK enforces.

const PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "workstreams", "tasks", "milestones"],
  properties: {
    summary: { type: "string" },
    workstreams: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "name", "description"],
        properties: {
          key: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "key",
          "title",
          "description",
          "priority",
          "estimatedHours",
          "workstreamKey",
          "dependsOn",
        ],
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
          estimatedHours: { type: ["number", "null"] },
          workstreamKey: { type: "string" },
          dependsOn: { type: "array", items: { type: "string" } },
        },
      },
    },
    milestones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "title", "taskKeys"],
        properties: {
          key: { type: "string" },
          title: { type: "string" },
          taskKeys: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

const DISCOVERY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["question", "why"],
        properties: {
          question: { type: "string" },
          why: { type: "string" },
        },
      },
    },
  },
} as const;

const RECOMMENDATIONS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["message", "reasoning", "impact"],
        properties: {
          message: { type: "string" },
          reasoning: { type: "string" },
          impact: { type: "string" },
        },
      },
    },
  },
} as const;

/** Named JSON-schema formats passed to the model, paired with their Zod validator. */
export const FORMATS = {
  plan: { name: "vector_plan", schema: PLAN_JSON_SCHEMA },
  discovery: { name: "vector_discovery", schema: DISCOVERY_JSON_SCHEMA },
  recommendations: {
    name: "vector_recommendations",
    schema: RECOMMENDATIONS_JSON_SCHEMA,
  },
} as const;

export type JsonSchemaFormat = {
  name: string;
  schema: Record<string, unknown>;
};
