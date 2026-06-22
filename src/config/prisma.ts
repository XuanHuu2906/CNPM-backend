import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Runtime enum constants (kept as strings for compatibility; imported by other modules)
const prismaModule = require('@prisma/client');

export const UserRole = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  ACADEMIC_DEPT: 'ACADEMIC_DEPT'
} as const;

export const SubmissionStatus = {
  CHUA_NOP: 'CHUA_NOP',
  DA_NOP: 'DA_NOP',
  DANG_CHAM: 'DANG_CHAM',
  YEU_CAU_SUA: 'YEU_CAU_SUA',
  TU_CHOI: 'TU_CHOI',
  DA_CHAM: 'DA_CHAM',
  CHO_DUYET: 'CHO_DUYET',
  HOAN_THANH: 'HOAN_THANH'
} as const;

prismaModule.UserRole = UserRole;
prismaModule.SubmissionStatus = SubmissionStatus;

// Prevent multiple instances of Prisma Client in development (during hot reloading)
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
