# Database Schema Specifications: Becha-Kena

* **Document Version:** 1.0.0 (Production Schema Reference)
* **Parent Architecture:** [architecture.md](file:///c:/Users/musfi/Documents/becha-kena/architecture.md) (v3.0.0)
* **Core Database Spec:** [database.md](file:///c:/Users/musfi/Documents/becha-kena/database.md) (v1.0.0)
* **Requirements SOT:** [PRD.md](file:///c:/Users/musfi/Documents/becha-kena/PRD.md) (v4.0.0)
* **Data Flow Architecture:** [dfd.md](file:///c:/Users/musfi/Documents/becha-kena/dfd.md) (v1.0.0)
* **Database Engine:** **MongoDB Atlas Dedicated Cluster (M10+)**
* **Driver / ODM:** Mongoose v8+ with Strict TypeScript Types
* **Geospatial Model:** WGS 84 GeoJSON (`Point`, `2dsphere` index, `[longitude, latitude]` order)
* **Status:** Complete & Fully Synchronized

---

## Table of Contents
1. [Overview & Schema Design Principles](#1-overview--schema-design-principles)
2. [Master Collection Catalog](#2-master-collection-catalog)
3. [Detailed Collection Schemas](#3-detailed-collection-schemas)
   * 3.1 [`users`](#31-users)
   * 3.2 [`identity_verifications`](#32-identity_verifications)
   * 3.3 [`categories`](#33-categories)
   * 3.4 [`listings`](#34-listings)
   * 3.5 [`listing_images`](#35-listing_images)
   * 3.6 [`phone_reveal_logs`](#36-phone_reveal_logs)
   * 3.7 [`chat_threads`](#37-chat_threads)
   * 3.8 [`messages`](#38-messages)
   * 3.9 [`reviews`](#39-reviews)
   * 3.10 [`reports`](#310-reports)
   * 3.11 [`ban_appeals`](#311-ban_appeals)
   * 3.12 [`admin_audit_logs`](#312-admin_audit_logs)
4. [Referential Integrity & Cross-Collection Relationships](#4-referential-integrity--cross-collection-relationships)
5. [Field-Level Security & Sensitivity Matrix](#5-field-level-security--sensitivity-matrix)

---

## 1. Overview & Schema Design Principles

The Becha-Kena data layer is architected around **5 fundamental principles** to ensure sub-50ms query response times, zero-join SSR page rendering, robust fraud prevention, and strict data consistency:

1. **Unified User Actor Model:**
   * Single `users` collection serves both buyers and sellers (`role: 'USER'`). Seller capabilities are governed by `sellerProfile.isSellerVerified: boolean`.
   * Staff permissions are strictly separated via granular roles: `'MODERATOR'`, `'COMPLIANCE_OFFICER'`, and `'ADMIN_LEAD'`.
2. **Hybrid Image Architecture for Zero-Join SSR:**
   * Product cards in search feeds and recommendation carousels render thousands of times per second. To eliminate expensive `$lookup` pipeline joins, the `listings` document embeds an optimized `images` array (`[{ cdnUrl, r2Key, sortOrder, ocrFlagged }]`) and a `coverImageUrl`.
   * The referenced `listing_images` collection maintains deep pipeline metadata (upload byte size, EXIF GPS stripping audit trail `SEC-02`, and asynchronous OCR phone number detection logs).
3. **Denormalized Snapshots with Asynchronous Eventual Consistency:**
   * Critical seller trust signals (`displayName`, `isSellerVerified`, `trustScore`, `avatarUrl`) are embedded into `listings.sellerSnapshot` to power SSR product cards.
   * When seller attributes mutate (KYC approval, review recalculation, or admin suspension), BullMQ background workers (`snapshot_sync_queue`) asynchronously update active listings, while admin ban actions execute synchronous inline updates.
4. **Optimistic Concurrency Control (OCC) for Atomic Negotiations:**
   * Deal offers in chat negotiations utilize Mongoose's internal version key (`__v`) to ensure that once a seller accepts an offer, the listing status switches to `reserved` and competing offers are invalidated atomically without race conditions (`FR-CHT-03`).
5. **Defense-in-Depth Privacy & Immutability:**
   * All PII and compliance credentials (NID hashes, raw e-KYC responses, unmasked phone logs) enforce `select: false` at the schema level.
   * `admin_audit_logs` are strictly append-only; update and delete operations are blocked via Mongoose pre-hooks and MongoDB Atlas database user privileges.

---

## 2. Master Collection Catalog

| # | Collection Name | Storage Type | Primary Key | Key Indexes | Sensitivity Level | Purpose & Lifecycle |
|:---|:---|:---:|:---:|:---|:---:|:---|
| **1** | **`users`** | Core Entity | `_id` (`ObjectId`) | `{ phoneNumber: 1 }` (Unique)<br>`{ status: 1, lastActiveAt: -1 }` | **High (PII)** | User accounts, phone auth, trust score, and 5-ad quota counter. |
| **2** | **`identity_verifications`** | Sensitive Entity | `_id` (`ObjectId`) | `{ canonicalNidHash: 1 }` (Partial Unique)<br>`{ userId: 1 }` | **Critical (KYC)** | Porichoy e-KYC verification records, NID HMAC hashes, and compliance audit trail. |
| **3** | **`categories`** | Taxonomy Store | `_id` (`ObjectId`) | `{ slug: 1 }` (Unique)<br>`{ parentId: 1, sortOrder: 1 }` | **Public** | 3-level hierarchical category taxonomy, dynamic attribute schemas, and minimum price floors. Cached in Redis. |
| **4** | **`listings`** | Core Entity | `_id` (`ObjectId`) | `{ location: '2dsphere' }`<br>`{ status: 1, categoryId: 1, createdAt: -1 }`<br>`{ sellerId: 1, status: 1 }` | **Public / Protected** | Product classifieds, prices, GeoJSON location point, embedded seller snapshot, and 30-day lifecycle. |
| **5** | **`listing_images`** | Media Store | `_id` (`ObjectId`) | `{ listingId: 1, sortOrder: 1 }`<br>`{ r2Key: 1 }` (Unique) | **Public** | Processed WebP images ($<300\text{KB}$) stored in Cloudflare R2 public bucket with stripped EXIF GPS metadata. |
| **6** | **`phone_reveal_logs`** | Ephemeral Log | `_id` (`ObjectId`) | `{ buyerId: 1, listingId: 1, revealedAt: -1 }`<br>`{ revealedAt: 1 }` (TTL: 90 Days) | **High (PII)** | Time-stamped records of Click-to-Reveal actions for rate-limiting, 7-day free re-views, and 90-day fraud audit trail. |
| **7** | **`chat_threads`** | Negotiation Channel | `_id` (`ObjectId`) | `{ listingId: 1, buyerId: 1 }` (Unique)<br>`{ sellerId: 1, updatedAt: -1 }` | **Confidential** | 1-to-1 conversation channels per buyer per listing, unread counters, and active price proposals. |
| **8** | **`messages`** | Messaging Entity | `_id` (`ObjectId`) | `{ threadId: 1, clientMessageId: 1 }` (Unique)<br>`{ threadId: 1, createdAt: -1 }` | **Confidential** | Real-time chat messages, price proposals, client-side UUID idempotency, and automated scam warnings. |
| **9** | **`reviews`** | Social Proof | `_id` (`ObjectId`) | `{ listingId: 1, reviewerId: 1 }` (Unique)<br>`{ revieweeId: 1, createdAt: -1 }` | **Public** | Deal-attributed 1-to-5 star ratings and reviews, unlocked post-deal confirmation with a permanent 48-hour edit lock. |
| **10** | **`reports`** | Trust & Safety | `_id` (`ObjectId`) | `{ reporterId: 1, targetId: 1 }` (Unique)<br>`{ status: 1, createdAt: 1 }` | **Restricted** | User/listing abuse tickets, scam complaints, and 90-day immutable listing/chat JSON snapshots. |
| **11** | **`ban_appeals`** | Compliance Ticket | `_id` (`ObjectId`) | `{ userId: 1 }`<br>`{ status: 1, submittedAt: 1 }` | **Restricted** | Dispute records submitted by suspended/banned users, routed to the Admin Compliance Officer queue. |
| **12** | **`admin_audit_logs`** | Security Audit Trail | `_id` (`ObjectId`) | `{ adminId: 1, createdAt: -1 }`<br>`{ targetId: 1, targetType: 1 }` | **Critical (Audit)** | Strictly append-only, immutable record of all privileged staff operations (Kill Switch, manual KYC override, warrant exports). |

---

## 3. Detailed Collection Schemas

---

### 3.1 `users`

The `users` collection represents the unified actor model for all registered members and administrative staff.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `phoneNumber` | `string` | `string` | No | None | Unique, canonical E.164 format (`^\+8801[3-9]\d{8}$`). Verified via SMS OTP. |
| `role` | `string` | `'USER' \| 'MODERATOR' \| 'COMPLIANCE_OFFICER' \| 'ADMIN_LEAD'` | No | `'USER'` | System RBAC authorization role. |
| `status` | `string` | `'active' \| 'suspended' \| 'banned' \| 'deleted'` | No | `'active'` | Account status. Checked in Redis session cache (`<1ms`). |
| `phoneVerified` | `bool` | `boolean` | No | `true` | Indicates mobile number ownership verified via Redis OTP. |
| `accountPinHash` | `string` | `string \| null` | Yes | `null` | Bcrypt hash of 4-digit SIM-swap guard PIN (`FR-AUTH-03`). `select: false`. |
| `activeListingCount` | `int` | `number` | No | `0` | Atomic counter of active classifieds. Range: `0 - 5`. Governs anti-broker quota (`FR-LST-01`). |
| `trustScore` | `double` | `number` | No | `0.0` | Computed decimal score (`0.0 - 5.0`). Defaults to `0.0` ("New Seller" badge). Recalculated via BullMQ. |
| `completedDealsCount`| `int` | `number` | No | `0` | Total confirmed transactions on the platform. Used as trust score multiplier. |
| `location` | `object` | `GeoJSONPoint` | Yes | `null` | GeoJSON WGS 84 point `{ type: 'Point', coordinates: [lng, lat] }`. Indexed via `2dsphere`. |
| `manualLocation` | `object` | `ManualLocation` | No | `{}` | Fallback administrative address subdocument (`division`, `district`, `thana`). |
| `sellerProfile` | `object` | `SellerProfile` | No | Subdoc | Embedded seller profile and KYC verification state. |
| `deviceIds` | `array` | `string[]` | No | `[]` | Client device fingerprints tracked for fraud prevention and multi-account ban detection. |
| `fcmToken` | `string` | `string \| null` | Yes | `null` | Firebase Cloud Messaging token for mobile background push alerts. |
| `notificationPrefs` | `object` | `NotificationPrefs` | No | Subdoc | Granular user opt-in flags for messages, offers, expiry, and deal alerts. |
| `bannedAt` | `date` | `Date \| null` | Yes | `null` | Timestamp when administrative ban was executed. |
| `banReason` | `string` | `string \| null` | Yes | `null` | Administrative justification code for account suspension. |
| `lastActiveAt` | `date` | `Date` | No | Now | Indexed timestamp of last user action. Used for DAU metrics and stale session cleanup. |
| `deletedAt` | `date` | `Date \| null` | Yes | `null` | Soft-delete timestamp. Frees phone number for re-registration after 30-day compliance retention. |
| `createdAt` | `date` | `Date` | No | Auto | Document creation timestamp (Mongoose timestamps). |
| `updatedAt` | `date` | `Date` | No | Auto | Document update timestamp (Mongoose timestamps). |

#### Subdocuments Structure

##### `manualLocation`
* `division`: `string` (e.g., `'Dhaka'`).
* `district`: `string` (e.g., `'Dhaka'`).
* `thana`: `string` (e.g., `'Gulshan'`). Matches Bangladesh Geocode standard.

##### `sellerProfile`
* `displayName`: `string` (Min 3, Max 50 chars. Trimmed, sanitized).
* `bio`: `string` (Max 500 chars).
* `businessName`: `string \| null` (Optional commercial name for verified trade accounts).
* `avatarUrl`: `string \| null` (Public Cloudflare CDN URL).
* `kycStatus`: `string` (`'pending' \| 'verified' \| 'rejected' \| 'manual_review'`). Default: `'pending'`.
* `isSellerVerified`: `boolean` (Default: `false`. Toggled to `true` upon automated or manual KYC approval).
* `verifiedAt`: `Date \| null` (Timestamp of KYC approval).

##### `notificationPrefs`
* `newMessage`: `boolean` (Default: `true`).
* `offerUpdates`: `boolean` (Default: `true`).
* `listingExpiry`: `boolean` (Default: `true`).
* `dealConfirmation`: `boolean` (Default: `true`).

---

### 3.2 `identity_verifications`

The `identity_verifications` collection manages sensitive government identity data, Porichoy e-KYC API verification trails, and biometric match records.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `userId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. Foreign Key. |
| `verificationType` | `string` | `'ADULT_SELF' \| 'MINOR_GUARDIAN'` | No | `'ADULT_SELF'` | Defines adult automated flow vs minor legal guardian verification flow. |
| `status` | `string` | `'pending' \| 'verified' \| 'rejected' \| 'manual_review'` | No | `'pending'` | Current verification state. |
| `canonicalNidHash` | `string` | `string` | No | None | `HMAC-SHA-256` of normalized 10-digit Smart NID. `select: false`. Unique partial index prevents multi-account fraud. |
| `compositeDobHash` | `string` | `string` | No | None | `HMAC-SHA-256(DOB + NormalizedName)`. `select: false`. Cross-validates legacy 13/17 digit paper NIDs. |
| `guardianName` | `string` | `string \| null` | Yes | `null` | Legal guardian's full name (Mandatory if `verificationType === 'MINOR_GUARDIAN'`). |
| `guardianRelationship` | `string` | `'FATHER' \| 'MOTHER' \| 'LEGAL_GUARDIAN' \| null` | Yes | `null` | Relationship descriptor for minor account verification. |
| `storageKeys` | `object` | `StorageKeys` | No | Subdoc | Encrypted R2 storage keys for encrypted front, back, and selfie files. `select: false`. |
| `porichoyRefId` | `string` | `string \| null` | Yes | `null` | Transaction reference ID returned by Porichoy e-KYC API. `select: false`. |
| `porichoyResponse` | `object` | `Record<string, any> \| null`| Yes | `null` | AES-256 encrypted raw Porichoy JSON response payload. `select: false`. |
| `livenessScore` | `double` | `number` | No | `0.0` | Facial comparison confidence score (`0.0 - 100.0`). Threshold $\ge 80.0$ required for auto-approval. |
| `rejectionReason` | `string` | `string \| null` | Yes | `null` | Failure code (e.g., `'NID_DOB_MISMATCH'`, `'FACE_LIVENESS_FAIL'`). |
| `reviewedByAdminId` | `ObjectId` | `Types.ObjectId \| null` | Yes | `null` | Ref: `users._id`. Admin officer who audited manual review. |
| `reviewNote` | `string` | `string \| null` | Yes | `null` | Compliance officer notes during dispute resolution. |
| `submittedAt` | `date` | `Date` | No | Now | Timestamp of user KYC submission. |
| `verifiedAt` | `date` | `Date \| null` | Yes | `null` | Timestamp of final verification approval. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |
| `updatedAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |

#### Subdocuments Structure

##### `storageKeys`
* `frontKey`: `string` (Path in Cloudflare R2 private encrypted bucket e.g., `kyc/{userId}/front.enc`).
* `backKey`: `string` (Path in Cloudflare R2 private encrypted bucket e.g., `kyc/{userId}/back.enc`).
* `selfieKey`: `string` (Path in Cloudflare R2 private encrypted bucket e.g., `kyc/{userId}/selfie.enc`).

---

### 3.3 `categories`

The `categories` collection defines the 3-level hierarchical catalog tree, dynamic attribute schemas, and anti-spam price floors.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `name` | `string` | `string` | No | None | Display title in Bengali / English (e.g., `'Mobiles & Tablets'`). |
| `slug` | `string` | `string` | No | None | URL-safe identifier (e.g., `'mobiles-tablets'`). Unique index. |
| `parentId` | `ObjectId` | `Types.ObjectId \| null` | Yes | `null` | Ref: `categories._id`. Null for Level 1 root categories. |
| `level` | `int` | `1 \| 2 \| 3` | No | `1` | Depth in taxonomy hierarchy. `1`: Root, `2`: Sub-category, `3`: Leaf item. |
| `minPriceBDT` | `double` | `number` | No | `10.0` | Minimum allowed price floor in BDT. Anti-spam guard preventing 1-Taka listings (`VAL-02`). |
| `maxPriceBDT` | `double` | `number \| null` | Yes | `null` | Maximum allowed price ceiling in BDT. Null represents no upper ceiling. |
| `attributeSchema` | `array` | `AttributeDefinition[]` | No | `[]` | Dynamic attribute definitions required when posting in this category. |
| `iconUrl` | `string` | `string \| null` | Yes | `null` | Public CDN URL for category icon SVG / WebP. |
| `sortOrder` | `int` | `number` | No | `0` | Display precedence in navigation drawer and home screen. |
| `isActive` | `bool` | `boolean` | No | `true` | Admin kill switch to temporarily disable posting in specific categories. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |
| `updatedAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |

#### Subdocuments Structure

##### `attributeSchema` (`AttributeDefinition`)
* `key`: `string` (Attribute machine identifier e.g., `'storageGB'`, `'ramGB'`).
* `label`: `string` (User-facing form label e.g., `'Internal Storage'`).
* `type`: `string` (`'text' | 'number' | 'select' | 'boolean'`).
* `options`: `string[]` (Pre-defined values for `'select'` type e.g., `['64GB', '128GB', '256GB', '512GB']`).
* `required`: `boolean` (Enforced during listing creation validation).

---

### 3.4 `listings`

The `listings` collection is the primary commercial entity, encapsulating product specifications, asking prices, GeoJSON location, embedded images, and denormalized seller trust snapshots.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `sellerId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. Listing creator and owner. Foreign Key. |
| `categoryId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `categories._id`. Must point to an active leaf category (`level: 3` or `2`). |
| `title` | `string` | `string` | No | None | Listing headline (5-100 characters). Regex blocks phone numbers & URLs (`VAL-03`). |
| `description` | `string` | `string` | No | None | Detailed specifications (20-2,000 characters). Regex blocks phone numbers & URLs. |
| `condition` | `string` | `'new' \| 'used_like_new' \| 'used_good' \| 'used_fair' \| 'free'` | No | None | Physical condition of item. `'free'` unlocks 0 BDT giveaway items. |
| `price` | `double` | `number` | No | None | Asking price in BDT. Must be $\ge \text{category.minPriceBDT}$; strictly `0` if `condition === 'free'`. |
| `isNegotiable` | `bool` | `boolean` | No | `true` | Indicates if seller accepts counter-offers via in-app chat. |
| `contactPhone` | `string` | `string` | No | None | Valid E.164 phone string. Defaults to seller's phone. Hidden behind Click-to-Reveal firewall. |
| `location` | `object` | `GeoJSONPoint` | No | None | WGS 84 point `{ type: 'Point', coordinates: [lng, lat] }`. `2dsphere` indexed. |
| `address` | `object` | `ListingAddress` | No | Subdoc | Administrative breakdown (`division`, `district`, `thana`). |
| `attributes` | `object` | `Map<string, any>` | No | `{}` | Dynamic key-value pairs validated against category `attributeSchema`. |
| `images` | `array` | `EmbeddedListingImage[]` | No | `[]` | Embedded array of lightweight image descriptors for instant SSR cards (Zero-Join). |
| `coverImageUrl` | `string` | `string` | No | None | Public CDN URL of primary display photo (sortOrder 0). |
| `sellerSnapshot`| `object` | `SellerSnapshot` | No | Subdoc | Denormalized snapshot of seller (`displayName`, `isSellerVerified`, `trustScore`, `avatarUrl`). |
| `status` | `string` | `'draft' \| 'active' \| 'under_review' \| 'reserved' \| 'sold' \| 'expired' \| 'deleted'` | No | `'active'` | Lifecycle status. Only `'active'` documents are returned in search. |
| `viewsCount` | `int` | `number` | No | `0` | View impressions. Incremented asynchronously in Redis and flushed every 5 minutes. |
| `reservedBuyerId`| `ObjectId`| `Types.ObjectId \| null` | Yes | `null` | Ref: `users._id`. Buyer whose offer was accepted, locking the item. |
| `soldToBuyerId` | `ObjectId`| `Types.ObjectId \| null` | Yes | `null` | Ref: `users._id`. Final purchaser of the listing. |
| `soldAt` | `date` | `Date \| null` | Yes | `null` | Timestamp when seller marked the deal as completed. |
| `dealConfirmedByBuyer` | `bool`| `boolean` | No | `false` | Buyer confirmation flag that unlocks review submission privileges (`FR-MOD-01`). |
| `expiresAt` | `date` | `Date` | No | `createdAt + 30d`| Auto-calculated expiration date. Processed by background cleanup job. |
| `deletedAt` | `date` | `Date \| null` | Yes | `null` | Soft-delete timestamp. Frees seller's active quota slot immediately. |
| `__v` | `int` | `number` | No | `0` | Internal Mongoose version key used for Optimistic Concurrency Control during offer acceptance. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |
| `updatedAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |

#### Subdocuments Structure

##### `images` (`EmbeddedListingImage`)
* `cdnUrl`: `string` (Public Cloudflare CDN URL e.g., `https://cdn.bechakena.com/listings/.../thumb.webp`).
* `r2Key`: `string` (R2 storage key e.g., `listings/{id}/img_0.webp`).
* `sortOrder`: `number` (`0 - 9`).
* `ocrFlagged`: `boolean` (Default: `false`. Toggled to `true` if OCR detects phone numbers inside the image).

##### `sellerSnapshot`
* `displayName`: `string` (Cached from `users.sellerProfile.displayName`).
* `isSellerVerified`: `boolean` (Cached from `users.sellerProfile.isSellerVerified`).
* `trustScore`: `number` (Cached decimal `0.0 - 5.0`).
* `avatarUrl`: `string | null` (Cached CDN avatar URL).

##### `address`
* `division`: `string` (e.g., `'Dhaka'`).
* `district`: `string` (e.g., `'Dhaka'`).
* `thana`: `string` (e.g., `'Gulshan'`). Matches Bangladesh Geocode standard.

---

### 3.5 `listing_images`

The `listing_images` collection maintains deep file processing records, compression metrics, and automated image moderation audit trails.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `listingId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `listings._id`. Foreign Key. Indexed. |
| `r2Key` | `string` | `string` | No | None | Cloudflare R2 bucket path e.g., `listings/{listingId}/image_{uuid}.webp`. Unique index. |
| `cdnUrl` | `string` | `string` | No | None | Public Cloudflare CDN URL. |
| `sortOrder` | `int` | `number` | No | `0` | Image display order (`0` to `9`). Max 10 images per listing. |
| `mimeType` | `string` | `'image/webp'` | No | `'image/webp'` | Strictly WebP format enforced by Sharp conversion pipeline. |
| `sizeBytes` | `int` | `number` | No | None | Output file size. Must be $< 307,200$ bytes (300KB). |
| `exifStripped` | `bool` | `boolean` | No | `true` | Security audit flag confirming 100% EXIF GPS metadata stripping (`SEC-02`). |
| `ocrChecked` | `bool` | `boolean` | No | `false` | Flag indicating image underwent asynchronous OCR moderation. |
| `ocrFlagged` | `bool` | `boolean` | No | `false` | True if OCR detected written phone numbers or external URLs. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose creation timestamp. |

---

### 3.6 `phone_reveal_logs`

The `phone_reveal_logs` collection tracks every Click-to-Reveal action for rate-limiting, the 7-day free re-view exception window, and 90-day fraud forensics.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `listingId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `listings._id`. The viewed item. |
| `sellerId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The phone owner. |
| `buyerId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The requesting user. |
| `phoneRevealed` | `string` | `string` | No | None | The unmasked E.164 phone string returned to the client. `select: false`. |
| `ipAddress` | `string` | `string` | No | None | SHA-256 hashed or subnet-masked IP for privacy compliance. `select: false`. |
| `deviceId` | `string` | `string` | No | None | Client device fingerprint header. |
| `revealedAt` | `date` | `Date` | No | Now | Timestamp of reveal action. Governed by 90-Day MongoDB TTL index (`7,776,000s`). |

---

### 3.7 `chat_threads`

The `chat_threads` collection governs 1-to-1 negotiation channels between a buyer and a seller per listing.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `listingId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `listings._id`. The product under negotiation. |
| `buyerId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The inquiring buyer. Unique compound index with `listingId`. |
| `sellerId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The listing owner. |
| `listingSnapshot`| `object` | `ChatListingSnapshot` | No | Subdoc | Minimal item cache (`title`, `price`, `thumbnail`, `status`). |
| `lastMessage` | `object` | `ChatLastMessage` | Yes | `null` | Preview snippet for chat inbox lists (`body`, `senderId`, `createdAt`). |
| `unreadCountBuyer`| `int` | `number` | No | `0` | Counter for buyer's unread messages. |
| `unreadCountSeller`| `int` | `number` | No | `0` | Counter for seller's unread messages. |
| `currentOffer` | `object` | `ActiveOffer \| null` | Yes | `null` | Active price proposal subdocument. Managed atomically. |
| `isLocked` | `bool` | `boolean` | No | `false` | Set to `true` when listing is deleted or permanently sold. |
| `lockReason` | `string` | `string \| null` | Yes | `null` | Administrative or system justification for locking chat. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |
| `updatedAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |

#### Subdocuments Structure

##### `currentOffer` (`ActiveOffer`)
* `offerId`: `ObjectId` (Unique ID for this offer proposal).
* `amount`: `number` (Proposed price in BDT).
* `proposedBy`: `ObjectId` (Ref: `users._id`. Indicates whether buyer proposed or seller counter-offered).
* `status`: `string` (`'pending' | 'accepted' | 'rejected' | 'expired' | 'superseded'`).
* `expiresAt`: `Date` (Auto-computed as 72 hours from proposal creation).

##### `listingSnapshot`
* `title`: `string` (Listing title at thread inception).
* `price`: `number` (Original listing asking price).
* `thumbnail`: `string` (CDN thumbnail image URL).
* `status`: `string` (Current status of the associated listing).

---

### 3.8 `messages`

The `messages` collection stores individual chat entries, price proposals, media attachments, and automated content moderation flags.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `threadId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `chat_threads._id`. Foreign Key. Indexed with `createdAt`. |
| `clientMessageId` | `string` | `string` | No | None | Client-generated UUIDv4. Scoped unique index with `threadId` ensures network retry idempotency (`FR-CHT-01`). |
| `senderId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. Message author. |
| `type` | `string` | `'TEXT' \| 'IMAGE' \| 'OFFER' \| 'SYSTEM'` | No | `'TEXT'` | Message payload classification. |
| `body` | `string` | `string` | No | None | Text content (1-1,000 characters). HTML-escaped and sanitized. |
| `mediaUrl` | `string` | `string \| null` | Yes | `null` | Public CDN URL if `type === 'IMAGE'` (Max 1 image per message). |
| `offerAmount` | `double` | `number \| null` | Yes | `null` | Numerical offer amount if `type === 'OFFER'`. |
| `moderationFlag` | `string` | `'CLEAN' \| 'SCAM_WARNING' \| 'OFF_PLATFORM_WARNING'` | No | `'CLEAN'` | Real-time safety filter flag triggered on advance-payment or courier keywords. |
| `readAt` | `date` | `Date \| null` | Yes | `null` | Timestamp when recipient opened the thread. |
| `deletedAt` | `date` | `Date \| null` | Yes | `null` | Soft-delete timestamp for message retraction. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose creation timestamp. Used for cursor pagination. |

---

### 3.9 `reviews`

The `reviews` collection holds verified user feedback, strictly gated on deal completion and protected by an immutable 48-hour edit window.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `listingId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `listings._id`. Unique compound index with `reviewerId` (`{ listingId: 1, reviewerId: 1 }`) ensures strictly 1 review per transaction. |
| `reviewerId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The verified buyer. |
| `revieweeId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The verified seller receiving the review. |
| `rating` | `int` | `number` | No | None | Star rating integer (`1`, `2`, `3`, `4`, `5`). |
| `comment` | `string` | `string` | No | None | Review text (10-500 characters). Profanity-filtered. |
| `dealConfirmedByBuyer`| `bool` | `boolean` | No | `true` | Validation guard. Must be `true` (`FR-MOD-01`). |
| `editableUntil` | `date` | `Date` | No | `createdAt + 48h`| Timestamp after which reviews are permanently immutable. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |
| `updatedAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |

---

### 3.10 `reports`

The `reports` collection manages trust & safety complaint tickets against abusive users, fraudulent listings, or harassing messages.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `reporterId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The user filing the complaint. |
| `targetType` | `string` | `'LISTING' \| 'USER' \| 'MESSAGE'` | No | None | Entity classification of the reported target. |
| `targetId` | `ObjectId` | `Types.ObjectId` | No | None | Target document ID. Unique compound index `{ reporterId: 1, targetId: 1 }`. |
| `reason` | `string` | `'SCAM_ADVANCE_PAYMENT' \| 'PROFANITY' \| 'FAKE_PRODUCT' \| 'HARASSMENT' \| 'OTHER'` | No | None | Standardized violation taxonomy. |
| `description` | `string` | `string` | No | None | Detailed complaint narrative from reporter (Max 1,000 chars). |
| `evidenceSnapshot` | `object`| `Record<string, any>` | No | None | Immutable JSON snapshot of listing data or chat snippet (90-day retention). |
| `status` | `string` | `'open' \| 'investigating' \| 'resolved' \| 'dismissed'` | No | `'open'` | Moderation ticket lifecycle state. |
| `assignedAdminId` | `ObjectId` | `Types.ObjectId \| null` | Yes | `null` | Ref: `users._id`. Moderator assigned to investigate ticket. |
| `resolutionNote` | `string` | `string \| null` | Yes | `null` | Moderator's internal summary of action taken. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |
| `updatedAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |

---

### 3.11 `ban_appeals`

The `ban_appeals` collection handles formal account reinstatement requests submitted by suspended or banned users.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `userId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. The banned account. Foreign Key. |
| `appealReason` | `string` | `string` | No | None | Explanatory statement from user (20-1,000 characters). |
| `contactEmailOrPhone`| `string` | `string` | No | None | Alternative contact channel for communication during ban. |
| `evidenceKeys` | `array` | `string[]` | No | `[]` | Cloudflare R2 storage keys for uploaded supporting documents. |
| `status` | `string` | `'pending' \| 'under_review' \| 'approved' \| 'rejected'` | No | `'pending'` | Adjudication state. |
| `reviewedByAdminId` | `ObjectId` | `Types.ObjectId \| null` | Yes | `null` | Ref: `users._id`. Compliance Officer handling the appeal. |
| `reviewNote` | `string` | `string \| null` | Yes | `null` | Compliance justification for upholding or reversing ban. |
| `submittedAt` | `date` | `Date` | No | Now | Timestamp of appeal submission. |
| `resolvedAt` | `date` | `Date \| null` | Yes | `null` | Timestamp when decision was rendered. |
| `createdAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |
| `updatedAt` | `date` | `Date` | No | Auto | Mongoose timestamps. |

---

### 3.12 `admin_audit_logs`

The `admin_audit_logs` collection provides a cryptographically tamper-evident, strictly append-only record of all privileged staff operations.

#### Fields Specification

| Field Name | BSON Type | TypeScript Type | Nullable | Default | Constraints & Description |
|:---|:---:|:---:|:---:|:---:|:---|
| `_id` | `ObjectId` | `Types.ObjectId` | No | Auto | Primary Key. |
| `adminId` | `ObjectId` | `Types.ObjectId` | No | None | Ref: `users._id`. Privileged staff member executing the operation. |
| `action` | `string` | `string` | No | None | Operation code (e.g., `'USER_BAN'`, `'KYC_MANUAL_APPROVE'`, `'LISTING_TAKEDOWN'`). |
| `targetType` | `string` | `'USER' \| 'LISTING' \| 'KYC'` | No | None | Entity type affected by the operation. |
| `targetId` | `ObjectId` | `Types.ObjectId` | No | None | Document ID of the entity affected. |
| `details` | `object` | `Record<string, any>` | No | None | Immutable JSON diff recording state before and after operation. |
| `ipAddress` | `string` | `string` | No | None | Client IP address of the staff member. |
| `userAgent` | `string` | `string` | No | None | Client browser and platform fingerprint. |
| `createdAt` | `date` | `Date` | No | Auto | Immutable timestamp. Update and delete operations strictly forbidden. |

---

## 4. Referential Integrity & Cross-Collection Relationships

```
                                  +-------------------+
                                  |     categories    |
                                  +-------------------+
                                            | (1:N)
                                            v
+-------------------+ (1:1)       +-------------------+ (1:N)       +-------------------+
|  identity_verifs  |<------------|       users       |------------>|   listing_images  |
+-------------------+             +-------------------+             +-------------------+
                                     |             |                          ^
                     +---------------+             +---------------+          | (1:N)
                     | (1:N as Seller)             | (1:N as Buyer)|          |
                     v                             v               |          |
           +-------------------+         +-------------------+     |          |
           |     listings      |-------->|   chat_threads    |<----+          |
           +-------------------+ (1:N)   +-------------------+                |
             |       |       |                     | (1:N)                    |
             |       |       |                     v                          |
             |       |       |           +-------------------+                |
             |       |       +---------->|     messages      |                |
             |       |                   +-------------------+                |
             |       v (1:1 post-deal)                                        |
             |   +-------------------+                                        |
             |   |      reviews      |                                        |
             |   +-------------------+                                        |
             |                                                                |
             v (1:N Click-to-Reveal)                                          |
   +-------------------+                                                      |
   | phone_reveal_logs |                                                      |
   +-------------------+                                                      |
             ^                                                                |
             +----------------------- [ Cloudflare R2 ] ----------------------+
```

### Relationship Rules & Invariants
1. **User Deletion Cascades:**
   * When a user is soft-deleted (`users.status = 'deleted'`), all their active listings are soft-deleted (`listings.status = 'deleted'`), freeing their quota slots. Chat threads are locked with `lockReason = 'USER_ACCOUNT_CLOSED'`.
2. **Review Integrity:**
   * A `review` document can only be created if `listings.dealConfirmedByBuyer === true` and `listings.soldToBuyerId === reviewerId`. The compound unique index on `{ listingId: 1 }` guarantees that no listing can ever receive duplicate reviews.
3. **Chat Thread Uniqueness:**
   * Compound unique index `{ listingId: 1, buyerId: 1 }` guarantees that a buyer can never spawn multiple simultaneous threads with a seller for the same classified item.

---

## 5. Field-Level Security & Sensitivity Matrix

To prevent data leaks, enforce Bangladesh Data Privacy compliance, and defend against privilege escalation, fields are classified into 4 security tiers:

| Security Tier | Collections & Fields | Storage Protection | Projection Policy |
|:---|:---|:---|:---|
| **Tier 1: Critical (PII / Gov KYC)** | `identity_verifications.canonicalNidHash`<br>`identity_verifications.compositeDobHash`<br>`identity_verifications.storageKeys`<br>`identity_verifications.porichoyResponse`<br>`users.accountPinHash` | Bcrypt / HMAC-SHA-256 / AES-256-GCM encrypted in R2 private bucket. | `select: false` at Mongoose schema level. Stripped from all standard API payloads. Only accessible to `COMPLIANCE_OFFICER` with explicit audit logging. |
| **Tier 2: Protected (Contact / IP)** | `users.phoneNumber`<br>`listings.contactPhone`<br>`phone_reveal_logs.phoneRevealed`<br>`phone_reveal_logs.ipAddress` | Plaintext in Atlas; Phone numbers masked in public feeds (`+88017XX-XXXXXX`). | Unmasked phone numbers returned **strictly** through `POST /listings/:id/reveal-phone` behind daily rate-limiters. |
| **Tier 3: Confidential (Negotiation)** | `chat_threads.currentOffer`<br>`messages.body`<br>`messages.mediaUrl` | Encrypted in transit (TLS 1.3) and at rest (WiredTiger AES-256). | Read authorization restricted to verified thread participants (`buyerId` or `sellerId`) and active `MODERATOR` investigating an open abuse report. |
| **Tier 4: Public (Catalog / Feed)** | `listings.title`<br>`listings.price`<br>`listings.images`<br>`listings.sellerSnapshot`<br>`categories.*`<br>`reviews.*` | Edge cached via Cloudflare CDN. | Freely accessible to unauthenticated visitors via public search and PDP endpoints. |

---

## 6. Mongoose & TypeScript Integration

All collections defined in this specification have corresponding production-grade TypeScript interfaces and Mongoose models implemented in Section 9 of [database.md](file:///c:/Users/musfi/Documents/becha-kena/database.md#9-mongoose-schema--model-implementation).

Key architectural guarantees implemented in Mongoose models:
* Strict typing via `InferSchemaType<typeof Schema>`.
* Automatic optimistic concurrency control (`__v`) on transaction-sensitive entities (`listings`).
* Defense-in-depth immutability hooks on `admin_audit_logs` preventing document modification or deletion.
* TTL indexing on `phone_reveal_logs` for automatic compliance purges after 90 days.
