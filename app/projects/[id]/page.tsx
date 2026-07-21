"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useRoadmap } from "@/lib/hooks/queries";
import { Button, Card, Spinner, Badge, EmptyState } from "@/components/ui/primitives";

export default function ProjectWorkspacePage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const { data, isLoading, error } = useRoadmap(id);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        {isLoading && <Spinner label="Loading project…" />}
        {error && <p className="text-sm text-red-600">Failed to load project.</p>}

        {data && (
          <>
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-slate-900">
                  {data.project.title}
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  {data.project.goal}
                </p>
              </div>
              <Link href={`/projects/${id}/roadmap`}>
                <Button>Open roadmap</Button>
              </Link>
            </div>

            {data.tasks.length === 0 ? (
              <EmptyState
                title="No roadmap yet"
                description="This project doesn't have a generated roadmap. Create one from the project creation flow."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Tasks" value={data.tasks.length} />
                <Stat label="Milestones" value={data.milestones.length} />
                <Stat
                  label="Est. critical path"
                  value={`${data.execution.criticalPath.totalHours}h`}
                />
                <Card className="sm:col-span-3">
                  <h2 className="mb-3 text-sm font-semibold text-slate-700">
                    What to do next
                  </h2>
                  {data.execution.actionable.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      No unblocked tasks — everything is either done or waiting on
                      prerequisites.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {data.execution.actionable.map((taskId) => {
                        const task = data.tasks.find((t) => t.id === taskId);
                        if (!task) return null;
                        return (
                          <li
                            key={taskId}
                            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                          >
                            <span className="text-sm text-slate-800">
                              {task.title}
                            </span>
                            <Badge label={task.priority} tone={task.priority} />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}
