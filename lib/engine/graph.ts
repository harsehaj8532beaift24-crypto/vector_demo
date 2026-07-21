/**
 * Dependency Engine — the intellectual core of Vector.
 *
 * PURE module: no I/O, no framework, no DB. Given tasks and dependency edges it
 * answers every "what should I do next / is this plan valid" question. Claude
 * *proposes* a graph; this engine *validates and orders* it. An invalid graph
 * must never reach the database — callers validate here first.
 *
 * Edge semantics: an edge {taskId, dependsOnTaskId} means `taskId` depends on
 * `dependsOnTaskId`, i.e. the prerequisite (`dependsOnTaskId`) must finish before
 * the dependent (`taskId`). In graph terms the directed edge points
 * prerequisite -> dependent, and a valid plan is a DAG.
 */

export type NodeStatus = "todo" | "in_progress" | "blocked" | "done";

/** Minimal node the engine needs — decoupled from DB/DTO shapes. */
export interface PlanNode {
  id: string;
  status: NodeStatus;
  /** Weight used for critical-path length. Defaults to 0 when null/undefined. */
  estimatedHours?: number | null;
}

/** Directed edge: `taskId` depends on `dependsOnTaskId`. */
export interface PlanEdge {
  taskId: string;
  dependsOnTaskId: string;
}

export interface ValidationResult {
  valid: boolean;
  /** A cycle as an ordered list of node ids (a -> b -> ... -> a), if any. */
  cycle: string[] | null;
  /** Edge endpoints that reference unknown nodes. */
  unknownRefs: string[];
}

export interface CriticalPath {
  path: string[];
  totalHours: number;
}

export interface ExecutionPlan {
  validation: ValidationResult;
  /** Topological execution order (empty when invalid). */
  order: string[];
  /** Layers of nodes that can run in parallel (level 0 first). */
  layers: string[][];
  criticalPath: CriticalPath;
  /** Incomplete tasks whose every prerequisite is done — the actionable set. */
  actionable: string[];
}

interface Adjacency {
  /** prerequisite id -> dependents that require it */
  successors: Map<string, string[]>;
  /** dependent id -> prerequisites it requires */
  predecessors: Map<string, string[]>;
  /** dependent id -> number of prerequisites (in-degree) */
  indegree: Map<string, number>;
}

const weightOf = (node: PlanNode): number =>
  node.estimatedHours != null && node.estimatedHours > 0
    ? node.estimatedHours
    : 0;

function buildAdjacency(nodes: PlanNode[], edges: PlanEdge[]): Adjacency {
  const successors = new Map<string, string[]>();
  const predecessors = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of nodes) {
    successors.set(node.id, []);
    predecessors.set(node.id, []);
    indegree.set(node.id, 0);
  }

  for (const edge of edges) {
    // Skip edges touching unknown nodes; validate() reports them separately.
    if (!successors.has(edge.dependsOnTaskId) || !successors.has(edge.taskId)) {
      continue;
    }
    successors.get(edge.dependsOnTaskId)!.push(edge.taskId);
    predecessors.get(edge.taskId)!.push(edge.dependsOnTaskId);
    indegree.set(edge.taskId, (indegree.get(edge.taskId) ?? 0) + 1);
  }

  return { successors, predecessors, indegree };
}

/** Node ids referenced by an edge that don't exist in the node set. */
function findUnknownRefs(nodes: PlanNode[], edges: PlanEdge[]): string[] {
  const known = new Set(nodes.map((n) => n.id));
  const unknown = new Set<string>();
  for (const edge of edges) {
    if (!known.has(edge.taskId)) unknown.add(edge.taskId);
    if (!known.has(edge.dependsOnTaskId)) unknown.add(edge.dependsOnTaskId);
  }
  return [...unknown];
}

/**
 * DFS cycle extraction. Returns an ordered node list forming a cycle, or null.
 * Uses the prerequisite -> dependent direction.
 */
function findCycle(nodes: PlanNode[], adj: Adjacency): string[] | null {
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const node of nodes) color.set(node.id, WHITE);

  const stack: string[] = [];

  const visit = (id: string): string[] | null => {
    color.set(id, GRAY);
    stack.push(id);

    for (const next of adj.successors.get(id) ?? []) {
      const c = color.get(next) ?? WHITE;
      if (c === GRAY) {
        // Found a back-edge; slice the stack from `next` to close the cycle.
        const start = stack.indexOf(next);
        return [...stack.slice(start), next];
      }
      if (c === WHITE) {
        const found = visit(next);
        if (found) return found;
      }
    }

    stack.pop();
    color.set(id, BLACK);
    return null;
  };

  for (const node of nodes) {
    if ((color.get(node.id) ?? WHITE) === WHITE) {
      const found = visit(node.id);
      if (found) return found;
    }
  }
  return null;
}

