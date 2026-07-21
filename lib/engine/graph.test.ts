import { describe, it, expect } from "vitest";
import {
  validate,
  topologicalSort,
  computeLayers,
  criticalPath,
  actionableTasks,
  computeExecutionPlan,
  type PlanNode,
  type PlanEdge,
  type NodeStatus,
} from "./graph";

const node = (id: string, status: NodeStatus = "todo", hours?: number): PlanNode => ({
  id,
  status,
  estimatedHours: hours ?? null,
});

/** edge: `task` depends on `dependsOn` (dependsOn must finish first). */
const dep = (task: string, dependsOn: string): PlanEdge => ({
  taskId: task,
  dependsOnTaskId: dependsOn,
});

/** Assert that in a topological order, prerequisites precede dependents. */
function assertOrdered(order: string[], edges: PlanEdge[]) {
  const pos = new Map(order.map((id, i) => [id, i]));
  for (const e of edges) {
    expect(pos.get(e.dependsOnTaskId)!).toBeLessThan(pos.get(e.taskId)!);
  }
}

describe("validate", () => {
  it("accepts a valid DAG", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [dep("b", "a"), dep("c", "b")];
    const r = validate(nodes, edges);
    expect(r.valid).toBe(true);
    expect(r.cycle).toBeNull();
    expect(r.unknownRefs).toEqual([]);
  });

  it("detects a two-node cycle", () => {
    const nodes = [node("a"), node("b")];
    const edges = [dep("b", "a"), dep("a", "b")];
    const r = validate(nodes, edges);
    expect(r.valid).toBe(false);
    expect(r.cycle).not.toBeNull();
    // cycle closes on itself
    expect(r.cycle![0]).toBe(r.cycle![r.cycle!.length - 1]);
  });

  it("detects a longer cycle", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [dep("b", "a"), dep("c", "b"), dep("a", "c")];
    const r = validate(nodes, edges);
    expect(r.valid).toBe(false);
    expect(r.cycle).not.toBeNull();
  });

  it("reports edges referencing unknown nodes", () => {
    const nodes = [node("a")];
    const edges = [dep("a", "ghost")];
    const r = validate(nodes, edges);
    expect(r.valid).toBe(false);
    expect(r.unknownRefs).toContain("ghost");
  });
});

describe("topologicalSort", () => {
  it("orders a linear chain", () => {
    const nodes = [node("c"), node("a"), node("b")];
    const edges = [dep("b", "a"), dep("c", "b")];
    const order = topologicalSort(nodes, edges);
    expect(order).not.toBeNull();
    assertOrdered(order!, edges);
  });

  it("returns null on a cycle", () => {
    const nodes = [node("a"), node("b")];
    const edges = [dep("b", "a"), dep("a", "b")];
    expect(topologicalSort(nodes, edges)).toBeNull();
  });

  it("handles a diamond", () => {
    // a -> b, a -> c, b -> d, c -> d
    const nodes = [node("a"), node("b"), node("c"), node("d")];
    const edges = [dep("b", "a"), dep("c", "a"), dep("d", "b"), dep("d", "c")];
    const order = topologicalSort(nodes, edges);
    expect(order).not.toBeNull();
    assertOrdered(order!, edges);
    expect(order![0]).toBe("a");
    expect(order![order!.length - 1]).toBe("d");
  });

  it("is deterministic for independent nodes (input order preserved)", () => {
    const nodes = [node("x"), node("y"), node("z")];
    expect(topologicalSort(nodes, [])).toEqual(["x", "y", "z"]);
  });
});

describe("computeLayers", () => {
  it("groups parallelizable work", () => {
    // a -> b, a -> c, {b,c} -> d
    const nodes = [node("a"), node("b"), node("c"), node("d")];
    const edges = [dep("b", "a"), dep("c", "a"), dep("d", "b"), dep("d", "c")];
    const layers = computeLayers(nodes, edges);
    expect(layers[0]).toEqual(["a"]);
    expect([...layers[1]!].sort()).toEqual(["b", "c"]);
    expect(layers[2]).toEqual(["d"]);
  });

  it("returns [] on a cycle", () => {
    const nodes = [node("a"), node("b")];
    expect(computeLayers(nodes, [dep("b", "a"), dep("a", "b")])).toEqual([]);
  });
});

describe("criticalPath", () => {
  it("finds the longest weighted path", () => {
    // a(2) -> b(5) -> d(1) ; a(2) -> c(1) -> d(1)
    const nodes = [
      node("a", "todo", 2),
      node("b", "todo", 5),
      node("c", "todo", 1),
      node("d", "todo", 1),
    ];
    const edges = [dep("b", "a"), dep("c", "a"), dep("d", "b"), dep("d", "c")];
    const cp = criticalPath(nodes, edges);
    expect(cp.path).toEqual(["a", "b", "d"]);
    expect(cp.totalHours).toBe(8);
  });

  it("treats null hours as zero", () => {
    const nodes = [node("a"), node("b")];
    const cp = criticalPath(nodes, [dep("b", "a")]);
    expect(cp.totalHours).toBe(0);
    expect(cp.path.length).toBeGreaterThan(0);
  });
});

describe("actionableTasks", () => {
  it("surfaces only tasks whose prerequisites are all done", () => {
    const nodes = [
      node("a", "done"),
      node("b", "todo"),
      node("c", "todo"),
    ];
    // b depends on a (done) -> actionable; c depends on b (todo) -> not
    const edges = [dep("b", "a"), dep("c", "b")];
    expect(actionableTasks(nodes, edges)).toEqual(["b"]);
  });

  it("never surfaces completed work", () => {
    const nodes = [node("a", "done"), node("b", "done")];
    expect(actionableTasks(nodes, [dep("b", "a")])).toEqual([]);
  });

  it("treats a root todo with no prerequisites as actionable", () => {
    const nodes = [node("a", "todo"), node("b", "todo")];
    expect(actionableTasks(nodes, []).sort()).toEqual(["a", "b"]);
  });
});

describe("computeExecutionPlan", () => {
  it("returns a full plan for a valid graph", () => {
    const nodes = [
      node("req", "done", 3),
      node("schema", "todo", 4),
      node("auth", "todo", 6),
      node("ui", "todo", 5),
    ];
    const edges = [dep("schema", "req"), dep("auth", "schema"), dep("ui", "auth")];
    const plan = computeExecutionPlan(nodes, edges);

    expect(plan.validation.valid).toBe(true);
    assertOrdered(plan.order, edges);
    expect(plan.actionable).toEqual(["schema"]);
    expect(plan.criticalPath.totalHours).toBe(18);
    expect(plan.layers.length).toBe(4);
  });

  it("degrades gracefully on an invalid graph", () => {
    const nodes = [node("a"), node("b")];
    const edges = [dep("b", "a"), dep("a", "b")];
    const plan = computeExecutionPlan(nodes, edges);
    expect(plan.validation.valid).toBe(false);
    expect(plan.order).toEqual([]);
    expect(plan.layers).toEqual([]);
    expect(plan.actionable).toEqual([]);
  });
});
