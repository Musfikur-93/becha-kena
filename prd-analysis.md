# Product & Business Analysis Report: Becha-Kena Marketplace

* **Document:** Comprehensive Product Requirements & Business Feasibility Analysis
* **Target Artifact:** `PRD.md` (Version 1.1.0)
* **Author:** Senior Product & Business Analyst
* **Date:** November 2026
* **Domain:** C2C Trust-First Classifieds & Peer-to-Peer Commerce (Bangladesh)

---

## 1. Executive Summary & PRD Overview

### 1.1 Strategic Thesis
The core value proposition of **Becha-Kena** is establishing a **"Trust Moat"** in a market plagued by anonymous scams, advance payment fraud (bKash/Nagad courier scams), and counterfeit/stolen goods. Existing platforms (Bikroy, Facebook Marketplace) operate on open or unverified access, creating high friction and security risks for legitimate consumers.

By making **National ID (NID) e-KYC verification mandatory for sellers**, Becha-Kena legally and psychologically anchors every listing to a real citizen (1 NID = 1 Account).

### 1.2 Overall PRD Maturity Assessment

| Assessment Dimension | Rating (1-5) | Analysis & Observations |
| :--- | :---: | :--- |
| **Problem-Solution Fit** | ⭐⭐⭐⭐⭐ (5.0) | Directly attacks the #1 pain point of Bangladesh C2C commerce (scams & anonymity). |
| **Core User Flows** | ⭐⭐⭐⭐☆ (4.2) | Buyer and Seller journeys are well articulated with clear visual Mermaid diagrams. |
| **Security & e-KYC Architecture** | ⭐⭐⭐⭐☆ (4.0) | NID hashing (`HMAC-SHA-256`) and Porichoy integration provide solid privacy and uniqueness. |
| **Edge-Case & Loophole Coverage** | ⭐⭐⭐☆☆ (3.0) | Critical gaps exist around phone number scraping, listing edit fraud, and review manipulation. |
| **Monetization & Commercial Longevity** | ⭐⭐⭐☆☆ (3.2) | All monetization paths are deferred to post-MVP; needs unit economic planning for SMS & KYC API costs. |

---

## 2. Product Goals & Business Feasibility Analysis

### 2.1 Business Goals vs. Unit Economics Reality Check

```
+---------------------------------------------------------------------------------+
|                       BECHA-KENA UNIT ECONOMICS (ESTIMATED)                     |
+---------------------------------------------------------------------------------+
| Cost per New Seller Onboarding:                                                 |
|   - SMS OTP Delivery: 2 SMS x ~0.35 BDT = ~0.70 BDT                            |
|   - Porichoy / e-KYC Verification API call: ~5.00 - 15.00 BDT                   |
|   - Cloud OCR & Liveness processing: ~2.00 - 5.00 BDT                           |
| Total Cost per Verified Seller Acquisition (Direct Infra): ~8.00 - 20.00 BDT    |
+---------------------------------------------------------------------------------+
| Revenue per Free C2C Listing (MVP): 0.00 BDT (Freemium / Subsidy)               |
+---------------------------------------------------------------------------------+
```

> [!WARNING] **Business Sustainability Risk:**
> In the MVP, all monetized items (ad boosts, commissions, escrow fees) are designated as **out of scope**. If thousands of new sellers register and undergo e-KYC verification, the business incurs substantial third-party API costs (Porichoy + SMS Gateway) without immediate direct revenue.
> 
> **Recommendation:** Impose a fair listing policy (e.g., up to 3 active listings free per verified user) and prepare post-MVP revenue streams (Category Featured Boosts, Verified Shop Pro accounts for high-volume traders).

### 2.2 Key Performance Indicators (KPIs) Audit

1. **Scam Incident Rate (< 0.2% per 1,000 transactions):** Highly achievable with mandatory NID, provided offline handovers do not lead to untracked disputes.
2. **Seller Verification Conversion Rate (Target ≥ 75%):** Aggressive. In Bangladesh, camera quality on low-end smartphones, glare on laminated NIDs, and user hesitation to share NID can push drop-offs to 35-45%. Onboarding UX must be frictionless.
3. **Deal Velocity (< 48 hours):** The combination of in-app messaging and **Click-to-Call** will significantly speed up deals compared to chat-only platforms.

---

## 3. User Types & Permission Matrix Analysis

### 3.1 User Categorization

