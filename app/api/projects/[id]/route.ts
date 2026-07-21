import { requireUser, route, json, parseBody } from "@/lib/api/http";
import {
  getProject,
  updateProject,
  deleteProject,
  UpdateProjectInput,
} from "@/lib/services/projects";

interface Params {
  params: { id: string };
}

export async function GET(_req: Request, { params }: Params) {
  return route(async () => {
    const { supabase } = await requireUser();
    return json(await getProject(supabase, params.id));
  });
}

export async function PUT(req: Request, { params }: Params) {
  return route(async () => {
    const { supabase } = await requireUser();
    const input = await parseBody(req, UpdateProjectInput);
    return json(await updateProject(supabase, params.id, input));
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return route(async () => {
    const { supabase } = await requireUser();
    await deleteProject(supabase, params.id);
    return json({ deleted: true });
  });
}
