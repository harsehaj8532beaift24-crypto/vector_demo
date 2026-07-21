import type { ProjectGraph } from "@/lib/types/domain";

/**
 * Prompt construction. Claude is a reasoning engine here, not a chatbot — the
 * system prompt sets the rules the spec demands (valid DAG, no hallucinated
 * tasks, preserve completed work, explain dependencies). The context builder
 * is the Project Memory surface: it renders prior state so replanning is aware
 * of what already exists and what must not be discarded.
 */

const RULES = `You are Vector's execution strategist — a reasoning engine that turns goals into executable plans.

Rules you must follow:
- Every task must contribute to the stated goal. Never invent filler or generic tasks.
- Dependencies must form a valid Directed Acyclic Graph. Never create a cycle.
- A task may only depend on other tasks that exist in your output (by their key).
- Order work by real prerequisite relationships, not arbitrary sequence.
- Group related tasks into workstreams; every task belongs to exactly one workstream.
- Prefer a small number of high-signal tasks over an exhaustive list.
- Keys are lowercase kebab-case slugs, unique within their kind (e.g. "design-db-schema").`;

export function systemPrompt(): string {
  return RULES;
}

export interface GoalInput {
  goal: string;
  /** Optional answers gathered during AI discovery. */
  answers?: Array<{ question: string; answer: string }>;
  timeline?: string | null;
}

function renderAnswers(input: GoalInput): string {
  if (!input.answers?.length) return "";
  const lines = input.answers.map((a) => `- ${a.question}\n  → ${a.answer}`);
  return `\n\nWhat the user told us during discovery:\n${lines.join("\n")}`;
}

/** Ask clarifying questions before planning (spec: AI Discovery). */
export function discoveryPrompt(goal: string): string {
  return `The user wants to build:\n\n"${goal}"\n\nAsk the clarifying questions you need before you can plan this well — about timeline, scope, team, constraints, and audience. Do not assume missing information; ask for it. For each question, explain why the answer changes the plan.`;
}

/** Generate the initial roadmap from a goal (+ discovery answers). */
export function initialPlanPrompt(input: GoalInput): string {
  const timeline = input.timeline ? `\nTimeline: ${input.timeline}` : "";
  return `Produce an execution roadmap for this goal:\n\n"${input.goal}"${timeline}${renderAnswers(input)}\n\nBreak it into workstreams, tasks, dependencies, and milestones. Explain the reasoning for the ordering through the dependency structure.`;
}

/**
 * Render current project state for replanning. Completed tasks are called out
 * explicitly — the model must preserve them and only adapt incomplete work.
 */
export function renderProjectMemory(graph: ProjectGraph): string {
  const byId = new Map(graph.tasks.map((t) => [t.id, t]));
  const deps = new Map<string, string[]>();
  for (const d of graph.dependencies) {
    const list = deps.get(d.taskId) ?? [];
    list.push(d.dependsOnTaskId);
    deps.set(d.taskId, list);
  }

  const taskLine = (id: string): string => {
    const t = byId.get(id);
    if (!t) return `- (unknown task ${id})`;
    const on = (deps.get(id) ?? [])
      .map((d) => byId.get(d)?.title ?? d)
      .join(", ");
    const onText = on ? ` — depends on: ${on}` : "";
    return `- [${t.status}] ${t.title} (${t.priority})${onText}`;
  };

  const completed = graph.tasks.filter((t) => t.status === "done");
  const open = graph.tasks.filter((t) => t.status !== "done");

  const completedText = completed.length
    ? `\n\nCOMPLETED WORK — must be preserved, do not remove or reorder:\n${completed
        .map((t) => taskLine(t.id))
        .join("\n")}`
    : "\n\nNo work has been completed yet.";

  const openText = open.length
    ? `\n\nRemaining work (may be changed):\n${open.map((t) => taskLine(t.id)).join("\n")}`
    : "";

  return `Project: ${graph.project.title}\nGoal: ${graph.project.goal}${completedText}${openText}`;
}

export interface ReplanInput {
  graph: ProjectGraph;
  /** What changed: new deadline, scope change, new requirement, etc. */
  change: string;
}

export function replanPrompt(input: ReplanInput): string {
  return `${renderProjectMemory(input.graph)}\n\nThe requirements have changed:\n\n"${input.change}"\n\nProduce the updated roadmap. Keep every completed task exactly as-is. Adjust only the remaining and new work, and keep the dependency graph valid.`;
}

export function recommendationsPrompt(graph: ProjectGraph): string {
  return `${renderProjectMemory(graph)}\n\nGiven the current state, recommend the best next actions. For each, give the reasoning and the impact of doing it now versus later. Focus on unblocking progress and reducing risk.`;
}