| User Type | Authentication Level | Core Capabilities & Permissions | Restrictions |
| :--- | :--- | :--- | :--- |
| **Visitor / Guest** | Unauthenticated | Browse homepage, search listings, filter items, view public PDP photos. | Cannot see seller phone numbers, cannot chat, cannot make offers, cannot post ads. |
| **Registered Buyer** | Phone OTP Verified | Search, view complete PDP, click-to-call seller, send in-app chat, submit formal price offers, report listings. | Cannot post products for sale unless they complete NID verification. |
| **New Seller** | Phone OTP (Unverified) | Access onboarding flow, initiate e-KYC verification. | Cannot create or publish listings; cannot access Seller Dashboard until approved. |
| **Verified Seller** | Phone OTP + NID e-KYC Approved | Access Seller Dashboard, Add/Edit/Delete listings, receive chats and calls, mark items Reserved/Sold, receive ratings. | Cannot create multiple accounts with the same NID; subject to permanent blacklist upon fraud. |
| **Trust & Safety Admin** | Enterprise 2FA Auth | Review flagged listings, oversee verification fallback queue, issue warnings, execute 1-click permanent bans. | Strictly audited; cannot view plaintext NID numbers without authorized supervisor log. |

### 3.2 Role-Based Access Control (RBAC) Matrix

| Feature / Action | Guest | Buyer (Phone OTP) | New Seller (Pending KYC) | Verified Seller |
| :--- | :---: | :---: | :---: | :---: |
| Browse & Search Listings | ✅ | ✅ | ✅ | ✅ |
| View Product Details & Specs | ✅ | ✅ | ✅ | ✅ |
| View Seller Info & Trust Badge | ✅ | ✅ | ✅ | ✅ |
| View Seller Phone Number | ❌ *(Hidden)* | ✅ *(Protected)* | ❌ | ✅ |
| Initiate In-App Chat | ❌ | ✅ | ❌ | ✅ |
| Submit "Make an Offer" | ❌ | ✅ | ❌ | ✅ |
| Access Seller Dashboard | ❌ | ❌ | ❌ | ✅ |
| Post New Ad (Create Listing) | ❌ | ❌ | ❌ | ✅ |
| Edit / Delete Own Listings | ❌ | ❌ | ❌ | ✅ |
| Leave Post-Deal Rating & Review | ❌ | ✅ *(Deal verified)* | ❌ | ✅ *(Deal verified)* |
| Report Ad / Bad Actor | ❌ | ✅ | ✅ | ✅ |

---

## 4. Functional Requirements Deep-Dive & Gap Analysis

### 4.1 Module 1: Authentication & Smart Role Routing
* **Current State:** Single phone OTP entry point with dynamic routing based on `role` and `verification_status`.
* **Identified Gaps & Vulnerabilities:**
  * **Dual Roles (Buyer is also a Seller):** In C2C platforms, many buyers eventually want to sell their own items. The PRD must clarify whether a single account transitions smoothly from `BUYER` to `VERIFIED_SELLER` upon completing NID verification.
  * **SMS OTP Gateway Failures:** Bangladesh telecom operators frequently experience SMS delivery latency (15–60s). A WhatsApp OTP fallback or automated voice call OTP should be considered.
  * **Session Expiry & Device Management:** When a seller logs in from a new device, should an extra OTP be triggered to prevent session hijacking?

### 4.2 Module 2: e-KYC & Verification Engine
* **Current State:** Front/back NID OCR + biometric liveness check + Porichoy integration + 1 NID = 1 Account constraint.
* **Identified Gaps & Vulnerabilities:**
  * **Old Laminated NIDs vs. Smart NID Cards:** Bangladesh has both 10-digit Smart NIDs and older 13/17-digit laminated cards. Laminated cards often feature faded print and low-contrast photos, which causes high OCR and facial comparison error rates.
  * **Manual Review Fallback Queue:** What happens when Porichoy API is down or when OCR fails due to poor lighting? The PRD requires a concrete SLA for human moderation fallback (e.g., manual review within 2 hours).
  * **Under-18 & Student Audience:** Many active second-hand buyers/sellers (university/college students) may not hold an NID or only hold a Birth Registration Certificate (*Jonmo Nibondhon*). The PRD must clarify if under-18 citizens are strictly prohibited or if Student ID verification is planned for a future phase.

