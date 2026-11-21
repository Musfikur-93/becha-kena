# REST & WebSocket API Specification: Becha-Kena

* **Document Version:** 1.0.0 (Complete Production API Contract)
* **Base Path:** `https://api.bechakena.com/api/v1`
* **Requirements SOT:** [PRD.md](file:///c:/Users/musfi/Documents/becha-kena/PRD.md) (v4.0.0)
* **System Architecture:** [architecture.md](file:///c:/Users/musfi/Documents/becha-kena/architecture.md) (v3.0.0)
* **Database Spec:** [database.md](file:///c:/Users/musfi/Documents/becha-kena/database.md) (v1.0.0)
* **Schema Reference:** [database-schema.md](file:///c:/Users/musfi/Documents/becha-kena/database-schema.md) (v1.0.0)
* **Validation Engine:** Shared Zod Schemas (`packages/shared/validators`)
* **Status:** Final & Synchronized

---

## Table of Contents

1. [Global API Standards & Conventions](#1-global-api-standards--conventions)
   * 1.1 [Authentication & Authorization Tiers](#11-authentication--authorization-tiers)
   * 1.2 [Required Custom Headers](#12-required-custom-headers)
   * 1.3 [Standard Response & Error Envelope](#13-standard-response--error-envelope)
   * 1.4 [Standard Error Codes](#14-standard-error-codes)
2. [Master Endpoint Index (Summary Table)](#2-master-endpoint-index-summary-table)
3. [Domain 1: Authentication & Session Management (`/auth`)](#3-domain-1-authentication--session-management-auth)
4. [Domain 2: User Profile & Account Lifecycle (`/users`)](#4-domain-2-user-profile--account-lifecycle-users)
5. [Domain 3: e-KYC Verification Pipeline (`/kyc`)](#5-domain-3-e-kyc-verification-pipeline-kyc)
6. [Domain 4: Category Taxonomy & Geolocation (`/categories`, `/geo`)](#6-domain-4-category-taxonomy--geolocation-categories-geo)
7. [Domain 5: Media & Image Processing Pipeline (`/media`)](#7-domain-5-media--image-processing-pipeline-media)
8. [Domain 6: Listings, Search & Product Details (`/listings`)](#8-domain-6-listings-search--product-details-listings)
9. [Domain 7: Seller Dashboard & Deal Attribution (`/seller`, `/listings/:id`)](#9-domain-7-seller-dashboard--deal-attribution-seller-listingsid)
10. [Domain 8: Real-Time Chat & Atomic Offer Negotiation (`/chats` & Socket.io)](#10-domain-8-real-time-chat--atomic-offer-negotiation-chats--socketio)
11. [Domain 9: Verified Reviews & Social Proof (`/reviews`)](#11-domain-9-verified-reviews--social-proof-reviews)
12. [Domain 10: Trust & Safety Reports & Ban Appeals (`/reports`, `/appeals`)](#12-domain-10-trust--safety-reports--ban-appeals-reports-appeals)
13. [Domain 11: Internal Admin & Compliance Operations (`/admin`)](#13-domain-11-internal-admin--compliance-operations-admin)
14. [API Version Control & Lifecycle Strategy](#14-api-version-control--lifecycle-strategy)
   * 14.1 [Versioning Scheme (URI + Header Negotiation)](#141-versioning-scheme-uri--header-negotiation)
   * 14.2 [Backward-Compatible vs. Breaking Changes](#142-backward-compatible-vs-breaking-changes)
   * 14.3 [Deprecation Policy & Sunset Headers (RFC 8594)](#143-deprecation-policy--sunset-headers-rfc-8594)
   * 14.4 [Optimistic Document Version Control (`__v` & ETag)](#144-optimistic-document-version-control-__v--etag)
   * 14.5 [API Specification Version History (Changelog)](#145-api-specification-version-history-changelog)
15. [Comprehensive Error Handling & Resilience Architecture](#15-comprehensive-error-handling--resilience-architecture)
   * 15.1 [Standardized Error Response Contract](#151-standardized-error-response-contract)
   * 15.2 [Domain-Specific Error Catalog & Client Recovery Matrix](#152-domain-specific-error-catalog--client-recovery-matrix)
   * 15.3 [Validation Error Formatting (Zod Integration)](#153-validation-error-formatting-zod-integration)
   * 15.4 [Rate-Limiting & Sliding-Window Headers (`429 Too Many Requests`)](#154-rate-limiting--sliding-window-headers-429-too-many-requests)
   * 15.5 [External Service Fault Tolerance & Circuit Breaker Fallbacks](#155-external-service-fault-tolerance--circuit-breaker-fallbacks)
   * 15.6 [WebSocket (Socket.io) Real-Time Error Handling Contract](#156-websocket-socketio-real-time-error-handling-contract)
   * 15.7 [Global Express Error Middleware Implementation Blueprint](#157-global-express-error-middleware-implementation-blueprint)

---

## 1. Global API Standards & Conventions

### 1.1 Authentication & Authorization Tiers

All authenticated endpoints rely on **HttpOnly, Secure, `SameSite=Lax` Cookies** (`bk_access_token` with 15-minute TTL, and `bk_refresh_token` with 30-day rotating TTL). On every authenticated request, the Express auth middleware performs a `<1ms` Redis check (`SISMEMBER banned_users {userId}`) to enforce immediate session revocation for banned accounts (`FR-AUTH-04`).

| Auth Badge | Required Cookie / Token | Role & State Guard | Description |
|:---|:---|:---|:---|
| **`PUBLIC`** | None | None | Accessible to unauthenticated guests and logged-in users. |
| **`PUBLIC + TURNSTILE`** | `X-Turnstile-Token` header | Cloudflare Turnstile Verified | Public endpoint protected against automated bot/SMS pumping (`FR-AUTH-01`). |
| **`REFRESH_COOKIE`** | `bk_refresh_token` Cookie | Valid session in Redis | Used strictly on `POST /auth/refresh` for token rotation. |
| **`AUTH: USER`** | `bk_access_token` Cookie | `status === 'active'` | Any phone-verified logged-in user (Buyer or Seller). |
| **`AUTH: VERIFIED_SELLER`** | `bk_access_token` Cookie | `status === 'active'` AND `isSellerVerified === true` | Users who have completed Porichoy e-KYC (`ADULT_SELF` or `MINOR_GUARDIAN`). |
| **`AUTH: MODERATOR+`** | `bk_access_token` Cookie | `role IN ['MODERATOR', 'COMPLIANCE_OFFICER', 'ADMIN_LEAD']` | Content moderators reviewing flagged listings, chats, and reports. |
| **`AUTH: COMPLIANCE+`** | `bk_access_token` Cookie | `role IN ['COMPLIANCE_OFFICER', 'ADMIN_LEAD']` | Compliance officers reviewing manual e-KYC queues and ban appeals. |
| **`AUTH: ADMIN_LEAD + 2FA`** | `bk_access_token` Cookie + `X-Admin-TOTP` | `role === 'ADMIN_LEAD'` + Valid 6-digit TOTP | High-privilege actions (Global Kill Switch, Forensic Warrant Export). |

---

### 1.2 Required Custom Headers

| Header Name | Format | Required On | Purpose |
|:---|:---|:---|:---|
| `X-Device-Id` | `string` (UUIDv4 / Fingerprint) | All `/auth/*`, `/listings/:id/reveal-phone`, `/listings` (POST) | Multi-dimensional rate-limiting, SIM-swap recycled account check, and device ban tracking. |
| `Idempotency-Key` | `string` (UUIDv4) | `POST /kyc/submit`, `POST /listings`, `POST /chats/threads/:id/messages` | Prevents duplicate submissions on unstable 3G/4G mobile networks (`EX 86400` in Redis). |
| `X-Turnstile-Token` | `string` | `POST /auth/otp/request`, `POST /appeals` | Cloudflare Turnstile / Firebase App Check token to block SMS pumping and spam. |
| `X-Admin-TOTP` | `string` (`^\d{6}$`) | `POST /admin/users/:id/ban`, `POST /admin/warrant-export` | Mandatory hardware/authenticator 2FA step-up verification for destructive admin operations. |

---

### 1.3 Standard Response & Error Envelope

#### Success Response Envelope (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTExLTE0VDEyOjAwOjAwLjAwMFoiLCJfaWQiOiI2NzM1ZTBhMDEyMzQ1Njc4OTBsaXN0MDEifQ==",
    "hasMore": true,
    "expandedRadiusKm": null
  }
}
```

#### Error Response Envelope (`4xx`, `5xx`)
```json
{
  "success": false,
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Maximum of 5 active free listings reached. Please delete or mark an existing listing as sold.",
    "details": [
      {
        "field": "activeListingCount",
        "issue": "Current active count is 5 (max allowed: 5)"
      }
    ]
  }
}
```

---

### 1.4 Standard Error Codes

| HTTP Status | Error Code | Trigger Condition |
|:---:|:---|:---|
| `400` | `VALIDATION_ERROR` | Request body or query parameters failed Zod schema validation (`VAL-01` to `VAL-04`). |
| `400` | `PRICE_BELOW_CATEGORY_FLOOR` | Listing price is below the dynamic `category.minPriceBDT` floor (`FR-CAT-02`). |
| `400` | `PROHIBITED_CONTENT_DETECTED` | Phone number, external URL, or profanity detected in listing title/description or chat (`FR-CHT-02`). |
| `401` | `UNAUTHORIZED` | Missing, expired, or invalid `bk_access_token` cookie. |
| `401` | `PIN_VERIFICATION_REQUIRED` | Account inactive > 180 days on a new device; requires `POST /auth/pin/verify` (`FR-AUTH-02`). |
| `403` | `FORBIDDEN_KYC_REQUIRED` | Unverified user attempted to access Seller Dashboard or create a listing. |
| `403` | `ACCOUNT_SUSPENDED_OR_BANNED` | User account status is `suspended` or `banned`. |
| `403` | `SELF_INTERACTION_BLOCKED` | Seller attempted to reveal own phone, message own listing, or review own item (`FR-PDP-01`). |
| `404` | `RESOURCE_NOT_FOUND` | Requested ID does not exist. |
| `409` | `CONFLICT_409` | Optimistic concurrency version (`__v`) mismatch during offer acceptance or duplicate report/review. |
| `409` | `NID_ALREADY_REGISTERED` | Canonical NID hash already belongs to another verified account (`1 NID = 1 Account`). |
| `410` | `LISTING_UNAVAILABLE` | Listing has been `sold` or `deleted` (`FR-PDP-01`). |
| `422` | `QUOTA_EXCEEDED` | Seller already has 5 active/reserved/under_review listings (`FR-LST-01`) or Guardian has 2 minor accounts. |
| `429` | `RATE_LIMIT_EXCEEDED` | Exceeded OTP limit (3/hr) or Click-to-Reveal quota (5/hr, 20/day). Includes `retryAfterSeconds`. |

---

## 2. Master Endpoint Index (Summary Table)

| # | Domain | Method | Endpoint Path | Auth Requirement | Primary Collection(s) | PRD Ref |
|:---:|:---|:---:|:---|:---|:---|:---|
| 1 | **Auth** | `POST` | `/api/v1/auth/otp/request` | `PUBLIC + TURNSTILE` | Redis (`otp:{phone}`) | `FR-AUTH-01` |
| 2 | **Auth** | `POST` | `/api/v1/auth/otp/verify` | `PUBLIC` | `users`, Redis | `FR-AUTH-01` |
| 3 | **Auth** | `POST` | `/api/v1/auth/refresh` | `REFRESH_COOKIE` | Redis (`session:*`) | `FR-AUTH-04` |
| 4 | **Auth** | `POST` | `/api/v1/auth/logout` | `AUTH: USER` | Redis (`session:*`) | `FR-AUTH-04` |
| 5 | **Auth** | `POST` | `/api/v1/auth/pin/verify` | `AUTH: USER` | `users` | `FR-AUTH-02` |
| 6 | **Auth** | `POST` | `/api/v1/auth/phone-migration` | `AUTH: USER` | `users`, `identity_verifications` | `FR-AUTH-03` |
| 7 | **Users** | `GET` | `/api/v1/users/me` | `AUTH: USER` | `users` | `B-01`, `S-01` |
| 8 | **Users** | `PATCH` | `/api/v1/users/me` | `AUTH: USER` | `users` | `VAL`, `FR-AUTH-02` |
| 9 | **Users** | `GET` | `/api/v1/users/:id/public-profile` | `PUBLIC` | `users`, `listings` | `B-03` |
| 10 | **Users** | `DELETE` | `/api/v1/users/me` | `AUTH: USER` | `users`, `listings`, `chat_threads` | `FR-AUTH-04` |
| 11 | **e-KYC** | `POST` | `/api/v1/kyc/upload-urls` | `AUTH: USER` | Cloudflare R2 (Private) | `FR-KYC-04` |
| 12 | **e-KYC** | `POST` | `/api/v1/kyc/submit` | `AUTH: USER` | `identity_verifications`, `users` | `FR-KYC-01..03` |
| 13 | **e-KYC** | `GET` | `/api/v1/kyc/status` | `AUTH: USER` | `identity_verifications` | `S-02` |
| 14 | **e-KYC** | `POST` | `/api/v1/kyc/upgrade-adult` | `AUTH: VERIFIED_SELLER` | `identity_verifications`, `users` | `FR-KYC-01` |
| 15 | **Catalog** | `GET` | `/api/v1/categories` | `PUBLIC` | `categories`, Redis | `FR-CAT-01..03` |
| 16 | **Catalog** | `GET` | `/api/v1/categories/:slug` | `PUBLIC` | `categories` | `FR-CAT-01` |
| 17 | **Geo** | `GET` | `/api/v1/geo/locations` | `PUBLIC` | Static / Redis Cache | `FR-GEO-01` |
| 18 | **Media** | `POST` | `/api/v1/media/upload-photo` | `AUTH: USER` | `listing_images`, R2 (Public) | `FR-LST-02` |
| 19 | **Listings** | `GET` | `/api/v1/listings` | `PUBLIC` | `listings` (Atlas Search) | `FR-GEO-02` |
| 20 | **Listings** | `GET` | `/api/v1/listings/:id` | `PUBLIC` | `listings`, Redis (`views:*`) | `FR-PDP-01` |
| 21 | **Listings** | `POST` | `/api/v1/listings/:id/reveal-phone` | `AUTH: USER` | `phone_reveal_logs`, `listings` | `FR-PDP-02` |
| 22 | **Listings** | `POST` | `/api/v1/listings` | `AUTH: VERIFIED_SELLER` | `listings`, `users`, `listing_images` | `FR-LST-01..02` |
| 23 | **Listings** | `PATCH` | `/api/v1/listings/:id` | `AUTH: VERIFIED_SELLER` | `listings` | `FR-LST-03` |
| 24 | **Listings** | `DELETE` | `/api/v1/listings/:id` | `AUTH: VERIFIED_SELLER` | `listings`, `users`, `chat_threads` | `FR-LST-04` |
| 25 | **Listings** | `POST` | `/api/v1/listings/:id/renew` | `AUTH: VERIFIED_SELLER` | `listings`, `users` | `FR-LST-05` |
| 26 | **Seller** | `GET` | `/api/v1/seller/dashboard` | `AUTH: VERIFIED_SELLER` | `listings`, `users` | `S-04` |
| 27 | **Deal** | `GET` | `/api/v1/listings/:id/eligible-buyers`| `AUTH: VERIFIED_SELLER` | `chat_threads`, `phone_reveal_logs` | `FR-MOD-01` |
| 28 | **Deal** | `POST` | `/api/v1/listings/:id/mark-sold` | `AUTH: VERIFIED_SELLER` | `listings`, `users`, `chat_threads` | `FR-MOD-01` |
| 29 | **Deal** | `POST` | `/api/v1/listings/:id/confirm-purchase`| `AUTH: USER` | `listings`, `users` | `FR-MOD-01` |
| 30 | **Chat** | `POST` | `/api/v1/chats/threads` | `AUTH: USER` | `chat_threads`, `listings` | `FR-CHT-04` |
| 31 | **Chat** | `GET` | `/api/v1/chats/threads` | `AUTH: USER` | `chat_threads` | `B-05` |
| 32 | **Chat** | `GET` | `/api/v1/chats/threads/:id/messages` | `AUTH: USER` | `messages`, `chat_threads` | `FR-CHT-01` |
| 33 | **Chat** | `POST` | `/api/v1/chats/threads/:id/messages` | `AUTH: USER` | `messages`, `chat_threads` | `FR-CHT-01..02` |
| 34 | **Chat** | `POST` | `/api/v1/chats/threads/:id/offers/:offerId/respond` | `AUTH: USER` | `listings`, `chat_threads`, `messages` | `FR-CHT-03` |
| 35 | **Reviews** | `POST` | `/api/v1/listings/:id/reviews` | `AUTH: USER` | `reviews`, `listings`, `users` | `FR-MOD-01`, `03`|
| 36 | **Reviews** | `PATCH` | `/api/v1/reviews/:id` | `AUTH: USER` | `reviews` | `FR-MOD-01` |
| 37 | **Reviews** | `GET` | `/api/v1/users/:id/reviews` | `PUBLIC` | `reviews` | `B-03` |
| 38 | **Safety** | `POST` | `/api/v1/reports` | `AUTH: USER` | `reports`, `listings`, `messages` | `FR-MOD-02` |
| 39 | **Safety** | `POST` | `/api/v1/appeals` | `PUBLIC + TURNSTILE` | `ban_appeals` | `FR-MOD-02` |
| 40 | **Admin** | `GET` | `/api/v1/admin/kyc-queue` | `AUTH: COMPLIANCE+` | `identity_verifications`, `admin_audit_logs` | `PERM-03` |
| 41 | **Admin** | `POST` | `/api/v1/admin/kyc/:id/decision` | `AUTH: COMPLIANCE+` | `identity_verifications`, `users`, `admin_audit_logs` | `FR-KYC-03` |
| 42 | **Admin** | `GET` | `/api/v1/admin/reports` | `AUTH: MODERATOR+` | `reports` | `FR-MOD-02` |
| 43 | **Admin** | `PATCH` | `/api/v1/admin/reports/:id` | `AUTH: MODERATOR+` | `reports`, `listings`, `admin_audit_logs` | `FR-MOD-02` |
| 44 | **Admin** | `GET` | `/api/v1/admin/appeals` | `AUTH: COMPLIANCE+` | `ban_appeals` | `FR-MOD-02` |
| 45 | **Admin** | `POST` | `/api/v1/admin/appeals/:id/decision` | `AUTH: COMPLIANCE+` | `ban_appeals`, `users`, `admin_audit_logs` | `FR-MOD-02` |
| 46 | **Admin** | `POST` | `/api/v1/admin/users/:id/ban` | `AUTH: ADMIN_LEAD + 2FA`| `users`, `listings`, `admin_audit_logs`, Redis | `PERM-05` |
| 47 | **Admin** | `POST` | `/api/v1/admin/warrant-export` | `AUTH: ADMIN_LEAD + 2FA`| `users`, `identity_verifications`, `admin_audit_logs` | `PERM-06` |
| 48 | **Admin** | `GET` | `/api/v1/admin/queue-health` | `AUTH: ADMIN_LEAD` | Redis (BullMQ) | `Arch 5.6` |

---

## 3. Domain 1: Authentication & Session Management (`/auth`)

---

### 3.1 Request SMS OTP
* **Endpoint:** `POST /api/v1/auth/otp/request`
* **Auth Required:** `PUBLIC + TURNSTILE` (`X-Turnstile-Token` & `X-Device-Id` headers required)
* **Rate Limit:** Max 3 requests / hour per phone, 5 requests / hour per IP or Device ID (`FR-AUTH-01`).

#### Request Body
```json
{
  "phoneNumber": "+8801711223344",
  "intent": "LOGIN_OR_REGISTER"
}
```
* **Validation:**
  * `phoneNumber`: Required, string matching `^\+8801[3-9]\d{8}$`.
  * `intent`: Enum `'LOGIN_OR_REGISTER' | 'PHONE_MIGRATION'`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "phoneNumber": "+8801711223344",
    "expiresInSeconds": 180,
    "resendCooldownSeconds": 60
  }
}
```

---

### 3.2 Verify SMS OTP & Issue Session Cookies
* **Endpoint:** `POST /api/v1/auth/otp/verify`
* **Auth Required:** `PUBLIC` (`X-Device-Id` header required)
* **Description:** Verifies the 6-digit OTP against Redis (`otp:{phone}`). If user does not exist in `users`, creates a new document with `role: 'USER'`, `trustScore: 0.0`, `activeListingCount: 0`. If account was inactive for `> 180 days` and `X-Device-Id` is unrecognized (`FR-AUTH-02`) and `accountPinHash` is set, returns `requiresPinVerification: true`. Sets HttpOnly cookies `bk_access_token` (15m) and `bk_refresh_token` (30d).

#### Request Body
```json
{
  "phoneNumber": "+8801711223344",
  "otpCode": "482910"
}
```
* **Validation:**
  * `phoneNumber`: `^\+8801[3-9]\d{8}$`
  * `otpCode`: `^\d{6}$` (Max 3 failed attempts before OTP is invalidated and locked for 1 hour).

#### Response (`200 OK`)
* **Headers Set:**
  * `Set-Cookie: bk_access_token=<JWT>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900`
  * `Set-Cookie: bk_refresh_token=<UUID>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth/refresh; Max-Age=2592000`
```json
{
  "success": true,
  "data": {
    "isNewUser": false,
    "requiresPinVerification": false,
    "nextRoute": "/seller/dashboard",
    "user": {
      "_id": "6735e0a01234567890user01",
      "phoneNumber": "+8801711223344",
      "role": "USER",
      "status": "active",
      "activeListingCount": 3,
      "trustScore": 4.8,
      "completedDealsCount": 14,
      "sellerProfile": {
        "displayName": "Tanvir Rahman",
        "isSellerVerified": true,
        "kycStatus": "verified",
        "avatarUrl": "https://cdn.bechakena.com/avatars/user01.webp"
      }
    }
  }
}
```

---

### 3.3 Refresh Access Token (Rotating Refresh Token)
* **Endpoint:** `POST /api/v1/auth/refresh`
* **Auth Required:** `REFRESH_COOKIE` (`bk_refresh_token` HttpOnly cookie)
* **Description:** Validates the refresh token in Redis (`session:{userId}:{jti}`), checks that the user is not in `banned_users`, invalidates the old refresh token, and issues a fresh `bk_access_token` + `bk_refresh_token` pair.

#### Request Body
*(Empty body — reads `bk_refresh_token` from HttpOnly cookie)*

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "expiresInSeconds": 900
  }
}
```

---

### 3.4 Logout & Revoke Session
* **Endpoint:** `POST /api/v1/auth/logout`
* **Auth Required:** `AUTH: USER`

#### Request Body
```json
{
  "allDevices": false
}
```

#### Response (`200 OK`)
*Clears `bk_access_token` and `bk_refresh_token` cookies and deletes Redis session key(s).*
```json
{
  "success": true,
  "data": {
    "loggedOut": true
  }
}
```

---

### 3.5 Verify SIM-Swap Security PIN (`FR-AUTH-02`)
* **Endpoint:** `POST /api/v1/auth/pin/verify`
* **Auth Required:** `AUTH: USER`
* **Description:** Unlocks Seller Dashboard access when an account inactive for `> 180 days` logs in from an unrecognized device fingerprint.

#### Request Body
```json
{
  "pin": "739204"
}
```
* **Validation:** `pin` (`^\d{4,6}$`). Verified against `users.accountPinHash` via bcrypt.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "deviceTrusted": true,
    "verifiedAt": "2026-11-17T13:20:00.000Z"
  }
}
```

---

### 3.6 Verified Phone Migration / Account Recovery (`FR-AUTH-03`)
* **Endpoint:** `POST /api/v1/auth/phone-migration`
* **Auth Required:** `AUTH: USER` (Logged in with the **new** OTP-verified phone number)
* **Description:** Allows a verified seller who lost their old SIM card to migrate their existing verified account to their new phone number by proving identity via their NID + Live Selfie matching the stored `canonicalNidHash`.

#### Request Body
```json
{
  "oldPhoneNumber": "+8801811998877",
  "nidNumber": "1995269123456",
  "dob": "1995-04-12",
  "selfieKey": "kyc/6735e0a01234567890user09/recovery_selfie.enc"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "migratedUserId": "6735e0a01234567890user01",
    "newPhoneNumber": "+8801711223344",
    "oldSessionsRevoked": true
  }
}
```

---

## 4. Domain 2: User Profile & Account Lifecycle (`/users`)

---

### 4.1 Get Current Authenticated User Profile
* **Endpoint:** `GET /api/v1/users/me`
* **Auth Required:** `AUTH: USER`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890user01",
    "phoneNumber": "+8801711223344",
    "role": "USER",
    "status": "active",
    "phoneVerified": true,
    "hasAccountPin": true,
    "activeListingCount": 3,
    "maxListingQuota": 5,
    "trustScore": 4.8,
    "completedDealsCount": 14,
    "manualLocation": {
      "division": "Dhaka",
      "district": "Dhaka",
      "thana": "Gulshan"
    },
    "sellerProfile": {
      "displayName": "Tanvir Rahman",
      "bio": "Authentic Apple gadgets and accessories seller in Gulshan 2.",
      "businessName": null,
      "avatarUrl": "https://cdn.bechakena.com/avatars/user01.webp",
      "kycStatus": "verified",
      "isSellerVerified": true,
      "verifiedAt": "2026-01-15T10:30:00.000Z"
    },
    "notificationPrefs": {
      "newMessage": true,
      "offerUpdates": true,
      "listingExpiry": true,
      "dealConfirmation": true
    },
    "lastActiveAt": "2026-11-17T13:00:00.000Z",
    "createdAt": "2025-11-01T08:00:00.000Z"
  }
}
```

---

### 4.2 Update Current User Profile & Preferences
* **Endpoint:** `PATCH /api/v1/users/me`
* **Auth Required:** `AUTH: USER`
* **Description:** Updates user profile fields. If `sellerProfile.displayName` or `sellerProfile.avatarUrl` is modified, enqueues a BullMQ job (`snapshot_sync_queue`) to update `sellerSnapshot` across the user's active listings.

#### Request Body (All fields optional)
```json
{
  "displayName": "Tanvir Rahman",
  "bio": "Authentic Apple gadgets and accessories seller in Gulshan 2.",
  "businessName": "TR Gadgets",
  "avatarUrl": "https://cdn.bechakena.com/avatars/user01.webp",
  "manualLocation": {
    "division": "Dhaka",
    "district": "Dhaka",
    "thana": "Gulshan"
  },
  "location": {
    "longitude": 90.4125,
    "latitude": 23.8103
  },
  "fcmToken": "fcm_token_string_xyz",
  "notificationPrefs": {
    "newMessage": true,
    "offerUpdates": true,
    "listingExpiry": true,
    "dealConfirmation": true
  },
  "accountPin": "739204"
}
```
* **Validation:**
  * `displayName`: 3–50 chars, no URLs or phone numbers.
  * `bio`: Max 500 chars, no URLs or phone numbers.
  * `location`: `latitude` in `[20.34, 26.64]`, `longitude` in `[88.01, 92.67]` (`VAL` Bangladesh GPS bounds).

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "updated": true,
    "snapshotSyncQueued": true
  }
}
```

---

### 4.3 Get Public Seller Profile & Trust Card
* **Endpoint:** `GET /api/v1/users/:id/public-profile`
* **Auth Required:** `PUBLIC`
* **Description:** Returns public-safe seller profile (never exposes `phoneNumber`, `deviceIds`, or NID data). If `trustScore === 0.0` and `completedDealsCount === 0`, returns `badgeLabel: "New Seller"`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890user01",
    "displayName": "Tanvir Rahman",
    "bio": "Authentic Apple gadgets and accessories seller in Gulshan 2.",
    "businessName": null,
    "avatarUrl": "https://cdn.bechakena.com/avatars/user01.webp",
    "isSellerVerified": true,
    "verificationBadge": "NID_VERIFIED",
    "trustScore": 4.8,
    "badgeLabel": "4.8 ★",
    "completedDealsCount": 14,
    "memberSince": "2025-11-01T08:00:00.000Z",
    "thana": "Gulshan",
    "district": "Dhaka"
  }
}
```

---

### 4.4 Soft-Delete User Account (`FR-AUTH-04`)
* **Endpoint:** `DELETE /api/v1/users/me`
* **Auth Required:** `AUTH: USER`
* **Description:** Atomically sets `users.status = 'deleted'`, `users.deletedAt = now`, soft-deletes all active listings (`listings.status = 'deleted'`), and locks all open chat threads (`isLocked = true`, `lockReason = 'USER_ACCOUNT_CLOSED'`). Retains `canonicalNidHash` and `phone_reveal_logs` for 90-day compliance audit.

#### Request Body
```json
{
  "reason": "No longer need the account",
  "confirmDelete": true
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "status": "deleted",
    "deletedAt": "2026-11-17T13:30:00.000Z"
  }
}
```

---

## 5. Domain 3: e-KYC Verification Pipeline (`/kyc`)

---

### 5.1 Generate 5-Minute Pre-Signed PUT URLs for Private R2 Bucket (`FR-KYC-04`)
* **Endpoint:** `POST /api/v1/kyc/upload-urls`
* **Auth Required:** `AUTH: USER`
* **Description:** Generates short-lived (300s) S3-compatible pre-signed PUT URLs for Cloudflare R2 Private Bucket (`ACL: private`, `SSE-AES256`) so sensitive NID and liveness selfie images upload directly from client to private cloud storage without touching Express disk/logs.

#### Request Body
```json
{
  "files": {
    "frontMimeType": "image/jpeg",
    "backMimeType": "image/jpeg",
    "selfieMimeType": "image/jpeg"
  }
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "expiresInSeconds": 300,
    "uploads": {
      "front": {
        "uploadUrl": "https://r2-private.bechakena.com/kyc/6735e0a0.../front.enc?X-Amz-Signature=...",
        "storageKey": "kyc/6735e0a01234567890user01/front_8f9a.enc"
      },
      "back": {
        "uploadUrl": "https://r2-private.bechakena.com/kyc/6735e0a0.../back.enc?X-Amz-Signature=...",
        "storageKey": "kyc/6735e0a01234567890user01/back_8f9a.enc"
      },
      "selfie": {
        "uploadUrl": "https://r2-private.bechakena.com/kyc/6735e0a0.../selfie.enc?X-Amz-Signature=...",
        "storageKey": "kyc/6735e0a01234567890user01/selfie_8f9a.enc"
      }
    }
  }
}
```

---

### 5.2 Submit e-KYC for Porichoy Verification (`FR-KYC-01`, `FR-KYC-02`, `FR-KYC-03`)
* **Endpoint:** `POST /api/v1/kyc/submit`
* **Auth Required:** `AUTH: USER` (`Idempotency-Key` header required)
* **Description:**
  1. Validates NID format (`10`, `13`, or `17` digits) and age rules (`ADULT_SELF` $\ge 18$; `MINOR_GUARDIAN` seller $< 18$, guardian $\ge 18$ or $\ge 21$ if non-parent, max 2 minor accounts per guardian NID).
  2. Queries **Porichoy API** via Circuit Breaker, resolves canonical 10-digit Smart NID, computes `canonicalNidHash = HMAC-SHA-256(smartNid)` and `compositeDobHash = HMAC-SHA-256(dob + normalizedName)`.
  3. Checks uniqueness of `canonicalNidHash` in `identity_verifications`.
  4. Evaluates liveness/face match score:
     * $\ge 80\%$: Auto-approves (`status: 'verified'`, sets `users.sellerProfile.isSellerVerified = true`).
     * $50\% - 79\%$ or Porichoy timeout: Routes to `manual_review` (< 4h SLA).
     * $< 50\%$: Rejects (`status: 'rejected'`).

#### Request Body
```json
{
  "verificationType": "ADULT_SELF",
  "nidNumber": "1995269123456",
  "fullName": "Tanvir Rahman",
  "dob": "1995-04-12",
  "guardianName": null,
  "guardianRelationship": null,
  "storageKeys": {
    "frontKey": "kyc/6735e0a01234567890user01/front_8f9a.enc",
    "backKey": "kyc/6735e0a01234567890user01/back_8f9a.enc",
    "selfieKey": "kyc/6735e0a01234567890user01/selfie_8f9a.enc"
  }
}
```
* **Validation:**
  * `verificationType`: `'ADULT_SELF' | 'MINOR_GUARDIAN'`
  * `nidNumber`: Regex `^(\d{10}|\d{13}|\d{17})$`
  * `guardianRelationship`: Required if `MINOR_GUARDIAN` (`'FATHER' | 'MOTHER' | 'LEGAL_GUARDIAN'`).

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "verificationId": "6735e0a01234567890kyc001",
    "status": "verified",
    "isSellerVerified": true,
    "livenessScore": 91.5,
    "message": "Verified! You can now post up to 5 free listings.",
    "verifiedAt": "2026-11-17T13:40:00.000Z"
  }
}
```

---

### 5.3 Get Current User's e-KYC Status
* **Endpoint:** `GET /api/v1/kyc/status`
* **Auth Required:** `AUTH: USER`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "verificationId": "6735e0a01234567890kyc001",
    "verificationType": "ADULT_SELF",
    "status": "verified",
    "isSellerVerified": true,
    "rejectionReason": null,
    "submittedAt": "2026-11-17T13:39:50.000Z",
    "verifiedAt": "2026-11-17T13:40:00.000Z"
  }
}
```

---

### 5.4 Upgrade Minor-Guardian Account to Adult Self-NID (`FR-KYC-01`)
* **Endpoint:** `POST /api/v1/kyc/upgrade-adult`
* **Auth Required:** `AUTH: VERIFIED_SELLER` (Must currently hold `verificationType === 'MINOR_GUARDIAN'`)
* **Description:** Allows an under-18 seller who has turned 18 and obtained their own Smart NID to verify their own identity, detaching their account from their parent/guardian's 2-minor quota slot while preserving their `trustScore` and `completedDealsCount`.

#### Request Body
```json
{
  "nidNumber": "2008269988776",
  "fullName": "Arafat Rahman",
  "dob": "2008-05-10",
  "storageKeys": {
    "frontKey": "kyc/6735e0a01234567890user05/adult_front.enc",
    "backKey": "kyc/6735e0a01234567890user05/adult_back.enc",
    "selfieKey": "kyc/6735e0a01234567890user05/adult_selfie.enc"
  }
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "verificationType": "ADULT_SELF",
    "status": "verified",
    "detachedFromGuardian": true
  }
}
```

---

## 6. Domain 4: Category Taxonomy & Geolocation (`/categories`, `/geo`)

---

### 6.1 Get Full 3-Level Category Taxonomy Tree (`FR-CAT-01..03`)
* **Endpoint:** `GET /api/v1/categories`
* **Auth Required:** `PUBLIC` (Served from Redis cache `categories:tree` with 1-hour TTL)

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "_id": "6735e0a01234567890cat000",
      "name": "Electronics",
      "slug": "electronics",
      "level": 1,
      "parentId": null,
      "minPriceBDT": 100,
      "maxPriceBDT": null,
      "iconUrl": "https://cdn.bechakena.com/icons/electronics.svg",
      "sortOrder": 1,
      "children": [
        {
          "_id": "6735e0a01234567890cat001",
          "name": "Mobiles & Tablets",
          "slug": "mobiles-tablets",
          "level": 2,
          "parentId": "6735e0a01234567890cat000",
          "minPriceBDT": 500,
          "maxPriceBDT": 500000,
          "attributeSchema": [
            {
              "key": "brand",
              "label": "Brand",
              "type": "select",
              "options": ["Apple", "Samsung", "Xiaomi", "Realme", "OnePlus", "Vivo", "Other"],
              "required": true
            },
            {
              "key": "storageGB",
              "label": "Internal Storage",
              "type": "select",
              "options": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"],
              "required": true
            },
            {
              "key": "ramGB",
              "label": "RAM",
              "type": "select",
              "options": ["2GB", "4GB", "6GB", "8GB", "12GB", "16GB"],
              "required": false
            }
          ]
        }
      ]
    }
  ]
}
```

---

### 6.2 Get Single Category by Slug
* **Endpoint:** `GET /api/v1/categories/:slug`
* **Auth Required:** `PUBLIC`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890cat001",
    "name": "Mobiles & Tablets",
    "slug": "mobiles-tablets",
    "level": 2,
    "parentId": "6735e0a01234567890cat000",
    "minPriceBDT": 500,
    "maxPriceBDT": 500000,
    "attributeSchema": [ ... ]
  }
}
```

---

### 6.3 Get Bangladesh Divisions, Districts & Thana Centroids (`FR-GEO-01`)
* **Endpoint:** `GET /api/v1/geo/locations`
* **Auth Required:** `PUBLIC`
* **Query Parameters:**
  * `division` (optional): Filter districts by division name.
  * `district` (optional): Filter thanas by district name.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "divisions": [
      {
        "name": "Dhaka",
        "districts": [
          {
            "name": "Dhaka",
            "thanas": [
              {
                "name": "Gulshan",
                "centroid": { "longitude": 90.4125, "latitude": 23.7925 }
              },
              {
                "name": "Dhanmondi",
                "centroid": { "longitude": 90.3742, "latitude": 23.7461 }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

## 7. Domain 5: Media & Image Processing Pipeline (`/media`)

---

### 7.1 Upload & Sanitize Single Listing/Chat Photo (`FR-LST-02`, `SEC-02`)
* **Endpoint:** `POST /api/v1/media/upload-photo`
* **Auth Required:** `AUTH: USER` (Chat image) or `AUTH: VERIFIED_SELLER` (Listing photo)
* **Content-Type:** `multipart/form-data`
* **Description:**
  1. Accepts a single raw image file (up to `10 MB` for listings, `5 MB` for chat).
  2. Verifies **Magic Bytes** (`JPEG`, `PNG`, `WebP`, `HEIC`). Rejects disguised executables/scripts.
  3. Streams buffer through **Sharp** (`sharp(buf).rotate().resize(1200, 1200, { fit: 'inside' }).webp({ quality: 80 })`), stripping **100% of EXIF GPS coordinates and camera metadata** and compressing to `< 300 KB` WebP.
  4. Uploads to Cloudflare R2 Public CDN Bucket and enqueues `image_ocr_scan_queue` to detect written phone numbers.

#### Request Body (`multipart/form-data`)
* `file`: Binary image file (`JPEG | PNG | WebP | HEIC`).
* `purpose`: `'LISTING_PHOTO' | 'CHAT_ATTACHMENT' | 'AVATAR'`.
* `sortOrder`: Integer `0–9` (optional, default `0`).

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "imageId": "6735e0a01234567890img001",
    "r2Key": "listings/temp/6735e0a0_img01.webp",
    "cdnUrl": "https://cdn.bechakena.com/listings/temp/6735e0a0_img01.webp",
    "mimeType": "image/webp",
    "sizeBytes": 184320,
    "exifStripped": true,
    "sortOrder": 0
  }
}
```

---

## 8. Domain 6: Listings, Search & Product Details (`/listings`)

---

### 8.1 Geospatial & Full-Text Search Feed (`FR-GEO-02`, `FR-CAT-03`)
* **Endpoint:** `GET /api/v1/listings`
* **Auth Required:** `PUBLIC`
* **Description:** Executes the MongoDB Atlas Search (`$search`) + `$geoNear` aggregation pipeline defined in `database.md` Section 6.1.
  * Never exposes exact `location.coordinates` or unmasked `contactPhone` (projects masked `+88017XX-XXXXXX` and `distanceKm` rounded to 1 decimal).
  * **Auto-Radius Expansion (`FR-GEO-02`):** If `radiusKm` (`2` or `5`) returns `0` matches, automatically re-queries at the next tier (`10` or `25` km) and sets `meta.expandedRadiusKm`.

#### Query Parameters
| Parameter | Type | Default | Description |
|:---|:---:|:---:|:---|
| `q` | `string` | `null` | Full-text fuzzy search query on `title` & `description`. |
| `categorySlug` | `string` | `null` | Filter by category or subcategory slug. |
| `lat` | `number` | `23.8103` | Buyer GPS latitude (`[20.34, 26.64]`). |
| `lng` | `number` | `90.4125` | Buyer GPS longitude (`[88.01, 92.67]`). |
| `radiusKm` | `number` | `10` | Proximity radius: `2`, `5`, `10`, `25`, or `0` (All Bangladesh). |
| `division` | `string` | `null` | Manual location filter when GPS is not used. |
| `district` | `string` | `null` | Manual district filter. |
| `thana` | `string` | `null` | Manual thana filter. |
| `condition` | `string` | `null` | `'new' \| 'used_like_new' \| 'used_good' \| 'used_fair' \| 'free'`. |
| `minPrice` | `number` | `null` | Minimum price in BDT. |
| `maxPrice` | `number` | `null` | Maximum price in BDT. |
| `attributes` | `JSON string`| `null` | URL-encoded JSON attribute filter e.g. `{"brand":"Apple","storageGB":"128GB"}`. |
| `sort` | `string` | `'nearest'`| `'nearest' \| 'newest' \| 'price_asc' \| 'price_desc'`. |
| `cursor` | `string` | `null` | Opaque base64 pagination cursor. |
| `limit` | `number` | `20` | Results per page (Max `40`). |

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "_id": "6735e0a01234567890list01",
      "title": "iPhone 13 Pro 128GB Sierra Blue",
      "price": 68000,
      "condition": "used_like_new",
      "isNegotiable": true,
      "coverImageUrl": "https://cdn.bechakena.com/listings/list01/img01.webp",
      "images": [
        {
          "cdnUrl": "https://cdn.bechakena.com/listings/list01/img01.webp",
          "sortOrder": 0
        }
      ],
      "address": {
        "division": "Dhaka",
        "district": "Dhaka",
        "thana": "Gulshan"
      },
      "distanceKm": 1.8,
      "maskedPhone": "+88017XX-XXXXXX",
      "sellerSnapshot": {
        "displayName": "Tanvir Rahman",
        "isSellerVerified": true,
        "trustScore": 4.8,
        "avatarUrl": "https://cdn.bechakena.com/avatars/user01.webp"
      },
      "createdAt": "2026-11-14T12:00:00.000Z"
    }
  ],
  "meta": {
    "nextCursor": "eyJkaXN0YW5jZSI6MS44LCJfaWQiOiI2NzM1ZTBhMDEyMzQ1Njc4OTBsaXN0MDEifQ==",
    "hasMore": true,
    "expandedRadiusKm": null
  }
}
```

---

### 8.2 Get Product Details Page (PDP) (`FR-PDP-01`)
* **Endpoint:** `GET /api/v1/listings/:id`
* **Auth Required:** `PUBLIC` (If authenticated and `req.user.id !== sellerId`, increments Redis counter `INCR views:{listingId}`)
* **Description:** Returns complete product details, dynamic attributes, rounded distance, and Seller Trust Card.
  * If `status` is `'sold'` or `'deleted'`, returns `410 Gone` (`LISTING_UNAVAILABLE`).
  * `contactPhone` is always masked (`+88017XX-XXXXXX`) in this response.
  * Sets `isOwner: true` if the requester is the listing creator so UI renders *"Edit Listing"* instead of buyer contact buttons.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890list01",
    "sellerId": "6735e0a01234567890user01",
    "categoryId": "6735e0a01234567890cat001",
    "title": "iPhone 13 Pro 128GB Sierra Blue",
    "description": "Mint condition with original box, cable, and money receipt. Battery health 86%. Never repaired.",
    "condition": "used_like_new",
    "price": 68000,
    "isNegotiable": true,
    "maskedPhone": "+88017XX-XXXXXX",
    "address": {
      "division": "Dhaka",
      "district": "Dhaka",
      "thana": "Gulshan"
    },
    "distanceKm": 2.4,
    "attributes": {
      "brand": "Apple",
      "model": "iPhone 13 Pro",
      "storageGB": "128GB",
      "batteryHealth": 86
    },
    "images": [
      {
        "cdnUrl": "https://cdn.bechakena.com/listings/list01/img01.webp",
        "r2Key": "listings/list01/img01.webp",
        "sortOrder": 0
      },
      {
        "cdnUrl": "https://cdn.bechakena.com/listings/list01/img02.webp",
        "r2Key": "listings/list01/img02.webp",
        "sortOrder": 1
      }
    ],
    "coverImageUrl": "https://cdn.bechakena.com/listings/list01/img01.webp",
    "sellerSnapshot": {
      "displayName": "Tanvir Rahman",
      "isSellerVerified": true,
      "trustScore": 4.8,
      "avatarUrl": "https://cdn.bechakena.com/avatars/user01.webp"
    },
    "status": "active",
    "viewsCount": 143,
    "isOwner": false,
    "expiresAt": "2026-12-14T12:00:00.000Z",
    "createdAt": "2026-11-14T12:00:00.000Z"
  }
}
```

---

### 8.3 Click-to-Reveal Seller Phone Number (`FR-PDP-02`)
* **Endpoint:** `POST /api/v1/listings/:id/reveal-phone`
* **Auth Required:** `AUTH: USER` (`X-Device-Id` header required)
* **Description:**
  1. Blocks self-reveal (`buyerId === listing.sellerId` $\rightarrow$ `403 SELF_INTERACTION_BLOCKED`).
  2. **7-Day Re-View Exception:** Queries `phone_reveal_logs` for `{ buyerId, listingId, revealedAt: { $gte: now - 7d } }`. If found, returns `listing.contactPhone` immediately **without incrementing rate-limit counters**.
  3. **Sliding-Window Rate Limit:** Enforces max **5 reveals/hour** and **20 reveals/day** per `userId`, **10/hr** per `deviceId`, and **30/hr** per `/24` IP subnet.
  4. Inserts audit document into `phone_reveal_logs` (90-day TTL) and returns unmasked `contactPhone`.

#### Request Body
*(Empty JSON `{}`)*

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "listingId": "6735e0a01234567890list01",
    "contactPhone": "+8801711223344",
    "telUri": "tel:+8801711223344",
    "isRepeatRevealFree": false,
    "remainingHourlyQuota": 4,
    "remainingDailyQuota": 19,
    "safetyWarning": "Never send money in advance via bKash/Nagad for delivery. Always inspect the item in person."
  }
}
```

---

### 8.4 Create New Listing (`FR-LST-01`, `FR-LST-02`, `FR-LST-06`)
* **Endpoint:** `POST /api/v1/listings`
* **Auth Required:** `AUTH: VERIFIED_SELLER` (`Idempotency-Key` header required)
* **Description:** Executes the multi-document ACID transaction `publishListingAtomic` (`database.md` Section 7.1):
  1. Validates `title` (5–100 chars) and `description` (20–2,000 chars) against embedded phone numbers and URLs (`VAL-03`).
  2. Validates `price` against `category.minPriceBDT` (`VAL-02`), or enforces `price === 0` if `condition === 'free'`.
  3. Atomically increments `users.activeListingCount` if and only if `activeListingCount < 5` and `isSellerVerified === true`.
  4. Inserts the `listings` document with embedded `images`, `coverImageUrl`, and `sellerSnapshot`, plus links records in `listing_images`.

#### Request Body
```json
{
  "categoryId": "6735e0a01234567890cat001",
  "title": "iPhone 13 Pro 128GB Sierra Blue",
  "description": "Mint condition with original box, cable, and money receipt. Battery health 86%. Never repaired. Face ID fully functional.",
  "condition": "used_like_new",
  "price": 68000,
  "isNegotiable": true,
  "contactPhone": "+8801711223344",
  "location": {
    "longitude": 90.4125,
    "latitude": 23.8103
  },
  "address": {
    "division": "Dhaka",
    "district": "Dhaka",
    "thana": "Gulshan"
  },
  "attributes": {
    "brand": "Apple",
    "model": "iPhone 13 Pro",
    "storageGB": "128GB",
    "batteryHealth": 86
  },
  "images": [
    {
      "imageId": "6735e0a01234567890img001",
      "cdnUrl": "https://cdn.bechakena.com/listings/list01/img01.webp",
      "r2Key": "listings/list01/img01.webp",
      "sortOrder": 0
    },
    {
      "imageId": "6735e0a01234567890img002",
      "cdnUrl": "https://cdn.bechakena.com/listings/list01/img02.webp",
      "r2Key": "listings/list01/img02.webp",
      "sortOrder": 1
    }
  ]
}
```
* **Validation:**
  * `images`: Array of `2` to `10` uploaded WebP images (`VAL`).
  * `contactPhone`: Defaults to `users.phoneNumber` if omitted; must match `^\+8801[3-9]\d{8}$` (`FR-LST-06`).

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890list01",
    "status": "active",
    "activeListingCount": 4,
    "remainingQuota": 1,
    "expiresAt": "2026-12-17T13:45:00.000Z"
  }
}
```

---

### 8.5 Edit Listing & Bait-and-Switch Re-Moderation (`FR-LST-03`)
* **Endpoint:** `PATCH /api/v1/listings/:id`
* **Auth Required:** `AUTH: VERIFIED_SELLER` (Must be listing owner; listing must not be `'sold'` or `'deleted'`)
* **Description:** Updates listing fields. If **Title**, **Category**, **Images**, or **Price (>30% delta)** is modified, transitions `status` to `'under_review'` and enqueues a fast-track BullMQ moderation job (< 5 min auto-clearance, or < 2h human review if flagged).

#### Request Body (Partial update)
```json
{
  "price": 65000,
  "description": "Price dropped for quick sale! Mint condition with original box and cable. Battery health 86%.",
  "isNegotiable": false
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890list01",
    "status": "active",
    "triggeredReModeration": false,
    "message": "Listing updated successfully."
  }
}
```

---

### 8.6 Soft-Delete Listing & Lock Linked Chats (`FR-LST-04`)
* **Endpoint:** `DELETE /api/v1/listings/:id`
* **Auth Required:** `AUTH: VERIFIED_SELLER` (Must be listing owner)
* **Description:** Runs an ACID transaction:
  1. Sets `listings.status = 'deleted'` and `deletedAt = now`.
  2. Decrements `users.activeListingCount` by `1` (freeing the seller's quota slot immediately).
  3. Updates all linked `chat_threads` (`isLocked = true`, `lockReason = 'LISTING_DELETED_BY_SELLER'`) and inserts a `SYSTEM` message: *"This listing has been removed by the seller."*

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890list01",
    "status": "deleted",
    "activeListingCount": 3,
    "lockedChatThreadsCount": 2
  }
}
```

---

### 8.7 1-Click 30-Day Listing Renewal (`FR-LST-05`)
* **Endpoint:** `POST /api/v1/listings/:id/renew`
* **Auth Required:** `AUTH: VERIFIED_SELLER` (Must be listing owner)
* **Description:** Renews an `'expired'` (or expiring within 3 days) listing for another 30 days (`expiresAt = now + 30d`). If the listing was `'expired'`, atomically checks `users.activeListingCount < 5` and increments it by `1`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890list01",
    "status": "active",
    "expiresAt": "2026-12-17T14:00:00.000Z",
    "activeListingCount": 4
  }
}
```

---

## 9. Domain 7: Seller Dashboard & Deal Attribution (`/seller`, `/listings/:id`)

---

### 9.1 Get Seller Dashboard KPIs & Listings (`S-04`)
* **Endpoint:** `GET /api/v1/seller/dashboard`
* **Auth Required:** `AUTH: VERIFIED_SELLER`
* **Query Parameters:**
  * `tab`: `'active' | 'under_review' | 'reserved' | 'sold' | 'expired'` (Default: `'active'`).
  * `cursor`: Pagination cursor.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "quota": {
      "activeListingCount": 3,
      "maxAllowed": 5,
      "remainingSlots": 2
    },
    "kpis": {
      "totalViews30d": 1240,
      "totalPhoneReveals30d": 38,
      "activeChatThreads": 6,
      "completedDealsCount": 14,
      "trustScore": 4.8
    },
    "listings": [
      {
        "_id": "6735e0a01234567890list01",
        "title": "iPhone 13 Pro 128GB Sierra Blue",
        "price": 68000,
        "status": "active",
        "coverImageUrl": "https://cdn.bechakena.com/listings/list01/img01.webp",
        "viewsCount": 143,
        "expiresAt": "2026-12-14T12:00:00.000Z",
        "createdAt": "2026-11-14T12:00:00.000Z"
      }
    ]
  },
  "meta": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

### 9.2 Get Eligible Buyers for "Mark as Sold" (`FR-MOD-01`)
* **Endpoint:** `GET /api/v1/listings/:id/eligible-buyers`
* **Auth Required:** `AUTH: VERIFIED_SELLER` (Must be listing owner)
* **Description:** Aggregates candidate buyers who either (a) have an active `chat_threads` document on this listing, OR (b) revealed the seller's phone number via `phone_reveal_logs` on this listing.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "candidates": [
      {
        "buyerId": "6735e0a01234567890buyer09",
        "displayName": "Mahmudul Hasan",
        "avatarUrl": null,
        "interactionType": "CHAT_AND_OFFER",
        "lastInteractionAt": "2026-11-16T18:20:00.000Z",
        "acceptedOfferAmount": 65000
      },
      {
        "buyerId": "6735e0a01234567890buyer12",
        "displayName": "Sabbir Ahmed",
        "avatarUrl": null,
        "interactionType": "PHONE_REVEAL",
        "lastInteractionAt": "2026-11-15T11:10:00.000Z",
        "acceptedOfferAmount": null
      }
    ]
  }
}
```

---

### 9.3 Mark Listing as Sold (`FR-MOD-01`)
* **Endpoint:** `POST /api/v1/listings/:id/mark-sold`
* **Auth Required:** `AUTH: VERIFIED_SELLER` (Must be listing owner)
* **Description:** Runs an ACID transaction:
  1. Sets `listings.status = 'sold'`, `soldToBuyerId = buyerId`, `soldAt = now`.
  2. Decrements `users.activeListingCount` by `1` (freeing the seller's active listing slot).
  3. Locks linked `chat_threads` (`isLocked = true`, `lockReason = 'ITEM_SOLD'`) and sends a push/in-app notification to `soldToBuyerId` prompting them to confirm the purchase.

#### Request Body
```json
{
  "buyerId": "6735e0a01234567890buyer09",
  "finalPriceBDT": 65000
}
```
* **Validation:** `buyerId` must exist in either `chat_threads` or `phone_reveal_logs` for this `listingId` (`buyerId !== sellerId`).

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890list01",
    "status": "sold",
    "soldToBuyerId": "6735e0a01234567890buyer09",
    "soldAt": "2026-11-17T14:10:00.000Z",
    "activeListingCount": 2,
    "buyerConfirmationSent": true
  }
}
```

---

### 9.4 Buyer Confirms Purchase (`FR-MOD-01`)
* **Endpoint:** `POST /api/v1/listings/:id/confirm-purchase`
* **Auth Required:** `AUTH: USER` (Must match `listings.soldToBuyerId`)
* **Description:** Sets `listings.dealConfirmedByBuyer = true`, increments `users.completedDealsCount` by `1` for the seller, and unlocks the 48-hour verified review submission window.

#### Request Body
```json
{
  "confirmed": true
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "listingId": "6735e0a01234567890list01",
    "dealConfirmedByBuyer": true,
    "canSubmitReview": true,
    "reviewWindowExpiresAt": "2026-11-19T14:15:00.000Z"
  }
}
```

---

## 10. Domain 8: Real-Time Chat & Atomic Offer Negotiation (`/chats` & Socket.io)

---

### 10.1 Find or Create 1-to-1 Chat Thread (`FR-CHT-04`)
* **Endpoint:** `POST /api/v1/chats/threads`
* **Auth Required:** `AUTH: USER`
* **Description:** Enforces the **1-Thread-Per-Buyer-Per-Listing** rule (`{ listingId: 1, buyerId: 1 }` unique index). If a thread already exists between `req.user.id` and `listingId`, returns the existing thread; otherwise creates a new `chat_threads` document with `listingSnapshot`. Blocks self-chat (`buyerId === sellerId`).

#### Request Body
```json
{
  "listingId": "6735e0a01234567890list01"
}
```

#### Response (`200 OK` or `201 Created`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890thrd01",
    "listingId": "6735e0a01234567890list01",
    "buyerId": "6735e0a01234567890buyer09",
    "sellerId": "6735e0a01234567890user01",
    "listingSnapshot": {
      "title": "iPhone 13 Pro 128GB Sierra Blue",
      "price": 68000,
      "thumbnail": "https://cdn.bechakena.com/listings/list01/img01.webp",
      "status": "active"
    },
    "currentOffer": null,
    "isLocked": false,
    "createdAt": "2026-11-17T14:20:00.000Z"
  }
}
```

---

### 10.2 Get Cursor-Paginated Chat Inbox
* **Endpoint:** `GET /api/v1/chats/threads`
* **Auth Required:** `AUTH: USER`
* **Query Parameters:**
  * `role`: `'buying' | 'selling' | 'all'` (Default: `'all'`).
  * `cursor`: Pagination cursor based on `updatedAt`.
  * `limit`: Default `20`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "_id": "6735e0a01234567890thrd01",
      "listingId": "6735e0a01234567890list01",
      "buyerId": "6735e0a01234567890buyer09",
      "sellerId": "6735e0a01234567890user01",
      "listingSnapshot": {
        "title": "iPhone 13 Pro 128GB Sierra Blue",
        "price": 68000,
        "thumbnail": "https://cdn.bechakena.com/listings/list01/img01.webp",
        "status": "active"
      },
      "lastMessage": {
        "body": "Is the original box included?",
        "senderId": "6735e0a01234567890buyer09",
        "createdAt": "2026-11-17T14:22:00.000Z"
      },
      "unreadCountBuyer": 0,
      "unreadCountSeller": 1,
      "currentOffer": {
        "offerId": "6735e0a01234567890offr01",
        "amount": 64000,
        "proposedBy": "6735e0a01234567890buyer09",
        "status": "pending",
        "expiresAt": "2026-11-20T14:22:00.000Z"
      },
      "isLocked": false,
      "updatedAt": "2026-11-17T14:22:00.000Z"
    }
  ],
  "meta": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

### 10.3 Get Message History in a Thread
* **Endpoint:** `GET /api/v1/chats/threads/:id/messages`
* **Auth Required:** `AUTH: USER` (Must be `buyerId` or `sellerId` of the thread)
* **Description:** Returns cursor-paginated messages sorted by `createdAt: -1` and resets the caller's unread counter (`unreadCountBuyer` or `unreadCountSeller`) to `0`.

#### Query Parameters
* `cursor`: Last message `createdAt` + `_id` cursor.
* `limit`: Default `30`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "_id": "6735e0a01234567890msg002",
      "threadId": "6735e0a01234567890thrd01",
      "clientMessageId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "senderId": "6735e0a01234567890buyer09",
      "type": "OFFER",
      "body": "Proposed an offer of 64,000 BDT",
      "mediaUrl": null,
      "offerAmount": 64000,
      "moderationFlag": "CLEAN",
      "readAt": "2026-11-17T14:25:00.000Z",
      "createdAt": "2026-11-17T14:22:00.000Z"
    }
  ],
  "meta": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

### 10.4 Send Chat Message or Propose Formal Offer (`FR-CHT-01`, `FR-CHT-02`, `FR-CHT-04`)
* **Endpoint:** `POST /api/v1/chats/threads/:id/messages`
* **Auth Required:** `AUTH: USER` (Must be thread participant; thread must have `isLocked === false`)
* **Description:**
  1. Deduplicates retries using unique compound index `{ threadId: 1, clientMessageId: 1 }`.
  2. Runs synchronous `<5ms` **Chat Safety Filter**:
     * **Hard Block (`400 PROHIBITED_CONTENT_DETECTED`):** Rejects external URLs (`http`, `.com`, `wa.me`, `t.me`, `[dot]`) and multi-lingual profanity (`\b` word-boundary matched).
     * **Soft Warning:** If `body` contains financial/courier keywords (`bKash`, `Nagad`, `Rocket`, `advance`, `courier`), sets `moderationFlag = 'SCAM_WARNING'`.
  3. If `type === 'OFFER'`, validates `offerAmount` is between `10%` and `150%` of `listingSnapshot.price` (`VAL`), updates `chat_threads.currentOffer` with `expiresAt = now + 72h`, and emits Socket.io event `new_message` to the room.

#### Request Body
```json
{
  "clientMessageId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "type": "OFFER",
  "body": "Can we close the deal at 64,000 BDT? I can meet in Gulshan 2 today.",
  "mediaUrl": null,
  "offerAmount": 64000
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890msg002",
    "threadId": "6735e0a01234567890thrd01",
    "clientMessageId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "senderId": "6735e0a01234567890buyer09",
    "type": "OFFER",
    "body": "Can we close the deal at 64,000 BDT? I can meet in Gulshan 2 today.",
    "mediaUrl": null,
    "offerAmount": 64000,
    "moderationFlag": "CLEAN",
    "currentOffer": {
      "offerId": "6735e0a01234567890offr01",
      "amount": 64000,
      "proposedBy": "6735e0a01234567890buyer09",
      "status": "pending",
      "expiresAt": "2026-11-20T14:22:00.000Z"
    },
    "createdAt": "2026-11-17T14:22:00.000Z"
  }
}
```

---

### 10.5 Accept, Reject, or Counter a Formal Offer (`FR-CHT-03`)
* **Endpoint:** `POST /api/v1/chats/threads/:id/offers/:offerId/respond`
* **Auth Required:** `AUTH: USER` (Must be the recipient of the pending offer)
* **Description:**
  * If `action === 'ACCEPT'`: Executes the ACID transaction `acceptOfferAtomic` (`database.md` Section 7.2) using optimistic concurrency lock `{ _id: listingId, status: 'active', __v: expectedListingVersion }`.
    1. Transitions `listings.status` to `'reserved'`, sets `reservedBuyerId = buyerId`, increments `__v`.
    2. Sets `currentOffer.status = 'accepted'` in the current thread.
    3. Marks all competing pending offers on other threads for the same listing as `'superseded'`.
    4. If a concurrent accept already succeeded, aborts transaction and returns `409 CONFLICT_409`.
  * If `action === 'REJECT'`: Sets `currentOffer.status = 'rejected'`.
  * If `action === 'COUNTER'`: Replaces `currentOffer` with the new counter amount (`expiresAt = now + 72h`).

#### Request Body
```json
{
  "action": "ACCEPT",
  "expectedListingVersion": 0,
  "counterAmount": null
}
```
* **Validation:**
  * `action`: `'ACCEPT' | 'REJECT' | 'COUNTER'`.
  * `expectedListingVersion`: Integer (`__v`), required when `action === 'ACCEPT'`.
  * `counterAmount`: Number (`10%–150%` of listing price), required when `action === 'COUNTER'`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "threadId": "6735e0a01234567890thrd01",
    "offerId": "6735e0a01234567890offr01",
    "offerStatus": "accepted",
    "listingStatus": "reserved",
    "reservedBuyerId": "6735e0a01234567890buyer09",
    "newListingVersion": 1
  }
}
```

---

### 10.6 WebSocket (Socket.io) Real-Time Events Contract
* **Namespace:** `/chat` (Authenticated via `bk_access_token` HttpOnly Cookie during handshake)

| Event Name | Direction | Payload Schema | Description |
|:---|:---:|:---|:---|
| `join_thread` | Client $\rightarrow$ Server | `{ "threadId": "6735..." }` | Subscribes socket to thread room after verifying participant membership. |
| `send_message` | Client $\rightarrow$ Server | `{ "threadId", "clientMessageId", "type", "body", "mediaUrl", "offerAmount" }` | Real-time message/offer dispatch with ACK callback. |
| `new_message` | Server $\rightarrow$ Client | `IChatMessage` JSON object | Broadcasts sanitized message & `moderationFlag` to thread participants. |
| `offer_updated` | Server $\rightarrow$ Client | `{ "threadId", "currentOffer", "listingStatus" }` | Notifies participants of accepted, rejected, counter, or superseded offers. |
| `thread_locked` | Server $\rightarrow$ Client | `{ "threadId", "isLocked": true, "lockReason" }` | Emitted immediately when a listing is deleted or marked sold. |

---

## 11. Domain 9: Verified Reviews & Social Proof (`/reviews`)

---

### 11.1 Submit Verified Deal Review (`FR-MOD-01`, `FR-MOD-03`)
* **Endpoint:** `POST /api/v1/listings/:id/reviews`
* **Auth Required:** `AUTH: USER` (Must be `listings.soldToBuyerId` AND `listings.dealConfirmedByBuyer === true`)
* **Description:** Creates a `reviews` document (strictly 1 review per listing enforced via unique index `{ listingId: 1, reviewerId: 1 }`), sets `editableUntil = now + 48 hours`, and enqueues a BullMQ job on `trust_score_recalc_queue` to asynchronously recompute the seller's `trustScore`.

#### Request Body
```json
{
  "rating": 5,
  "comment": "Phone matched the description 100%. Met in Gulshan 2, very polite and honest seller."
}
```
* **Validation:**
  * `rating`: Integer `1` to `5`.
  * `comment`: `10` to `500` chars, profanity-filtered.

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890revw01",
    "listingId": "6735e0a01234567890list01",
    "reviewerId": "6735e0a01234567890buyer09",
    "revieweeId": "6735e0a01234567890user01",
    "rating": 5,
    "comment": "Phone matched the description 100%. Met in Gulshan 2, very polite and honest seller.",
    "editableUntil": "2026-11-19T14:30:00.000Z",
    "createdAt": "2026-11-17T14:30:00.000Z"
  }
}
```

---

### 11.2 Edit Review Within 48-Hour Window (`FR-MOD-01`)
* **Endpoint:** `PATCH /api/v1/reviews/:id`
* **Auth Required:** `AUTH: USER` (Must be `reviewerId`; rejects with `403` if `now > review.editableUntil`)

#### Request Body
```json
{
  "rating": 4,
  "comment": "Phone is great, battery health was 85% instead of 86%, otherwise smooth deal."
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "_id": "6735e0a01234567890revw01",
    "rating": 4,
    "comment": "Phone is great, battery health was 85% instead of 86%, otherwise smooth deal.",
    "editableUntil": "2026-11-19T14:30:00.000Z",
    "updatedAt": "2026-11-17T16:00:00.000Z"
  }
}
```

---

### 11.3 Get Seller's Public Reviews
* **Endpoint:** `GET /api/v1/users/:id/reviews`
* **Auth Required:** `PUBLIC`
* **Query Parameters:** `cursor`, `limit` (Default `15`).

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "_id": "6735e0a01234567890revw01",
      "listingId": "6735e0a01234567890list01",
      "rating": 5,
      "comment": "Phone matched the description 100%. Met in Gulshan 2, very polite and honest seller.",
      "reviewerDisplayName": "Mahmudul H.",
      "createdAt": "2026-11-17T14:30:00.000Z"
    }
  ],
  "meta": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

---

## 12. Domain 10: Trust & Safety Reports & Ban Appeals (`/reports`, `/appeals`)

---

### 12.1 Submit Abuse or Scam Report (`FR-MOD-02`)
* **Endpoint:** `POST /api/v1/reports`
* **Auth Required:** `AUTH: USER`
* **Description:** Creates a ticket in `reports`. Enforces `{ reporterId: 1, targetId: 1 }` unique index so a user cannot spam duplicate reports on the same target. Server automatically captures an immutable `evidenceSnapshot` (the target listing JSON or the last 10 messages of the chat thread) for 90-day retention.

#### Request Body
```json
{
  "targetType": "MESSAGE",
  "targetId": "6735e0a01234567890msg099",
  "reason": "SCAM_ADVANCE_PAYMENT",
  "description": "Seller is insisting I send 500 BDT courier charge via bKash before seeing the phone."
}
```
* **Validation:**
  * `targetType`: `'LISTING' | 'USER' | 'MESSAGE'`.
  * `reason`: `'SCAM_ADVANCE_PAYMENT' | 'PROFANITY' | 'FAKE_PRODUCT' | 'HARASSMENT' | 'OTHER'`.
  * `description`: 10–1,000 chars.

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "reportId": "6735e0a01234567890rept01",
    "status": "open",
    "evidenceSnapshotCaptured": true,
    "createdAt": "2026-11-17T14:40:00.000Z"
  }
}
```

---

### 12.2 Submit Ban or Suspension Appeal (`FR-MOD-02`)
* **Endpoint:** `POST /api/v1/appeals`
* **Auth Required:** `PUBLIC + TURNSTILE` (Accessible to suspended/banned users via signed ban token or phone OTP verification)

#### Request Body
```json
{
  "userId": "6735e0a01234567890user88",
  "appealReason": "My phone was stolen last week and someone else posted that ad. I have attached my GD copy.",
  "contactEmailOrPhone": "+8801711223344",
  "evidenceKeys": [
    "appeals/6735e0a01234567890user88/police_gd_copy.webp"
  ]
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "appealId": "6735e0a01234567890appl01",
    "status": "pending",
    "submittedAt": "2026-11-17T14:45:00.000Z"
  }
}
```

---

## 13. Domain 11: Internal Admin & Compliance Operations (`/admin`)

> [!IMPORTANT]
> Every state-changing or PII-accessing request in `/api/v1/admin/*` automatically writes an immutable record to `admin_audit_logs` containing `adminId`, `action`, `targetType`, `targetId`, `details`, `ipAddress`, and `userAgent`.

---

### 13.1 Get Manual e-KYC Review Queue (`PERM-03`, `FR-KYC-03`)
* **Endpoint:** `GET /api/v1/admin/kyc-queue`
* **Auth Required:** `AUTH: COMPLIANCE+` (`COMPLIANCE_OFFICER` or `ADMIN_LEAD`)
* **Description:** Lists `identity_verifications` with `status === 'manual_review'`. Generates 15-minute pre-signed GET URLs (`Cache-Control: no-store, private`) for `frontKey`, `backKey`, and `selfieKey` and logs an `ADMIN_KYC_VIEW` entry in `admin_audit_logs`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "_id": "6735e0a01234567890kyc009",
      "userId": "6735e0a01234567890user55",
      "verificationType": "ADULT_SELF",
      "status": "manual_review",
      "livenessScore": 68.4,
      "submittedAt": "2026-11-17T12:00:00.000Z",
      "signedUrls": {
        "frontUrl": "https://r2-private.bechakena.com/kyc/.../front.enc?X-Amz-Expires=900&...",
        "backUrl": "https://r2-private.bechakena.com/kyc/.../back.enc?X-Amz-Expires=900&...",
        "selfieUrl": "https://r2-private.bechakena.com/kyc/.../selfie.enc?X-Amz-Expires=900&..."
      }
    }
  ]
}
```

---

### 13.2 Approve or Reject Manual Review e-KYC (`FR-KYC-03`)
* **Endpoint:** `POST /api/v1/admin/kyc/:id/decision`
* **Auth Required:** `AUTH: COMPLIANCE+`
* **Description:** Updates `identity_verifications.status` to `'verified'` or `'rejected'`, updates `users.sellerProfile.isSellerVerified`, writes an immutable entry to `admin_audit_logs`, and enqueues `kyc_notification_queue`.

#### Request Body
```json
{
  "decision": "APPROVE",
  "reviewNote": "Beard growth caused 68% automated liveness score; manual visual check against Porichoy photo confirmed match.",
  "rejectionReason": null
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "verificationId": "6735e0a01234567890kyc009",
    "status": "verified",
    "auditLogId": "6735e0a01234567890audt01"
  }
}
```

---

### 13.3 Get Moderation Reports Queue (`FR-MOD-02`)
* **Endpoint:** `GET /api/v1/admin/reports`
* **Auth Required:** `AUTH: MODERATOR+`
* **Query Parameters:** `status` (`'open' | 'investigating' | 'resolved' | 'dismissed'`), `cursor`, `limit`.

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "_id": "6735e0a01234567890rept01",
      "reporterId": "6735e0a01234567890buyer09",
      "targetType": "MESSAGE",
      "targetId": "6735e0a01234567890msg099",
      "reason": "SCAM_ADVANCE_PAYMENT",
      "description": "Seller is insisting I send 500 BDT courier charge via bKash before seeing the phone.",
      "evidenceSnapshot": {
        "threadId": "6735e0a01234567890thrd09",
        "messages": [ ... ]
      },
      "status": "open",
      "createdAt": "2026-11-17T14:40:00.000Z"
    }
  ]
}
```

