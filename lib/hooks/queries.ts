"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type CreateProjectBody, type UpdateTaskBody } from "@/lib/api/client";

/** React Query hooks — the only place the frontend reads/writes server state. */

export const keys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  roadmap: (id: string) => ["projects", id, "roadmap"] as const,
};

export function useProjects() {
  return useQuery({ queryKey: keys.projects, queryFn: api.listProjects });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: keys.project(id),
    queryFn: () => api.getProject(id),
  });
}

export function useRoadmap(id: string) {
  return useQuery({
    queryKey: keys.roadmap(id),
    queryFn: () => api.getRoadmap(id),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectBody) => api.createProject(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.projects }),
  });
}

export function useGenerateRoadmap(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answers?: Array<{ question: string; answer: string }>) =>
      api.generateRoadmap(projectId, answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.roadmap(projectId) });
      qc.invalidateQueries({ queryKey: keys.project(projectId) });
    },
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; body: UpdateTaskBody }) =>
      api.updateTask(args.id, args.body),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.roadmap(projectId) }),
  });
}

export function useDiscover() {
  return useMutation({ mutationFn: (goal: string) => api.discover(goal) });
}
