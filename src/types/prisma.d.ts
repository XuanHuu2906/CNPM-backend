import * as prismaClient from '@prisma/client';

declare module '@prisma/client' {
  export enum UserRole {
    ADMIN = 'ADMIN',
    TEACHER = 'TEACHER',
    STUDENT = 'STUDENT',
    ACADEMIC_DEPT = 'ACADEMIC_DEPT'
  }

  export enum SubmissionStatus {
    CHUA_NOP = 'CHUA_NOP',
    DA_NOP = 'DA_NOP',
    DANG_CHAM = 'DANG_CHAM',
    YEU_CAU_SUA = 'YEU_CAU_SUA',
    TU_CHOI = 'TU_CHOI',
    DA_CHAM = 'DA_CHAM',
    CHO_DUYET = 'CHO_DUYET',
    HOAN_THANH = 'HOAN_THANH'
  }
}
