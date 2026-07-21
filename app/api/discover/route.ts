import { requireUser, route, json, parseBody } from "@/lib/api/http";
import { z } from "zod";
import { Planner } from "@/lib/ai/planner";
import { getLlmClient } from "@/lib/ai/client";

const Body = z.object({ goal: z.string().min(1).max(2000) });

/** AI discovery: ask clarifying questions about a goal before planning. */
export async function POST(req: Request) {
  return route(async () => {
    await requireUser();
    const { goal } = await parseBody(req, Body);
    const planner = new Planner(getLlmClient());
    return json(await planner.discover(goal));
  });
}
