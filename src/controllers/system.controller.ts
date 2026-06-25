import { Request, Response } from 'express';
import { systemService } from '../services/system.service';
import { ApiResponse, BadRequestError, NotFoundError } from '../utils/apiResponse';
import { prisma } from '../config/prisma';
import fs from 'fs';
import path from 'path';

export class SystemController {
  // UC-16: Phê duyệt theo lô — PĐT chọn nhiều bài để phê duyệt hoặc trả về cùng lúc.
  async batchApproveGrades(req: Request, res: Response) {
    const { submissionIds, action, reason } = req.body || {};
    const actorId = req.user?.actorId;
    if (!actorId) {
      throw new BadRequestError('Yêu cầu xác thực Phòng Đào Tạo / Admin');
    }
    const result = await systemService.batchApproveGrades({
      submissionIds,
      action,
      reason,
      actorId,
    });
    const message = action === 'APPROVE'
      ? `Đã phê duyệt ${result.successCount}/${result.totalRequested} bài`
      : `Đã trả về ${result.successCount}/${result.totalRequested} bài`;
    return ApiResponse.success(res, message, result);
  }

  async approveGrade(req: Request, res: Response) {
    const { submissionId } = req.params;
    const { isApproved, version } = req.body;
    const approvedById = req.user?.actorId;

    if (!approvedById) {
      throw new BadRequestError("Tác nhân thực hiện phê duyệt phải là Phòng Đào Tạo hoặc Admin");
    }

    const grade = await systemService.approveGrade(submissionId, isApproved, version, approvedById);
    
    const message = isApproved 
      ? "Phê duyệt chính thức bảng điểm báo cáo thành công" 
      : "Hủy bỏ trạng thái phê duyệt bảng điểm thành công";

    return ApiResponse.success(res, message, grade);
  }

  async updateConfig(req: Request, res: Response) {
    const { key, value, description } = req.body;
    const actorId = req.user?.id;

    const config = await systemService.updateConfig(key, value, description, actorId);
    return ApiResponse.success(res, "Cập nhật tham số cấu hình hệ thống thành công", config);
  }

  async getConfigs(req: Request, res: Response) {
    const configs = await systemService.getConfigs();
    return ApiResponse.success(res, "Lấy danh sách các tham số cấu hình hệ thống thành công", configs);
  }

  async getLogs(req: Request, res: Response) {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const data = await systemService.getLogs(page, limit);
    return ApiResponse.success(res, "Lấy lịch sử hoạt động hệ thống thành công", data);
  }

  async backupDb(req: Request, res: Response) {
    const actorId = req.user?.id;
    if (!actorId) {
      throw new BadRequestError("Yêu cầu xác thực tài khoản để thực hiện sao lưu");
    }

    try {
      const metadata = await systemService.backupDatabase(actorId);
      return ApiResponse.success(res, "Sao lưu toàn bộ cơ sở dữ liệu thành công", metadata);
    } catch (error: any) {
      await systemService.logAction(
        actorId,
        "SAO_LƯU_THẤT_BẠI",
        `Tạo bản sao lưu thất bại: ${error.message}`
      );
      throw error;
    }
  }

  async restoreDb(req: Request, res: Response) {
    const { backupFile } = req.body;
    const actorId = req.user?.id;
    
    if (!actorId) {
      throw new BadRequestError("Yêu cầu xác thực tài khoản để thực hiện khôi phục");
    }

    try {
      const restoreMetadata = await systemService.restoreDatabase(backupFile, actorId);
      return ApiResponse.success(res, "Khôi phục toàn bộ cơ sở dữ liệu từ tệp tin JSON thành công", restoreMetadata);
    } catch (error: any) {
      await systemService.logAction(
        actorId,
        "KHÔI_PHỤC_THẤT_BẠI",
        `Yêu cầu khôi phục cơ sở dữ liệu từ file [${backupFile}] thất bại: ${error.message}`
      );
      throw error;
    }
  }

  async search(req: Request, res: Response) {
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return ApiResponse.success(res, "Kết quả tìm kiếm", { groups: [], submissions: [], teachers: [] });
    }

