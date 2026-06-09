import request from 'supertest';
import express, { Express } from 'express';
import { prisma } from '../src/config/prisma';
import authRouter from '../src/routes/v1/auth.routes';
import { errorHandler } from '../src/middleware/errorHandler';
import { SecurityHelper } from '../src/utils/securityHelper';

// Giả lập Prisma
jest.mock('../src/config/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

const app: Express = express();
app.use(express.json());
app.use('/api/v1/auth', authRouter);
app.use(errorHandler);

describe('XÁC THỰC NGƯỜI DÙNG (Authentication APIs - UC-01)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Đăng nhập thành công với thông tin hợp lệ', async () => {
    const mockHashedPassword = await SecurityHelper.hashPassword('password123');
    
    // Giả lập tìm thấy người dùng
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'mock-user-id',
      email: 'test@student.edu.vn',
      password: mockHashedPassword,
      fullName: 'Nguyen Van A',
      role: 'STUDENT',
      isActive: true,
      student: { id: 'mock-student-id' },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@student.edu.vn',
        password: 'password123',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.user.email).toBe('test@student.edu.vn');
    expect(res.body.data.user.role).toBe('STUDENT');
  });

  it('Đăng nhập thất bại do sai mật khẩu', async () => {
    const mockHashedPassword = await SecurityHelper.hashPassword('password123');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'mock-user-id',
      email: 'test@student.edu.vn',
      password: mockHashedPassword,
      fullName: 'Nguyen Van A',
      role: 'STUDENT',
      isActive: true,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@student.edu.vn',
        password: 'wrongpassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Email hoặc mật khẩu không chính xác');
  });

  it('Đăng nhập thất bại do tài khoản bị khóa (isActive = false)', async () => {
    const mockHashedPassword = await SecurityHelper.hashPassword('password123');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'mock-user-id',
      email: 'test@student.edu.vn',
      password: mockHashedPassword,
      fullName: 'Nguyen Van A',
      role: 'STUDENT',
      isActive: false,
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@student.edu.vn',
        password: 'password123',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Tài khoản đã bị tạm khóa');
  });
});
