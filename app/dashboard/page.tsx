"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useProjects, useDeleteProject } from "@/lib/hooks/queries";
import { Button, Card, Spinner, EmptyState, Badge } from "@/components/ui/primitives";

export default function DashboardPage() {
  const { data: projects, isLoading, error } = useProjects();
  const del = useDeleteProject();

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500">
              Each project turns a goal into an execution roadmap.
            </p>
          </div>
          <Link href="/projects/new">
            <Button>New project</Button>
          </Link>
        </div>

        {isLoading && <Spinner label="Loading projects…" />}
        {error && (
          <p className="text-sm text-red-600">Failed to load projects.</p>
        )}

        {projects && projects.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Start with a single sentence describing what you want to build. Vector will do the planning."
            action={
              <Link href="/projects/new">
                <Button>Create your first project</Button>
              </Link>
            }
          />
        )}

        {projects && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.id} className="flex flex-col justify-between">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-slate-900 hover:text-blue-600"
                    >
                      {p.title}
                    </Link>
                    <Badge label={p.status} />
                  </div>
                  <p className="line-clamp-2 text-sm text-slate-500">{p.goal}</p>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Link href={`/projects/${p.id}/roadmap`}>
                    <Button variant="secondary">Roadmap</Button>
                  </Link>
                  <Button
                    variant="danger"
                    disabled={del.isPending}
                    onClick={() => del.mutate(p.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
