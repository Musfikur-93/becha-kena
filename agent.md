# AI Agent Operating Manual & Engineering Constitution: Becha-Kena

* **Document Version:** 1.0.0 (Authoritative AI Agent Instructions)
* **Project:** **Becha-Kena** — Trust-First Peer-to-Peer (C2C) Marketplace for Bangladesh
* **Execution Strategy:** Backend-First, Spec-Driven, Test-Verified Modular Monolith
* **Status:** Active & Mandatory for All AI Coding Agents

---

## 1. Purpose of This File

You are an autonomous AI software engineer working on the **Becha-Kena** repository. This file (`agent.md`) is your permanent operating constitution. Read this file completely before reading code, planning tasks, or modifying any file in the workspace.

**Core Philosophy:**
1. **Zero Hallucination / Spec-First:** Every business rule, collection field, index, error code, and endpoint payload has already been designed and audited across 7 specification files at the repository root. **Never invent new field names, endpoints, enum values, or business rules silently.**
2. **Backend-First Execution:** Build and verify the shared validators (`packages/shared`) and the Express.js backend (`apps/api`) across Phases `B00`–`B22` in [prompt.md](file:///c:/Users/musfi/Documents/becha-kena/prompt.md) before starting the Next.js frontend (`apps/web`, Phases `F00`–`F10`).
3. **Offline-First Testability:** Every third-party integration (Porichoy e-KYC API, SMS Gateways, Cloudflare R2, Cloudflare Turnstile, FCM Push, Atlas Search) must sit behind a clean TypeScript interface with both a **Live Adapter** and a **Deterministic Mock Adapter** toggled via environment variables.

---

## 2. Source-of-Truth (SOT) Document Hierarchy

Before implementing any feature or fixing any bug, consult the relevant specification file(s). If two documents ever appear to conflict, **strictly follow this priority order** and report the discrepancy in your turn summary:

| Priority | File | Scope & Authority |
|:---:|:---|:---|
| **1 (Highest)** | [PRD.md](file:///c:/Users/musfi/Documents/becha-kena/PRD.md) (v4.0.0) | Ultimate source of truth for functional requirements (`FR-*`), RBAC matrices, user flows, notification triggers, and validation constraints (`VAL`). |
| **2** | [api-spec.md](file:///c:/Users/musfi/Documents/becha-kena/api-spec.md) (v1.0.0) | Authoritative contract for all 48 REST endpoints, 5 Socket.io events, auth tiers, custom headers, request/response JSON shapes, versioning (`§14`), and error codes (`§15`). |
| **3** | [database-schema.md](file:///c:/Users/musfi/Documents/becha-kena/database-schema.md) (v1.0.0) | Exact collection names, field names, BSON/TypeScript types, nullability, defaults, subdocument structures, and field sensitivity tiers (`select: false`). |
| **4** | [database.md](file:///c:/Users/musfi/Documents/becha-kena/database.md) (v1.0.0) | Index strategy, `$jsonSchema` validators, geospatial & trust-score aggregation pipelines, multi-document ACID transactions, and Mongoose v8 models. |
| **5** | [architecture.md](file:///c:/Users/musfi/Documents/becha-kena/architecture.md) (v3.0.0) | 4-layer modular monolith boundaries, monorepo directory structure, SSR vs. CSR rendering boundaries, Redis patterns, and BullMQ queue configurations. |
| **6** | [dfd.md](file:///c:/Users/musfi/Documents/becha-kena/dfd.md) (v1.0.0) | End-to-end data flows (`DF-01` to `DF-36`), process boundaries (`P1.0` to `P7.0`), and data store mappings (`D1` to `D9`). |
| **7** | [prompt.md](file:///c:/Users/musfi/Documents/becha-kena/prompt.md) (v1.0.0) | Ordered execution roadmap (`B00`–`B22`, `F00`–`F10`, `V01`–`V03`), pre-resolved cross-doc decisions (`D-01`–`D-10`), and per-phase Definition of Done (DoD). |

---

## 3. Pre-Resolved Cross-Document Decisions (`D-01` to `D-10`)

Always apply these locked decisions when implementing schemas, validators, and services:

1. **`D-01` Listing Photo Count (`2–10`):** `PRD.md` wins. Every published listing requires a minimum of `2` and a maximum of `10` processed WebP photos in Zod and Mongoose validators.
2. **`D-02` Click-to-Reveal Rate Limits:** Enforce the multi-dimensional sliding window from `PRD.md` (`FR-PDP-02`): **5 reveals/hour & 20/day per `userId`**, **10/hour per `deviceId`**, and **30/hour per `/24` IPv4 subnet** (or `/64` IPv6).
3. **`D-03` Guardian Relationship Enum:** Include `'ADULT_SIBLING'` alongside `'FATHER' | 'MOTHER' | 'LEGAL_GUARDIAN'`. Non-parent guardians (`ADULT_SIBLING` or `LEGAL_GUARDIAN`) must be aged $\ge 21$.
4. **`D-04` Admin 2FA Secrets Collection (`admin_2fa_secrets`):** Store encrypted TOTP secrets in a dedicated 13th collection `{ userId (unique), secretEncrypted (select: false), enabledAt, lastUsedAt, recognizedDeviceIds: [string] }`.
5. **`D-05` In-App Notifications Collection (`notifications`):** Persist in-app notifications in a 14th collection with a 90-day TTL index and expose `GET /api/v1/notifications`, `PATCH /api/v1/notifications/:id/read`, and `POST /api/v1/notifications/read-all`.
6. **`D-06` Dual Search Provider (`SEARCH_PROVIDER=atlas|local`):** Implement a `SearchProvider` interface with `AtlasSearchProvider` (`$search` compound pipeline for production M10+) and `LocalGeoSearchProvider` (`$geoNear` + regex/filter pipeline for local Docker & `mongodb-memory-server` tests).
7. **`D-07` Formal Offer Bounds (`10%–150%`):** Validate proposed and counter offer amounts against the **live `listings.price`**, never against a potentially stale `listingSnapshot.price`.
8. **`D-08` Free / Giveaway Items:** When `condition === 'free'`, `price` must be strictly `0` BDT and bypasses `category.minPriceBDT`. All other conditions require `price >= Math.max(10, category.minPriceBDT)`.
9. **`D-09` 5-Ad Quota Accounting:** Statuses `'active'`, `'reserved'`, and `'under_review'` count toward `users.activeListingCount` (max `5`). Increment atomically on listing creation or expired-listing renewal; decrement **only** when transitioning from one of those three statuses to `'sold'`, `'expired'`, or `'deleted'`.
10. **`D-10` Pluggable External Adapters:** All external services (`PORICHOY_MODE`, `SMS_MODE`, `TURNSTILE_MODE`, `FCM_MODE`) default to `'mock'` in development and test environments so `pnpm test` runs 100% offline.

---

## 4. Locked Technology Stack & Monorepo Structure

Do not introduce alternative frameworks, ORMs, or state managers without explicit user approval.

* **Package Manager & Workspace:** `pnpm` (v9+) monorepo with 3 workspaces:
  * `packages/shared` (`@becha-kena/shared`) — Zod schemas, TypeScript DTOs, error codes, RBAC constants, phone/URL/profanity guards.
  * `apps/api` (`@becha-kena/api`) — Express.js REST API, Socket.io server, Mongoose ODM, BullMQ workers.
  * `apps/web` (`@becha-kena/web`) — Next.js (App Router), Tailwind CSS, React Hook Form + `@becha-kena/shared` Zod resolvers, Socket.io client.
* **Runtime & Language:** Node.js 20 LTS, TypeScript 5+ (`"strict": true`, `"noUncheckedIndexedAccess": true`).
* **Database:** MongoDB Atlas (M10+ Replica Set in production; `MongoMemoryReplSet` in tests) via **Mongoose v8+**.
* **Cache, Locks & Queues:** Redis 7 (`ioredis`) + **BullMQ** for background jobs + `@socket.io/redis-adapter`.
* **Media & Storage:** **Sharp** (WebP conversion + EXIF stripping), `file-type` (magic byte inspection), `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` for **Cloudflare R2** (`bk-private` and `bk-public` buckets).
* **Resilience & Security:** `opossum` (Circuit Breaker), `jsonwebtoken`, `bcrypt`, `otplib` (TOTP 2FA), `helmet`, `cors`, `cookie-parser`, `pino` (structured logging with PII redaction).
* **Testing:** **Vitest** + **Supertest** + **socket.io-client** + **mongodb-memory-server**.

```text
becha-kena/
├── packages/
│   └── shared/src/
│       ├── constants/          # roles.ts, enums.ts, errorCodes.ts, limits.ts
│       ├── types/              # api.ts, dto/*.ts
│       └── validators/         # primitives.ts, contentGuards.ts, auth.ts, kyc.ts, listings.ts, ...
├── apps/
│   ├── api/src/
│   │   ├── config/             # env.ts, mongo.ts (withTransaction), redis.ts
│   │   ├── api/                # LAYER 1: Transport (routes/v1, controllers, middlewares, sockets)
│   │   ├── services/           # LAYER 2: Business Logic (pure domain rules, no req/res)
│   │   ├── repositories/       # LAYER 3: Data Access (Mongoose queries, pipelines, sessions)
│   │   ├── models/             # Mongoose Schemas (14 collections)
│   │   ├── adapters/           # LAYER 4: External Wrappers (porichoy, sms, storage, image, push, ocr, turnstile)
│   │   ├── jobs/               # BullMQ queues.ts + workers/*.worker.ts
│   │   ├── utils/              # AppError.ts, logger.ts, crypto.ts, chatSafety.ts, storageKeys.ts
│   │   ├── app.ts              # Express setup
│   │   ├── server.ts           # HTTP + Socket.io + Graceful Shutdown
│   │   └── worker.ts           # Standalone BullMQ worker entrypoint
│   └── web/                    # Next.js App Router frontend
```

---

## 5. Strict 4-Layer Architectural Rules (`apps/api`)

```text
[Layer 1: Controllers / Sockets / Middlewares]
                     │
                     ▼
        [Layer 2: Domain Services] ──────────► [Layer 4: Adapters & BullMQ Queues]
                     │
                     ▼
   [Layer 3: Repositories & Mongoose Models]
```

1. **Layer 1 (`api/`) — Transport Only:**
   * Parses HTTP/Socket payloads, runs `validate({ body, query, params })` with shared Zod schemas, checks authentication/RBAC middlewares, calls a Service method, and formats the response via `ok(res, data, meta)` or `created(res, data)`.
   * **Forbidden in Layer 1:** Mongoose model imports, business calculations, direct Redis/S3 calls, or try/catch blocks that swallow errors (let errors bubble to `globalErrorHandler`).
2. **Layer 2 (`services/`) — Pure Business Logic:**
   * Enforces all `FR-*` rules, coordinates multi-document ACID transactions via `withTransaction()`, invokes Adapters via interfaces, and emits socket/notification events after transaction commit.
   * **Forbidden in Layer 2:** Importing `Request` or `Response` from `express`, reading `req.headers` or `req.cookies` directly, or returning HTTP status codes (throw `new AppError(...)` instead).
3. **Layer 3 (`repositories/` & `models/`) — Data Access:**
   * Encapsulates Mongoose queries, cursor encoding/decoding, `$geoNear` / `$search` pipelines, and session passing (`{ session }`).
   * **Forbidden in Layer 3:** Calling Services or External Adapters.
4. **Layer 4 (`adapters/` & `jobs/`) — Infrastructure & Workers:**
   * Every external dependency defines a TypeScript interface (`SmsProvider`, `KycProvider`, `ObjectStorage`, `PushProvider`, `OcrProvider`, `TurnstileVerifier`) and provides both a live implementation and a mock/in-memory implementation.

---

## 6. The 12 Non-Negotiable Domain Invariants

Any code change that violates even one of the following rules is considered a critical bug:

### 6.1 Unified User Model & Asymmetric Onboarding
* Every public user has `role: 'USER'`. Buyer vs. Seller capability is controlled strictly by `sellerProfile.isSellerVerified: boolean`.
* Staff accounts use granular roles: `'MODERATOR'`, `'COMPLIANCE_OFFICER'`, and `'ADMIN_LEAD'` enforcing the least-privilege matrix in `PRD.md §2.1-B`.

### 6.2 Canonical NID Hashing & Under-18 Guardian Rules (`FR-KYC`)
* **Never store raw NID numbers** in MongoDB or logs.
* Always resolve the 10-digit canonical Smart NID from Porichoy first, then compute `canonicalNidHash = HMAC-SHA-256(NID_HMAC_SECRET, canonicalSmartNid)` and `compositeDobHash = HMAC-SHA-256(NID_HMAC_SECRET, dob + normalizedName)`.
* **1 Canonical NID = 1 Verified Adult Account** (enforced via partial unique index on `{ canonicalNidHash: 1 }` where `verificationType === 'ADULT_SELF'` and `status === 'verified'`).
* **Guardian Limit:** A single Guardian NID (`guardianCanonicalNidHash`) can sponsor at most **2** verified `MINOR_GUARDIAN` accounts.
* **Contamination Rule:** If a `MINOR_GUARDIAN` account is permanently banned for fraud, all other accounts sharing that `guardianCanonicalNidHash` must be automatically suspended pending compliance review.
* **Circuit Breaker Fallback:** If Porichoy API times out or returns `5xx`, `POST /api/v1/kyc/submit` **must not return `500`**. It must save the encrypted R2 keys, set `status: 'manual_review'`, and return **`202 Accepted`**.

### 6.3 5-Listing Quota with ACID Transaction Lock (`FR-LST-01`)
* Verified sellers are capped at **5 active listings** (`active`, `reserved`, `under_review`).
* Publishing a new listing or renewing an expired listing must run inside a MongoDB ACID transaction that atomically updates the user row with filter `{ _id: sellerId, activeListingCount: { $lt: 5 }, status: 'active', 'sellerProfile.isSellerVerified': true }` and `{ $inc: { activeListingCount: 1 } }`. If `findOneAndUpdate` returns `null`, abort and throw `422 QUOTA_EXCEEDED`.

### 6.4 Mandatory EXIF GPS Stripping & Image Sanitization (`SEC-02`, `FR-LST-02`)
* Verify file magic bytes (`file-type` package) — allow only `JPEG`, `PNG`, `WebP`, `HEIC`/`HEIF`. Never trust `Content-Type` or file extension.
* Process through Sharp: `.rotate().resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 })` (stepping down quality if needed to stay `< 307,200` bytes).
* **Never call `.withMetadata()`** — 100% of camera EXIF and GPS coordinates must be stripped so a seller's home location can never be extracted from product photos.

### 6.5 Geospatial Privacy & Coordinate Order (`FR-GEO`)
* **MongoDB GeoJSON strictly requires `[longitude, latitude]` order.** Always validate `latitude` in `[20.34, 26.64]` and `longitude` in `[88.01, 92.67]` (`BD_BOUNDS`).
* **Never return `location.coordinates` in public search or PDP responses.** Return only `distanceKm` (rounded to 1 decimal place) and `address: { division, district, thana }`.

### 6.6 Click-to-Reveal Phone Firewall (`FR-PDP-02`)
* Search and PDP endpoints must never return the raw `contactPhone`. Project `maskedPhone` preserving the telco prefix: `contactPhone.slice(0, 6) + "XX-XXXXXX"` (e.g., `+88017XX-XXXXXX`).
* `POST /api/v1/listings/:id/reveal-phone`:
  1. Block self-reveal (`403 SELF_INTERACTION_BLOCKED`).
  2. Check `phone_reveal_logs` for `{ buyerId, listingId, revealedAt: { $gte: now - 7d } }`. If found, return `listing.contactPhone` with `isRepeatRevealFree: true` **without consuming rate-limit quota**.
  3. Otherwise enforce sliding-window limits (`5/hr` & `20/day` per user, `10/hr` per device, `30/hr` per `/24` subnet) and insert a `phone_reveal_logs` entry (90-day TTL).

### 6.7 Bait-and-Switch Edit Re-Moderation (`FR-LST-03`)
* Editing a listing's `title`, `categoryId`, `images`, or changing `price` by `> 30%` sets `status: 'under_review'`, stores the new values in `pendingRevision` while keeping the last approved values visible in public search, and enqueues `listing_moderation_queue` (`< 5 min` fast-track automated check; escalates to human queue if flagged).

### 6.8 Real-Time Chat Safety Filter (`FR-CHT-02`)
* Every chat message (REST and Socket.io) passes through `chatSafety.ts` synchronously (`< 5ms`):
  * **Hard Block (`400 PROHIBITED_CONTENT_DETECTED`):** Reject any message containing external URLs/domains (`http`, `.com`, `bit.ly`, `wa.me`, `t.me`, `[dot]`) or word-boundary matched English/Banglish/Bengali profanity. Do not persist blocked messages.
  * **Soft Warning (`moderationFlag: 'SCAM_WARNING'`):** Deliver messages mentioning `bKash`, `Nagad`, `Rocket`, `advance`, `courier`, `অগ্রিম`, `বিকাশ`, `নগদ`, but tag them with `SCAM_WARNING` so the UI displays the anti-advance-payment warning banner.

### 6.9 Atomic Offer Acceptance & Optimistic Concurrency (`FR-CHT-03`)
* Only 1 chat thread is allowed per buyer per listing (`{ listingId: 1, buyerId: 1 }` unique index).
* Formal offers must be between `10%` and `150%` of the live `listings.price` and auto-expire after **72 hours**.
* Accepting an offer must execute `acceptOfferAtomic` (`database.md §7.2`) using `{ _id: listingId, status: 'active', __v: expectedListingVersion }` to transition the listing to `'reserved'`, set `reservedBuyerId`, increment `__v`, mark the offer `'accepted'`, and mark all competing pending offers on other threads for that listing as `'superseded'`. Concurrent accepts fail cleanly with `409 CONFLICT_409`.

### 6.10 Deal Attribution, 48-Hour Review Lock & Trust Score (`FR-MOD-01`, `FR-MOD-03`)
* Sellers can only mark a listing sold to a candidate buyer who has either an active `chat_threads` record or a `phone_reveal_logs` record on that listing.
* Reviews are unlocked only after deal confirmation (`dealConfirmedByBuyer === true`, an accepted formal offer, or $\ge 3$ two-way messages) and are permanently locked against edits after **48 hours** (`editableUntil = createdAt + 48h`).
* `users.trustScore` (`0.0` to `5.0`, default `0.0`) is recalculated asynchronously via `trust_score_recalc_queue`:
  $$\text{trustScore} = \text{round}_1\left(\frac{\sum \text{rating} \times \text{weight}}{\sum \text{weight}} \times \min\left(1.0, \frac{\text{completedDealsCount}}{10}\right)\right)$$
  where reviews older than 90 days have $\text{weight} = 0.70$ (recent reviews $= 1.0$). A seller with `0` completed deals displays `"New Seller"`.

### 6.11 Zero-Join SSR Snapshots & Cache Sync
* `listings` embeds `images: [{ cdnUrl, r2Key, sortOrder, ocrFlagged }]`, `coverImageUrl`, and `sellerSnapshot: { displayName, isSellerVerified, trustScore, avatarUrl }` so search feeds render with zero `$lookup` joins.
* Whenever a seller's `displayName`, `avatarUrl`, `isSellerVerified`, or `trustScore` changes, enqueue `snapshot_sync_queue` to update their active/reserved/under_review listings. On an **Admin Ban**, update the seller's listings **synchronously inline**.

### 6.12 Admin TOTP 2FA & Immutable Audit Logs (`PERM-05`, `SEC-07`)
* Every `/api/v1/admin/*` action (including viewing private KYC signed URLs) must write an append-only record to `admin_audit_logs` via `audit.service.ts`.
* `AdminAuditLog` blocks all update and delete operations via Mongoose pre-hooks.
* Destructive operations (`POST /admin/users/:id/ban` and `POST /admin/warrant-export`) require `role === 'ADMIN_LEAD'` **plus** a fresh, replay-protected 6-digit `X-Admin-TOTP` code on every single invocation.

---

## 7. API Conventions, Auth Cookies & Error Handling

### 7.1 Dual-Token HttpOnly Cookie Auth
* **Access Cookie (`bk_access_token`):** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900` (15 minutes).
* **Refresh Cookie (`bk_refresh_token`):** `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=2592000` (30 days, opaque token hashed with SHA-256 in Redis, rotated on every use with family theft detection).
* **Instant Ban Check:** Every authenticated REST request and inbound Socket.io event checks `SISMEMBER banned_users {userId}` in Redis (`< 1ms`).

### 7.2 Standard Envelopes
* **Success (`200` / `201` / `202`):**
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": {
      "nextCursor": "...",
      "hasMore": false,
      "expandedRadiusKm": null
    }
  }
  ```
* **Error (`4xx` / `5xx`):**
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Request validation failed on 1 field(s).",
      "requestId": "req_9f8e7d6c5b4a",
      "timestamp": "2026-11-17T14:00:00.000Z",
      "retryAfterSeconds": 60,
      "details": [
        { "field": "price", "code": "PRICE_BELOW_CATEGORY_FLOOR", "message": "Minimum price for Mobiles & Tablets is ৳500." }
      ]
    }
  }
  ```
* Always use the exact error codes defined in `api-spec.md §1.4` and `§15.2` (exported from `@becha-kena/shared/constants/errorCodes`).

### 7.3 Logging & PII Redaction Rules
* Never use `console.log` in application code; always use the `pino` logger (`utils/logger.ts`).
* Configure redaction so the following **never** appear in logs under any circumstance:
  * `bk_access_token`, `bk_refresh_token`, `Authorization` headers
  * `otpCode`, `pin`, `accountPin`, `accountPinHash`, `X-Admin-TOTP`
  * Raw `nidNumber`, `canonicalNidHash`, `porichoyResponse`, `storageKeys`
  * Unmasked `phoneNumber` / `contactPhone` in error dumps
  * Pre-signed URL query parameters (`X-Amz-Signature`, `X-Amz-Credential`, `X-Amz-Security-Token`)

---

## 8. Execution Protocol for AI Agents

When the user asks you to build a phase (e.g., `"Build Phase B05"` or `"Continue to next phase"`):

1. **Locate the Phase in `prompt.md`:** Read the phase prompt and every document section listed in its `Read first:` line.
2. **State Your Plan Briefly:** List the files you will create or modify and the tests you will write.
3. **Stay Strictly in Scope:** Implement all requirements for the current phase completely—no placeholder `// TODO: implement later` inside the current phase's scope, and do not jump ahead to build future phases.
4. **Verify Before Finishing:**
   * Run `pnpm lint`
   * Run `pnpm typecheck`
   * Run `pnpm test`
   * Fix any failing test, lint warning, or TypeScript error before concluding your turn.
5. **Report Clearly at the End of Every Turn:**
   * **Files Created / Modified:** Clickable markdown links to all touched files.
   * **Verification Output:** Summary of `lint`, `typecheck`, and `test` results.
   * **Doc Updates / Assumptions:** Any spec additions or conflict resolutions applied (following the SOT hierarchy in Section 2).
   * **Definition of Done (DoD) Checklist:** Tick `[x]` every item from the phase's DoD in `prompt.md`.
