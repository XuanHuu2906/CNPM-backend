import { Router } from 'express';
import { submissionController } from '../../controllers/submission.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { submitReportSchema, updateSubmissionStatusSchema } from '../../validators/submission.validator';
import { UserRole } from '@prisma/client';
import multer from 'multer';
import { uploadService } from '../../services/upload.service';

const router = Router();

// Cấu hình multer lưu tạm file trong Memory Buffer để stream trực tiếp lên Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // Hạn chế tối đa 20MB
  },
});

// API tải file thực tế lên Cloudinary và trả về URL bảo mật
router.post('/upload', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tệp tin tải lên!' });
    }
    
    // Tự động phân loại định dạng tệp tin
    const isImage = req.file.mimetype.startsWith('image/');
    const isPdf = req.file.mimetype === 'application/pdf';
    const resourceType = isImage ? 'image' : (isPdf ? 'image' : 'raw'); // Cloudinary hỗ trợ PDF dưới dạng image hoặc raw

    const uploadResult = await uploadService.uploadFromBuffer(req.file.buffer, {
      folder: 'academic_reports',
      resourceType: resourceType,
    });

    return res.status(200).json({
      success: true,
      message: 'Tải tệp tin lên hệ thống thành công!',
      data: {
        url: uploadResult.secure_url,
        name: req.file.originalname,
        size: req.file.size,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// BÁO CÁO / BÀI NỘP (SUBMISSIONS)
// ==========================================

// 1. Sinh viên nộp mới hoặc nộp đè bài báo cáo môn học (UC-10)
router.post('/submit', authenticate, authorize(UserRole.STUDENT), validate(submitReportSchema), submissionController.submitReport);

// 2. Sinh viên tự xem bài nộp báo cáo của cá nhân hoặc nhóm mình (UC-10, UC-18, UC-22)
router.get('/my', authenticate, authorize(UserRole.STUDENT), submissionController.getMySubmission);

// 2. Giảng viên / PDT duyệt trạng thái bài báo cáo (duyệt/yêu cầu sửa/từ chối) kèm OCC (UC-10, UC-15)
router.put('/:id/status', authenticate, authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_DEPT), validate(updateSubmissionStatusSchema), submissionController.updateStatus);

// 3. Xem toàn bộ bài nộp báo cáo của một lớp học phần
router.get('/class/:classId', authenticate, authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_DEPT), submissionController.getSubmissionsByClassId);

// 4. Xem chi tiết thông tin và lịch sử trạng thái của bài báo cáo
router.get('/:id', authenticate, submissionController.getSubmissionById);

// 4.1. Xem toàn bộ bài nộp báo cáo của hệ thống (PDT/Admin)
router.get('/', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), submissionController.getAllSubmissions);

// 5. Xuất phiếu điểm chi tiết sang định dạng PDF thực tế (UC-06)
router.get('/:id/export-pdf', authenticate, submissionController.exportPdf);

export default router;
