# Backend Technical Audit: Cynbit Public Web Surfaces

**Prepared by:** Anish Ahuja\
**Role:** Backend Developer Intern applicant\
**Observation date:** 1 November 2026\
**Assessment mode:** Passive review of public pages only

## Executive summary

Cynbit's public site presents several user-facing data collection flows: a project inquiry form, a recruitment application form, and a newsletter signup. The careers page describes backend responsibilities that include authentication, database optimization, and REST/GraphQL API development. The public pages therefore provide a useful basis for discussing data minimization, validation, abuse resistance, API contracts, and operational observability.

This review did **not** submit forms or inspect private application data. The accessible page text does not expose request methods, API routes, payloads, response codes, server headers, or persistence behavior. I found no confirmed exploitable vulnerability. The findings below are framed as **design and assurance opportunities** where public information suggests what a well-designed backend should make explicit or verify.

## Scope and method

I read the publicly accessible home, contact, careers, backend-intern role, privacy, terms, and cookie-policy pages. I used the page content as presented to an ordinary visitor and stopped before any form submission or authenticated area. I did not crawl the site, enumerate routes, inspect source maps, guess API endpoints, or generate traffic beyond normal page reads.

The candidate portal URL included in the applicant's message was not independently accessible in the read-only page viewer. This report does not reproduce the applicant's personal details from the portal or infer portal behavior from the email copy.

### Evidence labels

- **Observed:** Directly visible in a public page.
- **Unknown:** Not verifiable from a passive page read.
- **Recommendation:** A design improvement to validate against the implementation, not a statement that the current implementation is vulnerable.

## Public surface and likely data flows

