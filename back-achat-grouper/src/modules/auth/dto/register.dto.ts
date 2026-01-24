import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  phone: z.string().regex(/^(\+225)?[0-9]{10}$/, 'Numéro de téléphone invalide (format: +225XXXXXXXXXX)'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().min(2, 'Le prénom doit contenir au moins 2 caractères'),
  lastName: z.string().min(2, 'Le nom doit contenir au moins 2 caractères'),
  role: z.enum(['MEMBER', 'SUPPLIER']).optional().default('MEMBER'),
});

export type RegisterDto = z.infer<typeof registerSchema>;