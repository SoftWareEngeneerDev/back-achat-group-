import { z } from 'zod';

export const loginSchema = z.object({
  // Peut être email OU téléphone
  identifier: z.string().min(1, 'Email ou téléphone requis'),
  password: z.string().min(1, 'Mot de passe requis'),
});

export type LoginDto = z.infer<typeof loginSchema>;