import { prisma } from '../config/prisma';
import { Grade } from '@prisma/client';
import { BadRequestError } from '../utils/apiResponse';

export class GradeRepository {
  /**
   * Helper chuyển đổi trường detailedScores từ dạng chuỗi JSON trong CSDL (MSSQL) thành đối tượng JS
   */
  private mapGrade(grade: any): any {
    if (!grade) return null;
    return {
      ...grade,
      detailedScores: typeof grade.detailedScores === 'string' ? JSON.parse(grade.detailedScores) : grade.detailedScores,
    };
  }

  /**
   * Tìm điểm chi tiết của một bài nộp
   */
  async findGradeBySubmissionId(submissionId: string): Promise<any | null> {
    const grade = await prisma.grade.findUnique({
      where: { submissionId },
      include: {
        rubric: {
          include: { criteria: true },
        },
        submission: true,
        // UC-17 (R12): trả kèm thông tin GV đã chấm nháp để FE hiển thị badge
        // "Chấm nháp bởi: GV cũ" khi PĐT đã đổi GV phụ trách giữa kỳ.
        teacher: {
          select: {
            id: true,
            teacherCode: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    return this.mapGrade(grade);
  }

  /**
   * Thực hiện lưu mới hoặc cập nhật điểm của giảng viên kèm kiểm duyệt phiên bản OCC
   */
  async upsertGradeWithOCC(
    submissionId: string,
    data: {
      rubricId: string;
      teacherId: string;
      detailedScores: any; // Mảng JSON chứa [{ criteriaId, score }]
      finalScore: number;
      feedback?: string | null;
    },
    currentVersion?: number
  ): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.grade.findUnique({
        where: { submissionId },
      });

      const serializedScores = JSON.stringify(data.detailedScores); // Serialize sang chuỗi cho MSSQL

      if (!existing) {
        // 1. Nếu chưa có điểm, tiến hành tạo mới bảng điểm chi tiết
        const created = await tx.grade.create({
          data: {
            submissionId,
            rubricId: data.rubricId,
            teacherId: data.teacherId,
            detailedScores: serializedScores,
            finalScore: data.finalScore,
            feedback: data.feedback ?? null,
            version: 1,
          },
        });
        return this.mapGrade(created);
      } else {
        // 2. Nếu đã có điểm, tiến hành cập nhật đè điểm mới kèm so khớp phiên bản (OCC)
        const versionToCheck = currentVersion ?? existing.version;

        const updateResult = await tx.grade.updateMany({
          where: {
            submissionId,
            version: versionToCheck,
          },
          data: {
            rubricId: data.rubricId,
            teacherId: data.teacherId,
            detailedScores: serializedScores,
            finalScore: data.finalScore,
            feedback: data.feedback ?? null,
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new BadRequestError("Dữ liệu điểm số của bài báo cáo này đã bị thay đổi bởi giảng viên khác trước đó. Vui lòng tải lại trang để hiển thị kết quả chính xác nhất.");
        }

        const updated = await tx.grade.findUniqueOrThrow({
          where: { submissionId },
        });
        return this.mapGrade(updated);
      }
    });
  }

  /**
   * Phê duyệt hoặc hủy phê duyệt bảng điểm kèm kiểm duyệt phiên bản OCC
   */
  async approveGradeWithOCC(
    submissionId: string,
    currentVersion: number,
    isApproved: boolean,
    approvedById: string
  ): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      const updateResult = await tx.grade.updateMany({
        where: {
          submissionId,
          version: currentVersion,
        },
        data: {
          isApproved,
          approvedById: isApproved ? approvedById : null,
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestError("Bảng điểm đã bị thay đổi bởi một tiến trình khác trước đó. Vui lòng tải lại trang.");
      }

      const updated = await tx.grade.findUniqueOrThrow({
        where: { submissionId },
      });
      return this.mapGrade(updated);
    });
  }
}

export const gradeRepository = new GradeRepository();