### 4.3 Module 3: Product Details Page & Direct Communication (Chat vs. Call)
* **Current State:** Product info, Seller Info Card, "Send Message" button, and visible phone number with click-to-call link.
* **Identified Gaps & Vulnerabilities:**
  * **🚨 Critical Vulnerability: Phone Number Harvesting / Web Scraping:**
    * If a verified seller's phone number is rendered openly in raw HTML on the Product Details Page, automated scrapers and telemarketers will scrape thousands of valid, verified Bangladeshi mobile numbers.
    * **Required Solution:** The phone number must be **masked by default** (e.g., `01712-XXXXXX`). Only registered, logged-in buyers should be able to click **"Show Number / Call"**, accompanied by rate-limiting (e.g., max 5 phone number reveals per hour per buyer account).
  * **Deal Attribution Gap with Direct Phone Calls:**
    * When buyers use the in-app chat, the platform can track offers, acceptances, and status changes ("Reserved" $\rightarrow$ "Sold").
    * When a buyer simply clicks the phone number and calls offline, the platform loses visibility into the transaction. Who is the buyer? How does the seller mark the item "Sold to Tanvir" to trigger mutual reviews?

### 4.4 Module 4: Seller Dashboard & Listing CRUD (Add, Edit, Delete)
* **Current State:** Overview metrics, Add new listing, Edit existing listing, Delete listing.
* **Identified Gaps & Vulnerabilities:**
  * **🚨 Listing Edit "Bait-and-Switch" Loophole:**
    * A seller creates an ad for a legitimate, safe item (e.g., "Wooden Study Table - 3,000 BDT"). Once approved and indexed, the seller edits the listing to sell an illegal item, a counterfeit iPhone, or changes the price to lure victims into a scam.
    * **Required Solution:** Major edits (Title, Category, Images, or Price change > 30%) must trigger an automated re-moderation flag or temporary "Under Review" state.
  * **Impact of Listing Deletion on Ongoing Inquiries:**
    * If a seller deletes an active listing while 3 buyers are currently negotiating with them in in-app chat, the chat threads must display a badge: *"This listing has been deleted by the seller."* Further offer submissions on that thread should be disabled.
  * **Commercial Bulk Seller Exploitation:**
    * Without listing quotas, commercial smartphone shops or refurbishers can post 50-100 ads a day, crowding out genuine individuals. A maximum cap of **5 active listings per standard user** should be enforced in MVP.

### 4.5 Module 5: Trust, Ratings & Mutual Reviews
* **Current State:** Seller marks item as "Sold", prompts mutual review.
* **Identified Gaps & Vulnerabilities:**
  * **Fake Review Astroturfing:** If any seller can arbitrarily pick a friend's account and mark an item as "Sold to them", bad actors can farm 5-star ratings quickly.
  * **Required Solution:** A review can only be submitted if there is an **accepted digital offer** or at least **3 exchanged messages** between the buyer and seller in the platform chat history.

---

## 5. Non-Functional Requirements (NFR) Audit

```
+-----------------------------------------------------------------------------------+
|                        NON-FUNCTIONAL REQUIREMENTS AUDIT                          |
+--------------------------+---------------------+----------------------------------+
| Attribute                | Current PRD Spec    | Analyst Assessment & Recommendation|
+--------------------------+---------------------+----------------------------------+
| Security & PII           | Hashed NID Storage  | Strong. Must ensure NID photos   |
|                          | (HMAC-SHA-256)      | in S3/GCS have private signed    |
|                          |                     | URLs expiring in 15 minutes.     |
+--------------------------+---------------------+----------------------------------+
| Scraping Protection      | Rate-limiting noted | Needs explicit Click-to-Reveal   |
|                          |                     | threshold: Max 5 reveals/hr/user.|
+--------------------------+---------------------+----------------------------------+
| Media Optimization       | WebP/JPEG < 300KB   | Add support for HEIC format      |
|                          |                     | (default format on modern iPhones|
|                          |                     | popular in BD tech resale).      |
+--------------------------+---------------------+----------------------------------+
| Chat Scalability         | WebSockets < 100ms  | Implement Redis Pub/Sub backplane|
|                          |                     | for horizontal socket scaling.   |
+--------------------------+---------------------+----------------------------------+
| Regulatory Compliance    | Cyber Security Act  | Explicit compliance policy for   |
|                          | compliance noted    | formal Bangladesh Police CID     |
|                          |                     | investigation requests.          |
+--------------------------+---------------------+----------------------------------+
```

---

## 6. Comprehensive Missing Requirements Checklist

Here is the prioritized list of specifications missing from `PRD.md` that must be addressed before software engineering and architectural implementation begin:

### High Priority (P0 - Critical for MVP Launch & Safety)
- [ ] **P0-1: Phone Number Scraping & Privacy Firewall:**
  - Phone number must not be exposed in raw SSR/static HTML.
  * Must require user authentication (logged-in buyer).
  * Requires a "Click to View Number" action that logs the interaction (`lead_phone_reveal`).
  * Rate-limiting rule: Maximum 5 reveals per hour per user account to block data scrapers.
