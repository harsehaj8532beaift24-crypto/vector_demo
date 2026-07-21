import type { Project, Task, ProjectGraph } from "@/lib/types/domain";
import type { ExecutionPlan } from "@/lib/engine";
import type { Discovery } from "@/lib/ai/schemas";

/**
 * Typed browser-side API client. The single way the frontend reaches the
 * backend — every call goes through our route handlers (never Supabase REST
 * for domain data). Shares DTO types with the server, so the contract is
 * enforced at compile time on both ends.
 */

export type RoadmapResponse = ProjectGraph & { execution: ExecutionPlan };

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    let code = "internal";
    let message = res.statusText;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new ApiClientError(code, message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface CreateProjectBody {
  title: string;
  goal: string;
  description?: string;
  timeline?: string | null;
}

export interface UpdateTaskBody {
  title?: string;
  description?: string;
  priority?: Task["priority"];
  status?: Task["status"];
  estimatedHours?: number | null;
  workstreamId?: string | null;
}

export const api = {
  listProjects: () => request<Project[]>("/projects"),

  getProject: (id: string) => request<Project>(`/projects/${id}`),

  createProject: (body: CreateProjectBody) =>
    request<Project>("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  deleteProject: (id: string) =>
    request<{ deleted: true }>(`/projects/${id}`, { method: "DELETE" }),

  getRoadmap: (id: string) => request<RoadmapResponse>(`/projects/${id}/roadmap`),

  generateRoadmap: (
    id: string,
    answers?: Array<{ question: string; answer: string }>,
  ) =>
    request<ProjectGraph>(`/projects/${id}/generate-roadmap`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    }),

  discover: (goal: string) =>
    request<Discovery>("/discover", {
      method: "POST",
      body: JSON.stringify({ goal }),
    }),

  updateTask: (id: string, body: UpdateTaskBody) =>
    request<Task>(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteTask: (id: string) =>
    request<{ deleted: true }>(`/tasks/${id}`, { method: "DELETE" }),
};
