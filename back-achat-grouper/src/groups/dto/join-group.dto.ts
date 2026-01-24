import { z } from 'zod';

export const joinGroupSchema = z.object({
  groupId: z.string().uuid('Group ID invalide'),
  paymentMethod: z.enum(['ORANGE_MONEY', 'MOOV_MONEY', 'LIGDICASH', 'CARD']),
  phoneNumber: z.string().optional(), // Pour mobile money
});

export type JoinGroupDto = z.infer<typeof joinGroupSchema>;
