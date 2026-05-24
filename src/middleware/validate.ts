import { Request, Response, NextFunction } from 'express';
import { ZodTypeAny } from 'zod';

/**
 * Middleware tổng quát kiểm duyệt và làm sạch dữ liệu đầu vào sử dụng Zod schema.
 * Nếu không hợp lệ sẽ ném lỗi về errorHandler xử lý tập trung.
 */
export const validate = (schema: ZodTypeAny) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });

      // Gán ngược dữ liệu đã được Zod parse/validate và ép kiểu (coerced) thành công
      req.body = parsed.body || req.body;
      req.query = parsed.query || req.query;
      req.params = parsed.params || req.params;

      return next();
    } catch (error) {
      return next(error);
    }
  };
};
