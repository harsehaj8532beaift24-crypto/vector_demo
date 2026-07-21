import { z } from "zod";
import type { Db } from "@/lib/db/clients";
import { ApiError } from "@/lib/api/errors";
import {
  toProject,
  toWorkstream,
  toTask,
  toDependency,
  toMilestone,
} from "@/lib/db/mappers";
import type { Project, ProjectGraph } from "@/lib/types/domain";

export const CreateProjectInput = z.object({
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(2000),
  description: z.string().max(4000).optional(),
  timeline: z.string().max(200).nullable().optional(),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInput>;

export const UpdateProjectInput = z.object({
  title: z.string().min(1).max(200).optional(),
  goal: z.string().min(1).max(2000).optional(),
  description: z.string().max(4000).optional(),
  timeline: z.string().max(200).nullable().optional(),
  status: z
    .enum(["draft", "planning", "active", "completed", "archived"])
    .optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInput>;

export async function createProject(
  supabase: Db,
  userId: string,
  input: CreateProjectInput,
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      title: input.title,
      goal: input.goal,
      description: input.description ?? "",
      timeline: input.timeline ?? null,
    })
    .select()
    .single();
  if (error || !data) throw new ApiError("internal", error?.message ?? "Insert failed");
  return toProject(data);
}

export async function listProjects(supabase: Db): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select()
    .order("created_at", { ascending: false });
  if (error) throw new ApiError("internal", error.message);
  return (data ?? []).map(toProject);
}

export async function getProject(supabase: Db, id: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new ApiError("internal", error.message);
  if (!data) throw ApiError.notFound("Project not found");
  return toProject(data);
}

export async function updateProject(
  supabase: Db,
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  // Ensure it exists / is owned (RLS + explicit 404).
  await getProject(supabase, id);
  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select()
    .single();
  if (error || !data) throw new ApiError("internal", error?.message ?? "Update failed");
  return toProject(data);
}

export async function deleteProject(supabase: Db, id: string): Promise<void> {
  await getProject(supabase, id);
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new ApiError("internal", error.message);
}

/** Hydrate the full project graph for the roadmap / dashboard. */
export async function getProjectGraph(
  supabase: Db,
  id: string,
): Promise<ProjectGraph> {
  const project = await getProject(supabase, id);

  const [workstreams, tasks, dependencies, milestones] = await Promise.all([
    supabase.from("workstreams").select().eq("project_id", id).order("position"),
    supabase.from("tasks").select().eq("project_id", id).order("position"),
    supabase.from("dependencies").select().eq("project_id", id),
    supabase.from("milestones").select().eq("project_id", id).order("position"),
  ]);

  const firstError =
    workstreams.error ?? tasks.error ?? dependencies.error ?? milestones.error;
  if (firstError) throw new ApiError("internal", firstError.message);

  return {
    project,
    workstreams: (workstreams.data ?? []).map(toWorkstream),
    tasks: (tasks.data ?? []).map(toTask),
    dependencies: (dependencies.data ?? []).map(toDependency),
    milestones: (milestones.data ?? []).map(toMilestone),
  };
}