    const [groups, submissions, teachers] = await Promise.all([
      prisma.group.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            { topicName: { contains: q } },
          ],
        },
        include: {
          members: {
            include: {
              student: {
                include: {
                  user: { select: { fullName: true, email: true } },
                },
              },
            },
          },
        },
        take: 10,
      }),
      prisma.submission.findMany({
        where: {
          OR: [
            { filePath: { contains: q } },
            { student: { user: { fullName: { contains: q } } } },
            { group: { name: { contains: q } } },
            { group: { topicName: { contains: q } } },
          ],
        },
        include: {
          student: { include: { user: { select: { fullName: true } } } },
          group: true,
        },
        take: 10,
      }),
      prisma.teacher.findMany({
        where: {
          OR: [
            { user: { fullName: { contains: q } } },
            { user: { email: { contains: q } } },
            { teacherCode: { contains: q } },
          ],
        },
        include: {
          user: { select: { fullName: true, email: true } },
        },
        take: 10,
      }),
    ]);

    const mappedSubmissions = submissions.map((sub: any) => ({
      ...sub,
      attachments: sub.attachments ? sub.attachments.split(',').filter(Boolean) : [],
    }));

    return ApiResponse.success(res, "Tìm kiếm thành công", {
      groups,
      submissions: mappedSubmissions,
      teachers,
    });
  }

  async listBackups(req: Request, res: Response) {
    try {
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const files = fs.readdirSync(backupDir);
      const backups = files
        .filter(file => file.endsWith('.json') && !file.includes('temp_'))
        .map(file => {
          const filePath = path.join(backupDir, file);
          try {
            const raw = fs.readFileSync(filePath, 'utf8');
            const meta = JSON.parse(raw);
            
            // Đảm bảo tệp nén zip tương ứng tồn tại
            const zipName = file.replace('.json', '.zip');
            const zipPath = path.join(backupDir, zipName);
            if (fs.existsSync(zipPath)) {
              return {
                id: zipName,
                fileName: zipName,
                fileSize: meta.fileSize || '0.00 MB',
                createdAt: meta.createdAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
                type: meta.type || 'Thủ công',
                creator: meta.creator || 'Hệ thống'
              };
            }
          } catch (e) {
            // Bỏ qua nếu lỗi đọc tệp
          }
          return null;
        })
        .filter((item): item is any => item !== null)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // Lấy thông số bản sao lưu mới nhất
      const latestBackup = backups[0];
      const latestBackupAt = latestBackup ? latestBackup.createdAt : null;
      const latestBackupStatus = latestBackup ? "Thành công" : null;

      // Lấy cấu hình khôi phục gần nhất từ database
      let latestRestoreAt: string | null = null;
      let latestRestoredBackupId: string | null = null;
      let latestRestoredBackupFile: string | null = null;
      let latestRestoredBy: string | null = null;
      let latestRestoreStatus: string | null = null;

      try {
        const config = await prisma.systemConfig.findUnique({ where: { key: 'last_restore_metadata' } });
        if (config && config.value) {
          const restoreMeta = JSON.parse(config.value);
          latestRestoreAt = restoreMeta.lastRestoreAt || null;
          latestRestoredBackupId = restoreMeta.lastRestoredBackupId || null;
          latestRestoredBackupFile = restoreMeta.lastRestoredBackupFile || null;
          latestRestoredBy = restoreMeta.lastRestoredBy || null;
          latestRestoreStatus = restoreMeta.lastRestoreStatus || null;
        }
      } catch (err) {
        // Bỏ qua lỗi truy vấn config
      }

      return ApiResponse.success(res, "Lấy danh sách tệp sao lưu thành công", {
        backups,
        latestBackupAt,
        latestBackupStatus,
        latestRestoreAt,
        latestRestoredBackupId,
        latestRestoredBackupFile,
        latestRestoredBy,
        latestRestoreStatus
      });
    } catch (error: any) {
      throw new BadRequestError(`Không thể lấy danh sách bản sao lưu: ${error.message}`);
    }
  }

  async deleteBackup(req: Request, res: Response) {
    try {
      const { filename } = req.params;
      const safeFilename = path.basename(filename);
      const backupDir = path.join(process.cwd(), 'backups');
      
      const zipPath = path.join(backupDir, safeFilename);
      const jsonFilename = safeFilename.replace('.zip', '.json');
      const jsonPath = path.join(backupDir, jsonFilename);

      let deleted = false;
      if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
        deleted = true;
      }
      if (fs.existsSync(jsonPath)) {
        fs.unlinkSync(jsonPath);
        deleted = true;
      }

      if (deleted) {
        // Ghi log
        const actorId = req.user?.id;
        if (actorId) {
          await systemService.logAction(
            actorId,
            "XÓA_BẢN_SAO_LƯU",
            `Xóa gói sao lưu cơ sở dữ liệu và tài liệu uploads khỏi hệ thống: ${safeFilename}`
          );
        }
        return ApiResponse.success(res, "Xóa tệp sao lưu thành công");
      } else {
        throw new NotFoundError("Không tìm thấy tệp sao lưu cần xóa");
      }
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new BadRequestError(`Không thể xóa tệp sao lưu: ${error.message}`);
    }
  }

  async downloadBackup(req: Request, res: Response) {
    try {
      const { filename } = req.params;
      const safeFilename = path.basename(filename);
      const filePath = path.join(process.cwd(), 'backups', safeFilename);
      if (fs.existsSync(filePath)) {
        // Ghi nhận nhật ký hệ thống
        const actorId = req.user?.id;
        if (actorId) {
          await systemService.logAction(
            actorId,
            "TẢI_BẢN_SAO_LƯU",
            `Tải xuống gói sao lưu cơ sở dữ liệu và tài liệu uploads: ${safeFilename}`
          );
        }
        return res.download(filePath, safeFilename);
      } else {
        throw new NotFoundError("Không tìm thấy tệp sao lưu cần tải xuống");
      }
    } catch (error: any) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new BadRequestError(`Không thể tải xuống tệp sao lưu: ${error.message}`);
    }
  }

  async getSemesterLockStats(req: Request, res: Response) {
    const { id } = req.params;
    const stats = await systemService.getSemesterLockStats(id);
    return ApiResponse.success(res, "Lấy thông số khóa điểm học kỳ thành công", stats);
  }

  async getSemesterProgress(req: Request, res: Response) {
    const { id } = req.params;
    const stats = await systemService.getSemesterProgress(id);
    return ApiResponse.success(res, "Lấy tiến độ học kỳ thành công", stats);
  }

  async lockSemester(req: Request, res: Response) {
    const { id } = req.params;
    const actorId = req.user?.id;
    if (!actorId) {
      throw new BadRequestError("Yêu cầu xác thực tài khoản để thực hiện khóa điểm học kỳ");
    }
    const updatedTerm = await systemService.lockSemester(id, actorId);
    return ApiResponse.success(res, "Khóa điểm học kỳ thành công. Toàn bộ điểm số đã được đóng băng vĩnh viễn.", updatedTerm);
  }
}

export const systemController = new SystemController();
