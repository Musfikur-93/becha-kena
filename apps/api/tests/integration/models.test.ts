import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AdminAuditLog,
  AdminTwoFactorSecret,
  Category,
  ChatMessage,
  ChatThread,
  IdentityVerification,
  Listing,
  PhoneRevealLog,
  Report,
  Review,
  User
} from '../../src/models/index.js';
import { syncAllIndexes } from '../../src/scripts/db-indexes.js';
import { applyDbValidators } from '../../src/scripts/db-validators.js';
import { runSeed } from '../../src/scripts/seed.js';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Phase B03: Mongoose Models, Indexes, Validators & Seed Data', () => {
  beforeAll(async () => {
    await connectTestDb();
    await syncAllIndexes();
    await applyDbValidators();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  describe('Model validation rules', () => {
    it('enforces phone regex, trustScore 0..5, and activeListingCount 0..5 on User', async () => {
      await expect(User.create({ phoneNumber: '+8801112345678' })).rejects.toThrow();
      await expect(
        User.create({ phoneNumber: '+8801711223344', trustScore: 5.5 })
      ).rejects.toThrow();
      await expect(
        User.create({ phoneNumber: '+8801711223345', activeListingCount: 6 })
      ).rejects.toThrow();

      const validUser = await User.create({
        phoneNumber: '+8801711223344',
        accountPinHash: 'hashed-pin-value'
      });
      expect(validUser.role).toBe('USER');
      expect(validUser.trustScore).toBe(0);
    });

    it('enforces free/price rule and 2..10 images rule on Listing (Decisions D-01, D-08)', async () => {
      const seller = await User.create({ phoneNumber: '+8801711223344' });
      const cat = await Category.create({
        name: 'Mobiles',
        slug: 'mobiles',
        level: 1,
        minPriceBDT: 500
      });

      const baseListing = {
        sellerId: seller._id,
        categoryId: cat._id,
        title: 'iPhone 13 Pro 128GB',
        description: 'Mint condition with original box and cable. Battery health 86%.',
        condition: 'used_like_new' as const,
        price: 68000,
        contactPhone: '+8801711223344',
        location: { type: 'Point' as const, coordinates: [90.4125, 23.8103] },
        address: { division: 'Dhaka', district: 'Dhaka', thana: 'Gulshan' },
        images: [
          { cdnUrl: 'https://cdn.bechakena.com/1.webp', r2Key: '1.webp', sortOrder: 0 },
          { cdnUrl: 'https://cdn.bechakena.com/2.webp', r2Key: '2.webp', sortOrder: 1 }
        ],
        coverImageUrl: 'https://cdn.bechakena.com/1.webp',
        sellerSnapshot: { displayName: 'Tanvir', isSellerVerified: true, trustScore: 4.5 },
        expiresAt: new Date(Date.now() + 30 * 86400 * 1000)
      };

      // 1 image rejected (D-01)
      await expect(
        Listing.create({ ...baseListing, images: baseListing.images.slice(0, 1) })
      ).rejects.toThrow();

      // free item with price > 0 rejected (D-08)
      await expect(
        Listing.create({ ...baseListing, condition: 'free', price: 100 })
      ).rejects.toThrow();

      // non-free item with price < 10 rejected
      await expect(Listing.create({ ...baseListing, price: 5 })).rejects.toThrow();

      // free item with price 0 succeeds
      const freeAd = await Listing.create({ ...baseListing, condition: 'free', price: 0 });
      expect(freeAd.price).toBe(0);
    });

    it('enforces 1..5 rating bounds on Review', async () => {
      const id = new Types.ObjectId();
      await expect(
        Review.create({
          listingId: id,
          reviewerId: id,
          revieweeId: id,
          rating: 6,
          comment: 'Great seller, very responsive and honest.'
        })
      ).rejects.toThrow();
    });
  });

  describe('Unique & partial unique indexes', () => {
    it('enforces unique users.phoneNumber, chat_threads, messages, reviews, reports', async () => {
      const u1 = await User.create({ phoneNumber: '+8801711000001' });
      const u2 = await User.create({ phoneNumber: '+8801711000002' });

      await expect(User.create({ phoneNumber: '+8801711000001' })).rejects.toThrow();

      const listingId = new Types.ObjectId();
      const thread = await ChatThread.create({
        listingId,
        buyerId: u1._id,
        sellerId: u2._id,
        listingSnapshot: {
          title: 'Phone',
          price: 10000,
          thumbnail: 'https://cdn.bechakena.com/t.webp',
          status: 'active'
        }
      });
      await expect(
        ChatThread.create({
          listingId,
          buyerId: u1._id,
          sellerId: u2._id,
          listingSnapshot: {
            title: 'Phone',
            price: 10000,
            thumbnail: 'https://cdn.bechakena.com/t.webp',
            status: 'active'
          }
        })
      ).rejects.toThrow();

      await ChatMessage.create({
        threadId: thread._id,
        clientMessageId: 'uuid-1',
        senderId: u1._id,
        body: 'Hello there'
      });
      await expect(
        ChatMessage.create({
          threadId: thread._id,
          clientMessageId: 'uuid-1',
          senderId: u1._id,
          body: 'Retry duplicate'
        })
      ).rejects.toThrow();

      await Review.create({
        listingId,
        reviewerId: u1._id,
        revieweeId: u2._id,
        rating: 5,
        comment: 'Very honest seller, recommended!'
      });
      await expect(
        Review.create({
          listingId,
          reviewerId: u1._id,
          revieweeId: u2._id,
          rating: 4,
          comment: 'Trying to submit a second review!'
        })
      ).rejects.toThrow();

      await Report.create({
        reporterId: u1._id,
        targetType: 'LISTING',
        targetId: listingId,
        reason: 'SCAM_ADVANCE_PAYMENT',
        description: 'Asked for advance bKash payment before meetup.'
      });
      await expect(
        Report.create({
          reporterId: u1._id,
          targetType: 'LISTING',
          targetId: listingId,
          reason: 'FAKE_PRODUCT',
          description: 'Duplicate report on same target.'
        })
      ).rejects.toThrow();
    });

    it('enforces partial unique canonicalNidHash only for verified ADULT_SELF records', async () => {
      const u1 = await User.create({ phoneNumber: '+8801722000001' });
      const u2 = await User.create({ phoneNumber: '+8801722000002' });

      const baseKyc = {
        verificationType: 'ADULT_SELF' as const,
        canonicalNidHash: 'hmac_hash_same_nid',
        compositeDobHash: 'hmac_dob_hash',
        storageKeys: { frontKey: 'f', backKey: 'b', selfieKey: 's' }
      };

      // Rejected attempt should not block a verified attempt
      await IdentityVerification.create({ ...baseKyc, userId: u1._id, status: 'rejected' });
      await IdentityVerification.create({ ...baseKyc, userId: u1._id, status: 'verified' });

      // Second verified ADULT_SELF with same hash MUST fail
      await expect(
        IdentityVerification.create({ ...baseKyc, userId: u2._id, status: 'verified' })
      ).rejects.toThrow();
    });
  });

  describe('Security guards (select:false & Audit Log Immutability)', () => {
    it('omits select:false fields from default queries', async () => {
      const u = await User.create({
        phoneNumber: '+8801733000001',
        accountPinHash: 'bcrypt-secret-hash'
      });
      const fetchedUser = await User.findById(u._id).lean();
      expect(fetchedUser?.accountPinHash).toBeUndefined();

      const kyc = await IdentityVerification.create({
        userId: u._id,
        verificationType: 'MINOR_GUARDIAN',
        guardianName: 'Elder Brother',
        guardianRelationship: 'ADULT_SIBLING',
        canonicalNidHash: 'secret-nid-hash',
        compositeDobHash: 'secret-dob-hash',
        guardianCanonicalNidHash: 'secret-guardian-hash',
        storageKeys: { frontKey: 'f', backKey: 'b', selfieKey: 's' },
        porichoyRefId: 'ref-123'
      });
      const fetchedKyc = await IdentityVerification.findById(kyc._id).lean();
      expect(fetchedKyc?.canonicalNidHash).toBeUndefined();
      expect(fetchedKyc?.guardianCanonicalNidHash).toBeUndefined();
      expect(fetchedKyc?.porichoyRefId).toBeUndefined();

      const rev = await PhoneRevealLog.create({
        listingId: new Types.ObjectId(),
        sellerId: u._id,
        buyerId: new Types.ObjectId(),
        phoneRevealed: '+8801733000001',
        ipAddress: 'hashed-ip'
      });
      const fetchedRev = await PhoneRevealLog.findById(rev._id).lean();
      expect(fetchedRev?.phoneRevealed).toBeUndefined();
      expect(fetchedRev?.ipAddress).toBeUndefined();

      const sec = await AdminTwoFactorSecret.create({
        userId: u._id,
        secretEncrypted: 'aes-gcm-secret'
      });
      const fetchedSec = await AdminTwoFactorSecret.findById(sec._id).lean();
      expect(fetchedSec?.secretEncrypted).toBeUndefined();
    });

    it('blocks update and delete mutations on AdminAuditLog', async () => {
      const log = await AdminAuditLog.create({
        adminId: new Types.ObjectId(),
        action: 'USER_BAN',
        targetType: 'USER',
        targetId: new Types.ObjectId(),
        details: { reason: 'FRAUD' },
        ipAddress: '127.0.0.1'
      });

      await expect(
        AdminAuditLog.updateOne({ _id: log._id }, { $set: { action: 'TAMPERED' } })
      ).rejects.toThrow('IMMUTABLE_AUDIT_LOG');
      await expect(AdminAuditLog.deleteOne({ _id: log._id })).rejects.toThrow(
        'IMMUTABLE_AUDIT_LOG'
      );
      await expect(
        AdminAuditLog.findOneAndUpdate({ _id: log._id }, { $set: { action: 'TAMPERED' } })
      ).rejects.toThrow('IMMUTABLE_AUDIT_LOG');
    });
  });

  describe('Seed script idempotency & Geo dataset', () => {
    it('runs seed twice without duplicating categories or staff users', async () => {
      await runSeed({ withSamples: true });
      const firstCatCount = await Category.countDocuments();
      const firstUserCount = await User.countDocuments();
      const firstListingCount = await Listing.countDocuments();

      await runSeed({ withSamples: true });
      expect(await Category.countDocuments()).toBe(firstCatCount);
      expect(await User.countDocuments()).toBe(firstUserCount);
      expect(await Listing.countDocuments()).toBe(firstListingCount);
      expect(firstCatCount).toBeGreaterThanOrEqual(20);
    });

    it('ships bd-geo.json with all 8 divisions and 64 districts', () => {
      const geoRaw = fs.readFileSync(
        path.join(__dirname, '../../src/data/bd-geo.json'),
        'utf-8'
      );
      const geo = JSON.parse(geoRaw) as {
        divisions: { name: string; districts: { name: string }[] }[];
      };
      expect(geo.divisions).toHaveLength(8);
      const totalDistricts = geo.divisions.reduce((acc, d) => acc + d.districts.length, 0);
      expect(totalDistricts).toBe(64);
    });
  });
});