---

### 13.4 Resolve or Dismiss Report & Takedown Violating Listing
* **Endpoint:** `PATCH /api/v1/admin/reports/:id`
* **Auth Required:** `AUTH: MODERATOR+`

#### Request Body
```json
{
  "status": "resolved",
  "actionTaken": "REMOVE_LISTING_AND_WARN_USER",
  "resolutionNote": "Confirmed advance fee request in chat snapshot. Listing removed."
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "reportId": "6735e0a01234567890rept01",
    "status": "resolved",
    "auditLogId": "6735e0a01234567890audt02"
  }
}
```

---

### 13.5 List & Adjudicate Ban Appeals (`FR-MOD-02`)
* **Endpoints:**
  * `GET /api/v1/admin/appeals` (`AUTH: COMPLIANCE+`)
  * `POST /api/v1/admin/appeals/:id/decision` (`AUTH: COMPLIANCE+`)

#### Decision Request Body (`POST /api/v1/admin/appeals/:id/decision`)
```json
{
  "decision": "APPROVE",
  "reviewNote": "Verified police GD copy and SIM replacement record. Reinstating account."
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "appealId": "6735e0a01234567890appl01",
    "status": "approved",
    "userReinstated": true,
    "auditLogId": "6735e0a01234567890audt03"
  }
}
```

