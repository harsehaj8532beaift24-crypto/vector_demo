# Vector — Database Schema

> Phase 2 deliverable. SQL lives in `supabase/migrations/`. Apply with the Supabase CLI
> (`supabase db push`) or paste into the SQL editor in order: `0001_init.sql`, then
> `0002_rls.sql`.

## Entity overview

```
auth.users (Supabase)
   │ 1─┐
      └──< projects
             │ 1─┐
             ├──< workstreams ──┐
             ├──< tasks ────────┘ (task.workstream_id, nullable)
             │      ▲   ▲
             │      │   │  edges reference two tasks
             ├──< dependencies (task_id ──▶ depends_on_task_id)
             ├──< milestones
             ├──< recommendations
             └──< project_history
```

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `projects` | Owned container for a goal | `user_id`, `goal`, `status`, `timeline` |
| `workstreams` | Grouping of related tasks | `project_id`, `name`, `position` |
| `tasks` | Unit of execution | `project_id`, `workstream_id?`, `priority`, `status`, `estimated_hours` |
| `dependencies` | Directed edge `task → depends_on` | `task_id`, `depends_on_task_id`, `project_id` |
| `milestones` | Dated checkpoints | `project_id`, `deadline`, `completed` |
| `recommendations` | AI suggestions w/ reasoning | `message`, `reasoning`, `impact`, `status` |
| `project_history` | Append-only audit (Project Memory) | `event`, `snapshot` (jsonb) |

## Design decisions

- **Dependencies are an edge table, not an array column.** This lets the engine query the graph
  relationally, enforce per-edge constraints, and apply RLS per edge. A `tasks.dependencies[]`
  column could not do any of these.
- **Two DB-level guards on edges:** `dependencies_no_self` (a task can't depend on itself) and
  `dependencies_unique_edge` (no duplicate edges). A trigger additionally enforces that both
  endpoints belong to the edge's `project_id`.
- **Cycle prevention is *not* in the DB.** "Is this a DAG?" is a graph-reachability question
  that a CHECK constraint can't express efficiently. It is enforced by `lib/engine` before any
  write — see `docs/architecture.md` §4.2. The DB guarantees local edge integrity; the engine
  guarantees global acyclicity.
- **`project_id` is denormalized onto `dependencies`** so RLS and same-project checks are a
  single indexed lookup rather than a join through `tasks`.
- **Enums are native Postgres enums** for referential integrity. Adding a value later is a
  one-line `alter type ... add value`.
- **`project_history` is append-only** (RLS allows insert + select, no update/delete) so the
  audit trail — which feeds replanning context — can't be silently rewritten.
- **`updated_at` is trigger-maintained**, never trusted from the client.

## Row Level Security

RLS is enabled on every table. `projects` is scoped by `user_id = auth.uid()`. Child tables use
the `owns_project(project_id)` security-definer helper, which checks the parent project's owner.
This means a leaked or buggy server query still cannot read or write another tenant's data.

## Cascade behaviour

- Deleting a `project` cascades to all children.
- Deleting a `task` cascades to any dependency edges touching it.
- Deleting a `workstream` sets `tasks.workstream_id` to null (tasks survive, ungrouped).
