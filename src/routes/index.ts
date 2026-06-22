import { Router, Request, Response } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import authRouter from './v1/auth.routes';
import userRouter from './v1/user.routes';
import academicRouter from './v1/academic.routes';
import rubricRouter from './v1/rubric.routes';
import groupRouter from './v1/group.routes';
import submissionRouter from './v1/submission.routes';
import gradeRouter from './v1/grade.routes';
import systemRouter from './v1/system.routes';
import commentRouter from './v1/comment.routes';
import editRequestRouter from './v1/edit-request.routes';
import notificationRouter from './v1/notification.routes';
import resubmissionRequestRouter from './v1/resubmission-request.routes';
import teacherRouter from './v1/teacher.routes';
import internalRouter from './v1/internal.routes';

const router = Router();

// 1. API Health Check
router.get('/health', (req: Request, res: Response) => {
  return ApiResponse.success(res, "Hệ thống hoạt động bình thường!", {
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// 2. Phân hệ Xác thực & Bảo mật (Auth Module)
router.use('/auth', authRouter);

// 3. Phân hệ Quản lý Tài khoản (User Module)
router.use('/users', userRouter);

// 4. Phân hệ Đào tạo & Phân công (Academic Module)
router.use('/academic', academicRouter);

// 5. Phân hệ Quản lý Tiêu chí chấm (Rubric Module)
router.use('/rubrics', rubricRouter);

// 6. Phân hệ Đăng ký đề tài & Nhóm (Group/Topic Module)
router.use('/groups', groupRouter);

// 7. Phân hệ Báo cáo & Bài nộp (Submission Module)
router.use('/submissions', submissionRouter);

// 8. Phân hệ Chấm điểm chi tiết (Grade Module)
router.use('/grades', gradeRouter);

// 9. Phân hệ Quản trị hệ thống & Tiện ích (System Module)
router.use('/system', systemRouter);

// 10. Phân hệ Bình luận (Comment Module - UC-22)
router.use('/comments', commentRouter);

// 11. Phân hệ Yêu cầu chỉnh sửa (Edit Request Module - UC-10)
router.use('/edit-requests', editRequestRouter);

// 12. Phân hệ Thông báo (Notification Module - UC-I03)
router.use('/notifications', notificationRouter);

// 13. Phân hệ Yêu cầu nộp lại (Resubmission Request Module - UC-23)
router.use('/resubmission-requests', resubmissionRequestRouter);

// 14. Phân hệ Giảng viên Quản lý nhóm & đề tài (Teacher Module)
router.use('/teacher', teacherRouter);

// 15. Phân hệ Nội bộ (Internal Module - cho Cron jobs)
router.use('/internal', internalRouter);

export default router;
