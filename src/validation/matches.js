import { z } from 'zod';

// Constant for match statuses
export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
};

// Helper function to validate ISO date string
const isISODate = (val) => {
  const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;
  if (!isoRegex.test(val)) return false;
  const d = new Date(val);
  return !isNaN(d.getTime());
};

// Schema for listing matches query parameters
export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

// Schema for match ID route parameter
export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Schema for creating a match
export const createMatchSchema = z.object({
  sport: z.string().min(1, { message: "Sport must be a non-empty string" }),
  homeTeam: z.string().min(1, { message: "Home team must be a non-empty string" }),
  awayTeam: z.string().min(1, { message: "Away team must be a non-empty string" }),
  startTime: z.string().refine(isISODate, { message: "startTime must be a valid ISO date string" }),
  endTime: z.string().refine(isISODate, { message: "endTime must be a valid ISO date string" }),
  homeScore: z.coerce.number().int().nonnegative().optional(),
  awayScore: z.coerce.number().int().nonnegative().optional(),
}).superRefine((data, ctx) => {
  if (isISODate(data.startTime) && isISODate(data.endTime)) {
    const start = new Date(data.startTime);
    const end = new Date(data.endTime);
    if (end.getTime() <= start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endTime must be chronologically after startTime",
        path: ["endTime"],
      });
    }
  }
});

// Schema for updating scores
export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
