import { z } from "zod";

/**
 * Domain contract. These types mirror the database schema (docs/database.md)
 * and are the single source of truth shared between server and client.
 * Runtime-validated with Zod so both API boundaries and AI responses can be
 * parsed with the same schemas.
 */

// --- Enums ------------------------------------------------------------------

export const ProjectStatus = z.enum([
  "draft",
  "planning",
  "active",
  "completed",
  "archived",
]);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

export const TaskStatus = z.enum(["todo", "in_progress", "blocked", "done"]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskPriority = z.enum(["low", "medium", "high", "critical"]);
export type TaskPriority = z.infer<typeof TaskPriority>;

export const RecommendationStatus = z.enum(["active", "dismissed", "applied"]);
export type RecommendationStatus = z.infer<typeof RecommendationStatus>;

// --- Entities ---------------------------------------------------------------

export const Project = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(2000),
  description: z.string().default(""),
  status: ProjectStatus,
  timeline: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof Project>;

export const Workstream = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().default(""),
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Workstream = z.infer<typeof Workstream>;

export const Task = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  workstreamId: z.string().uuid().nullable(),
  title: z.string().min(1).max(200),
  description: z.string().default(""),
  priority: TaskPriority,
  status: TaskStatus,
  estimatedHours: z.number().nonnegative().nullable(),
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof Task>;

export const Dependency = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  taskId: z.string().uuid(),
  dependsOnTaskId: z.string().uuid(),
  createdAt: z.string(),
});
export type Dependency = z.infer<typeof Dependency>;

export const Milestone = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  title: z.string().min(1).max(200),
  deadline: z.string().nullable(),
  completed: z.boolean(),
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Milestone = z.infer<typeof Milestone>;

export const Recommendation = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  message: z.string(),
  reasoning: z.string(),
  impact: z.string().default(""),
  status: RecommendationStatus,
  createdAt: z.string(),
});
export type Recommendation = z.infer<typeof Recommendation>;

/** A fully-hydrated project used by the roadmap and dashboard. */
export interface ProjectGraph {
  project: Project;
  workstreams: Workstream[];
  tasks: Task[];
  dependencies: Dependency[];
  milestones: Milestone[];
}
