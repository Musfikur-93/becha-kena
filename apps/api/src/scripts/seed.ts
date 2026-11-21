import 'dotenv/config';

import { config } from '../config/env.js';
import { connectMongo, disconnectMongo } from '../config/mongo.js';
import { Category, Listing, User, type ICategoryAttribute } from '../models/index.js';
import { logger } from '../utils/logger.js';

interface CategorySeedNode {
  name: string;
  slug: string;
  minPriceBDT: number;
  maxPriceBDT?: number | null;
  sortOrder: number;
  attributeSchema?: ICategoryAttribute[];
  children?: Omit<CategorySeedNode, 'children'>[];
}

const ELECTRONICS_ATTRS: ICategoryAttribute[] = [
  {
    key: 'brand',
    label: 'Brand',
    type: 'select',
    options: ['Apple', 'Samsung', 'Xiaomi', 'Realme', 'OnePlus', 'Vivo', 'Oppo', 'Other'],
    required: true
  },
  { key: 'model', label: 'Model', type: 'text', required: false },
  {
    key: 'storageGB',
    label: 'Internal Storage',
    type: 'select',
    options: ['32GB', '64GB', '128GB', '256GB', '512GB', '1TB'],
    required: false
  },
  {
    key: 'ramGB',
    label: 'RAM',
    type: 'select',
    options: ['2GB', '4GB', '6GB', '8GB', '12GB', '16GB'],
    required: false
  },
  { key: 'imeiLast4Digits', label: 'IMEI (Last 4 Digits)', type: 'text', required: false }
];

const VEHICLE_ATTRS: ICategoryAttribute[] = [
  {
    key: 'brand',
    label: 'Brand',
    type: 'select',
    options: ['Yamaha', 'Honda', 'Suzuki', 'Bajaj', 'TVS', 'Toyota', 'Hero', 'Other'],
    required: true
  },
  { key: 'year', label: 'Model Year', type: 'number', required: false },
  { key: 'engineCC', label: 'Engine CC', type: 'number', required: false },
  {
    key: 'registrationType',
    label: 'Registration Type',
    type: 'select',
    options: ['Dhaka Metro', 'Chattogram Metro', 'Other District', 'On-Test'],
    required: false
  }
];