- [ ] **P0-2: Dual Role Transition (Unified Account):**
  - Clarify that a single user can be both a Buyer and a Seller. A buyer who clicks "Sell" is seamlessly guided to e-KYC without having to register a separate account.
- [ ] **P0-3: Listing Edit Re-moderation Rules:**
  - Policy preventing "Bait-and-Switch" listing updates after publication.
- [ ] **P0-4: Deletion Impact on Live Chats:**
  - Specific UX state for chat threads when the underlying listing is edited, reserved, or deleted.
- [ ] **P0-5: Fallback Verification Flow:**
  - Explicit manual verification queue when the Porichoy automated API times out or when low-quality laminated NIDs fail automated OCR.

### Medium Priority (P1 - Vital for Platform Health & Economics)
- [ ] **P1-1: Listing Quota Policy (Anti-Spam / Anti-Broker):**
  - Limit standard users to a maximum of 5 active listings simultaneously to keep the platform genuine C2C and prevent commercial merchant spam.
- [ ] **P1-2: Review Legitimacy Gate:**
  - Require a minimum chat interaction or formal offer acceptance before permitting a buyer/seller review.
- [ ] **P1-3: Safe Public Meetup Guidelines:**
  - In-app safety guide suggesting designated safe transaction spots (e.g., shopping mall food courts, police box vicinities, bank lobbies) to protect users during in-person handovers.
- [ ] **P1-4: Push Notifications & Telephony Fallback:**
  - Web & Mobile Push Notification triggers when an in-app message or offer is received while the user is offline.

---

## 7. Strategic Business & Product Questions for Stakeholder Alignment

As Senior Product Analyst & Business Analyst, the following strategic questions are submitted for your input and decision:

### Question 1: Buyer Verification Depth
> **Context:** In `PRD.md` Section 1.1, the document states: *"mandatory National ID (NID) identity verification for all sellers and active buyers"*, but in Section 2, buyers only perform a Phone Number OTP verification to register, search, chat, and call.  
> **Clarification Needed:**
> * **Option A (Recommended for Liquidity):** Keep buyers on **Phone OTP only** for browsing, calling, and initial chatting. Only require buyer NID verification if they submit formal binding price offers or want to post a listing.
> * **Option B (Maximum Strict Trust):** Require buyers to complete NID verification **before** they can see seller phone numbers or send messages. *(Note: This will significantly increase trust, but may reduce buyer conversion by 40-50%).*

### Question 2: Phone Number Display vs. Call Anonymity / Masking
> **Context:** The current PRD specifies displaying the seller's actual phone number on the Product Details Page with a click-to-call link.  
> **Clarification Needed:**
> * Are you comfortable displaying the seller's real mobile number (protected behind a "Click to Reveal" button for logged-in users)?
> * Or would you prefer an in-app voice call / virtual masked number system (e.g., Twilio/local PBX masking) in a future phase so personal numbers are never exposed to strangers?

### Question 3: Free Listing Quota vs. Commercial Sellers
> **Context:** Without limits, commercial second-hand gadget shops in places like Elephant Road, Motijheel, or Stadium Market could register with individual NIDs and post 100+ ads daily, diluting the authentic C2C experience.  
> **Clarification Needed:**
> * Should we impose a hard cap of **3 to 5 active listings** per verified individual seller for the MVP free tier?

### Question 4: Under-18 / College Student Demographic
> **Context:** A large percentage of second-hand gadget buyers and sellers in Bangladesh are 15-18 years old (school and college students) who do not possess a National ID (NID) card yet.  
> **Clarification Needed:**
> * Should the platform strictly restrict selling to age 18+ (NID holders only)?
> * Or should we provide an alternate path (e.g., verified Student ID + Parental NID) in Phase 2?

---

## 8. Summary & Next Steps

1. **Review Stakeholder Feedback:** Align on the 4 strategic questions above.
2. **Update `PRD.md`:** Incorporate the P0/P1 missing requirements (Click-to-reveal phone protection, edit re-moderation, unified account roles, listing quotas).
3. **Architecture & Engineering Hand-off:** Translate finalized functional requirements into:
   - System Architecture Diagram & Tech Stack Specification.
   - Database Entity Relationship Diagram (ERD).
   - High-fidelity UI/UX Wireframe flows for Product Details Page & Seller Dashboard.

