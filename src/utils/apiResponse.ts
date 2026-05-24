import { Response } from 'express';

// ==========================================
// SUCCESS RESPONSE HELPER
// ==========================================

export class ApiResponse {
  static success<T>(res: Response, message: string, data?: T, statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data: data ?? null
    });
  }

  static created<T>(res: Response, message: string, data?: T) {
    return this.success(res, message, data, 201);
  }
}

// ==========================================
// CUSTOM EXCEPTION CLASSES (APP ERRORS)
// ==========================================

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Dữ liệu đầu vào không hợp lệ") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Phiên làm việc hết hạn hoặc không có quyền truy cập") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Bạn không có quyền thực hiện hành động này") {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Tài nguyên không tìm thấy") {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Dữ liệu bị tranh chấp, vui lòng làm mới trang") {
    super(message, 409);
  }
}

export class InternalServerError extends AppError {
  constructor(message = "Lỗi hệ thống nội bộ") {
    super(message, 500);
  }
}
