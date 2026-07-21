import { randomUUID } from "node:crypto";
import { requireUser, route, json, parseBody } from "@/lib/api/http";
import { z } from "zod";
import { getProject } from "@/lib/services/projects";
import { persistNewRoadmap } from "@/lib/services/roadmap";
import { Planner } from "@/lib/ai/planner";
import { getLlmClient } from "@/lib/ai/client";

const Body = z
  .object({
    answers: z
      .array(z.object({ question: z.string(), answer: z.string() }))
      .optional(),
  })
  .optional();

/**
 * Generate an execution roadmap from the project's goal and persist it.
 * The planner engine-gates the plan; persistNewRoadmap re-gates before writing.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  return route(async () => {
    const { supabase } = await requireUser();
    const project = await getProject(supabase, params.id);
    const body = (await parseBody(req, Body)) ?? {};

    const planner = new Planner(getLlmClient());
    const plan = await planner.generateRoadmap({
      goal: project.goal,
      timeline: project.timeline,
      answers: body.answers,
    });

    const graph = await persistNewRoadmap(supabase, project.id, plan, randomUUID);
    return json(graph, 201);
  });
}
