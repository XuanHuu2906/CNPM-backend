import { Request, Response, NextFunction } from 'express';
import { resubmissionRequestService } from '../services/resubmission-request.service';
import { ApiResponse } from '../utils/apiResponse';
import { auditLog } from '../utils/audit';

export class ResubmissionRequestController {
  // POST /v1/resubmission-requests
  async createRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user!.actorId; // Requires authentication
      const { submissionId, reason } = req.body;
      
      if (!studentId) {
        return res.status(403).json({ success: false, message: "Chỉ sinh viên mới có thể thực hiện thao tác này." });
      }

      if (!submissionId || !reason) {
        return res.status(400).json({ success: false, message: "Vui lòng cung cấp submissionId và reason." });
      }

      const request = await resubmissionRequestService.createRequest(studentId, submissionId, reason);

      // UC-I04: ghi audit yêu cầu nộp lại
      await auditLog(
        req.user?.id ?? null,
        'TAO_YEU_CAU_NOP_LAI',
        `SV gửi yêu cầu nộp lại cho submission ${submissionId}`,
        req.ip,
      );

      return ApiResponse.created(res, "Gửi yêu cầu xin nộp lại thành công.", request);
    } catch (error) {
      next(error);
    }
  }

  // GET /v1/resubmission-requests/my
  async getMyRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user!.actorId;
      if (!studentId) {
        return res.status(403).json({ success: false, message: "Chỉ sinh viên mới có thể thực hiện thao tác này." });
      }

      const requests = await resubmissionRequestService.getStudentRequests(studentId);
      return ApiResponse.success(res, "Lấy danh sách yêu cầu thành công.", requests);
    } catch (error) {
      next(error);
    }
  }

  // GET /v1/resubmission-requests/teacher
  async getTeacherPendingRequests(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.actorId;
      if (!teacherId) {
        return res.status(403).json({ success: false, message: "Chỉ giảng viên mới có thể thực hiện thao tác này." });
      }

      const requests = await resubmissionRequestService.getTeacherPendingRequests(teacherId);
      return ApiResponse.success(res, "Lấy danh sách yêu cầu chờ xử lý thành công.", requests);
    } catch (error) {
      next(error);
    }
  }

  // PUT /v1/resubmission-requests/:id/status
  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const teacherId = req.user!.actorId;
      if (!teacherId) {
        return res.status(403).json({ success: false, message: "Chỉ giảng viên mới có thể thực hiện thao tác này." });
      }

      const requestId = req.params.id;
      const { status, feedbackNote } = req.body;

      if (status === 'DA_DUYET') {
        const result = await resubmissionRequestService.approveRequest(requestId, teacherId, feedbackNote);
        await auditLog(
          req.user?.id ?? null,
          'DUYET_YEU_CAU_NOP_LAI',
          `GV duyệt yêu cầu nộp lại ${requestId}`,
          req.ip,
        );
        return ApiResponse.success(res, "Đã duyệt yêu cầu nộp lại.", result);
      } else if (status === 'TU_CHOI') {
        if (!feedbackNote) {
          return res.status(400).json({ success: false, message: "Vui lòng nhập lý do từ chối." });
        }
        const result = await resubmissionRequestService.rejectRequest(requestId, teacherId, feedbackNote);
        await auditLog(
          req.user?.id ?? null,
          'TU_CHOI_YEU_CAU_NOP_LAI',
          `GV từ chối yêu cầu nộp lại ${requestId}`,
          req.ip,
        );
        return ApiResponse.success(res, "Đã từ chối yêu cầu nộp lại.", result);
      } else {
        return res.status(400).json({ success: false, message: "Trạng thái không hợp lệ." });
      }
    } catch (error) {
      next(error);
    }
  }
}

export const resubmissionRequestController = new ResubmissionRequestController();
