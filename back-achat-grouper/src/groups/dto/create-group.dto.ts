import { z } from 'zod';

export const createGroupSchema = z.object({
  productId: z.string().uuid('Product ID invalide'),
  name: z.string().min(3, 'Le nom doit contenir au moins 3 caractères'),
  minParticipants: z.number().int().min(2, 'Minimum 2 participants'),
  maxParticipants: z.number().int().min(5, 'Minimum 5 participants'),
  endDate: z.string().datetime('Date de fin invalide'),
  discountCurve: z.array(z.object({
    participants: z.number().int(),
    discountPercent: z.number().min(0).max(50), // Max 50% de réduction
  })).min(1, 'Au moins un palier de réduction requis'),
});

export type CreateGroupDto = z.infer<typeof createGroupSchema>;