import { describe, it, expect } from "vitest";
import { Planner, PlanningError, checkPlan } from "./planner";
import { FakeLlmClient } from "./fake";
import type { Plan } from "./schemas";

const validPlan: Plan = {
  summary: "Build the thing.",
  workstreams: [
    { key: "backend", name: "Backend", description: "APIs and data" },
    { key: "frontend", name: "Frontend", description: "UI" },
  ],
  tasks: [
    {
      key: "requirements",
      title: "Requirements analysis",
      description: "Define scope",
      priority: "high",
      estimatedHours: 8,
      workstreamKey: "backend",
      dependsOn: [],
    },
    {
      key: "db-schema",
      title: "Design database schema",
      description: "Tables and relations",
      priority: "high",
      estimatedHours: 6,
      workstreamKey: "backend",
      dependsOn: ["requirements"],
    },
    {
      key: "auth-api",
      title: "Authentication API",
      description: "Login/signup",
      priority: "critical",
      estimatedHours: 10,
      workstreamKey: "backend",
      dependsOn: ["db-schema"],
    },
    {
      key: "dashboard",
      title: "Frontend dashboard",
      description: "Main UI",
      priority: "medium",
      estimatedHours: 12,
      workstreamKey: "frontend",
      dependsOn: ["auth-api"],
    },
  ],
  milestones: [
    { key: "mvp", title: "MVP", taskKeys: ["auth-api", "dashboard"] },
  ],
};

const json = (p: unknown) => JSON.stringify(p);

const goal = { goal: "Build an AI food delivery app" };

describe("checkPlan", () => {
  it("accepts a valid plan", () => {
    expect(checkPlan(validPlan)).toEqual([]);
  });

  it("rejects a dependency cycle", () => {
    const cyclic: Plan = {
      ...validPlan,
      tasks: validPlan.tasks.map((t) =>
        t.key === "requirements" ? { ...t, dependsOn: ["dashboard"] } : t,
      ),
    };
    const issues = checkPlan(cyclic);
    expect(issues.some((i) => i.includes("cycle"))).toBe(true);
  });

  it("rejects a dependency on an unknown task", () => {
    const bad: Plan = {
      ...validPlan,
      tasks: validPlan.tasks.map((t) =>
        t.key === "db-schema" ? { ...t, dependsOn: ["ghost"] } : t,
      ),
    };
    const issues = checkPlan(bad);
    expect(issues.some((i) => i.includes("unknown"))).toBe(true);
  });

  it("rejects a task referencing an unknown workstream", () => {
    const bad: Plan = {
      ...validPlan,
      tasks: validPlan.tasks.map((t) =>
        t.key === "dashboard" ? { ...t, workstreamKey: "nope" } : t,
      ),
    };
    expect(checkPlan(bad).some((i) => i.includes("workstream"))).toBe(true);
  });

  it("rejects a self-dependency", () => {
    const bad: Plan = {
      ...validPlan,
      tasks: validPlan.tasks.map((t) =>
        t.key === "db-schema" ? { ...t, dependsOn: ["db-schema"] } : t,
      ),
    };
    // engine flags a self-loop as a cycle; checkPlan also flags it explicitly
    expect(checkPlan(bad).length).toBeGreaterThan(0);
  });
});

describe("Planner.generateRoadmap", () => {
  it("returns a valid plan on first try", async () => {
    const client = new FakeLlmClient([json(validPlan)]);
    const plan = await new Planner(client).generateRoadmap(goal);
    expect(plan.tasks).toHaveLength(4);
    expect(client.requests).toHaveLength(1);
  });

  it("self-corrects after malformed JSON", async () => {
    const client = new FakeLlmClient(["not json at all", json(validPlan)]);
    const plan = await new Planner(client).generateRoadmap(goal);
    expect(plan.tasks).toHaveLength(4);
    expect(client.requests).toHaveLength(2);
    // the retry prompt carries the correction feedback
    expect(client.requests[1]!.user).toContain("invalid");
  });

  it("self-corrects after a cyclic plan is returned", async () => {
    const cyclic: Plan = {
      ...validPlan,
      tasks: validPlan.tasks.map((t) =>
        t.key === "requirements" ? { ...t, dependsOn: ["dashboard"] } : t,
      ),
    };
    const client = new FakeLlmClient([json(cyclic), json(validPlan)]);
    const plan = await new Planner(client).generateRoadmap(goal);
    expect(plan.tasks).toHaveLength(4);
    expect(client.requests).toHaveLength(2);
    expect(client.requests[1]!.user).toContain("cycle");
  });

  it("throws PlanningError after exhausting retries", async () => {
    const client = new FakeLlmClient(["bad", "still bad", "nope"]);
    await expect(new Planner(client).generateRoadmap(goal)).rejects.toBeInstanceOf(
      PlanningError,
    );
    expect(client.requests).toHaveLength(3);
  });

  it("rejects a shape-invalid plan (missing required field)", async () => {
    const { summary, ...missing } = validPlan;
    void summary;
    const client = new FakeLlmClient([json(missing), json(validPlan)]);
    const plan = await new Planner(client).generateRoadmap(goal);
    expect(plan.summary).toBeTruthy();
    expect(client.requests).toHaveLength(2);
  });
});

describe("Planner.discover", () => {
  it("returns clarifying questions", async () => {
    const client = new FakeLlmClient([
      json({
        questions: [
          { question: "What is your timeline?", why: "affects scope" },
        ],
      }),
    ]);
    const out = await new Planner(client).discover("Build an app");
    expect(out.questions[0]!.question).toContain("timeline");
  });
});
