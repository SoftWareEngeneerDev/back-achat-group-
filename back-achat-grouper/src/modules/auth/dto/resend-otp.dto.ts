import { z } from 'zod';

export const resendOtpSchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(['email', 'sms']),
});

export type ResendOtpDto = z.infer<typeof resendOtpSchema>;