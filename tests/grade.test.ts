import { gradeService } from '../src/services/grade.service';
import { prisma, SubmissionStatus } from '../src/config/prisma';
import { BadRequestError } from '../src/utils/apiResponse';

// Giả lập các Repository liên đới
jest.mock('../src/repositories/grade.repository', () => ({
  gradeRepository: {
    findGradeBySubmissionId: jest.fn(),
    upsertGradeWithOCC: jest.fn(),
  },
}));

jest.mock('../src/repositories/submission.repository', () => ({
  submissionRepository: {
    findSubmissionById: jest.fn(),
    updateSubmissionStatusWithOCC: jest.fn(),
  },
}));

jest.mock('../src/services/rubric.service', () => ({
  rubricService: {
    getRubricById: jest.fn(),
  },
}));

jest.mock('../src/services/academic.service', () => ({
  academicService: {
    verifyTermActive: jest.fn(),
  },
}));

import { gradeRepository } from '../src/repositories/grade.repository';
import { submissionRepository } from '../src/repositories/submission.repository';
import { rubricService } from '../src/services/rubric.service';

describe('CHẤM ĐIỂM & CHỐT ĐIỂM (Grading Service - UC-11, UC-16)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Tính toán điểm tổng kết finalScore chuẩn xác theo trọng số của Rubric và làm tròn 2 chữ số thập phân', async () => {
    // 1. Giả lập thông tin bài nộp hợp lệ
    (submissionRepository.findSubmissionById as jest.Mock).mockResolvedValue({
      id: 'sub-123',
      status: SubmissionStatus.DA_NOP,
      student: { classId: 'class-abc' },
      version: 1,
    });

    // Chưa có điểm chấm cũ
    (gradeRepository.findGradeBySubmissionId as jest.Mock).mockResolvedValue(null);

    // 2. Giả lập Rubric có 2 tiêu chí: Tiêu chí 1 (trọng số 30%), Tiêu chí 2 (trọng số 70%)
    (rubricService.getRubricById as jest.Mock).mockResolvedValue({
      id: 'rub-123',
      criteria: [
        { id: 'crit-1', name: 'Nội dung báo cáo', maxScore: 10, weight: 30 },
        { id: 'crit-2', name: 'Thuyết trình bài tập', maxScore: 10, weight: 70 },
      ],
    });

    (gradeRepository.upsertGradeWithOCC as jest.Mock).mockResolvedValue({
      id: 'grade-123',
      submissionId: 'sub-123',
      finalScore: 8.7, // 8.0 * 0.3 + 9.0 * 0.7 = 8.7
    });

    // 3. Thực thi chấm điểm: 8 điểm cho crit-1, 9 điểm cho crit-2
    const grade = await gradeService.submitGrade('sub-123', 'teacher-123', {
      rubricId: 'rub-123',
      detailedScores: [
        { criteriaId: 'crit-1', score: 8 },
        { criteriaId: 'crit-2', score: 9 },
      ],
      feedback: 'Bài nộp đạt yêu cầu tốt',
      version: 1,
    });

    // 4. Kiểm chứng kết quả tính toán finalScore trong đối số được truyền xuống repository
    expect(gradeRepository.upsertGradeWithOCC).toHaveBeenCalledWith(
      'sub-123',
      expect.objectContaining({
        rubricId: 'rub-123',
        finalScore: 8.7, // 8 * 0.3 + 9 * 0.7 = 8.7
      }),
      1
    );

    expect(grade.finalScore).toBe(8.7);
  });

  it('Chặn đứng hoàn toàn việc chấm/sửa đổi điểm nếu bảng điểm đã được Phòng Đào Tạo phê duyệt (isApproved = true)', async () => {
    // Giả lập bài nộp
    (submissionRepository.findSubmissionById as jest.Mock).mockResolvedValue({
      id: 'sub-123',
      status: SubmissionStatus.DA_CHAM,
      student: { classId: 'class-abc' },
    });

    // Giả lập bảng điểm cũ ĐÃ được APPROVED
    (gradeRepository.findGradeBySubmissionId as jest.Mock).mockResolvedValue({
      id: 'grade-123',
      submissionId: 'sub-123',
      isApproved: true, // Điểm đã được phê duyệt!
    });

    // Thực thi ném lỗi BadRequestError từ tầng Service
    await expect(
      gradeService.submitGrade('sub-123', 'teacher-123', {
        rubricId: 'rub-123',
        detailedScores: [],
        version: 1,
      })
    ).rejects.toThrow(BadRequestError);

    await expect(
      gradeService.submitGrade('sub-123', 'teacher-123', {
        rubricId: 'rub-123',
        detailedScores: [],
        version: 1,
      })
    ).rejects.toThrow('Bảng điểm của bài báo cáo này đã được Phòng Đào Tạo phê duyệt chính thức. Không thể chỉnh sửa điểm số!');
  });
});
