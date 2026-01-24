import { z } from 'zod';

export const requestResetPasswordSchema = z.object({
  identifier: z.string().min(1, 'Email ou téléphone requis'), // Email ou téléphone
});

export const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6, 'Le code OTP doit contenir 6 chiffres'),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});

export type RequestResetPasswordDto = z.infer<typeof requestResetPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;