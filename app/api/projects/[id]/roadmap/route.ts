import { requireUser, route, json } from "@/lib/api/http";
import { getProjectGraph } from "@/lib/services/projects";
import { computeExecutionPlan, type PlanEdge, type PlanNode } from "@/lib/engine";

/**
 * The hydrated roadmap: the full project graph plus the engine's execution
 * view (order, parallel layers, critical path, actionable set) so the client
 * renders and answers "what's next?" without recomputing.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const { supabase } = await requireUser();
    const graph = await getProjectGraph(supabase, params.id);

    const nodes: PlanNode[] = graph.tasks.map((t) => ({
      id: t.id,
      status: t.status,
      estimatedHours: t.estimatedHours,
    }));
    const edges: PlanEdge[] = graph.dependencies.map((d) => ({
      taskId: d.taskId,
      dependsOnTaskId: d.dependsOnTaskId,
    }));

    return json({ ...graph, execution: computeExecutionPlan(nodes, edges) });
  });
}
