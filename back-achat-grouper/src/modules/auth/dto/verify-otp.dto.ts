import { z } from 'zod';

export const verifyOtpSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6, 'Le code OTP doit contenir 6 chiffres'),
  type: z.enum(['email', 'sms']),
});

export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>;