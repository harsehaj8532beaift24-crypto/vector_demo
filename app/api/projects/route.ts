import { requireUser, route, json, parseBody } from "@/lib/api/http";
import {
  createProject,
  listProjects,
  CreateProjectInput,
} from "@/lib/services/projects";

export async function GET() {
  return route(async () => {
    const { supabase } = await requireUser();
    return json(await listProjects(supabase));
  });
}

export async function POST(req: Request) {
  return route(async () => {
    const { supabase, userId } = await requireUser();
    const input = await parseBody(req, CreateProjectInput);
    return json(await createProject(supabase, userId, input), 201);
  });
}
