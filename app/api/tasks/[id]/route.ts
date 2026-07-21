import { requireUser, route, json, parseBody } from "@/lib/api/http";
import { updateTask, deleteTask, UpdateTaskInput } from "@/lib/services/tasks";

interface Params {
  params: { id: string };
}

export async function PUT(req: Request, { params }: Params) {
  return route(async () => {
    const { supabase } = await requireUser();
    const input = await parseBody(req, UpdateTaskInput);
    return json(await updateTask(supabase, params.id, input));
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  return route(async () => {
    const { supabase } = await requireUser();
    await deleteTask(supabase, params.id);
    return json({ deleted: true });
  });
}