export const CATEGORY_SEED_TREE: CategorySeedNode[] = [
  {
    name: 'Electronics',
    slug: 'electronics',
    minPriceBDT: 100,
    sortOrder: 1,
    children: [
      {
        name: 'Mobiles & Tablets',
        slug: 'mobiles-tablets',
        minPriceBDT: 500,
        maxPriceBDT: 500_000,
        sortOrder: 1,
        attributeSchema: ELECTRONICS_ATTRS
      },
      {
        name: 'Laptops & Computers',
        slug: 'laptops-computers',
        minPriceBDT: 1000,
        sortOrder: 2,
        attributeSchema: ELECTRONICS_ATTRS
      },
      {
        name: 'Cameras & Photography',
        slug: 'cameras-photography',
        minPriceBDT: 500,
        sortOrder: 3
      },
      { name: 'Audio & Headphones', slug: 'audio-headphones', minPriceBDT: 100, sortOrder: 4 },
      { name: 'Gaming', slug: 'gaming', minPriceBDT: 200, sortOrder: 5 },
      { name: 'Other Electronics', slug: 'other-electronics', minPriceBDT: 100, sortOrder: 6 }
    ]
  },
  {
    name: 'Vehicles',
    slug: 'vehicles',
    minPriceBDT: 1000,
    sortOrder: 2,
    children: [
      {
        name: 'Motorcycles & Bikes',
        slug: 'motorcycles-bikes',
        minPriceBDT: 10_000,
        sortOrder: 1,
        attributeSchema: VEHICLE_ATTRS
      },
      {
        name: 'Cars & Microbuses',
        slug: 'cars-microbuses',
        minPriceBDT: 100_000,
        sortOrder: 2,
        attributeSchema: VEHICLE_ATTRS
      },
      { name: 'Bicycle', slug: 'bicycle', minPriceBDT: 1000, sortOrder: 3 },
      { name: 'Spare Parts', slug: 'spare-parts', minPriceBDT: 100, sortOrder: 4 }
    ]
  },
  {
    name: 'Home & Living',
    slug: 'home-living',
    minPriceBDT: 100,
    sortOrder: 3,
    children: [
      { name: 'Furniture', slug: 'furniture', minPriceBDT: 200, sortOrder: 1 },
      { name: 'Kitchen Appliances', slug: 'kitchen-appliances', minPriceBDT: 150, sortOrder: 2 },
      { name: 'Home Decor', slug: 'home-decor', minPriceBDT: 50, sortOrder: 3 },
      { name: 'Baby & Kids', slug: 'baby-kids', minPriceBDT: 50, sortOrder: 4 }
    ]
  },
  {
    name: 'Fashion & Lifestyle',
    slug: 'fashion-lifestyle',
    minPriceBDT: 50,
    sortOrder: 4,
    children: [
      { name: 'Clothing & Footwear', slug: 'clothing-footwear', minPriceBDT: 50, sortOrder: 1 },
      { name: 'Watches & Accessories', slug: 'watches-accessories', minPriceBDT: 100, sortOrder: 2 }
    ]
  },
  {
    name: 'Books & Education',
    slug: 'books-education',
    minPriceBDT: 10,
    sortOrder: 5,
    children: [
      { name: 'Academic & Textbooks', slug: 'academic-textbooks', minPriceBDT: 10, sortOrder: 1 },
      { name: 'Novels & Literature', slug: 'novels-literature', minPriceBDT: 10, sortOrder: 2 }
    ]
  },
  {
    name: 'Sports & Hobbies',
    slug: 'sports-hobbies',
    minPriceBDT: 50,
    sortOrder: 6,
    children: [
      { name: 'Sports Equipment', slug: 'sports-equipment', minPriceBDT: 50, sortOrder: 1 },
      { name: 'Musical Instruments', slug: 'musical-instruments', minPriceBDT: 200, sortOrder: 2 }
    ]
  },
  {
    name: 'Giveaway / Free Stuff',
    slug: 'giveaway-free-stuff',
    minPriceBDT: 0,
    maxPriceBDT: 0,
    sortOrder: 7
  },
  {
    name: 'Other',
    slug: 'other',
    minPriceBDT: 10,
    sortOrder: 8
  }
];

