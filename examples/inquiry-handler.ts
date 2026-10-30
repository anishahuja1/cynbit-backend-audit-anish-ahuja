/**
 * Illustrative TypeScript design sketch for an anonymous inquiry endpoint.
 * Not connected to Cynbit and intentionally does not include infrastructure
 * specific persistence, rate limiting, or queue code.
 */

import { z } from "zod";

const InquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  company: z.string().trim().max(160).optional().default(""),
  industry: z.string().trim().max(120).optional().default(""),
  message: z.string().trim().min(10).max(5_000),
}).strict();

type Inquiry = z.infer<typeof InquirySchema>;

type Dependencies = {
  /** Must enforce a bounded request rate and return false when throttled. */
  allowSubmission(key: string): Promise<boolean>;
  /** Must durably enqueue before the endpoint acknowledges receipt. */
  enqueue(input: { requestId: string; idempotencyKey?: string; inquiry: Inquiry }): Promise<void>;
  /** Server-generated correlation ID; do not derive it from user input. */
  requestId(): string;
};

type RequestLike = {
  headers: Headers;
  json(): Promise<unknown>;
  /** Trusted client identity resolved by the edge/proxy, not raw X-Forwarded-For. */
  trustedClientKey: string;
};

type ResponseLike = {
  status: number;
  headers: Record<string, string>;
  body: unknown;
};

function json(status: number, requestId: string, body: unknown): ResponseLike {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
    },
    body,
  };
}

export async function postInquiry(
  request: RequestLike,
  deps: Dependencies,
): Promise<ResponseLike> {
  const requestId = deps.requestId();

  // Enforce the byte limit at the proxy/server before parsing JSON as well.
  const allowed = await deps.allowSubmission(request.trustedClientKey);
  if (!allowed) {
    return json(429, requestId, {
      error: {
        code: "RATE_LIMITED",
        message: "Please wait before trying again.",
        requestId,
      },
    });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(400, requestId, {
      error: { code: "INVALID_JSON", message: "Request body must be valid JSON.", requestId },
    });
  }

  const parsed = InquirySchema.safeParse(raw);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join("."), "Check this field."]),
    );
    return json(422, requestId, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Check the highlighted fields.",
        fields,
        requestId,
      },
    });
  }

  const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
  try {
    await deps.enqueue({ requestId, idempotencyKey, inquiry: parsed.data });
  } catch {
    // Log requestId and a safe error class internally; never log submitted fields.
    return json(503, requestId, {
      error: {
        code: "TEMPORARY_UNAVAILABLE",
        message: "We could not receive your request right now. Please try again later.",
        requestId,
      },
    });
  }

  return json(202, requestId, { status: "received", requestId });
}

