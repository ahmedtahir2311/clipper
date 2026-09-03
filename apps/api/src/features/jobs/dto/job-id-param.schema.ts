import { z } from 'zod';

export const JobIdParamSchema = z.object({
  id: z.string().uuid(),
});