---

### 13.6 Execute Global Kill Switch / Permanent User Ban (`PERM-05`, `FR-KYC-01`)
* **Endpoint:** `POST /api/v1/admin/users/:id/ban`
* **Auth Required:** `AUTH: ADMIN_LEAD + 2FA` (`X-Admin-TOTP` header required)
* **Description:**
  1. Verifies hardware/authenticator 6-digit TOTP code.
  2. Sets `users.status = 'banned'`, `bannedAt = now`, `banReason`.
  3. Adds `userId` to Redis Set `banned_users` and deletes all active Redis sessions (`<1ms` global revocation).
  4. **Contamination Rule (`FR-KYC-01`):** If the banned user is a `MINOR_GUARDIAN` account, automatically flags/suspends all linked accounts sharing the same Guardian `canonicalNidHash`.
  5. Synchronously updates all listings by this seller to `status = 'deleted'` and `sellerSnapshot.isSellerVerified = false`.
  6. Writes an immutable audit trail to `admin_audit_logs`.

#### Request Body
```json
{
  "banReason": "CONFIRMED_ADVANCE_FEE_FRAUD",
  "blacklistCanonicalNid": true,
  "blacklistDeviceIds": true,
  "internalEvidenceNote": "Multiple confirmed bKash advance fee scams under Report #6735e0a01234567890rept01."
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "bannedUserId": "6735e0a01234567890user88",
    "status": "banned",
    "redisBlacklisted": true,
    "listingsRemovedCount": 4,
    "linkedMinorAccountsSuspended": 0,
    "auditLogId": "6735e0a01234567890audt04"
  }
}
```