| Surface | Publicly visible input or statement | Backend implications | What remains unknown |
| --- | --- | --- | --- |
| Contact / inquiry | Name and email required by the form; company and industry optional; free-text message. [Contact page](https://www.cynbit.in/contact) | Validate and bound strings; normalize email; handle spam; avoid logging message contents; make submission outcome explicit. | Endpoint, payload schema, validation, delivery, persistence, rate limits, response/error behavior. |
| Recruitment application | Name, email, phone, WhatsApp, date of birth, gender, education, score, address, profile URLs, skills, and application statement appear in the role form. [Backend Intern role](https://www.cynbit.in/careers/backend-developer-intern) | Higher sensitivity and retention burden; validate structured fields and URLs; minimize early-stage collection; protect access and audit use. | Which fields are required by the server, retention period, access model, encryption, deletion workflow, and whether optionality matches the UI. |
| Privacy statement | Says contact forms generally collect name, email, and professional context; describes inquiry and BitElevate use, rights requests, and Resend/Prisma as third-party services. [Privacy policy](https://www.cynbit.in/privacy) | Keep notices aligned with each form and actual processors; document purpose, retention, and data-subject request handling. | Whether this is the complete processor inventory and whether recruitment data follows the same policy. |
| Cookie statement | Describes essential cookies, analytics (including Google Analytics), and functional preferences such as previously filled form fields. [Cookie policy](https://www.cynbit.in/cookies) | Keep cookie behavior, preference controls, and policy text consistent; avoid persisting personal form content unless intentional and protected. | Actual cookies, consent UI, cookie attributes, and whether form fields are persisted in the browser. |
| Careers architecture claims | Role description names secure authentication, database/schema optimization, and RESTful and GraphQL APIs. [Careers page](https://www.cynbit.in/careers/backend-developer-intern) | Candidate-facing APIs benefit from documented schemas, consistent errors, auth boundaries, and observability. | The site's implementation stack and any API architecture. |

### API and payload evidence boundary

The public HTML exposes form fields, but it does not disclose a wire-level API contract. I did not submit a form, so there is no observed HTTP method, endpoint, request body, response body, or status code to report. The JSON examples below are **proposed contracts**, inferred only from the visible form fields; they are not captured Cynbit payloads. This distinction avoids inventing behavior while still showing how I would structure the API.

For an inquiry, the visible fields map naturally to a small allow-listed request (`name`, `email`, optional `company` and `industry`, and `message`). For recruitment, the public form currently presents substantially more personal information. The example DTO in [`examples/application-schema.ts`](examples/application-schema.ts) shows a minimized first-stage request and deliberately defers date of birth, gender, WhatsApp, and permanent address pending a documented business purpose.

## Findings and opportunities

Severity here is a prioritization of the **recommended design work**, not a confirmed vulnerability rating.

### F1 · Minimize and explain recruitment data collection — Medium

**Observed:** The backend-intern application page displays date of birth, gender, phone and WhatsApp numbers, and a permanent address alongside education and application details. The visible consent language says data will be processed for an architectural review in the talent acquisition cycle. The privacy page describes data collected through forms in broad terms and mentions inquiry and BitElevate applications, but the public text reviewed does not give a recruitment-specific retention period or field-by-field purpose.

**Why it matters:** Collecting additional personal information early increases exposure in storage, logs, exports, and support workflows. Vague purpose or retention makes it harder for an applicant and an operator to understand when data should be deleted.

**Recommendation:** Collect only the fields needed to evaluate an initial application. If date of birth, gender, or a permanent address is genuinely needed for a later step, defer collection and explain the purpose at that step. Publish a recruitment-specific notice with purpose, recipients/processors, retention, access, and deletion/contact path. Apply the same policy to the UI and server validation; do not rely on client-side `required` flags.

**Confidence:** High that the fields and broad consent wording are visible; unknown whether the server stores every field or the full policy is available through another applicant-specific notice.

### F2 · Make public submission endpoints resilient to abuse — Medium

**Observed:** Contact and recruitment pages expose anonymous submission forms with free-text fields and links. No submission was made, so backend abuse controls cannot be verified.

**Why it matters:** Public write endpoints are common targets for automated spam and oversized or malformed payloads. An email delivery provider can also become a cost or reputation boundary if the application sends mail synchronously for every request.

**Recommendation:** Enforce server-side schemas, request/body size limits, per-IP and per-identifier rate limits, and a bot mitigation strategy proportionate to observed abuse. Queue email delivery with retries and idempotency; return a generic acknowledgement that does not reveal whether an address is already known. Keep provider credentials server-side and redact message/application content from routine logs.

**Confidence:** This is a control recommendation for publicly presented forms, not a finding that controls are absent.

### F3 · Publish a stable API and error contract for form flows — Low / Medium

**Observed:** The public careers page says Cynbit works with RESTful and GraphQL APIs. Public page text does not reveal the forms' HTTP methods, routes, request payloads, status codes, or error schema.

**Why it matters:** A documented contract makes client/server validation consistent, supports maintainable integrations, and lets operators distinguish user-correctable validation errors from transient infrastructure failures.

**Recommendation:** Define versioned OpenAPI contracts for write endpoints, with field constraints and examples. Use `400`/`422` for invalid input, `429` for throttling, `202` when durable asynchronous processing has been accepted, and `5xx` with a correlation ID for unexpected failures. Return stable machine-readable error codes and safe field-level messages; never return stack traces or provider errors.

**Confidence:** High that API behavior is not described in the page content reviewed; actual API documentation may exist elsewhere.

### F4 · Align cookie behavior with the published explanation — Low / Medium

**Observed:** The cookie policy describes analytics and functional cookies, including previously filled form fields, and says essential cookies cannot be disabled. It points visitors to browser settings for cookie management. The passive page view does not establish what cookies are actually set or whether a preference interface exists.

**Why it matters:** A mismatch between policy and runtime behavior weakens user trust and can lead to unnecessary retention of personal data in shared browsers.

**Recommendation:** Inventory cookies and local storage by purpose, expiry, and owning service. Avoid storing free-text inquiry/application fields in persistent browser storage by default. If optional analytics are used, provide a clear preference path where applicable and update the notice when vendors or purposes change. Set secure attributes on server cookies (`Secure`, `HttpOnly`, appropriate `SameSite`, narrow `Path`, and bounded lifetime) when those cookies exist.

**Confidence:** This is a consistency review opportunity; cookie implementation was not inspected.

### F5 · Measure backend and page performance before optimizing — Low

**Observed:** The public pages advertise high-performance engineering, but a passive text read does not provide reliable page timing, API latency, database query, cache-hit, or throughput measurements. No performance defect is confirmed.

**Why it matters:** Without a baseline, optimization can target the wrong layer and regressions can go unnoticed.

**Recommendation:** Instrument server-side request duration and status by route, queue age, email-provider latency, and database query duration. Track browser-facing Core Web Vitals separately. Set service objectives from real traffic and product needs; use cache headers for public, cacheable content and indexes only after query plans show a need. Load-test only an owned staging environment with authorization.

**Confidence:** This is a measurement recommendation, not a finding that the current site is slow.

## Recommended backend shape

For anonymous forms, I would use a small, explicit write boundary rather than allowing the UI to dictate persistence:

1. **Edge:** TLS, request-size cap, basic bot/rate controls, and a stable request ID.
2. **API handler:** Parse JSON, validate with a shared schema, normalize inputs, and reject unknown fields.
3. **Application service:** Apply business rules and idempotency; persist only necessary fields.
4. **Outbox/queue:** Deliver notification email asynchronously with retries and deduplication.
5. **Operations:** Structured logs with request ID and outcome only; metrics for accepted, rejected, throttled, queued, and failed submissions; alerts on queue age and provider failures.

### Proposed inquiry success and error contract (illustrative)

```http
POST /api/v1/inquiries
Content-Type: application/json
Idempotency-Key: 4c7b...   # optional client-generated key

{"name":"Alex Rivera","email":"alex@example.com","company":"Example","industry":"SaaS","message":"We need a product discovery call."}
```

Accepted work should be durably queued before returning:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json
X-Request-Id: req_01...

{"status":"received","requestId":"req_01..."}
```

Invalid requests should return a predictable, non-sensitive shape:

```json
{"error":{"code":"VALIDATION_ERROR","message":"Check the highlighted fields.","fields":{"email":"Enter a valid email address."},"requestId":"req_01..."}}
```

The accompanying [`examples/inquiry-handler.ts`](examples/inquiry-handler.ts) sketches validation and response behavior. It intentionally leaves persistence, rate limiting, and queue integration behind interfaces so a real implementation can use the project's chosen infrastructure.

## Prioritized implementation plan

| Priority | Work | How to verify |
| --- | --- | --- |
| 1 | Review required fields and purpose for recruitment; minimize or defer sensitive fields; add retention/access/deletion detail to the recruitment notice. | Product/privacy review; compare the visible form, server schema, retention job, and deletion workflow. |
| 2 | Define shared server-side schemas and OpenAPI contracts for inquiry and recruitment submissions. | Contract review; valid/invalid payload examples; ensure client and server constraints match. |
| 3 | Add bounded input, rate limits, bot controls, idempotency, and asynchronous email delivery. | Unit/integration checks in a staging environment, controlled load tests against owned staging only, and queue retry/dead-letter review. |
| 4 | Inventory cookies/storage and make privacy copy match runtime behavior; redact submitted content from logs. | Browser storage audit with consent states; log sampling in staging; privacy notice review. |
| 5 | Add request IDs, structured outcome metrics, and alerts for elevated rejection/queue/provider failure rates. | Dashboard and alert exercises using synthetic staging events. |

## Limitations and next authorized validation

This review cannot confirm whether the site currently implements these controls. A follow-up technical validation should be done only with Cynbit's written authorization and a defined scope, ideally against a staging environment. It could then verify the documented API contract, server-side validation, cookie attributes, privacy/data deletion workflow, and operational behavior using test data. No active testing was performed for this submission.

## Deadline note

The applicant-provided email says 1 November 2026 at 09:55 AM; the portal text says 1 November 2026 at 03:25:38 PM. At the time this report was updated (1 November 2026, 1:25 PM IST), the email time had passed and the portal time had not. The portal's displayed deadline is the later of the two, but I cannot verify whether the portal remains open or whether either deadline has since changed.

## Sources

- [Cynbit Contact](https://www.cynbit.in/contact)
- [Cynbit Careers](https://www.cynbit.in/careers)
- [Backend Developer Intern role](https://www.cynbit.in/careers/backend-developer-intern)
- [Cynbit Privacy Policy](https://www.cynbit.in/privacy)
- [Cynbit Cookie Policy](https://www.cynbit.in/cookies)
- [Cynbit Terms of Service](https://www.cynbit.in/terms)
