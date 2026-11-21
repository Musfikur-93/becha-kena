export const USER_STATUSES = ['active', 'suspended', 'banned', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const KYC_STATUSES = ['pending', 'verified', 'rejected', 'manual_review'] as const;
export type KycStatus = (typeof KYC_STATUSES)[number];

export const VERIFICATION_TYPES = ['ADULT_SELF', 'MINOR_GUARDIAN'] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

// Includes ADULT_SIBLING per PRD FR-KYC-01 & Decision D-03
export const GUARDIAN_RELATIONSHIPS = [
  'FATHER',
  'MOTHER',
  'ADULT_SIBLING',
  'LEGAL_GUARDIAN'
] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const LISTING_CONDITIONS = [
  'new',
  'used_like_new',
  'used_good',
  'used_fair',
  'free'
] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

export const LISTING_STATUSES = [
  'draft',
  'active',
  'under_review',
  'reserved',
  'sold',
  'expired',
  'deleted'
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const QUOTA_COUNTING_STATUSES = ['active', 'reserved', 'under_review'] as const;
export type QuotaCountingStatus = (typeof QUOTA_COUNTING_STATUSES)[number];

export const CATEGORY_ATTRIBUTE_TYPES = ['text', 'number', 'select', 'boolean'] as const;
export type CategoryAttributeType = (typeof CATEGORY_ATTRIBUTE_TYPES)[number];

export const OFFER_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'expired',
  'superseded'
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'OFFER', 'SYSTEM'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MODERATION_FLAGS = [
  'CLEAN',
  'SCAM_WARNING',
  'OFF_PLATFORM_WARNING'
] as const;
export type ModerationFlag = (typeof MODERATION_FLAGS)[number];

export const REPORT_TARGET_TYPES = ['LISTING', 'USER', 'MESSAGE'] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  'SCAM_ADVANCE_PAYMENT',
  'PROFANITY',
  'FAKE_PRODUCT',
  'HARASSMENT',
  'OTHER'
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'investigating', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const APPEAL_STATUSES = ['pending', 'under_review', 'approved', 'rejected'] as const;
export type AppealStatus = (typeof APPEAL_STATUSES)[number];

export const AUDIT_TARGET_TYPES = [
  'USER',
  'LISTING',
  'KYC',
  'REPORT',
  'APPEAL',
  'SYSTEM'
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export const NOTIFICATION_TYPES = [
  'KYC_APPROVED',
  'KYC_MANUAL_REVIEW',
  'KYC_REJECTED',
  'NEW_MESSAGE',
  'OFFER_RECEIVED',
  'OFFER_UPDATED',
  'OFFER_EXPIRED',
  'LISTING_UNDER_REVIEW',
  'LISTING_REVIEW_ESCALATED',
  'LISTING_APPROVED',
  'LISTING_UNAVAILABLE',
  'LISTING_EXPIRING',
  'LISTING_EXPIRED',
  'CONFIRM_PURCHASE',
  'SECURITY_ALERT',
  'ACCOUNT_STATUS'
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const OTP_INTENTS = ['LOGIN_OR_REGISTER', 'PHONE_MIGRATION', 'APPEAL'] as const;
export type OtpIntent = (typeof OTP_INTENTS)[number];

export const MEDIA_PURPOSES = ['LISTING_PHOTO', 'CHAT_ATTACHMENT', 'AVATAR'] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const SEARCH_SORTS = ['nearest', 'newest', 'price_asc', 'price_desc'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];