---

### 13.7 Export Forensic Legal Warrant Bundle (`PERM-06`)
* **Endpoint:** `POST /api/v1/admin/warrant-export`
* **Auth Required:** `AUTH: ADMIN_LEAD + 2FA` (`X-Admin-TOTP` header required)
* **Description:** Generates an encrypted forensic compliance archive containing the target user's KYC records, `phone_reveal_logs`, chat transcripts, and IP/device logs for law enforcement requests, and logs `WARRANT_EXPORT` in `admin_audit_logs`.

#### Request Body
```json
{
  "targetUserId": "6735e0a01234567890user88",
  "warrantReferenceNumber": "DMP-CYBER-2026-8841",
  "issuingAuthority": "Dhaka Metropolitan Police - Cyber Crime Unit"
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "exportDownloadUrl": "https://r2-private.bechakena.com/warrants/DMP-CYBER-2026-8841.zip?X-Amz-Expires=300&...",
    "expiresInSeconds": 300,
    "auditLogId": "6735e0a01234567890audt05"
  }
}
```

---

### 13.8 Inspect BullMQ Background Queue Health (`Arch 5.6`)
* **Endpoint:** `GET /api/v1/admin/queue-health`
* **Auth Required:** `AUTH: ADMIN_LEAD`

#### Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "queues": [
      {
        "name": "kyc_notification_queue",
        "waiting": 0,
        "active": 1,
        "failed": 0,
        "deadLetterCount": 0
      },
      {
        "name": "snapshot_sync_queue",
        "waiting": 2,
        "active": 1,
        "failed": 0,
        "deadLetterCount": 0
      },
      {
        "name": "image_ocr_scan_queue",
        "waiting": 5,
        "active": 3,
        "failed": 0,
        "deadLetterCount": 0
      }
    ]
  }
}
```


---

## 14. API Version Control & Lifecycle Strategy

Becha-Kena serves both a **Next.js SSR Web Application** (which updates instantaneously on deployment) and **Android/iOS Mobile Clients** (where users in Bangladesh may remain on older app builds for months due to mobile data constraints). To prevent breaking live clients while iterating rapidly, the platform enforces a dual-layer API and Document Version Control architecture.

---

### 14.1 Versioning Scheme (URI + Header Negotiation)

1. **Major Version in URI Path (`/api/v{major}`):**
   * The primary API contract version is explicitly embedded in the URL prefix: `/api/v1/...`.
   * A new major path (`/api/v2/...`) is introduced **only** when breaking structural changes occur in core domain payloads or authentication flows.
2. **Minor Revision via Request Header (`X-API-Version`):**
   * Clients may optionally send `X-API-Version: 2026-11-17` (date-stamped minor revision) and `X-Client-Platform: web | android | ios` with `X-App-Build: 104`.
   * Every API response echoes the active contract version in the response headers:
     ```http
     X-API-Version: 1.0.0
     X-Min-Supported-Build-Android: 100
     X-Min-Supported-Build-iOS: 100
     ```
3. **Forced Update Gate for Critical Security Patches (`426 Upgrade Required`):**
   * If a mobile client connects with an `X-App-Build` below `X-Min-Supported-Build-*` (e.g., after a critical e-KYC or security update), the API middleware intercepts the request and returns `426 Upgrade Required`, prompting an in-app "Update Required" modal.

---

### 14.2 Backward-Compatible vs. Breaking Changes

| Change Classification | Permitted in `/api/v1`? | Examples |
|:---|:---:|:---|
| **Additive (Non-Breaking)** | ✅ **Yes** | • Adding new optional query parameters or request body fields.<br>• Adding new properties to JSON response objects.<br>• Adding new endpoints (e.g., `GET /api/v1/listings/:id/similar`).<br>• Adding new enum values in informational fields (clients must handle unknown enum strings gracefully). |
| **Breaking Changes** | ❌ **No** *(Requires `/api/v2`)* | • Renaming or removing an existing JSON response field (e.g., changing `coverImageUrl` to `thumbnailUrl`).<br>• Changing a field's data type (e.g., `price: number` $\rightarrow$ `price: { amount, currency }`).<br>• Adding a new **required** request body field without a default server fallback.<br>• Changing authentication requirements or HTTP status codes for existing flows. |

---

### 14.3 Deprecation Policy & Sunset Headers (RFC 8594)

When an `/api/v1` endpoint is scheduled for retirement in favor of `/api/v2`:
1. **90-Day Sunset Window:** Deprecated endpoints remain fully operational for a minimum of **90 days** after the replacement endpoint goes live.
2. **Standard RFC 8594 Response Headers:** All responses from a deprecated route include:
   ```http
   Deprecation: true
   Sunset: Wed, 17 Feb 2027 23:59:59 GMT
   Link: <https://api.bechakena.com/api/v2/listings>; rel="successor-version"
   ```
3. **Observability & Alerting:** Requests hitting deprecated routes are logged with client user-agent and build version in Pino/Datadog so engineering can verify traffic drops below `0.1%` before final removal.

---

### 14.4 Optimistic Document Version Control (`__v` & ETag)

Beyond API contract versioning, Becha-Kena enforces **Data-Level Optimistic Concurrency Control (OCC)** on stateful marketplace documents (`listings` and `chat_threads`) to prevent race conditions:

1. **Mongoose Version Key (`__v`):**
   * Every `listings` document maintains an integer version counter `__v` (starting at `0` and incremented atomically on every state transition).
   * When a seller accepts an offer via `POST /api/v1/chats/threads/:id/offers/:offerId/respond`, the client must pass `"expectedListingVersion": 0`.
   * The database transaction executes:
     ```javascript
     Listing.findOneAndUpdate(
       { _id: listingId, sellerId, status: 'active', __v: expectedListingVersion },
       { $set: { status: 'reserved', reservedBuyerId: buyerId }, $inc: { __v: 1 } }
     )
     ```
   * If another offer was accepted milliseconds earlier (incrementing `__v` to `1`), the query returns `null`, the transaction aborts, and the API responds with `409 CONFLICT_409`.
2. **HTTP `ETag` / `If-None-Match` Caching:**
   * Public read-heavy endpoints (`GET /api/v1/categories`, `GET /api/v1/listings/:id`) emit weak entity tags (`ETag: W/"6735e0a0list01-v2"`).
   * Clients sending `If-None-Match` receive `304 Not Modified` with an empty body when listing data is unchanged, saving up to 85% mobile bandwidth on 3G/4G networks.

---

### 14.5 API Specification Version History (Changelog)

| Spec Version | Date | Author | Alignment Reference | Summary of Changes |
|:---:|:---:|:---|:---|:---|
| **`1.0.0`** | `2026-11-17` | Architecture Team | `PRD.md` v4.0.0<br>`architecture.md` v3.0.0<br>`database.md` v1.0.0<br>`database-schema.md` v1.0.0 | • Initial production freeze covering all 11 domains (48 REST endpoints + 5 Socket.io events).<br>• Standardized `trustScore` scale (`0.0 - 5.0`), unified `USER` role model, and zero-join embedded `images` array.<br>• Added version control (`__v` OCC + URI/Header versioning) and comprehensive error handling specification. |

---

## 15. Comprehensive Error Handling & Resilience Architecture

To guarantee a predictable developer experience across Next.js SSR, React client components, and mobile apps, every error thrown anywhere in the Express.js monolith is caught, normalized, sanitized, and returned in a deterministic JSON envelope.

---

### 15.1 Standardized Error Response Contract

Every `4xx` and `5xx` HTTP response strictly conforms to the `ApiErrorResponse` TypeScript interface (`packages/shared/types/api.ts`):

```typescript
export interface ApiErrorDetail {
  field?: string;          // Dot-notation path to invalid field (e.g., "address.thana" or "price")
  code: string;            // Specific field-level rule code (e.g., "TOO_SMALL", "REGEX_MISMATCH")
  message: string;         // Human-readable explanation
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;                  // Machine-readable uppercase constant (e.g., "QUOTA_EXCEEDED")
    message: string;               // User-safe localized/English summary message
    requestId: string;             // Unique trace UUID (X-Request-Id) for log correlation
    timestamp: string;             // ISO 8601 UTC timestamp
    retryAfterSeconds?: number;    // Present on 429 Rate Limit and 503 Circuit Breaker responses
    details?: ApiErrorDetail[];    // Array of field-level validation issues (present on 400 errors)
  };
}
```

#### Security Guarantee (No Stack Trace Leakage)
* In `NODE_ENV=production`, internal database errors (`MongoServerError`), third-party gateway timeouts, and unhandled exceptions **never** leak stack traces, collection names, SQL/Mongo query structures, or internal IP addresses to the client. They are logged internally with `requestId` and masked as `500 INTERNAL_SERVER_ERROR`.

---

### 15.2 Domain-Specific Error Catalog & Client Recovery Matrix

| HTTP Status | `error.code` | Domain | Trigger Scenario | Retryable? | Recommended Client UI Recovery Action |
|:---:|:---|:---:|:---|:---:|:---|
| **`400`** | `VALIDATION_ERROR` | Global | Request body, params, or query failed Zod validation (`VAL-01..04`). | ❌ *(Fix input)* | Map `error.details[]` directly to React Hook Form field errors (`setError(detail.field, ...)`). |
| **`400`** | `PRICE_BELOW_CATEGORY_FLOOR` | Listings | `price < category.minPriceBDT` on non-free listing (`FR-CAT-02`). | ❌ *(Fix input)* | Highlight price input and display *"Minimum price for [Category] is ৳[minPriceBDT]."* |
| **`400`** | `PROHIBITED_CONTENT_DETECTED` | Listings / Chat | Embedded phone number, external link (`wa.me`, `.com`), or slur detected (`FR-CHT-02`). | ❌ *(Fix input)* | Highlight offending text and display safety tooltip explaining external links/phones are blocked. |
| **`400`** | `INVALID_IMAGE_FORMAT` | Media | Magic bytes check failed (not JPEG/PNG/WebP/HEIC) or file $> 10\text{MB}$ (`FR-LST-02`). | ❌ *(Fix file)* | Show per-thumbnail error badge and allow user to remove or replace that specific photo. |
| **`400`** | `OTP_INVALID_OR_EXPIRED` | Auth | Wrong 6-digit OTP code or 180s Redis TTL elapsed (`FR-AUTH-01`). | ✅ *(Up to 3x)* | Show remaining attempts counter; if expired, enable *"Resend OTP"* button. |
| **`401`** | `UNAUTHORIZED` | Auth | Missing, malformed, or expired `bk_access_token` cookie. | ✅ *(Auto-Refresh)*| Client interceptor silently calls `POST /api/v1/auth/refresh` once; if refresh fails, open Login modal. |
| **`401`** | `REFRESH_TOKEN_EXPIRED` | Auth | `bk_refresh_token` expired (30d) or revoked in Redis. | ❌ | Clear client auth state and redirect user to OTP login screen. |
| **`401`** | `PIN_VERIFICATION_REQUIRED` | Auth | Account inactive $> 180$ days logging in from a new device (`FR-AUTH-02`). | ❌ *(Step-up)* | Redirect user to the 6-digit Account Security PIN verification screen (`/auth/verify-pin`). |
| **`403`** | `FORBIDDEN_KYC_REQUIRED` | Seller / KYC | Buyer (`isSellerVerified: false`) attempted to post an ad or view Seller Dashboard. | ❌ | Redirect user to the e-KYC Verification Wizard (`/seller/kyc`). |
| **`403`** | `ACCOUNT_SUSPENDED_OR_BANNED` | Global | User ID is present in Redis `banned_users` set or `status !== 'active'`. | ❌ | Redirect to Account Status page with option to submit a Ban Appeal (`/appeals`). |
| **`403`** | `SELF_INTERACTION_BLOCKED` | PDP / Chat | Seller tried to reveal own phone, message own listing, or review own item (`FR-PDP-01`). | ❌ | Disable action button; show *"You are the owner of this listing."* |
| **`403`** | `REVIEW_WINDOW_LOCKED` | Reviews | Buyer tried to edit a review after the 48-hour `editableUntil` lock (`FR-MOD-01`). | ❌ | Disable edit controls and display *"Reviews are permanently locked 48 hours after submission."* |
| **`403`** | `ADMIN_2FA_INVALID` | Admin | Missing or invalid 6-digit `X-Admin-TOTP` code on Kill Switch or Warrant Export. | ✅ | Prompt admin to re-enter current 6-digit code from authenticator app. |
| **`404`** | `RESOURCE_NOT_FOUND` | Global | Requested listing, user, category, or thread ID does not exist. | ❌ | Render 404 empty state page. |
| **`409`** | `CONFLICT_409` | Chat / Deals | Optimistic lock `__v` mismatch during offer acceptance (`FR-CHT-03`). | ❌ *(Refresh)* | Refetch thread/listing state and display *"This listing was just reserved or modified."* |
| **`409`** | `NID_ALREADY_REGISTERED` | e-KYC | `canonicalNidHash` is already bound to another verified account (`1 NID = 1 Account`). | ❌ | Offer link to **Phone Migration / Account Recovery** flow (`POST /auth/phone-migration`). |
| **`409`** | `DUPLICATE_SUBMISSION` | Reviews / Reports | User already reviewed this listing or already reported this target (`OPT-02`). | ❌ | Inform user that their previous submission is already recorded. |
| **`410`** | `LISTING_UNAVAILABLE` | PDP | Listing status is `sold` or `deleted` (`FR-PDP-01`). | ❌ | Render *"Item Sold / No Longer Available"* banner and suggest similar nearby listings. |
| **`422`** | `QUOTA_EXCEEDED` | Listings | Seller already has `5` active listings (`FR-LST-01`). | ❌ | Prompt seller to delete or mark an older listing as sold in Seller Dashboard. |
| **`422`** | `GUARDIAN_MINOR_LIMIT_REACHED`| e-KYC | Guardian NID already sponsors the maximum of `2` under-18 seller accounts (`FR-KYC-01`). | ❌ | Display compliance notice that a Guardian NID can sponsor at most 2 minor accounts. |
| **`426`** | `UPGRADE_REQUIRED` | Global | Mobile app build is below minimum security threshold. | ❌ | Display blocking modal linking to Google Play / App Store. |
| **`429`** | `RATE_LIMIT_EXCEEDED` | Auth / Reveal | Exceeded OTP dispatch limit or Click-to-Reveal sliding window (`FR-PDP-02`). | ✅ *(After TTL)* | Start countdown timer using `error.retryAfterSeconds`. |
| **`500`** | `INTERNAL_SERVER_ERROR` | Global | Unhandled server exception or database failure. | ✅ *(Backoff)* | Display generic retry toast with `error.requestId` for support reference. |
| **`503`** | `EXTERNAL_PROVIDER_DEGRADED` | e-KYC / Auth | Both primary & secondary SMS gateways failed, or storage upstream unavailable. | ✅ *(Backoff)* | Inform user service is temporarily busy and retry after `retryAfterSeconds`. |

---

### 15.3 Validation Error Formatting (Zod Integration)

All request payloads (`req.body`, `req.query`, `req.params`) are parsed through shared Zod schemas before reaching any controller. When validation fails, the Express validation middleware transforms the `ZodError` into the following `400 VALIDATION_ERROR` payload:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed on 2 fields.",
    "requestId": "req_9f8e7d6c5b4a",
    "timestamp": "2026-11-17T13:50:00.000Z",
    "details": [
      {
        "field": "title",
        "code": "PROHIBITED_PHONE_OR_URL",
        "message": "Listing title cannot contain phone numbers or website links (VAL-03)."
      },
      {
        "field": "location.latitude",
        "code": "OUT_OF_BANGLADESH_BOUNDS",
        "message": "Latitude must be within Bangladesh geographic boundaries [20.34, 26.64]."
      }
    ]
  }
}
```

