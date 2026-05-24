import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string({ required_error: "DATABASE_URL là bắt buộc" }).min(5, "DATABASE_URL phải là một chuỗi kết nối hợp lệ"),
  JWT_SECRET: z.string().min(12, { message: "JWT_SECRET must be at least 12 characters long" }),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLOUDINARY_URL: z.string({ required_error: "CLOUDINARY_URL là bắt buộc" }).url({ message: "CLOUDINARY_URL phải là một URL hợp lệ" }),
  RESEND_API_KEY: z.string({ required_error: "RESEND_API_KEY là bắt buộc" }).min(1, "RESEND_API_KEY không được để trống")
});

// Run validation
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  console.error("❌ Environment validation error:");
  parseResult.error.issues.forEach((issue) => {
    console.error(`   - [${issue.path.join('.')}] ${issue.message}`);
  });
  process.exit(1);
}

export const env = parseResult.data;