export async function runSeed(options: { withSamples?: boolean } = {}): Promise<{
  categoriesUpserted: number;
  staffUpserted: number;
}> {
  let categoriesUpserted = 0;

  for (const root of CATEGORY_SEED_TREE) {
    const parentDoc = await Category.findOneAndUpdate(
      { slug: root.slug },
      {
        $set: {
          name: root.name,
          slug: root.slug,
          parentId: null,
          level: 1,
          minPriceBDT: root.minPriceBDT,
          maxPriceBDT: root.maxPriceBDT ?? null,
          attributeSchema: root.attributeSchema ?? [],
          sortOrder: root.sortOrder,
          isActive: true
        }
      },
      { upsert: true, new: true }
    );
    categoriesUpserted += 1;

    for (const child of root.children ?? []) {
      await Category.findOneAndUpdate(
        { slug: child.slug },
        {
          $set: {
            name: child.name,
            slug: child.slug,
            parentId: parentDoc._id,
            level: 2,
            minPriceBDT: child.minPriceBDT,
            maxPriceBDT: child.maxPriceBDT ?? null,
            attributeSchema: child.attributeSchema ?? [],
            sortOrder: child.sortOrder,
            isActive: true
          }
        },
        { upsert: true, new: true }
      );
      categoriesUpserted += 1;
    }
  }

  const staffSeeds = [
    { phoneNumber: config.SEED_MODERATOR_PHONE, role: 'MODERATOR' as const, name: 'Seed Moderator' },
    {
      phoneNumber: config.SEED_COMPLIANCE_PHONE,
      role: 'COMPLIANCE_OFFICER' as const,
      name: 'Seed Compliance Officer'
    },
    { phoneNumber: config.SEED_ADMIN_LEAD_PHONE, role: 'ADMIN_LEAD' as const, name: 'Seed Admin Lead' }
  ];

  let staffUpserted = 0;
  for (const s of staffSeeds) {
    await User.findOneAndUpdate(
      { phoneNumber: s.phoneNumber },
      {
        $setOnInsert: {
          phoneNumber: s.phoneNumber,
          role: s.role,
          status: 'active',
          phoneVerified: true,
          sellerProfile: {
            displayName: s.name,
            kycStatus: 'verified',
            isSellerVerified: false
          }
        }
      },
      { upsert: true }
    );
    staffUpserted += 1;
  }

  if (options.withSamples) {
    const sampleSeller = await User.findOneAndUpdate(
      { phoneNumber: '+8801711223344' },
      {
        $setOnInsert: {
          phoneNumber: '+8801711223344',
          role: 'USER',
          status: 'active',
          phoneVerified: true,
          activeListingCount: 1,
          trustScore: 4.8,
          completedDealsCount: 14,
          location: { type: 'Point', coordinates: [90.4125, 23.8103] },
          manualLocation: { division: 'Dhaka', district: 'Dhaka', thana: 'Gulshan' },
          sellerProfile: {
            displayName: 'Tanvir Rahman',
            bio: 'Authentic Apple gadgets and accessories seller in Gulshan 2.',
            kycStatus: 'verified',
            isSellerVerified: true,
            verifiedAt: new Date()
          }
        }
      },
      { upsert: true, new: true }
    );

    const mobilesCat = await Category.findOne({ slug: 'mobiles-tablets' });
    if (mobilesCat && sampleSeller) {
      const existing = await Listing.findOne({
        sellerId: sampleSeller._id,
        title: 'iPhone 13 Pro 128GB Sierra Blue'
      });
      if (!existing) {
        await Listing.create({
          sellerId: sampleSeller._id,
          categoryId: mobilesCat._id,
          title: 'iPhone 13 Pro 128GB Sierra Blue',
          description:
            'Mint condition with original box, cable, and money receipt. Battery health 86%. Never repaired.',
          condition: 'used_like_new',
          price: 68000,
          isNegotiable: true,
          contactPhone: '+8801711223344',
          location: { type: 'Point', coordinates: [90.4125, 23.7925] },
          address: { division: 'Dhaka', district: 'Dhaka', thana: 'Gulshan' },
          attributes: { brand: 'Apple', model: 'iPhone 13 Pro', storageGB: '128GB' },
          images: [
            {
              cdnUrl: 'https://cdn.bechakena.com/listings/sample/img01.webp',
              r2Key: 'listings/sample/img01.webp',
              sortOrder: 0,
              ocrFlagged: false
            },
            {
              cdnUrl: 'https://cdn.bechakena.com/listings/sample/img02.webp',
              r2Key: 'listings/sample/img02.webp',
              sortOrder: 1,
              ocrFlagged: false
            }
          ],
          coverImageUrl: 'https://cdn.bechakena.com/listings/sample/img01.webp',
          sellerSnapshot: {
            displayName: 'Tanvir Rahman',
            isSellerVerified: true,
            trustScore: 4.8,
            avatarUrl: null
          },
          status: 'active',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        });
      }
    }
  }

  logger.info({ categoriesUpserted, staffUpserted }, 'Seed completed');
  return { categoriesUpserted, staffUpserted };
}

async function main(): Promise<void> {
  const withSamples = process.argv.includes('--with-samples');
  await connectMongo();
  try {
    await runSeed({ withSamples });
  } finally {
    await disconnectMongo();
  }
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  main().catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exit(1);
  });
}
