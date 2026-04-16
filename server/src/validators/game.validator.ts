import { z } from 'zod';

export const createGameSchema = z.object({
  gameId: z.string().min(2).max(20),
  name: z.string().min(3),
  scenarioId: z.string(),
  winCriteria: z.enum(['M', 'N', 'P', 'E', 'V', 'A', 'B', 'C', 'O']),
  noOfTeams: z.number().int().min(2).max(20),
  maxQuarters: z.number().int().min(3).max(12).default(5),
  facilitatorId: z.string().default('facilitator-1'),
});

export const createTeamSchema = z.object({
  teamNo: z.number().int().min(0).max(19),
  teamName: z.string().min(1),
  ceo: z.string().optional().default(''),
  cfo: z.string().optional().default(''),
  coo: z.string().optional().default(''),
  cmo: z.string().optional().default(''),
});
