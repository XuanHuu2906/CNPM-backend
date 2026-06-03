import { z } from 'zod';

export const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
  }),
});

export const markReadSchema = z.object({
  params: z.object({
    id: z.string({ required_error: "Mã thông báo là bắt buộc" }),
  }),
});
