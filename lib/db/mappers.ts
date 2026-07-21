import type { Database } from "./database.types";
import type {
  Project,
  Workstream,
  Task,
  Dependency,
  Milestone,
  Recommendation,
} from "@/lib/types/domain";

type Rows = Database["public"]["Tables"];

/** DB row → domain DTO. The one place snake_case becomes camelCase. */

export const toProject = (r: Rows["projects"]["Row"]): Project => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  goal: r.goal,
  description: r.description,
  status: r.status,
  timeline: r.timeline,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toWorkstream = (r: Rows["workstreams"]["Row"]): Workstream => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  description: r.description,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toTask = (r: Rows["tasks"]["Row"]): Task => ({
  id: r.id,
  projectId: r.project_id,
  workstreamId: r.workstream_id,
  title: r.title,
  description: r.description,
  priority: r.priority,
  status: r.status,
  estimatedHours: r.estimated_hours,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toDependency = (r: Rows["dependencies"]["Row"]): Dependency => ({
  id: r.id,
  projectId: r.project_id,
  taskId: r.task_id,
  dependsOnTaskId: r.depends_on_task_id,
  createdAt: r.created_at,
});

export const toMilestone = (r: Rows["milestones"]["Row"]): Milestone => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  deadline: r.deadline,
  completed: r.completed,
  position: r.position,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toRecommendation = (
  r: Rows["recommendations"]["Row"],
): Recommendation => ({
  id: r.id,
  projectId: r.project_id,
  message: r.message,
  reasoning: r.reasoning,
  impact: r.impact,
  status: r.status,
  createdAt: r.created_at,
});
