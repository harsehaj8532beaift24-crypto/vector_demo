/**
 * Typed API errors. Every failure carries an HTTP status and a machine-readable
 * code so route handlers can translate consistently and clients can branch.
 */

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "planning_failed"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 400,
  conflict: 409,
  planning_failed: 422,
  internal: 500,
};

export class ApiError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = STATUS[code];
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError("unauthorized", message);
  }
  static notFound(message = "Not found") {
    return new ApiError("not_found", message);
  }
  static validation(message: string, details?: unknown) {
    return new ApiError("validation_error", message, details);
  }
}
