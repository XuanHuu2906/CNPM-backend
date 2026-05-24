import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export class SecurityHelper {
  /**
   * Băm mật khẩu (hashing) sử dụng bcryptjs
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * So sánh mật khẩu gốc với mật khẩu đã băm
   */
  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  }

  /**
   * Sinh Token JWT ký số
   */
  static generateToken(payload: { id: string; email: string; role: string }): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });
  }

  /**
   * Giải mã và kiểm tra token JWT
   */
  static verifyToken(token: string): { id: string; email: string; role: string } {
    return jwt.verify(token, env.JWT_SECRET) as { id: string; email: string; role: string };
  }
}
