import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ZodError } from 'zod';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // 1. Ghi log lỗi chi tiết qua Winston logger
  logger.error(`${req.method} ${req.originalUrl} - Error: ${err.message}`, {
    stack: err.stack,
  });

  // 2. Xử lý lỗi validate dữ liệu đầu vào của Zod (ZodError)
  if (err instanceof ZodError) {
    const formattedIssues = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return res.status(400).json({
      success: false,
      message: "Dữ liệu đầu vào không hợp lệ",
      errors: formattedIssues,
    });
  }

  // 3. Xử lý các lỗi nghiệp vụ định nghĩa sẵn (AppError)
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // 4. Xử lý lỗi không xác định (Internal Server Error)
  const isDev = env.NODE_ENV === 'development';
  return res.status(500).json({
    success: false,
    message: isDev ? err.message : "Đã xảy ra lỗi hệ thống nội bộ. Vui lòng liên hệ quản trị viên.",
    ...(isDev && { stack: err.stack }),
  });
};
