import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
}).strict();

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
}).strict();

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100)
}).strict();

export const walletNonceSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
}).strict();

export const walletVerifySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/)
}).strict();

export const flightSearchSchema = z.object({
  flightNumber: z.string().trim().min(2).max(12).optional(),
  origin: z.string().trim().toUpperCase().length(3).optional(),
  destination: z.string().trim().toUpperCase().length(3).optional(),
  date: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict().refine(value => value.flightNumber || (value.origin && value.destination && value.date), {
  message: 'Provide a flight number or origin, destination, and date.'
});

export const recentFlightsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20)
}).strict();

export const objectIdParamsSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
export const flightIdParamsSchema = z.object({ flightId: z.string().regex(/^[a-f\d]{24}$/i) });
export const policyIdParamsSchema = z.object({ policyId: z.string().trim().min(1).max(100) });

export const verificationParamsSchema = z.object({
  flightId: z.string().regex(/^[a-f\d]{24}$/i)
});

export const compensationCalculateSchema = z.object({
  policyId: z.string().trim().min(1).max(100)
}).strict();

export const predictionRequestSchema = z.object({
  flightId: z.string().regex(/^[a-f\d]{24}$/i)
}).strict();

export const policyCreateSchema = z.object({
  planId: z.string().trim().min(1).max(64),
  flightId: z.string().regex(/^[a-f\d]{24}$/i),
  idempotencyKey: z.uuid()
}).strict();

export const policyConfirmSchema = policyCreateSchema.extend({
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/)
}).strict();

export const transactionHashParamsSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/)
});
