import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  CLIENT_ORIGINS: z.string().default('http://localhost:3000'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/flightsure'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  FLIGHT_PROVIDER_URL: z.string().url().optional(),
  FLIGHT_PROVIDER_API_KEY: z.string().optional(),
  OPENWEATHER_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().trim().min(1).optional(),
  GROQ_MODEL: z.string().trim().min(1).default('openai/gpt-oss-120b'),
  POLICY_CATALOG_JSON: z.string().optional(),
  ORACLE_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(300),
  ORACLE_DELAY_TOLERANCE_MINUTES: z.coerce.number().min(0).default(5),
  ORACLE_SOURCE_A_URL: z.string().url().optional(),
  ORACLE_SOURCE_A_KEY: z.string().optional(),
  ORACLE_SOURCE_A_FEED_ID: z.string().min(1).optional(),
  ORACLE_SOURCE_B_URL: z.string().url().optional(),
  ORACLE_SOURCE_B_KEY: z.string().optional(),
  ORACLE_SOURCE_B_FEED_ID: z.string().min(1).optional(),
  ORACLE_SOURCE_C_URL: z.string().url().optional(),
  ORACLE_SOURCE_C_KEY: z.string().optional(),
  ORACLE_SOURCE_C_FEED_ID: z.string().min(1).optional(),
  BLOCKCHAIN_RPC_URL: z.string().url().optional(),
  BLOCKCHAIN_CHAIN_ID: z.coerce.number().int().positive().optional(),
  BLOCKCHAIN_CONTRACT_ADDRESS: z.string().optional(),
  BLOCKCHAIN_SIGNER_PRIVATE_KEY: z.string().optional(),
  MONITOR_POLL_CRON: z.string().default('*/10 * * * *'),
  SOCKET_CORS_ORIGINS: z.string().default('http://localhost:3000'),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).optional()
});

export function loadConfig(source = process.env) {
  const normalizedSource = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== '')
  );
  const parsed = schema.safeParse(normalizedSource);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid backend configuration: ${errors}`);
  }
  const value = parsed.data;
  const policyCatalog = parsePolicyCatalog(value.POLICY_CATALOG_JSON);
  return {
    ...value,
    POLICY_CATALOG: policyCatalog,
    clientOrigins: splitOrigins(value.CLIENT_ORIGINS),
    socketOrigins: splitOrigins(value.SOCKET_CORS_ORIGINS)
  };
}

function parsePolicyCatalog(value) {
  if (!value) return [];
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Invalid backend configuration: POLICY_CATALOG_JSON must be valid JSON.');
  }
  const result = z.array(z.object({
    planId: z.string().min(1),
    name: z.string().min(1),
    currency: z.literal('ETH'),
    premiumMinor: z.number().int().positive().safe(),
    policyTerms: z.object({
      version: z.string().min(1),
      coverageThresholdMinutes: z.number().int().positive().max(4294967295),
      tiers: z.array(z.object({
        minimumDelayMinutes: z.number().int().positive().max(4294967295),
        amountMinor: z.number().int().positive().safe(),
        currency: z.literal('ETH')
      }).strict()).min(1),
      maximumPayoutMinor: z.number().int().positive().safe()
    }).strict()
  }).strict()).safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid backend configuration: POLICY_CATALOG_JSON does not match the policy catalog schema (${result.error.issues[0].message}).`);
  }
  const planIds = new Set();
  for (const plan of result.data) {
    if (planIds.has(plan.planId)) {
      throw new Error('Invalid backend configuration: POLICY_CATALOG_JSON planId values must be unique.');
    }
    planIds.add(plan.planId);
    let previousDelay = -1;
    for (const tier of plan.policyTerms.tiers) {
      if (tier.currency !== plan.currency || tier.minimumDelayMinutes < plan.policyTerms.coverageThresholdMinutes ||
          tier.minimumDelayMinutes <= previousDelay || tier.amountMinor > plan.policyTerms.maximumPayoutMinor) {
        throw new Error('Invalid backend configuration: policy tiers must use the plan currency, be strictly ordered, and stay within the maximum payout.');
      }
      previousDelay = tier.minimumDelayMinutes;
    }
    if (!plan.policyTerms.tiers.some(tier => tier.minimumDelayMinutes === plan.policyTerms.coverageThresholdMinutes)) {
      throw new Error('Invalid backend configuration: each policy must define a payout tier at its coverage threshold.');
    }
  }
  return result.data;
}

function splitOrigins(value) {
  return value.split(',').map(origin => origin.trim()).filter(Boolean);
}
