# Vector — System Architecture

> Phase 1 deliverable. Defines system boundaries, data flow, and the reasoning behind each
> decision. This document is authoritative for technical decisions; where it differs from the
> product spec in CLAUDE.md, it reflects a deliberate, approved change.
>
> **Backend decision (approved):** single Next.js application (App Router route handlers) is
> the backend. No separate Python/FastAPI service. Supabase provides Postgres + Auth. The
> dependency engine and AI orchestration are TypeScript modules running server-side only.

## 1. Guiding Principle

Vector's defensible core is **reasoning about execution**, not CRUD. The architecture isolates
the two hardest problems — (a) turning language into a *valid* plan and (b) keeping that plan a
valid DAG as it changes — into pure, testable modules with zero UI or framework coupling.

Everything else (auth, storage, transport) is deliberately boring.

## 2. System Topology

```
┌───────────────────────────────────────────────┐
│                Next.js (Vercel)                 │
│                                                 │
│  Client (browser)          Server (route/RSC)   │
│  ─────────────────         ───────────────────  │
│  - App Router UI           - /api route handlers│
│  - React Flow              - domain services    │
│  - React Query             - dependency engine  │
│  - Zustand (UI only)       - Claude orchestration
│        │                          │             │
└────────┼──────────────────────────┼─────────────┘
         │ Supabase JS (auth)        │ supabase-js (service role) + Anthropic SDK
         ▼                           ▼
┌────────────────────────┐   ┌────────────────────┐
│  Supabase Auth (JWT)   │   │     Claude API      │
├────────────────────────┤   │  Messages + tools   │
│  Supabase Postgres     │   └────────────────────┘
│  projects, tasks, ...  │
│  + Row Level Security  │
└────────────────────────┘
```

The trust boundary is the **server side of Next.js**. The browser never sees the Anthropic key
or the Supabase service role key.

### Responsibility split

| Concern | Owner | Rationale |
|---|---|---|
| Identity, login, JWT issuance | **Supabase Auth** | Don't rebuild auth. Client logs in via Supabase JS. |
| Database (source of truth) | **Supabase Postgres** | Managed Postgres + Row Level Security. |
| All domain reads/writes | **Next.js route handlers** | One server-side place for validation, invariants, and the dependency engine. |
| AI reasoning & orchestration | **Next.js (server)** | Keeps the Anthropic key server-only; centralizes retries/validation. |
| Plan validity (DAG) | **`lib/engine` (pure TS)** | Pure algorithm, no I/O, fully unit-testable. |

**Auth flow:** Supabase issues a JWT (stored in cookies via `@supabase/ssr`) → server route
handlers read the session, derive `user_id`, and authorize every domain operation. Two Supabase
clients: a **user-scoped** client (respects RLS, used for reads) and a **service-role** client
(server-only, used where the engine must write across the graph transactionally). RLS stays on
as defense-in-depth.

## 3. Server Layering (Clean Architecture, inside Next.js)

```
lib/
  api/          # route-handler adapters: parse, authorize, call service, shape response
  services/     # business logic — orchestration, use cases, transactions
  ai/           # Claude client, prompt builders, tool schemas, retry/self-correction
  engine/       # dependency engine — PURE. topo sort, cycle detection, critical path. No I/O.
  db/           # Supabase clients, repositories, query helpers
  types/        # shared DTOs / domain types (imported by client and server)

app/
  (routes per spec)
  api/          # route handlers delegating to lib/services
```

Dependency direction points inward: `api → services → {engine, ai, db}`. `engine` depends on
nothing — that is what makes the hard logic testable without a DB or network.

## 4. The Two Core Modules

### 4.1 Planning (AI reasoning) — `lib/ai`
- Claude is called via **tool use / structured output**, never free-text parsing. A strict JSON
  schema defines `{workstreams, tasks, dependencies, milestones}`; Claude is forced to emit it.
- Every response is validated (Zod). Invalid → **retry with the validation error fed back**
  (self-correction), bounded to N attempts, then a graceful, typed failure.
- Discovery, initial generation, and replanning are distinct prompts sharing a
  **project-context builder** so Claude always sees prior decisions (Project Memory).
- The Anthropic client is behind an interface so tests run against a fake; the real client is
  swapped in via env.

### 4.2 Dependency Engine (plan validity) — `lib/engine`
- Input: tasks + declared dependency edges. Output: execution order + validity report.
- **Cycle detection** (Kahn/DFS) — rejects any non-DAG *before* persistence.
- **Topological sort** → execution order + parallelizable groups.
- **Critical path** → drives "what should I do next?" recommendations.
- **Replanning preserves completed work:** completed nodes are pinned; only downstream
  incomplete subgraphs are recomputed.

Claude *proposes* dependencies; the engine *validates and orders* them. AI can never write an
invalid graph into the DB.

## 5. Frontend

- **App Router**, routes per spec (`/`, `/dashboard`, `/projects/new`, `/projects/[id]`,
  `/projects/[id]/roadmap`, `/projects/[id]/ai`, `/settings`).
- **React Query** owns all server state; **Zustand** owns only ephemeral UI state (canvas
  viewport, selected node, open panels). No server data in Zustand.
- **React Flow** renders the roadmap as a pure projection of engine output.
- Optimistic task-status updates with React Query rollback on error.
- Typed API client in `lib/api` sharing DTO types with the server.

## 6. Data Model (authoritative)

`auth.users` (Supabase) · `projects` · `workstreams` · `tasks` · `dependencies` (edge table:
`task_id`, `depends_on_task_id`) · `milestones` · `recommendations` · `project_history`.

Dependencies are a separate **edge table** (not an array column) so the engine can validate the
graph relationally and so constraints/RLS apply per edge.

## 7. Cross-Cutting

- **Secrets:** `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only env vars.
  The browser holds only `NEXT_PUBLIC_SUPABASE_URL` and the anon key.
- **Validation:** Zod at every boundary (request bodies + AI responses).
- **Errors:** typed error results → consistent HTTP status + machine-readable code.
- **Testing:** engine = pure unit tests; AI = schema-contract tests with a fake client;
  routes = integration tests against a test project.

## 8. Deployment

- **Vercel** — the entire Next.js app (client + server).
- **Supabase** — Postgres + Auth (hosted).
- Two targets. No container/Python infra.

## 9. Build Order (phases, each gated on approval)

1. **Architecture** ← *this document (done)*
2. Database schema + Supabase SQL + RLS policies
3. Next.js scaffold + `lib/types` + dependency engine (with tests)
4. Claude integration (`lib/ai`: tool schemas + retry)
5. API route handlers + Supabase auth wiring
6. Frontend scaffold + API client + auth pages
7. Roadmap (React Flow)
8. Dynamic replanning + recommendations
9. Test hardening
10. Performance + deployment configs
