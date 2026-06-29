// Apply @prisma/client monkey patches FIRST before any module imports the client
import './config/prisma';

// Phải import trước express để patch Router prototype, cho phép async controllers
// throw lỗi và được forward tự động sang errorHandler thay vì crash process.
import 'express-async-errors';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { NotFoundError } from './utils/apiResponse';
import apiRouter from './routes/index';

const app = express();

// B14/S3: Whitelist origins từ env ALLOWED_ORIGINS (CSV)
const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);

if (env.NODE_ENV !== 'production') {
  logger.warn('[CONFIG] NODE_ENV != production → stack traces có thể bị lộ qua errorHandler. Đảm bảo đổi sang production trước khi deploy.');
}

// 1. Core Middlewares
app.use(
  cors({
    origin: (origin, callback) => {
      // Cho phép request không có origin (curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked: origin "${origin}" không nằm trong whitelist`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Custom HTTP request logger middleware
app.use((req: Request, res: Response, next: NextFunction) => {
    logger.info(`Incoming Request: ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
    next();
});

// 3. Register API routes under /api/v1
app.use('/api/v1', apiRouter);

// 4. Handle 404 - Not Found Routes
app.use((req: Request, res: Response, next: NextFunction) => {
    next(new NotFoundError(`Đường dẫn API [${req.method} ${req.originalUrl}] không tồn tại.`));
});

// 5. Global centralized error handler middleware
app.use(errorHandler);

export default app;
