import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';

/**
 * B16: Rate-limit cho các endpoint upload/submit để chống lạm dụng Cloudinary quota
 * và DoS database.
 *
 * Key theo user.id (nếu đã authenticate) thay vì IP để tránh false-positive khi nhiều
 * SV cùng nộp từ một mạng (lab/wifi trường).
 */
const userOrIpKey = (req: Request, res: any): string => {
  const userId = (req as any).user?.id;
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
};

export const uploadRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Bạn đã upload quá nhiều lần trong thời gian ngắn. Vui lòng thử lại sau 5 phút.',
  },
});

export const submitRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKey,
  message: {
    success: false,
    message: 'Bạn đã thao tác nộp bài quá nhiều lần. Vui lòng thử lại sau 5 phút.',
  },
});
