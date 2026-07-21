import { z } from "zod";
import type { Db } from "@/lib/db/clients";
import type { Database } from "@/lib/db/database.types";
import { ApiError } from "@/lib/api/errors";
import { toTask } from "@/lib/db/mappers";
import type { Task } from "@/lib/types/domain";

type TaskUpdate = Database["public"]["Tables"]["tasks"]["Update"];

/**
 * Task mutations. Ownership is enforced by RLS (a task's project must be owned
 * by the caller), so these operate directly and surface a 404 when the row is
 * invisible to the caller.
 */

export const UpdateTaskInput = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z.enum(["todo", "in_progress", "blocked", "done"]).optional(),
  estimatedHours: z.number().nonnegative().nullable().optional(),
  workstreamId: z.string().uuid().nullable().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInput>;

export async function updateTask(
  supabase: Db,
  id: string,
  input: UpdateTaskInput,
): Promise<Task> {
  const patch: TaskUpdate = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.status !== undefined) patch.status = input.status;
  if (input.estimatedHours !== undefined) patch.estimated_hours = input.estimatedHours;
  if (input.workstreamId !== undefined) patch.workstream_id = input.workstreamId;

  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw new ApiError("internal", error.message);
  if (!data) throw ApiError.notFound("Task not found");
  return toTask(data);
}

export async function deleteTask(supabase: Db, id: string): Promise<void> {
  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new ApiError("internal", error.message);
  if (!data) throw ApiError.notFound("Task not found");
}
