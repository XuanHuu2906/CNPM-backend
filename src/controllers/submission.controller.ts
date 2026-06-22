import { Request, Response, NextFunction } from 'express';
import { submissionService } from '../services/submission.service';
import { ApiResponse, BadRequestError } from '../utils/apiResponse';
import PDFDocument from 'pdfkit';
import fs from 'fs';

export class SubmissionController {
  async submitReport(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user?.actorId;
      if (!studentId) {
        throw new BadRequestError("Tác nhân thực hiện nộp bài phải là Sinh viên");
      }

      const submission = await submissionService.submitReport(studentId, req.body);
      return ApiResponse.created(res, "Nộp tệp tin báo cáo môn học thành công", submission);
    } catch (error) {
      return next(error);
    }
  }

  async getMySubmission(req: Request, res: Response, next: NextFunction) {
    try {
      const studentId = req.user?.actorId;
      if (!studentId) {
        throw new BadRequestError("Tác nhân thực hiện phải là Sinh viên");
      }

      const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined;
      const submission = await submissionService.getStudentSubmission(studentId, classId);
      return ApiResponse.success(res, "Lấy thông tin bài nộp thành công", submission);
    } catch (error) {
      return next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, note, rejectReason, editRequestNote, version } = req.body;
      const actorId = req.user?.actorId;

      if (!actorId) {
        throw new BadRequestError("Không xác định được ID tác nhân phê duyệt thay đổi");
      }

      const submission = await submissionService.updateStatus(
        id,
        version,
        { status, note, rejectReason, editRequestNote },
        actorId,
        req.user!.fullName,
        req.user!.role
      );

      return ApiResponse.success(res, "Cập nhật trạng thái bài báo cáo thành công", submission);
    } catch (error) {
      return next(error);
    }
  }

  async getSubmissionById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const submission = await submissionService.getSubmissionById(id);
      return ApiResponse.success(res, "Lấy chi tiết tệp tin báo cáo thành công", submission);
    } catch (error) {
      return next(error);
    }
  }

  async getSubmissionsByClassId(req: Request, res: Response, next: NextFunction) {
    try {
      const { classId } = req.params;
      const submissions = await submissionService.getSubmissionsByClassId(classId);
      return ApiResponse.success(res, "Lấy danh sách báo cáo nộp của lớp học phần thành công", submissions);
    } catch (error) {
      return next(error);
    }
  }

  async getAllSubmissions(_req: Request, res: Response, next: NextFunction) {
    try {
      const submissions = await submissionService.getAllSubmissions();
      return ApiResponse.success(res, "Lấy danh sách toàn bộ báo cáo nộp thành công", submissions);
    } catch (error) {
      return next(error);
    }
  }

  async exportPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const submission = await submissionService.getSubmissionById(id);
      
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=Phieu_Diem_${id}.pdf`);
      
      doc.pipe(res);
      
      let fontPath = 'Helvetica';
      const possibleFonts = [
        'C:\\Windows\\Fonts\\Arial.ttf',
        'C:\\Windows\\Fonts\\times.ttf',
        'C:\\Windows\\Fonts\\tahoma.ttf',
        'C:\\Windows\\Fonts\\calibri.ttf',
      ];
      for (const f of possibleFonts) {
        if (fs.existsSync(f)) {
          fontPath = f;
          break;
        }
      }
      
      if (fontPath !== 'Helvetica') {
        doc.font(fontPath);
      }
      
      doc.fillColor('#1e1b4b').fontSize(18).text('PHIẾU ĐÁNH GIÁ & BẢNG ĐIỂM CHI TIẾT', { align: 'center' });
      doc.fontSize(10).fillColor('#475569').text('HỆ THỐNG QUẢN LÝ ĐIỂM & ĐÁNH GIÁ BÁO CÁO (EDUGRADE)', { align: 'center' });
      doc.moveDown(1);
      
      doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(1.5);
      
      doc.fillColor('#1e1b4b').fontSize(12).text('I. THÔNG TIN BÀI NỘP VÀ TÁC NHÂN', { underline: true });
      doc.moveDown(0.5);
      
      doc.fontSize(10).fillColor('#1e293b');
      if (submission.student) {
        doc.text(`Sinh viên thực hiện: ${submission.student.user.fullName}`);
        doc.text(`Email liên hệ: ${submission.student.user.email}`);
        doc.text(`Hình thức nộp: Cá nhân`);
      } else if (submission.group) {
        doc.text(`Nhóm sinh viên thực hiện: ${submission.group.name}`);
        const names = submission.group.members.map((m: any) => `${m.student.user.fullName} (${m.student.user.email})`).join(', ');
        doc.text(`Thành viên nhóm: ${names}`);
        doc.text(`Hình thức nộp: Nhóm`);
      }
      
      doc.text(`Tên đường dẫn tệp báo cáo: ${submission.filePath}`);
      doc.text(`Thời gian nộp bài: ${new Date(submission.submittedAt).toLocaleString('vi-VN')}`);
      doc.text(`Trạng thái bài nộp hiện tại: ${submission.status}`);
      doc.moveDown(1.5);
      
      doc.fillColor('#1e1b4b').fontSize(12).text('II. BẢNG ĐIỂM CHI TIẾT & ĐÁNH GIÁ TIÊU CHÍ (RUBRIC)', { underline: true });
      doc.moveDown(0.5);
      
      if (!submission.grades || submission.grades.length === 0) {
        doc.fontSize(10).fillColor('#64748b').text('Hiện tại bài báo cáo chưa được chấm điểm hoặc chưa công bố kết quả chấm.');
      } else {
        submission.grades.forEach((grade: any, index: number) => {
          doc.fillColor('#312e81').fontSize(10).text(`Lần chấm số ${index + 1} - Giảng viên: ${grade.teacher.user.fullName}`);
          doc.moveDown(0.3);
          
          doc.fontSize(8).fillColor('#1e293b');
          
          let currentY = doc.y;
          doc.rect(50, currentY, 495, 20).fill('#f1f5f9');
          doc.fillColor('#0f172a').text('Tiêu chí đánh giá', 55, currentY + 5, { width: 230 });
          doc.text('Điểm tối đa', 290, currentY + 5, { width: 50, align: 'center' });
          doc.text('Đạt được', 350, currentY + 5, { width: 50, align: 'center' });
          doc.text('Nhận xét giảng viên', 410, currentY + 5, { width: 130 });
          doc.moveDown(0.8);
          
          const rubric = grade.rubric;
          let scores: any = {};
          try {
            scores = typeof grade.scoresJson === 'string' ? JSON.parse(grade.scoresJson) : (grade.scoresJson || {});
          } catch (e) {
            scores = {};
          }
          const maxScore = rubric.criteria.reduce((sum: number, c: any) => sum + c.maxScore, 0);
          const totalScore = grade.totalScore;
          
          rubric.criteria.forEach((criterion: any) => {
            let rowY = doc.y;
            if (rowY > 730) {
              doc.addPage();
              if (fontPath !== 'Helvetica') doc.font(fontPath);
              rowY = 50;
            }
            const criterionScore = scores[criterion.id]?.score ?? 0;
            const criterionNote = scores[criterion.id]?.note ?? 'Không có nhận xét';
            
            doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(50, rowY).lineTo(545, rowY).stroke();
            
            doc.fillColor('#334155').text(criterion.name, 55, rowY + 5, { width: 230 });
            doc.text(`${criterion.maxScore}`, 290, rowY + 5, { width: 50, align: 'center' });
            doc.fillColor('#0f172a').text(`${criterionScore}`, 350, rowY + 5, { width: 50, align: 'center' });
            doc.fillColor('#334155').text(criterionNote, 410, rowY + 5, { width: 130 });
            
            doc.moveDown(0.8);
          });
          
          let totalY = doc.y;
          if (totalY > 730) {
            doc.addPage();
            if (fontPath !== 'Helvetica') doc.font(fontPath);
            totalY = 50;
          }
          doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, totalY).lineTo(545, totalY).stroke();
          doc.rect(50, totalY + 1, 495, 20).fill('#e0e7ff');
          doc.fillColor('#1e1b4b').fontSize(9).text('ĐIỂM TỔNG CỘNG', 55, totalY + 5);
          doc.text(`${maxScore}`, 290, totalY + 5, { width: 50, align: 'center' });
          doc.text(`${totalScore}`, 350, totalY + 5, { width: 50, align: 'center' });
          doc.text('Đã phê duyệt chính thức', 410, totalY + 5, { width: 130 });
          
          doc.moveDown(2);
        });
      }
      
      let logsY = doc.y;
      if (logsY > 700) {
        doc.addPage();
        if (fontPath !== 'Helvetica') doc.font(fontPath);
        logsY = 50;
      }
      doc.fillColor('#1e1b4b').fontSize(12).text('III. LỊCH SỬ PHÊ DUYỆT VÀ TRẠNG THÁI', { underline: true });
      doc.moveDown(0.5);
      
      if (submission.statusLogs && submission.statusLogs.length > 0) {
        submission.statusLogs.forEach((log: any) => {
          doc.fontSize(8).fillColor('#475569');
          const time = new Date(log.createdAt).toLocaleString('vi-VN');
          doc.text(`[${time}] - Thay đổi từ ${log.oldStatus} sang ${log.newStatus} (Ghi chú: ${log.note || 'Không có'})`);
        });
      } else {
        doc.fontSize(9).fillColor('#64748b').text('Chưa ghi nhận lịch sử thay đổi trạng thái.');
      }
      
      doc.moveDown(2);
      
      let footerY = doc.y;
      if (footerY > 700) {
        doc.addPage();
        if (fontPath !== 'Helvetica') doc.font(fontPath);
        footerY = 50;
      }
      doc.fontSize(9).fillColor('#475569');
      doc.text('Xác nhận của Giảng viên hướng dẫn', 330, footerY, { align: 'center' });
      doc.text('(Ký và ghi rõ họ tên)', 330, footerY + 15, { align: 'center' });
      
      doc.end();
    } catch (error) {
      next(error);
    }
  }
}

export const submissionController = new SubmissionController();
