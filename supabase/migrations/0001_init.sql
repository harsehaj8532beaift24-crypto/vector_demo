-- Vector — Phase 2: schema
-- Postgres (Supabase). Source of truth for all domain data.
-- Naming: snake_case tables/columns, UUID primary keys, timestamptz everywhere.

-- gen_random_uuid() is available on Supabase (pgcrypto).
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums — constrained, extensible domains. Kept as native enums for integrity.
-- ---------------------------------------------------------------------------
create type project_status as enum ('draft', 'planning', 'active', 'completed', 'archived');
create type task_status    as enum ('todo', 'in_progress', 'blocked', 'done');
create type task_priority   as enum ('low', 'medium', 'high', 'critical');
create type recommendation_status as enum ('active', 'dismissed', 'applied');
create type history_event as enum (
  'project_created', 'roadmap_generated', 'roadmap_updated',
  'task_created', 'task_updated', 'task_completed', 'task_deleted',
  'requirements_changed', 'replanned'
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- projects — top-level container, owned by a Supabase auth user.
-- ---------------------------------------------------------------------------
create table projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 200),
  goal        text not null check (char_length(goal) between 1 and 2000),
  description text not null default '',
  status      project_status not null default 'draft',
  timeline    text,                        -- freeform for MVP, e.g. "3 months"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index projects_user_id_idx on projects (user_id);

create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- workstreams — logical grouping of related tasks within a project.
-- ---------------------------------------------------------------------------
create table workstreams (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 200),
  description text not null default '',
  position    integer not null default 0,   -- display order
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index workstreams_project_id_idx on workstreams (project_id);

create trigger workstreams_set_updated_at
  before update on workstreams
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- tasks — the unit of execution. Optionally belongs to a workstream.
-- ---------------------------------------------------------------------------
create table tasks (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects (id) on delete cascade,
  workstream_id  uuid references workstreams (id) on delete set null,
  title          text not null check (char_length(title) between 1 and 200),
  description    text not null default '',
  priority       task_priority not null default 'medium',
  status         task_status not null default 'todo',
  estimated_hours numeric(6,2) check (estimated_hours is null or estimated_hours >= 0),
  position       integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index tasks_project_id_idx on tasks (project_id);
create index tasks_workstream_id_idx on tasks (workstream_id);

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- dependencies — directed edge: task depends_on another task.
-- project_id is denormalized so RLS and same-project integrity are cheap.
-- Cycle prevention is enforced by the application-layer engine (a DAG check
-- is not expressible as a simple constraint); the DB enforces the rest.
-- ---------------------------------------------------------------------------
create table dependencies (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects (id) on delete cascade,
  task_id            uuid not null references tasks (id) on delete cascade,
  depends_on_task_id uuid not null references tasks (id) on delete cascade,
  created_at         timestamptz not null default now(),
  constraint dependencies_no_self  check (task_id <> depends_on_task_id),
  constraint dependencies_unique_edge unique (task_id, depends_on_task_id)
);
create index dependencies_project_id_idx on dependencies (project_id);
create index dependencies_task_id_idx on dependencies (task_id);
create index dependencies_depends_on_idx on dependencies (depends_on_task_id);

-- Integrity: both endpoints must live in the same project as the edge.
create or replace function dependencies_validate_same_project()
returns trigger
language plpgsql
as $$
declare
  task_project uuid;
  dep_project  uuid;
begin
  select project_id into task_project from tasks where id = new.task_id;
  select project_id into dep_project  from tasks where id = new.depends_on_task_id;

  if task_project is null or dep_project is null then
    raise exception 'dependency references a non-existent task';
  end if;
  if task_project <> new.project_id or dep_project <> new.project_id then
    raise exception 'dependency endpoints must belong to project %', new.project_id;
  end if;
  return new;
end;
$$;

create trigger dependencies_same_project
  before insert or update on dependencies
  for each row execute function dependencies_validate_same_project();

-- ---------------------------------------------------------------------------
-- milestones — dated checkpoints within a project.
-- ---------------------------------------------------------------------------
create table milestones (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 200),
  deadline   timestamptz,
  completed  boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index milestones_project_id_idx on milestones (project_id);

create trigger milestones_set_updated_at
  before update on milestones
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- recommendations — AI suggestions; every one carries its reasoning.
-- ---------------------------------------------------------------------------
create table recommendations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  message    text not null,
  reasoning  text not null,
  impact     text not null default '',
  status     recommendation_status not null default 'active',
  created_at timestamptz not null default now()
);
create index recommendations_project_id_idx on recommendations (project_id);

-- ---------------------------------------------------------------------------
-- project_history — append-only audit of state changes (Project Memory).
-- snapshot holds a JSON payload describing the change for replanning context.
-- ---------------------------------------------------------------------------
create table project_history (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  event      history_event not null,
  snapshot   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index project_history_project_id_idx on project_history (project_id);
create index project_history_created_at_idx on project_history (project_id, created_at desc);
