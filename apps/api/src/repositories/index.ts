import type { ClientSession, Types } from 'mongoose';

import {
  AdminAuditLog,
  AdminTwoFactorSecret,
  BanAppeal,
  Category,
  ChatMessage,
  ChatThread,
  IdentityVerification,
  Listing,
  ListingImage,
  Notification,
  PhoneRevealLog,
  Report,
  Review,
  User,
  type IAdminAuditLog,
  type IAdminTwoFactorSecret,
  type IBanAppeal,
  type ICategory,
  type IChatMessage,
  type IChatThread,
  type IIdentityVerification,
  type IListing,
  type IListingImage,
  type INotification,
  type IPhoneRevealLog,
  type IReport,
  type IReview,
  type IUser
} from '../models/index.js';

import { BaseRepository } from './BaseRepository.js';

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  async findByPhone(phoneNumber: string, includePin = false): Promise<IUser | null> {
    const query = this.model.findOne({ phoneNumber });
    if (includePin) {
      query.select('+accountPinHash');
    }
    return query.exec();
  }

  async findByIdWithPin(id: string | Types.ObjectId): Promise<IUser | null> {
    return this.model.findById(id).select('+accountPinHash').exec();
  }
}

export class IdentityVerificationRepository extends BaseRepository<IIdentityVerification> {
  constructor() {
    super(IdentityVerification);
  }

  async findLatestByUser(userId: string | Types.ObjectId): Promise<IIdentityVerification | null> {
    return this.model.findOne({ userId }).sort({ submittedAt: -1 }).exec();
  }

  async countActiveMinorsByGuardianHash(guardianCanonicalNidHash: string): Promise<number> {
    return this.model
      .countDocuments({
        verificationType: 'MINOR_GUARDIAN',
        guardianCanonicalNidHash,
        status: 'verified',
        supersededAt: null
      })
      .exec();
  }
}

export class CategoryRepository extends BaseRepository<ICategory> {
  constructor() {
    super(Category);
  }

  async findBySlug(slug: string): Promise<ICategory | null> {
    return this.model.findOne({ slug: slug.toLowerCase(), isActive: true }).exec();
  }

  async findAllActiveSorted(): Promise<ICategory[]> {
    return this.model.find({ isActive: true }).sort({ level: 1, sortOrder: 1, name: 1 }).exec();
  }
}

export class ListingRepository extends BaseRepository<IListing> {
  constructor() {
    super(Listing);
  }

  async findActiveBySeller(sellerId: string | Types.ObjectId): Promise<IListing[]> {
    return this.model
      .find({ sellerId, status: { $in: ['active', 'reserved', 'under_review'] } })
      .sort({ createdAt: -1 })
      .exec();
  }
}

export class ListingImageRepository extends BaseRepository<IListingImage> {
  constructor() {
    super(ListingImage);
  }

  async findOrphansByIds(
    ids: (string | Types.ObjectId)[],
    uploadedBy: string | Types.ObjectId
  ): Promise<IListingImage[]> {
    return this.model
      .find({ _id: { $in: ids }, uploadedBy, listingId: null })
      .exec();
  }
}

export class PhoneRevealLogRepository extends BaseRepository<IPhoneRevealLog> {
  constructor() {
    super(PhoneRevealLog);
  }

  async findRecentReveal(
    buyerId: string | Types.ObjectId,
    listingId: string | Types.ObjectId,
    since: Date
  ): Promise<IPhoneRevealLog | null> {
    return this.model
      .findOne({ buyerId, listingId, revealedAt: { $gte: since } })
      .sort({ revealedAt: -1 })
      .exec();
  }
}

export class ChatThreadRepository extends BaseRepository<IChatThread> {
  constructor() {
    super(ChatThread);
  }

  async findByListingAndBuyer(
    listingId: string | Types.ObjectId,
    buyerId: string | Types.ObjectId
  ): Promise<IChatThread | null> {
    return this.model.findOne({ listingId, buyerId }).exec();
  }
}

export class ChatMessageRepository extends BaseRepository<IChatMessage> {
  constructor() {
    super(ChatMessage);
  }

  async findByClientMessageId(
    threadId: string | Types.ObjectId,
    clientMessageId: string
  ): Promise<IChatMessage | null> {
    return this.model.findOne({ threadId, clientMessageId }).exec();
  }
}

export class ReviewRepository extends BaseRepository<IReview> {
  constructor() {
    super(Review);
  }
}

export class ReportRepository extends BaseRepository<IReport> {
  constructor() {
    super(Report);
  }
}

export class BanAppealRepository extends BaseRepository<IBanAppeal> {
  constructor() {
    super(BanAppeal);
  }
}

export class AdminAuditLogRepository {
  async append(doc: Partial<IAdminAuditLog>, session?: ClientSession): Promise<IAdminAuditLog> {
    if (session) {
      const [created] = await AdminAuditLog.create([doc], { session });
      if (!created) {
        throw new Error('Failed to write immutable audit log entry');
      }
      return created;
    }
    return AdminAuditLog.create(doc);
  }

  async findByAdmin(adminId: string | Types.ObjectId, limit = 50): Promise<IAdminAuditLog[]> {
    return AdminAuditLog.find({ adminId }).sort({ createdAt: -1 }).limit(limit).exec();
  }
}

export class AdminTwoFactorSecretRepository extends BaseRepository<IAdminTwoFactorSecret> {
  constructor() {
    super(AdminTwoFactorSecret);
  }

  async findByUserWithSecret(userId: string | Types.ObjectId): Promise<IAdminTwoFactorSecret | null> {
    return this.model.findOne({ userId }).select('+secretEncrypted').exec();
  }
}

export class NotificationRepository extends BaseRepository<INotification> {
  constructor() {
    super(Notification);
  }

  async countUnread(userId: string | Types.ObjectId): Promise<number> {
    return this.model.countDocuments({ userId, readAt: null }).exec();
  }
}

export const userRepository = new UserRepository();
export const identityVerificationRepository = new IdentityVerificationRepository();
export const categoryRepository = new CategoryRepository();
export const listingRepository = new ListingRepository();
export const listingImageRepository = new ListingImageRepository();
export const phoneRevealLogRepository = new PhoneRevealLogRepository();
export const chatThreadRepository = new ChatThreadRepository();
export const chatMessageRepository = new ChatMessageRepository();
export const reviewRepository = new ReviewRepository();
export const reportRepository = new ReportRepository();
export const banAppealRepository = new BanAppealRepository();
export const adminAuditLogRepository = new AdminAuditLogRepository();
export const adminTwoFactorSecretRepository = new AdminTwoFactorSecretRepository();
export const notificationRepository = new NotificationRepository();
