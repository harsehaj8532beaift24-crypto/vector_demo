import { describe, it, expect } from "vitest";
import { planToRows } from "./roadmap";
import type { Plan } from "@/lib/ai/schemas";

const plan: Plan = {
  summary: "Build it.",
  workstreams: [{ key: "backend", name: "Backend", description: "" }],
  tasks: [
    {
      key: "req",
      title: "Requirements",
      description: "",
      priority: "high",
      estimatedHours: 4,
      workstreamKey: "backend",
      dependsOn: [],
    },
    {
      key: "schema",
      title: "Schema",
      description: "",
      priority: "high",
      estimatedHours: null,
      workstreamKey: "backend",
      dependsOn: ["req"],
    },
  ],
  milestones: [{ key: "m1", title: "Milestone 1", taskKeys: ["schema"] }],
};

/** Deterministic id generator: key order → v0, v1, ... */
function seqIds() {
  let n = 0;
  return () => `00000000-0000-0000-0000-${String(n++).padStart(12, "0")}`;
}

describe("planToRows", () => {
  it("mints a UUID per workstream and task and stamps project_id", () => {
    const rows = planToRows("proj-1", plan, seqIds());
    expect(rows.workstreams).toHaveLength(1);
    expect(rows.tasks).toHaveLength(2);
    for (const t of rows.tasks) {
      expect(t.project_id).toBe("proj-1");
      expect(t.id).toMatch(/^00000000-/);
    }
  });

  it("rewrites dependency edges from keys to the resolved task UUIDs", () => {
    const rows = planToRows("proj-1", plan, seqIds());
    const idByTitle = new Map(rows.tasks.map((t) => [t.title, t.id]));
    expect(rows.dependencies).toHaveLength(1);
    const edge = rows.dependencies[0]!;
    expect(edge.task_id).toBe(idByTitle.get("Schema"));
    expect(edge.depends_on_task_id).toBe(idByTitle.get("Requirements"));
    expect(edge.project_id).toBe("proj-1");
  });

  it("links tasks to their workstream UUID", () => {
    const rows = planToRows("proj-1", plan, seqIds());
    const wsId = rows.workstreams[0]!.id;
    for (const t of rows.tasks) expect(t.workstream_id).toBe(wsId);
  });

  it("preserves null estimated_hours and sets initial status/positions", () => {
    const rows = planToRows("proj-1", plan, seqIds());
    const schema = rows.tasks.find((t) => t.title === "Schema")!;
    expect(schema.estimated_hours).toBeNull();
    expect(schema.status).toBe("todo");
    expect(rows.tasks.map((t) => t.position)).toEqual([0, 1]);
  });

  it("maps milestones with positions", () => {
    const rows = planToRows("proj-1", plan, seqIds());
    expect(rows.milestones).toEqual([
      { project_id: "proj-1", title: "Milestone 1", position: 0 },
    ]);
  });
});