---

### 15.4 Rate-Limiting & Sliding-Window Headers (`429 Too Many Requests`)

Rate-limited endpoints (`POST /auth/otp/request`, `POST /listings/:id/reveal-phone`, `POST /reports`) attach standard IETF rate-limit headers on every response so clients can proactively display remaining quotas:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1794925800
Retry-After: 1420
```

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "You have reached the maximum of 5 phone number reveals per hour. Please use in-app chat or try again in 24 minutes.",
    "requestId": "req_3a2b1c4d5e6f",
    "timestamp": "2026-11-17T13:52:20.000Z",
    "retryAfterSeconds": 1420
  }
}
```

---

### 15.5 External Service Fault Tolerance & Circuit Breaker Fallbacks

In accordance with `PRD.md` (`FR-AUTH-01`, `FR-KYC-03`) and `architecture.md` (Section 5.3), third-party external dependencies never cause unhandled `502`/`504` crashes for end users:

1. **Porichoy National ID API Circuit Breaker (`opossum`):**
   * **Timeout:** `8,000ms` per request; **Retries:** `2` with exponential backoff.
   * **Graceful Degradation (No Hard Error):** If the Porichoy API is down, times out, or returns a `5xx` error, `POST /api/v1/kyc/submit` **does not fail with a 500 error**. Instead, it persists the encrypted R2 `storageKeys`, transitions `identity_verifications.status` to `'manual_review'`, and returns **`202 Accepted`**:
     ```json
     {
       "success": true,
       "data": {
         "verificationId": "6735e0a01234567890kyc001",
         "status": "manual_review",
         "isSellerVerified": false,
         "message": "National ID server is temporarily busy. Your documents have been queued for priority verification by our compliance team (within 4 hours)."
       }
     }
     ```
