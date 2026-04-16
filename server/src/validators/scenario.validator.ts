import { z } from 'zod';

export const scenarioSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(''),
  gameType: z.enum(['P', 'S']),
  productNames: z.array(z.string().min(1)).min(1).max(4),
  rm1Name: z.string().optional().default(''),
  rm2Name: z.string().optional().default(''),
  gameaid: z.record(z.unknown()).optional(),
  prodstrai: z.record(z.unknown()).optional(),
  forecast: z.array(z.record(z.unknown())).optional().default([]),
});