export function validate(nodes: PlanNode[], edges: PlanEdge[]): ValidationResult {
  const unknownRefs = findUnknownRefs(nodes, edges);
  const adj = buildAdjacency(nodes, edges);
  const cycle = findCycle(nodes, adj);
  return {
    valid: cycle === null && unknownRefs.length === 0,
    cycle,
    unknownRefs,
  };
}

/**
 * Kahn's algorithm. Returns the topological order, or null if the graph has a
 * cycle. Ties are broken by the input node order for deterministic output.
 */
export function topologicalSort(
  nodes: PlanNode[],
  edges: PlanEdge[],
): string[] | null {
  const adj = buildAdjacency(nodes, edges);
  const order: string[] = [];
  // Preserve input order among ready nodes for determinism.
  const ready: string[] = nodes
    .filter((n) => (adj.indegree.get(n.id) ?? 0) === 0)
    .map((n) => n.id);

  const indegree = new Map(adj.indegree);
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const next of adj.successors.get(id) ?? []) {
      const deg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, deg);
      if (deg === 0) ready.push(next);
    }
  }

  return order.length === nodes.length ? order : null;
}

/**
 * Parallelizable layers. A node's layer is one past the max layer of its
 * prerequisites, so every node in a layer can run concurrently. Returns [] if
 * the graph is cyclic.
 */
export function computeLayers(
  nodes: PlanNode[],
  edges: PlanEdge[],
): string[][] {
  const order = topologicalSort(nodes, edges);
  if (order === null) return [];

  const adj = buildAdjacency(nodes, edges);
  const level = new Map<string, number>();
  for (const id of order) {
    let lvl = 0;
    for (const prereq of adj.predecessors.get(id) ?? []) {
      lvl = Math.max(lvl, (level.get(prereq) ?? 0) + 1);
    }
    level.set(id, lvl);
  }

  const layers: string[][] = [];
  for (const id of order) {
    const lvl = level.get(id) ?? 0;
    while (layers.length <= lvl) layers.push([]);
    layers[lvl]!.push(id);
  }
  return layers;
}

/**
 * Longest weighted path (critical path) by estimated hours. Returns the path
 * and its total weight; empty path if the graph is cyclic.
 */
export function criticalPath(
  nodes: PlanNode[],
  edges: PlanEdge[],
): CriticalPath {
  const order = topologicalSort(nodes, edges);
  if (order === null) return { path: [], totalHours: 0 };

  const adj = buildAdjacency(nodes, edges);
  const weight = new Map(nodes.map((n) => [n.id, weightOf(n)]));
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  let bestId: string | null = null;
  let bestDist = -1;

  for (const id of order) {
    let best = 0;
    let from: string | null = null;
    for (const prereq of adj.predecessors.get(id) ?? []) {
      const d = dist.get(prereq) ?? 0;
      if (d > best) {
        best = d;
        from = prereq;
      }
    }
    const total = best + (weight.get(id) ?? 0);
    dist.set(id, total);
    prev.set(id, from);
    if (total > bestDist) {
      bestDist = total;
      bestId = id;
    }
  }

  const path: string[] = [];
  let cursor = bestId;
  while (cursor != null) {
    path.unshift(cursor);
    cursor = prev.get(cursor) ?? null;
  }
  return { path, totalHours: bestDist < 0 ? 0 : bestDist };
}

/**
 * Incomplete tasks whose every prerequisite is `done`. This is the answer to
 * "what should I do next?" and is stable under replanning: completed work is
 * never re-surfaced, and a task blocked by unfinished prerequisites is excluded.
 */
export function actionableTasks(
  nodes: PlanNode[],
  edges: PlanEdge[],
): string[] {
  const statusOf = new Map(nodes.map((n) => [n.id, n.status]));
  const adj = buildAdjacency(nodes, edges);

  return nodes
    .filter((n) => n.status !== "done")
    .filter((n) =>
      (adj.predecessors.get(n.id) ?? []).every(
        (p) => statusOf.get(p) === "done",
      ),
    )
    .map((n) => n.id);
}

/** One-shot: everything a caller needs to render/validate a roadmap. */
export function computeExecutionPlan(
  nodes: PlanNode[],
  edges: PlanEdge[],
): ExecutionPlan {
  const validation = validate(nodes, edges);
  if (!validation.valid) {
    return {
      validation,
      order: [],
      layers: [],
      criticalPath: { path: [], totalHours: 0 },
      actionable: [],
    };
  }
  return {
    validation,
    order: topologicalSort(nodes, edges) ?? [],
    layers: computeLayers(nodes, edges),
    criticalPath: criticalPath(nodes, edges),
    actionable: actionableTasks(nodes, edges),
  };
}
