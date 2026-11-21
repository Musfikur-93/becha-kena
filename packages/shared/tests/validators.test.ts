import { describe, expect, it } from 'vitest';

import {
  bdPhoneSchema,
  containsPhoneNumber,
  containsUrl,
  createListingSchema,
  hasRoleAtLeast,
  normalizeBdPhone,
  respondToOfferSchema
} from '../src/index.js';

describe('Phase B01: @becha-kena/shared validators & constants', () => {
  describe('bdPhoneSchema & normalizeBdPhone', () => {
    it('normalizes local, 880, Bengali, and hyphenated BD phone numbers to E.164', () => {
      expect(normalizeBdPhone('01711223344')).toBe('+8801711223344');
      expect(normalizeBdPhone('8801811-223344')).toBe('+8801811223344');
      expect(normalizeBdPhone('০১৭১১ ২২৩৩৪৪')).toBe('+8801711223344');
      expect(bdPhoneSchema.parse('01912345678')).toBe('+8801912345678');
    });

    it('rejects invalid Bangladeshi operator prefixes (010, 011, 012) and short numbers', () => {
      expect(bdPhoneSchema.safeParse('+8801112345678').success).toBe(false);
      expect(bdPhoneSchema.safeParse('+8801212345678').success).toBe(false);
      expect(bdPhoneSchema.safeParse('017112233').success).toBe(false);
    });
  });

  describe('containsPhoneNumber', () => {
    it('detects Bengali digits, spaced/hyphenated digits, and plus880 disguised numbers', () => {
      expect(containsPhoneNumber('কল করুন ০১৭১১ ২২৩৩৪৪ নাম্বারে')).toBe(true);
      expect(containsPhoneNumber('Call me at 0 1 7 1 1-223344 asap')).toBe(true);
      expect(containsPhoneNumber('Reach me plus8801711223344')).toBe(true);
      expect(containsPhoneNumber('zero one seven one one two two three three four four')).toBe(
        true
      );
    });

    it('does not false-positive on normal prices or specs', () => {
      expect(containsPhoneNumber('iPhone 13 Pro 128GB, battery 86%, price 68000 BDT')).toBe(false);
    });
  });

  describe('containsUrl', () => {
    it('detects direct URLs, shorteners, messaging handles, and obfuscated domains', () => {
      expect(containsUrl('Message me on wa.me/8801711223344')).toBe(true);
      expect(containsUrl('Check bit[dot]ly/scam123')).toBe(true);
      expect(containsUrl('Visit example . com for discount')).toBe(true);
      expect(containsUrl('https://phishing.xyz/pay')).toBe(true);
    });

    it('does not false-positive on normal words like "dotted" or "company"', () => {
      expect(containsUrl('Polka dotted shirt from a great company, almost new.')).toBe(false);
    });
  });

  describe('createListingSchema', () => {
    const validBase = {
      categoryId: '6735e0a01234567890abcdef',
      title: 'iPhone 13 Pro 128GB Sierra Blue',
      description: 'Mint condition with original box, cable, and money receipt. Battery 86%.',
      condition: 'used_like_new' as const,
      price: 68000,
      address: { division: 'Dhaka', district: 'Dhaka', thana: 'Gulshan' },
      images: [
        {
          imageId: '6735e0a01234567890abcde1',
          cdnUrl: 'https://cdn.bechakena.com/1.webp',
          r2Key: 'listings/1.webp',
          sortOrder: 0
        },
        {
          imageId: '6735e0a01234567890abcde2',
          cdnUrl: 'https://cdn.bechakena.com/2.webp',
          r2Key: 'listings/2.webp',
          sortOrder: 1
        }
      ]
    };

    it('accepts valid priced listing with 2 images', () => {
      expect(createListingSchema.safeParse(validBase).success).toBe(true);
    });

    it('requires price === 0 for free items and >= 10 for non-free items', () => {
      expect(
        createListingSchema.safeParse({ ...validBase, condition: 'free', price: 0 }).success
      ).toBe(true);
      expect(
        createListingSchema.safeParse({ ...validBase, condition: 'free', price: 100 }).success
      ).toBe(false);
      expect(createListingSchema.safeParse({ ...validBase, price: 0 }).success).toBe(false);
      expect(createListingSchema.safeParse({ ...validBase, price: 5 }).success).toBe(false);
    });

    it('rejects listings with fewer than 2 images (Decision D-01)', () => {
      const oneImage = validBase.images.slice(0, 1);
      expect(createListingSchema.safeParse({ ...validBase, images: oneImage }).success).toBe(
        false
      );
    });

    it('rejects embedded phone numbers or URLs in title/description', () => {
      expect(
        createListingSchema.safeParse({
          ...validBase,
          title: 'iPhone call 01711223344 now'
        }).success
      ).toBe(false);
    });
  });

  describe('respondToOfferSchema', () => {
    it('enforces expectedListingVersion on ACCEPT and counterAmount on COUNTER', () => {
      expect(
        respondToOfferSchema.safeParse({ action: 'ACCEPT', expectedListingVersion: 0 }).success
      ).toBe(true);
      expect(respondToOfferSchema.safeParse({ action: 'ACCEPT' }).success).toBe(false);
      expect(
        respondToOfferSchema.safeParse({ action: 'COUNTER', counterAmount: 65000 }).success
      ).toBe(true);
      expect(respondToOfferSchema.safeParse({ action: 'COUNTER' }).success).toBe(false);
      expect(respondToOfferSchema.safeParse({ action: 'REJECT' }).success).toBe(true);
    });
  });

  describe('RBAC role hierarchy', () => {
    it('evaluates role weights accurately', () => {
      expect(hasRoleAtLeast('ADMIN_LEAD', 'MODERATOR')).toBe(true);
      expect(hasRoleAtLeast('COMPLIANCE_OFFICER', 'MODERATOR')).toBe(true);
      expect(hasRoleAtLeast('MODERATOR', 'COMPLIANCE_OFFICER')).toBe(false);
      expect(hasRoleAtLeast('USER', 'MODERATOR')).toBe(false);
    });
  });
});
