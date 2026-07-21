"use client";

import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { useRoadmap } from "@/lib/hooks/queries";
import { Button, Card, Spinner } from "@/components/ui/primitives";

/**
 * Roadmap screen. Phase 7 replaces this list view with the interactive React
 * Flow canvas (nodes = tasks/milestones, edges = dependencies). For now it
 * renders the engine's execution layers so the data path is verifiable.
 */
export default function RoadmapPage({ params }: { params: { id: string } }) {
  const { data, isLoading, error } = useRoadmap(params.id);

  return (
    <div className="min-h-screen bg-slate-50/50">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Roadmap</h1>
          <Link href={`/projects/${params.id}`}>
            <Button variant="secondary">Back to project</Button>
          </Link>
        </div>

        {isLoading && <Spinner label="Loading roadmap…" />}
        {error && <p className="text-sm text-red-600">Failed to load roadmap.</p>}

        {data && (
          <div className="flex flex-col gap-4">
            {data.execution.layers.map((layer, i) => (
              <Card key={i}>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Stage {i + 1} — can run in parallel
                </p>
                <div className="flex flex-wrap gap-2">
                  {layer.map((taskId) => {
                    const task = data.tasks.find((t) => t.id === taskId);
                    if (!task) return null;
                    return (
                      <span
                        key={taskId}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                      >
                        {task.title}
                      </span>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
