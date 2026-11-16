# Requirement Validation & Gap Audit: Becha-Kena

* **Document:** Engineering & QA Requirement Validation Audit
* **Audited Source:** [PRD.md](file:///c:/Users/musfi/Documents/becha-kena/PRD.md) (v2.0.0 - Architecture-Ready)
* **Author:** Senior Product Analyst & Business Analyst
* **Date:** November 2026

---

## Executive Summary & Validation Scorecard

An exhaustive technical and business audit was conducted on `PRD.md` (v2.0.0) across eight critical engineering validation pillars. While the core business logic, Porichoy e-KYC, GPS discovery, and Click-to-Reveal mechanisms are well structured, several high-impact production edge cases, security loopholes (such as bypassing Click-to-Reveal via listing descriptions, EXIF GPS leakage in public photos, and 10/13/17-digit NID hash mismatches), and missing system flows must be addressed prior to database and API implementation.

| Validation Pillar | Critical Findings Count | Severity Level | Readiness Status |
| :--- | :---: | :---: | :--- |
| **1. Missing Flow** | 7 Missing Flows | 🔴 High | Needs Flowchart / Spec Addendum |
| **2. Edge Case** | 9 Corner Scenarios | 🔴 Critical | Must Handle in DB & API Logic |
| **3. Error Handling** | 6 Failure Modes | 🟠 Medium-High | Needs Fallback & Retry Rules |
| **4. Security** | 7 Vulnerabilities | 🔴 Critical | Mandatory Before Production |
| **5. Validation** | 6 Rule Sets | 🟠 Medium-High | Required in API & Client Schema |
| **6. Permission** | 5 Access Gaps | 🔴 High | Enforce in Middleware & DB RLS |
| **7. Notification** | 4 Event Matrices | 🟡 Medium | Needed for User Retention & Ops |
| **8. Exception** | 6 Business Exceptions | 🟠 Medium-High | Required in State Machines |

---

## 1. Missing Flow

The following user and operational workflows are implied by `PRD.md` requirements but lack explicit step-by-step definitions or diagrams:

### `MF-01` Phone Number Change & Account Recovery Flow
* **Gap in `PRD.md`:** `FR-KYC-04` enforces `1 NID = 1 Account`. If a verified seller loses their SIM card or switches mobile operators (`+88017...` $\rightarrow$ `+88018...`), they cannot register a new account because their NID hash is already locked.
* **Required Flow:** Provide an "Update / Recover Account Phone Number" flow where the user authenticates via **NID + Live Selfie Biometric Match (Porichoy re-verification)** and verifies the new phone via SMS OTP before migrating ownership.

### `MF-02` Listing Expiry & 1-Click Renewal Lifecycle Flow
* **Gap in `PRD.md`:** v2.0.0 omits ad expiration. Without expiry rules, stale items sold offline via phone call remain in search results indefinitely, polluting buyer search quality and consuming the seller's **5-listing quota**.
* **Required Flow:** Listings auto-expire after **30 days** (`ACTIVE` $\rightarrow$ `EXPIRED`). Send reminder on Day 27; allow 1-click renewal from the Seller Dashboard (if quota < 5) or automatic archival.

### `MF-03` Offline Call-Based "Mark as Sold" & Buyer Confirmation Flow
* **Gap in `PRD.md`:** `FR-MOD-01` assumes a seller selects a buyer from *active chats* when marking an item Sold. However, many deals close strictly via the **Click-to-Reveal Phone Call** (`FR-PDP-02`) with zero chat messages exchanged.
* **Required Flow:** Allow sellers to select buyers who either *chatted* OR *revealed the seller's phone number* (`PhoneRevealLogs`), and send a **"Confirm Purchase"** push prompt to the selected buyer before unlocking mutual reviews.

### `MF-04` Under-18 Minor Turning 18 (Guardian Detachment Flow)
* **Gap in `PRD.md`:** `FR-KYC-01` links minors to a Parent/Guardian's NID. No flow exists for when the minor turns 18, obtains their own NID, and wants to detach from the guardian's NID to free up the guardian's minor-link cap.
* **Required Flow:** Self-service "Upgrade to Own NID" flow transitioning `verification_type` from `MINOR_GUARDIAN` to `ADULT_SELF`.

### `MF-05` Admin Moderation, Ban & False-Positive Appeal Flow
* **Gap in `PRD.md`:** `FR-MOD-02` mentions reports and permanent bans, without defining the Admin review workflow (`Report Queue` $\rightarrow$ `Evidence Inspection` $\rightarrow$ `Warn / Takedown / Ban`) or how a wrongly banned user submits an appeal.

### `MF-06` GPS Permission Denied / Unavailable Fallback Flow
* **Gap in `PRD.md`:** `FR-GEO-01` / `FR-GEO-02` rely on GPS capture. No fallback UX flow is specified if the buyer/seller denies location permissions on iOS/Android/Web or browses from a desktop browser without GPS hardware.
* **Required Flow:** Prompt manual fallback dropdown (`Division > District > Thana`) and map its geographic centroid as the search anchor.

### `MF-07` Account Deactivation & Legal Data Retention Flow
* **Gap in `PRD.md`:** Missing flow for user-initiated account deletion. Must specify soft-deleting public profile/listings while retaining hashed NIDs and `PhoneRevealLogs` in encrypted compliance storage for fraud prevention and Bangladesh legal retention mandates.

---

## 2. Edge Case

### `EC-01` Old Laminated NID (13/17-Digit) vs. Smart NID (10-Digit) Hash Mismatch 🔴
* **Scenario:** A scammer gets permanently banned using their old 13-digit or 17-digit NID (`HMAC-SHA-256` stored). Later, they apply for a 10-digit Smart NID and attempt to register a new seller account. Hashing the 10-digit string yields a **completely different hash**, bypassing the ban!
* **Resolution:** Normalize NIDs using the canonical **10-digit Smart NID / Porichoy Election Commission canonical ID** returned by the Porichoy API response (not solely the raw OCR string), and hash both the canonical ID and DOB+Name composite fingerprint.

### `EC-02` Recycled Mobile SIM Cards in Bangladesh 🔴
* **Scenario:** Local telcos recycle inactive SIM numbers after 12–15 months. If User B purchases a recycled SIM previously used by User A (an existing Verified Seller or a Banned Fraudster), User B logging in via SMS OTP would gain unauthorized access to User A's verified account or inherit User A's ban.
* **Resolution:** Add an optional 6-digit **Account Security PIN** for Seller logins or prompt identity confirmation if a phone number has been inactive on the platform for > 180 days and logs in from a brand-new device fingerprint.

### `EC-03` Guardian NID Contamination (Under-18 Fraud Spillover)
* **Scenario:** A minor using `MINOR_GUARDIAN` verification commits advance-payment fraud, or a banned adult registers under a younger sibling's phone number using their parent's NID.
* **Resolution:** If any minor account linked to a Guardian NID is permanently banned for confirmed fraud, **all accounts linked to that Guardian NID** (including the parent's own account if applicable) must be suspended pending compliance review.

### `EC-04` 5-Listing Quota Race Condition
* **Scenario:** A seller with 4 active ads sends two concurrent `POST /listings` API requests in the same millisecond to bypass the 5-ad limit.
* **Resolution:** Wrap quota check and listing insertion inside a PostgreSQL transaction using row-level locking (`SELECT ... FOR UPDATE` on the user's profile row or advisory lock per `seller_id`).

### `EC-05` Listing Deleted / Sold Mid-Session on PDP
* **Scenario:** Buyer loads a Product Details Page (`ACTIVE`). One minute later, Seller deletes the item. Buyer then clicks **"Click to Reveal"** or **"Send Message"**.
* **Resolution:** Both endpoints must perform a live DB status check and return `410 Gone` (`LISTING_UNAVAILABLE`) with a graceful UI banner: *"Sorry, this item was just sold or removed by the seller."*

### `EC-06` Obfuscated External Links & Phone Numbers in Listing Descriptions / Images
* **Scenario:** To bypass `FR-CHT-02` (Chat URL blocker) and `FR-PDP-02` (Click-to-Reveal rate limits), sellers put `01712-345678` or `fb(dot)com/myshop` inside the **Product Description** or write their phone number on a piece of paper in Product Photo #1.
* **Resolution:** Apply phone-number & URL detection validators to **Listing Titles and Descriptions**, and scan listing images via OCR in the async moderation pipeline to flag embedded phone numbers/QR codes.

### `EC-07` Zero Results in Tight GPS Radius (Rural / Semi-Urban Empty State)
* **Scenario:** Buyer in a rural Upazila searches with default `2km` radius and receives 0 listings.
* **Resolution:** Auto-fallback UI showing *"0 exact matches within 2km — Showing results within 25km / District"* to prevent dead-end user bounce.

### `EC-08` Self-Interaction on Own Listing
* **Scenario:** A logged-in seller visits their own listing's PDP and clicks "Send Message", "Make Offer", or "Click to Reveal".
* **Resolution:** Hide buyer action buttons on own listings and replace with *"Edit Listing"* / *"Manage in Dashboard"*; enforce `buyer_id != seller_id` at API level.

### `EC-09` Fake "1 BDT" Pricing to Hijack "Price: Low to High" Sort
* **Scenario:** Sellers list an iPhone 14 for `1 BDT` or `100 BDT` (putting real price `85,000 BDT` in the description) to appear first in low-to-high price sorting.
* **Resolution:** Enforce category minimum price floors (e.g., Smartphones $\ge 1,000$ BDT unless marked `For Parts`) or separate "Free Giveaway" into a dedicated category.

---

## 3. Error Handling

### `EH-01` Porichoy API Outage, Rate-Limit, or Timeout (5xx / 504)
* **Failure Mode:** Porichoy government verification endpoints experience downtime or slow latency (>10s).
* **Handling Strategy:** Implement an automated Circuit Breaker + 2 retries with exponential backoff. If Porichoy remains unreachable, gracefully save the encrypted NID images in 3rd-party private cloud storage, set status to `MANUAL_REVIEW_QUEUE`, and reassure the user: *"Automated verification is experiencing high load. Our team will verify your NID within 4 hours."*

### `EH-02` Unstable Mobile Network During Multi-Photo Upload
* **Failure Mode:** Seller uploads 8 listing photos on slow 3G/4G; photo #6 fails mid-upload.
* **Handling Strategy:** Upload images asynchronously one-by-one to pre-signed URLs before submitting the listing form. Display per-thumbnail progress bars with an individual **"Retry"** button so valid uploads are preserved.

### `EH-03` SMS OTP Gateway Downtime or Telco Filtering
* **Failure Mode:** Primary SMS provider (e.g., SSL Wireless) fails to deliver OTPs to specific operators (e.g., Teletalk or Robi).
* **Handling Strategy:** Configure automatic failover to a secondary SMS aggregator if delivery webhook fails or user clicks "Resend OTP" after 60s.

### `EH-04` WebSocket Drop & Duplicate Offline Chat Messages
* **Failure Mode:** User loses connection in an elevator while hitting "Send" repeatedly in chat.
* **Handling Strategy:** Assign a client-generated UUID (`client_message_id`) to every message as an idempotency key. Display `Sending...` / `Failed - Tap to Retry` states locally, and deduplicate server-side on `client_message_id`.

### `EH-05` Corrupted / Malformed Image Payloads (HEIC/JPEG Decode Failure)
* **Failure Mode:** Uploaded file is corrupted, truncated, or a disguised non-image file renamed to `.jpg`.
* **Handling Strategy:** Validate magic bytes (file headers), not file extensions. Catch transcoding errors (`Sharp`/`libheif`) cleanly and return `422 Unprocessable Entity` specifying which image failed.

### `EH-06` GPS Border / River Coordinate Lookup Failure
* **Failure Mode:** User GPS lands on a river, coastal area, or edge coordinate outside strict Thana polygon boundaries.
* **Handling Strategy:** Use nearest-neighbor spatial query (`ST_Distance`) to snap to the closest Thana polygon within 15km, and allow manual user adjustment.

---

## 4. Security

### `SEC-01` EXIF GPS Metadata Leakage in Public Product Photos 🔴
* **Vulnerability:** Smartphones embed exact GPS latitude/longitude coordinates, device model, and timestamps inside photo EXIF headers. If sellers upload photos taken inside their bedroom, malicious actors can download raw images from the CDN and pinpoint the seller's exact home address!
* **Mitigation:** **Mandatory EXIF Stripping** during image optimization/transcoding before storing listing photos on the public CDN.

### `SEC-02` SMS Pumping / OTP Toll Fraud Attack 🔴
* **Vulnerability:** Bots spam `POST /auth/otp/request` across thousands of international or premium numbers, draining the platform's SMS budget.
* **Mitigation:** Integrate **Cloudflare Turnstile / Google reCAPTCHA v3 / Firebase App Check** before SMS dispatch; strictly whitelist `+8801[3-9]` Bangladesh prefixes; enforce IP + Device Fingerprint + Number rate caps.

### `SEC-03` Insecure Direct Object Reference (IDOR) Across Endpoints
* **Vulnerability:** Manipulating `listing_id`, `thread_id`, or `verification_id` in API calls to edit/delete another seller's ad or read private chats.
* **Mitigation:** Every mutating and private-read endpoint must verify resource ownership directly in SQL/ORM (`WHERE id = :listing_id AND seller_id = :current_user_id`). Use non-guessable UUIDv4/ULIDs instead of sequential integer IDs.

### `SEC-04` Pre-Signed Private Cloud Storage URL Leakage
* **Vulnerability:** Caching or logging 3rd-party pre-signed URLs for NID front/back photos in browser history, CDN logs, or APM telemetry tools (Sentry/Datadog).
* **Mitigation:** Set `Cache-Control: no-store, no-cache, must-revalidate` on KYC endpoints; restrict pre-signed URL expiry to **5–15 minutes**; scrub query strings (`?X-Amz-Signature=...`) from all server and analytics logs.

### `SEC-05` Click-to-Reveal Rate Limit Bypass via Multi-Account / IP Rotation
* **Vulnerability:** Data scrapers register 20 cheap burner SIMs to bypass the `5 reveals/hour` per-user limit.
* **Mitigation:** Apply multi-dimensional rate limiting in Redis across `user_id` (**5/hr, 20/day**), `IP /24 subnet` (**30/hr**), and `device_id` (**10/hr**).

### `SEC-06` Biometric Liveness Spoofing (Photo-of-Photo / Video Replay)
* **Vulnerability:** Fraudster holds up a printed photo or another phone screen playing a victim's video to pass selfie verification.
* **Mitigation:** Enforce active randomized liveness prompts (e.g., *"Turn head slightly left, then blink"*) alongside passive depth/screen-moiré spoofing detection.

### `SEC-07` Immediate Session Revocation for Banned Users
* **Vulnerability:** A user banned by an Admin retains a valid 24-hour stateless JWT and continues spamming buyers via active WebSockets.
* **Mitigation:** Maintain a Redis `banned_users` set checked on WebSocket events and sensitive API routes, plus short-lived Access Tokens (15 min) paired with revocable Refresh Tokens.

---

## 5. Validation

### `VAL-01` Identity & Auth Input Rules
* **Mobile Number:** Regex `^\+8801[3-9]\d{8}$` (Auto-normalize inputs starting with `01...` or `8801...` to E.164 `+8801...`).
* **OTP Code:** Exactly 6 numeric digits (`^\d{6}$`); max 3 failed attempts before invalidation.
* **NID Number:** Strictly `10`, `13`, or `17` numeric digits (`^(\d{10}|\d{13}|\d{17})$`).
* **Age Validation:**
  * `ADULT_SELF`: Extracted DOB must yield age $\ge 18$ years on submission date.
  * `MINOR_GUARDIAN`: Seller profile age $< 18$; Guardian NID DOB must yield age $\ge 18$ years.

### `VAL-02` Listing Creation & Edit Validation
* **Title:** Length `5` to `100` chars. Reject URLs and phone number patterns.
* **Description:** Length `20` to `2,000` chars. Reject external URLs and embedded mobile number patterns (`01[3-9]...` or disguised spacing).
* **Price:** Numeric $\ge 10$ BDT (unless category = Free/Giveaway) and $\le 100,000,000$ BDT; max 2 decimal places (integer preferred for BDT).
* **Images:** Min `2`, Max `10` images; allowed MIME types `image/jpeg`, `image/png`, `image/webp`, `image/heic`; max single raw upload size `10 MB`.

### `VAL-03` GPS & Location Validation
* **Bangladesh Bounding Box Check:** Reject mocked/VPN GPS coordinates outside `Lat: [20.34, 26.64]` and `Lng: [88.01, 92.67]`.
* **Location Integrity:** Require both `location_point` (or Thana centroid) and structured `division_id`, `district_id`, `thana_id`.

### `VAL-04` Chat & Formal Offer Validation
* **Chat Body:** Length `1` to `1,000` chars (trimmed). Reject empty whitespace-only messages.
* **Chat Media:** Max `1` image per message (`<= 5 MB`), strictly no `.pdf`, `.apk`, `.zip`, or executable attachments (prevents malware delivery).
* **Formal Offer Amount:** Must be $> 0$ and within `[10%, 150%]` of the listing's asking price (prevents `1 BDT` spam offers).

---

## 6. Permission

### `PERM-01` Strict Seller Dashboard & CRUD Isolation
* Any request to `/api/seller/**` or `POST /api/listings` from an account where `is_seller_verified == FALSE` must fail immediately with `403 Forbidden` (`ERR_KYC_REQUIRED`).
* Sellers may only `UPDATE` or `DELETE` listings where `listing.seller_id == auth.user_id` AND `listing.status NOT IN ('DELETED', 'SOLD')`.

### `PERM-02` Product Details & Contact Authorization
* **Guests (`Unauthenticated`):** May read public PDP fields (`title`, `price`, `images`, `seller_display_name`, `is_verified_badge`). API response **must physically omit** the full `phone_number` field (send masked string `017XX-XXXXXX` only).
* **Logged-In Users (`Buyer/Seller`):** Must invoke `POST /api/listings/:id/reveal-phone` to retrieve the full phone number.

### `PERM-03` Chat & Offer Role Boundaries
* Only the **Buyer** (`thread.buyer_id`) may initiate a formal price offer or withdraw their pending offer.
* Only the **Seller** (`thread.seller_id`) may `ACCEPT` or `DECLINE` an offer.
* Neither party may send messages or offers once `thread.is_locked == TRUE` (triggered when listing is `SOLD` or `DELETED`).

### `PERM-04` Review Submission Gate
* Only verified deal participants (where `listing.buyer_id == auth.user_id` OR `listing.seller_id == auth.user_id` AND legitimacy threshold is met) may `POST /api/reviews`. Reviews are immutable after 48 hours (preventing extortion edits).

### `PERM-05` Admin Role Segregation (Least Privilege)
* **Content Moderator:** Can view reported listings/chats, hide ads, and issue warnings. **Cannot** view raw NID documents in private cloud storage.
* **KYC Compliance Officer:** Can access short-lived pre-signed NID images in `MANUAL_REVIEW_QUEUE` (all views logged).
* **Trust & Safety Lead:** Authorized to trigger the **Global NID Blacklist Kill Switch** and export forensic bundles for law enforcement warrants.

---

## 7. Notification

Comprehensive event notification specification across **Push (FCM/APNs)**, **SMS**, and **In-App System Events**:

| Trigger Event | Recipient | Channels | Priority | Content / Payload Action |
| :--- | :--- | :--- | :---: | :--- |
| **SMS OTP Requested** | Buyer / Seller | SMS | Critical | 6-digit OTP code (3-min expiry) |
| **KYC Verification Approved** | Seller | Push + SMS + In-App | High | *"You're verified! Start posting up to 5 free listings."* |
| **KYC Verification Rejected / Retry** | Seller | Push + In-App | High | Actionable failure reason (e.g., *"Glare on NID front"*) |
| **New In-App Chat Message** | Buyer / Seller | Push *(if offline)* + In-App | High | Sender name, listing title, snippet $\rightarrow$ Deep link to thread |
| **Formal Offer Received** | Seller | Push + In-App | High | Offer amount in BDT $\rightarrow$ Deep link to accept/counter |
| **Offer Accepted / Countered / Declined** | Buyer | Push + In-App | High | Status update $\rightarrow$ Deep link to meetup scheduling |
| **Edit Triggered Re-Moderation** | Seller | In-App | Medium | *"Your listing update is under brief safety review."* |
| **Listing Deleted / Sold** | Active Chat Buyers | In-App System Banner + Push | Medium | *"This listing is no longer available."* |
| **Listing Expiring (Day 27) / Expired (Day 30)** | Seller | Push + In-App | Medium | *"Your ad expires in 3 days. Tap to renew with 1 click."* |
| **Seller Marked Sold (Confirm Deal)** | Selected Buyer | Push + In-App | High | *"Did you buy [Item]? Confirm & rate your experience."* |
| **New Device Login Detected** | Verified Seller | SMS + Push | Critical | Security alert + 1-tap session revocation link |

---

## 8. Exception

### `EXC-01` Click-to-Reveal Re-View Quota Exception
* **Problem:** If a buyer reveals Seller A's phone number at 2:00 PM, calls, and re-opens the listing at 3:00 PM to call again, counting that repeat click against the `5 reveals/hour` quota creates terrible UX.
* **Exception Rule:** Check `PhoneRevealLogs` first. If `(buyer_id, listing_id)` already has a reveal record within the last **7 days**, return the unmasked phone number **without incrementing or blocking on the hourly rate-limit counter**.

### `EXC-02` Borderline Biometric Face Match Score (60%–79%)
* **Problem:** Many Bangladeshi citizens hold 10-to-15-year-old NID photos where facial aging, beards, glasses, or hijab changes lower automated confidence scores below an 80% threshold.
* **Exception Rule:** Hard-reject scores `< 50%`; auto-approve scores `>= 80%`; route borderline scores (`50%–79%`) cleanly to the **Manual Review Queue** instead of rejecting genuine users.

### `EXC-03` Chat Safety Filter False Positives ("Scunthorpe Problem" & Legitimate MFS)
* **Problem:**
  1. Substring matching a slur list can accidentally block benign Bengali/English words.
  2. Hard-blocking the words `"bKash"` or `"Nagad"` prevents legitimate buyers from asking *"Will you accept bKash when we meet in person?"*
* **Exception Rule:**
  * Apply strict **word-boundary (`\b`) matching** and edit-distance checks for profanity.
  * Categorize financial terms (`bKash`, `Nagad`, `advance`, `courier`) as **Non-Blocking Warning Triggers** (deliver message + show warning banner), reserving **Hard Blocks** strictly for external URLs and severe profanity/harassment.

### `EXC-04` Concurrent Offer Acceptance Race Condition
* **Problem:** Buyer A and Buyer B both send offers for the same item; Seller clicks Accept on Buyer A's offer while Buyer B submits a higher counter-offer, or Seller double-taps Accept on two threads.
* **Exception Rule:** Use optimistic locking (`version` column) or database transaction on `Listings`. First acceptance atomically updates `listing.status = 'RESERVED'` and sets `reserved_buyer_id`; concurrent attempts return `409 Conflict` and lock competing threads.

### `EXC-05` Minor Account with Non-Parent Legal Guardian
* **Problem:** Under-18 students living away from parents (e.g., in Dhaka hostels/mess) may only have an elder brother, sister, or uncle as their local guardian.
* **Exception Rule:** Support `relationship` enum values `['FATHER', 'MOTHER', 'ADULT_SIBLING', 'LEGAL_GUARDIAN']` while enforcing that the guardian NID holder is `>= 21` years old and physically completes the live selfie match.

### `EXC-06` Deleted Listing Chat Retention for Fraud Disputes
* **Problem:** A scammer deletes a listing immediately after collecting an advance fee or abusing a buyer, trying to erase evidence.
* **Exception Rule:** Deleting a listing **never** purges `Listings`, `ListingImages`, or `ChatThreads`. It strictly performs a soft-delete (`status = 'DELETED'`), keeping the historical chat snapshot and listing metadata locked and reportable by the buyer for **90 days**.

---

## Recommended Immediate Updates to `PRD.md`

Before starting Architecture & Database ERD design, update `PRD.md` to explicitly integrate these **Top 5 P0 Hardening Requirements**:
1. **Canonical NID Hashing (`EC-01`):** Hash Porichoy's canonical 10-digit ID (not raw OCR text) to close the 13/17-digit vs. 10-digit NID ban-evasion loophole.
2. **EXIF GPS Stripping (`SEC-01`):** Strip all EXIF metadata from public listing photos to protect seller home addresses.
3. **Description/Title Contact Scrubbing (`EC-06`, `VAL-02`):** Block phone numbers and URLs inside listing titles and descriptions so Click-to-Reveal and Chat Link Blockers cannot be bypassed.
4. **30-Day Listing Expiry & Offline Call "Mark Sold" Flow (`MF-02`, `MF-03`):** Allow sellers to attribute sold items to buyers who revealed their phone number (not just chat buyers), and auto-expire stale ads at 30 days.
5. **Re-View Phone Exception & SIM Recycling Guard (`EXC-01`, `EC-02`):** Exempt already-revealed numbers from consuming hourly reveal limits, and guard against recycled SIM account takeovers.

