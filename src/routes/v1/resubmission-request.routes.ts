import { Router } from 'express';
import { resubmissionRequestController } from '../../controllers/resubmission-request.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '@prisma/client';

const router = Router();

// 1. Sinh viên gửi yêu cầu nộp lại (UC-23)
router.post(
  '/', 
  authenticate, 
  authorize(UserRole.STUDENT), 
  resubmissionRequestController.createRequest
);

// 2. Sinh viên xem danh sách yêu cầu của mình
router.get(
  '/my', 
  authenticate, 
  authorize(UserRole.STUDENT), 
  resubmissionRequestController.getMyRequests
);

// 3. Giảng viên xem danh sách yêu cầu cần duyệt
router.get(
  '/teacher', 
  authenticate, 
  authorize(UserRole.TEACHER), 
  resubmissionRequestController.getTeacherPendingRequests
);

// 4. Giảng viên duyệt / từ chối yêu cầu
router.put(
  '/:id/status', 
  authenticate, 
  authorize(UserRole.TEACHER), 
  resubmissionRequestController.updateStatus
);

export default router;
