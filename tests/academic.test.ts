import { academicService } from '../src/services/academic.service';
import { prisma } from '../src/config/prisma';
import { BadRequestError } from '../src/utils/apiResponse';

// Giả lập Prisma
jest.mock('../src/config/prisma', () => ({
  prisma: {
    class: {
      findUnique: jest.fn(),
    },
    academicTerm: {
      findUnique: jest.fn(),
    },
  },
}));

describe('QUẢN LÝ NIÊN KHÓA & CHỐT CHẶN (Academic & Term Lock Guards)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Cho phép đi tiếp nếu học kỳ niên khóa đang MỞ khóa (isLocked = false)', async () => {
    // Giả lập tìm thấy lớp liên kết học kỳ đang Mở
    (prisma.class.findUnique as jest.Mock).mockResolvedValue({
      id: 'class-123',
      classCode: 'LH01',
      termId: 'term-123',
      term: {
        id: 'term-123',
        name: 'Học kỳ 1 - 2026',
        isLocked: false, // Học kỳ đang mở!
      }
    });

    // Hàm gọi không được ném ra lỗi nào
    await expect(academicService.verifyTermActive('class-123')).resolves.not.toThrow();
  });

  it('Ném lỗi BadRequestError chặn đứng nếu học kỳ niên khóa đã bị KHÓA điểm (isLocked = true)', async () => {
    // Giả lập tìm thấy lớp liên kết học kỳ đã Khóa
    (prisma.class.findUnique as jest.Mock).mockResolvedValue({
      id: 'class-123',
      classCode: 'LH01',
      termId: 'term-123',
      term: {
        id: 'term-123',
        name: 'Học kỳ 1 - 2026',
        isLocked: true, // Học kỳ đã bị KHÓA!
      }
    });

    // Phải ném ra lỗi BadRequestError với thông báo phù hợp
    await expect(academicService.verifyTermActive('class-123')).rejects.toThrow(BadRequestError);
    await expect(academicService.verifyTermActive('class-123')).rejects.toThrow(
      'đã bị khóa điểm toàn cục'
    );
  });
});
