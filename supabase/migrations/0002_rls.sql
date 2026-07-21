-- Vector — Phase 2: Row Level Security
-- Every row is scoped to the owning auth user. `projects` is scoped directly;
-- all child tables are scoped via their project's owner. This is defense in
-- depth: the server also authorizes, but the DB refuses cross-tenant access
-- even if application code has a bug.

alter table projects        enable row level security;
alter table workstreams     enable row level security;
alter table tasks           enable row level security;
alter table dependencies    enable row level security;
alter table milestones      enable row level security;
alter table recommendations enable row level security;
alter table project_history enable row level security;

-- Helper: does the current user own this project?
create or replace function owns_project(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from projects p
    where p.id = pid and p.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- projects — owner has full access.
-- ---------------------------------------------------------------------------
create policy projects_select on projects
  for select using (user_id = auth.uid());
create policy projects_insert on projects
  for insert with check (user_id = auth.uid());
create policy projects_update on projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy projects_delete on projects
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Child tables — access iff the user owns the parent project.
-- Pattern repeated per table so each can diverge later if needed.
-- ---------------------------------------------------------------------------

-- workstreams
create policy workstreams_all on workstreams
  for all using (owns_project(project_id)) with check (owns_project(project_id));

-- tasks
create policy tasks_all on tasks
  for all using (owns_project(project_id)) with check (owns_project(project_id));

-- dependencies
create policy dependencies_all on dependencies
  for all using (owns_project(project_id)) with check (owns_project(project_id));

-- milestones
create policy milestones_all on milestones
  for all using (owns_project(project_id)) with check (owns_project(project_id));

-- recommendations
create policy recommendations_all on recommendations
  for all using (owns_project(project_id)) with check (owns_project(project_id));

-- project_history — insert + read only (append-only audit; no update/delete).
create policy project_history_select on project_history
  for select using (owns_project(project_id));
create policy project_history_insert on project_history
  for insert with check (owns_project(project_id));
