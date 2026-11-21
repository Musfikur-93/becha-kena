import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  MONGODB_URI: z
    .string()
    .min(1)
    .default('mongodb://localhost:27017/becha-kena?replicaSet=rs0&directConnection=true'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),

  JWT_ACCESS_SECRET: z
    .string()
    .min(16)
    .default('dev-jwt-access-secret-minimum-32-chars'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  COOKIE_DOMAIN: z.string().default('localhost'),

  NID_HMAC_SECRET: z
    .string()
    .min(16)
    .default('dev-nid-hmac-secret-minimum-32-chars'),
  PHONE_HMAC_SECRET: z
    .string()
    .min(16)
    .default('dev-phone-hmac-secret-minimum-32-chars'),
  OTP_HMAC_SECRET: z
    .string()
    .min(16)
    .default('dev-otp-hmac-secret-minimum-32-chars'),
  KYC_RESPONSE_ENC_KEY: z
    .string()
    .min(32)
    .default('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='),
  TOTP_ENC_KEY: z
    .string()
    .min(32)
    .default('BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB='),

  R2_ENDPOINT: z.string().url().default('http://localhost:9000'),
  R2_ACCESS_KEY_ID: z.string().default('minioadmin'),
  R2_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  R2_PRIVATE_BUCKET: z.string().default('bk-private'),
  R2_PUBLIC_BUCKET: z.string().default('bk-public'),
  CDN_BASE_URL: z.string().url().default('http://localhost:9000/bk-public'),

  PORICHOY_MODE: z.enum(['mock', 'live']).default('mock'),
  PORICHOY_BASE_URL: z.string().url().default('https://api.porichoybd.com'),
  PORICHOY_API_KEY: z.string().default('mock-porichoy-key'),

  SMS_MODE: z.enum(['mock', 'live']).default('mock'),
  SMS_PRIMARY_URL: z.string().url().default('https://sms-primary.example.com/send'),
  SMS_PRIMARY_API_KEY: z.string().default('mock-primary-key'),
  SMS_PRIMARY_SENDER_ID: z.string().default('BechaKena'),
  SMS_SECONDARY_URL: z.string().url().default('https://sms-secondary.example.com/send'),
  SMS_SECONDARY_API_KEY: z.string().default('mock-secondary-key'),
  SMS_SECONDARY_SENDER_ID: z.string().default('BechaKena'),

  TURNSTILE_MODE: z.enum(['mock', 'live']).default('mock'),
  TURNSTILE_SECRET: z.string().default('mock-turnstile-secret'),

  FCM_MODE: z.enum(['mock', 'live']).default('mock'),
  FCM_PROJECT_ID: z.string().default('becha-kena-dev'),
  FCM_CLIENT_EMAIL: z.string().default('firebase@becha-kena-dev.iam.gserviceaccount.com'),
  FCM_PRIVATE_KEY: z.string().default('mock-private-key'),

  SEARCH_PROVIDER: z.enum(['local', 'atlas']).default('local'),
  MIN_BUILD_ANDROID: z.coerce.number().int().min(1).default(100),
  MIN_BUILD_IOS: z.coerce.number().int().min(1).default(100),

  SEED_MODERATOR_PHONE: z.string().default('+8801700000001'),
  SEED_COMPLIANCE_PHONE: z.string().default('+8801700000002'),
  SEED_ADMIN_LEAD_PHONE: z.string().default('+8801700000003')
});

export type EnvConfig = z.infer<typeof envSchema>;

export function parseEnv(rawEnv: NodeJS.ProcessEnv = process.env): EnvConfig {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return parsed.data;
}

export const config: EnvConfig = parseEnv();