2. **Dual-Gateway SMS OTP Failover (`FR-AUTH-01`):**
   * If the primary Bangladeshi SMS aggregator fails or times out (`> 3,000ms`), `SmsService` automatically routes the OTP payload through the secondary SMS gateway before returning to the user.
3. **MongoDB Write Conflict Auto-Retry:**
   * Transient MongoDB replica set transaction conflicts (`TransientTransactionError`) inside `publishListingAtomic` are automatically retried up to `2` times by the Mongoose session runner before surfacing `409 CONFLICT_409`.

---

### 15.6 WebSocket (Socket.io) Real-Time Error Handling Contract

Because Socket.io events operate over a persistent bidirectional connection rather than HTTP status codes, every client-to-server event (`send_message`, `join_thread`) uses an **Acknowledgement (ACK) Callback** following the exact same error structure:

#### Example: Blocked Phishing Link in Chat (`send_message` ACK)
```json
{
  "success": false,
  "error": {
    "code": "PROHIBITED_CONTENT_DETECTED",
    "message": "External links (wa.me, bit.ly, websites) are blocked for your safety. Please communicate inside Becha-Kena.",
    "clientMessageId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "blocked": true
  }
}
```

#### Example: Mid-Session Account Ban (`connection_revoked` Event)
* If an admin executes the Global Kill Switch while a user has an active WebSocket connection, the server emits `connection_revoked` with `{ code: "ACCOUNT_SUSPENDED_OR_BANNED" }` and immediately disconnects the socket (`socket.disconnect(true)`).

