import { Router } from 'express';
import { submissionController } from '../../controllers/submission.controller';
import { validate } from '../../middleware/validate';
import { authenticate, authorize } from '../../middleware/auth';
import { verifySubmissionOwnership } from '../../middleware/verifySubmissionOwnership';
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

// B16: Whitelist các định dạng được chấp nhận để upload báo cáo
const ALLOWED_UPLOAD_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

// API tải file thực tế lên Cloudinary và trả về URL bảo mật
// B16: chỉ Sinh viên / Giảng viên được upload (loại Admin/PĐT để tránh spam Cloudinary quota).
// TODO: gắn rate-limit khi cài express-rate-limit.
router.post('/upload', authenticate, authorize(UserRole.STUDENT, UserRole.TEACHER), upload.single('file') as any, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tệp tin tải lên!' });
    }

    if (!ALLOWED_UPLOAD_MIMES.has(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `Định dạng tệp tin '${req.file.mimetype}' không được hỗ trợ. Chỉ chấp nhận PDF, ảnh PNG/JPEG, DOC, DOCX.`,
      });
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
router.put('/:id/status', authenticate, authorize(UserRole.TEACHER, UserRole.ACADEMIC_DEPT), validate(updateSubmissionStatusSchema), submissionController.updateStatus);

// 3. Xem toàn bộ bài nộp báo cáo của một lớp học phần
router.get('/class/:classId', authenticate, authorize(UserRole.TEACHER, UserRole.ADMIN, UserRole.ACADEMIC_DEPT), submissionController.getSubmissionsByClassId);

// 4. Xem chi tiết thông tin và lịch sử trạng thái của bài báo cáo
router.get('/:id', authenticate, verifySubmissionOwnership, submissionController.getSubmissionById);

// 4.1. Xem toàn bộ bài nộp báo cáo của hệ thống (PDT/Admin)
router.get('/', authenticate, authorize(UserRole.ADMIN, UserRole.ACADEMIC_DEPT), submissionController.getAllSubmissions);

// 5. Xuất phiếu điểm chi tiết sang định dạng PDF thực tế (UC-06)
router.get('/:id/export-pdf', authenticate, verifySubmissionOwnership, submissionController.exportPdf);

export default router;
