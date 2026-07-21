import type { Db } from "@/lib/db/clients";
import { ApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/db/database.types";
import { computeExecutionPlan, type PlanEdge, type PlanNode } from "@/lib/engine";
import type { Plan } from "@/lib/ai/schemas";
import { checkPlan } from "@/lib/ai/planner";
import { getProjectGraph } from "./projects";
import type { ProjectGraph } from "@/lib/types/domain";

type Inserts = Database["public"]["Tables"];

export interface RoadmapRows {
  workstreams: Inserts["workstreams"]["Insert"][];
  tasks: Inserts["tasks"]["Insert"][];
  dependencies: Inserts["dependencies"]["Insert"][];
  milestones: Inserts["milestones"]["Insert"][];
}

/**
 * Pure transform: an AI plan (slug keys) → database insert rows (UUIDs).
 *
 * Claude reasons in `key`s; the database keys on UUIDs. This resolves every
 * key to a freshly-minted id and rewrites dependency edges accordingly. Kept
 * pure (id generator injected) so it can be unit-tested without a database.
 */
export function planToRows(
  projectId: string,
  plan: Plan,
  newId: () => string,
): RoadmapRows {
  const workstreamId = new Map<string, string>();
  for (const w of plan.workstreams) workstreamId.set(w.key, newId());

  const taskId = new Map<string, string>();
  for (const t of plan.tasks) taskId.set(t.key, newId());

  const resolveTask = (key: string): string => {
    const id = taskId.get(key);
    if (!id) throw new ApiError("internal", `unresolved task key "${key}"`);
    return id;
  };

  const workstreams = plan.workstreams.map((w, i) => ({
    id: workstreamId.get(w.key)!,
    project_id: projectId,
    name: w.name,
    description: w.description,
    position: i,
  }));

  const tasks = plan.tasks.map((t, i) => ({
    id: resolveTask(t.key),
    project_id: projectId,
    workstream_id: workstreamId.get(t.workstreamKey) ?? null,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: "todo" as const,
    estimated_hours: t.estimatedHours,
    position: i,
  }));

  const dependencies = plan.tasks.flatMap((t) =>
    t.dependsOn.map((dep) => ({
      project_id: projectId,
      task_id: resolveTask(t.key),
      depends_on_task_id: resolveTask(dep),
    })),
  );

  const milestones = plan.milestones.map((m, i) => ({
    project_id: projectId,
    title: m.title,
    position: i,
  }));

  return { workstreams, tasks, dependencies, milestones };
}

/**
 * Persist a freshly-generated roadmap into an empty project. Re-validates the
 * plan through the engine (defense in depth — the planner already gated it)
 * before any write, so an invalid DAG can never be written.
 *
 * Inserts in dependency order. A production system would wrap this in a
 * Postgres function for atomicity; for the MVP we insert sequentially and fail
 * loudly — generate-roadmap runs against an empty project, so partial state is
 * recoverable by regenerating.
 */
export async function persistNewRoadmap(
  supabase: Db,
  projectId: string,
  plan: Plan,
  newId: () => string,
): Promise<ProjectGraph> {
  const planIssues = checkPlan(plan);
  if (planIssues.length > 0) {
    throw new ApiError("planning_failed", "Plan failed validation", {
      issues: planIssues,
    });
  }

  const rows = planToRows(projectId, plan, newId);

  // Final engine gate on the resolved UUID graph.
  const nodes: PlanNode[] = rows.tasks.map((t) => ({
    id: t.id!,
    status: "todo",
    estimatedHours: t.estimated_hours ?? null,
  }));
  const edges: PlanEdge[] = rows.dependencies.map((d) => ({
    taskId: d.task_id,
    dependsOnTaskId: d.depends_on_task_id,
  }));
  const execution = computeExecutionPlan(nodes, edges);
  if (!execution.validation.valid) {
    throw new ApiError("planning_failed", "Resolved roadmap is not a valid DAG", {
      validation: execution.validation,
    });
  }

  const ws = await supabase.from("workstreams").insert(rows.workstreams);
  if (ws.error) throw new ApiError("internal", ws.error.message);

  const tk = await supabase.from("tasks").insert(rows.tasks);
  if (tk.error) throw new ApiError("internal", tk.error.message);

  if (rows.dependencies.length > 0) {
    const dp = await supabase.from("dependencies").insert(rows.dependencies);
    if (dp.error) throw new ApiError("internal", dp.error.message);
  }

  if (rows.milestones.length > 0) {
    const ms = await supabase.from("milestones").insert(rows.milestones);
    if (ms.error) throw new ApiError("internal", ms.error.message);
  }

  await supabase.from("projects").update({ status: "active" }).eq("id", projectId);
  await supabase.from("project_history").insert({
    project_id: projectId,
    event: "roadmap_generated",
    snapshot: { summary: plan.summary, taskCount: rows.tasks.length },
  });

  return getProjectGraph(supabase, projectId);
}
