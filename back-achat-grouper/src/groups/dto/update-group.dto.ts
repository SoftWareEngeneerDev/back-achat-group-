import { z } from 'zod';

export const updateGroupSchema = z.object({
  name: z.string().min(3).optional(),
  maxParticipants: z.number().int().min(5).optional(),
  endDate: z.string().datetime().optional(),
  discountCurve: z.array(z.object({
    participants: z.number().int(),
    discountPercent: z.number().min(0).max(50),
  })).optional(),
});

export type UpdateGroupDto = z.infer<typeof updateGroupSchema>;