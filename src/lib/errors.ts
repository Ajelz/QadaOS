import { NextResponse } from "next/server";

/** Stable error codes the client can switch on. */
export const ErrorCode = {
  UNAUTHENTICATED: "unauthenticated",
  FORBIDDEN: "forbidden",
  INVALID_BODY: "invalid_body",
  PAYLOAD_TOO_LARGE: "payload_too_large",
  RATE_LIMITED: "rate_limited",
  EVENT_CAP_REACHED: "event_cap_reached",
  NOT_FOUND: "not_found",
  PUSH_NOT_CONFIGURED: "push_not_configured",
  INTERNAL: "internal",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_body: 400,
  payload_too_large: 413,
  rate_limited: 429,
  event_cap_reached: 409,
  not_found: 404,
  push_not_configured: 503,
  internal: 500,
};

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function errorResponse(code: ErrorCode, message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: { code, message, details } }, { status: STATUS[code] });
}

/** Wrap a route handler so thrown ApiErrors become well-formed responses. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.code, e.message, e.details);
      console.error(e);
      return errorResponse(ErrorCode.INTERNAL, "Something went wrong on our side. Try again in a moment.");
    }
  };
}
