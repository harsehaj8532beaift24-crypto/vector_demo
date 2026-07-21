import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./errors";
import { PlanningError } from "@/lib/ai/planner";
import { supabaseServer, type Db } from "@/lib/db/clients";

/**
 * Route-handler plumbing: a single place that authorizes the caller, parses
 * input, and turns any thrown error into a consistent JSON response. Handlers
 * stay thin — parse, authorize, call a service, shape the result.
 */

export interface AuthContext {
  userId: string;
  supabase: Db;
}

/** Resolve the authenticated user, or throw 401. */
export async function requireUser(): Promise<AuthContext> {
  const supabase = supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw ApiError.unauthorized();
  }
  return { userId: data.user.id, supabase };
}

export function json<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** Parse a request body against a Zod schema, throwing a 400 on mismatch. */
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.validation("Request body must be valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw ApiError.validation("Invalid request body", result.error.flatten());
  }
  return result.data;
}

/** Wrap a handler so thrown errors become consistent JSON responses. */
export function route(
  handler: () => Promise<NextResponse>,
): Promise<NextResponse> {
  return handler().catch((err: unknown) => {
    if (err instanceof ApiError) {
      return json(
        { error: { code: err.code, message: err.message, details: err.details } },
        err.status,
      );
    }
    if (err instanceof PlanningError) {
      return json(
        {
          error: {
            code: "planning_failed",
            message: err.message,
            details: { issues: err.lastIssues },
          },
        },
        422,
      );
    }
    console.error("Unhandled route error:", err);
    return json(
      { error: { code: "internal", message: "Internal server error" } },
      500,
    );
  });
}