---

### 15.7 Global Express Error Middleware Implementation Blueprint

```typescript
// apps/api/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { logger } from '../utils/logger';

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // 1. Handle Shared Zod Schema Validation Errors (400)
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: `Request validation failed on ${err.issues.length} field(s).`,
        requestId,
        timestamp,
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          code: issue.code.toUpperCase(),
          message: issue.message
        }))
      }
    });
    return;
  }

  // 2. Handle Known Operational Domain Errors (AppError)
  if (err instanceof AppError) {
    if (err.retryAfterSeconds) {
      res.setHeader('Retry-After', String(err.retryAfterSeconds));
    }
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
        timestamp,
        ...(err.retryAfterSeconds ? { retryAfterSeconds: err.retryAfterSeconds } : {}),
        ...(err.details ? { details: err.details } : {})
      }
    });
    return;
  }

  // 3. Handle MongoDB Duplicate Key Errors (E11000 -> 409 Conflict)
  if (typeof err === 'object' && err !== null && 'code' in err && (err as any).code === 11000) {
    res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_SUBMISSION',
        message: 'A record with these unique attributes already exists.',
        requestId,
        timestamp
      }
    });
    return;
  }

  // 4. Fallback: Unhandled / Programming Errors (Mask internals in production)
  logger.error({ err, requestId, path: req.originalUrl, method: req.method }, 'Unhandled API Exception');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again later.',
      requestId,
      timestamp
    }
  });
}
```
