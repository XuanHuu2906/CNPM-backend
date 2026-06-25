import { systemRepository } from '../repositories/system.repository';
import { gradeRepository } from '../repositories/grade.repository';
import { submissionRepository } from '../repositories/submission.repository';
import { academicService } from './academic.service';
import { BadRequestError, NotFoundError } from '../utils/apiResponse';
import { Grade, SystemConfig, SystemLog } from '@prisma/client';
import { prisma } from '../config/prisma';
import fs from 'fs';
import path from 'path';

export class SystemService {
  // ==========================================
  // SYSTEM LOGS (NHẬT KÝ HỆ THỐNG - UC-21)
  // ==========================================

  /**
   * Lưu nhanh nhật ký hoạt động hệ thống
   */
  async logAction(userId: string | null, action: string, description: string, ipAddress?: string): Promise<SystemLog> {
    return await systemRepository.createLog(userId, action, description, ipAddress);
  }

  /**
   * Truy xuất lịch sử nhật ký hệ thống phân trang
   */
  async getLogs(page: number = 1, limit: number = 20) {
    const realPage = Math.max(1, page);
    const realLimit = Math.max(1, limit);
    const skip = (realPage - 1) * realLimit;

    const [logs, total] = await Promise.all([
      systemRepository.getLogs(skip, realLimit),
      systemRepository.getLogsCount(),
    ]);

    return {
      logs,
      pagination: {
        page: realPage,
        limit: realLimit,
        total,
        totalPages: Math.ceil(total / realLimit),
      },
    };
  }

  // ==========================================
  // SYSTEM CONFIGS (CẤU HÌNH HỆ THỐNG - UC-14)
  // ==========================================

  async updateConfig(key: string, value: string, description?: string, actorId?: string): Promise<SystemConfig> {
    const oldConfig = await systemRepository.getConfigByKey(key);
    const oldValue = oldConfig ? oldConfig.value : 'Chưa thiết lập';
    const config = await systemRepository.upsertConfig(key, value, description);
    
    if (actorId) {
      let action = "CẬP_NHẬT_CẤU_HÌNH";
      const keyUpper = key.toUpperCase();
      if (['SESSION_TIMEOUT', 'MAX_LOGIN_ATTEMPTS', 'REQUIRE_TWO_FACTOR'].includes(keyUpper)) {
        action = "CAP_NHAT_CAU_HINH_HE_THONG";
      } else if ([
        'MAX_MAIN_REPORT_SIZE_MB', 'MAX_ATTACHMENT_SIZE_MB', 'MAX_TOTAL_UPLOAD_SIZE_MB',
        'MAX_ATTACHMENT_FILES', 'ALLOWED_MAIN_REPORT_EXTENSIONS', 'ALLOWED_ATTACHMENT_EXTENSIONS',
        'MAX_FILE_SIZE'
      ].includes(keyUpper)) {
        action = "CAP_NHAT_CAU_HINH_TEP_TIN";
      } else if (['SIMILARITY_WARNING_THRESHOLD', 'PLAGIARISM_THRESHOLD'].includes(keyUpper)) {
        action = "CAP_NHAT_NGUONG_TRUNG_LAP";
      } else if (['ENABLE_EMAIL_NOTIFICATION', 'ENABLE_IN_APP_NOTIFICATION', 'EMAIL_TEMPLATE_SUBMISSION', 'EMAIL_TEMPLATE_VIOLATION'].includes(keyUpper)) {
        action = "CAP_NHAT_MAU_THONG_BAO";
      }
      
      await this.logAction(
        actorId,
        action,
        `Cập nhật cấu hình [${key}] từ [${oldValue}] thành [${value}] (Thành công)`
      );
    }

    return config;
  }

  async getConfigs(): Promise<SystemConfig[]> {
    return await systemRepository.getAllConfigs();
  }

  async getConfigValue(key: string, defaultValue: string): Promise<string> {
    const config = await systemRepository.getConfigByKey(key);
    return config ? config.value : defaultValue;
  }

  // ==========================================
  // UC-16 (BATCH): PHÊ DUYỆT / TRẢ VỀ NHIỀU BÀI MỘT LẦN
  // ==========================================
  // Mỗi item chạy trong transaction riêng:
  //  - APPROVE: Grade.isApproved=true + submission.status=HOAN_THANH (OCC).
  //  - RETURN : Grade.isApproved=false + submission.status=DANG_CHAM (OCC), reason bắt buộc.
  // Item lỗi không làm hỏng phần còn lại — trả về kết quả per-item.
  async batchApproveGrades(params: {
    submissionIds: string[];
    action: 'APPROVE' | 'RETURN';
    reason?: string;
    actorId: string;
  }) {
    const { submissionIds, action, reason, actorId } = params;

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      throw new BadRequestError('Danh sách bài cần phê duyệt rỗng');
    }
    if (submissionIds.length > 100) {
      throw new BadRequestError('Mỗi lần xử lý tối đa 100 bài để tránh quá tải');
    }
    if (action !== 'APPROVE' && action !== 'RETURN') {
      throw new BadRequestError('Hành động không hợp lệ');
    }
    if (action === 'RETURN' && (!reason || !reason.trim())) {
      throw new BadRequestError('Vui lòng nhập lý do trả về');
    }

    const uniqueIds = [...new Set(submissionIds)];
    const results: Array<
      | { submissionId: string; status: 'SUCCESS' }
      | { submissionId: string; status: 'FAILED'; reason: string }
    > = [];

    for (const submissionId of uniqueIds) {
      try {
        const submission = await prisma.submission.findUnique({
          where: { id: submissionId },
          include: {
            grades: true,
            student: { include: { enrollments: { take: 1, orderBy: { createdAt: 'desc' } } } },
            group: { select: { classId: true } },
          },
        });
        if (!submission) {
          throw new Error('Không tìm thấy bài nộp');
        }
        if (submission.status !== 'CHO_DUYET') {
          throw new Error(`Bài nộp đang ở trạng thái ${submission.status}, không phải CHO_DUYET`);
        }
        const grade = submission.grades[0];
        if (!grade) {
          throw new Error('Chưa có điểm chấm');
        }

        const classId = submission.group?.classId
          ?? submission.student?.enrollments[0]?.classId
          ?? null;
        if (classId) {
          await academicService.verifyTermActive(classId);
        }

        const targetStatus = action === 'APPROVE' ? 'HOAN_THANH' : 'DANG_CHAM';

        await prisma.$transaction(async (tx) => {
          // 1. Grade OCC
          const updGrade = await tx.grade.updateMany({
            where: { submissionId, version: grade.version },
            data: {
              isApproved: action === 'APPROVE',
              approvedById: action === 'APPROVE' ? actorId : null,
              version: { increment: 1 },
            },
          });
          if (updGrade.count === 0) {
            throw new Error('Bảng điểm đã bị thay đổi (OCC), vui lòng tải lại');
          }

          // 2. Submission OCC
          const updSub = await tx.submission.updateMany({
            where: { id: submissionId, version: submission.version, status: 'CHO_DUYET' },
            data: {
              status: targetStatus,
              rejectReason: action === 'RETURN' ? (reason ?? null) : null,
              version: { increment: 1 },
            },
          });
          if (updSub.count === 0) {
            throw new Error('Trạng thái bài nộp đã bị thay đổi (OCC)');
          }

          // 3. Log
          await tx.submissionLog.create({
            data: {
              submissionId,
              oldStatus: 'CHO_DUYET',
              newStatus: targetStatus,
              actorId,
              note: action === 'APPROVE'
                ? 'PĐT phê duyệt (batch UC-16)'
                : `PĐT trả về chấm lại (batch UC-16): ${reason ?? ''}`,
            },
          });
        });

        // Notify (best-effort)
        try {
          const userIds: string[] = [];
          if (submission.student) {
            const stu = await prisma.student.findUnique({
              where: { id: submission.studentId! },
              select: { userId: true },
            });
            if (stu?.userId) userIds.push(stu.userId);
          }
          if (submission.group?.classId) {
            const members = await prisma.groupMember.findMany({
              where: { groupId: submission.groupId! },
              include: { student: { select: { userId: true } } },
            });
            members.forEach(m => { if (m.student.userId) userIds.push(m.student.userId); });
          }
          for (const uid of [...new Set(userIds)]) {
            await prisma.notification.create({
              data: {
                userId: uid,
                title: action === 'APPROVE' ? 'Kết quả đã được phê duyệt' : 'Bài nộp bị trả về chấm lại',
                content: action === 'APPROVE'
                  ? 'Phòng Đào tạo đã phê duyệt kết quả chấm điểm. Bạn có thể xem điểm chính thức.'
                  : `Phòng Đào tạo trả về bài nộp để chấm lại. Lý do: ${reason ?? ''}`,
                type: 'TRANG_THAI',
                submissionId,
              },
            });
          }
        } catch {
          // best-effort
        }

        results.push({ submissionId, status: 'SUCCESS' });
      } catch (err: any) {
        results.push({ submissionId, status: 'FAILED', reason: err.message || 'Lỗi không xác định' });
      }
    }

    const successCount = results.filter(r => r.status === 'SUCCESS').length;
    const failedCount = results.length - successCount;

    await this.logAction(
      actorId,
      'PHE_DUYET_DIEM_LO',
      `Duyệt theo lô (${action}): tổng ${uniqueIds.length}, OK ${successCount}, lỗi ${failedCount}${reason ? `, lý do: ${reason}` : ''}`,
    );

    return {
      action,
      totalRequested: uniqueIds.length,
      successCount,
      failedCount,
      results,
    };
  }

  // ==========================================
  // PHÊ DUYỆT ĐIỂM (GRADE APPROVALS - UC-16)
  // ==========================================

  /**
   * PDT phê duyệt hoặc gỡ phê duyệt bảng điểm của bài báo cáo (OCC)
   */
  async approveGrade(
    submissionId: string,
    isApproved: boolean,
    version: number,
    approvedById: string
  ): Promise<Grade> {
    // 1. Kiểm tra tồn tại điểm số
    const grade = await gradeRepository.findGradeBySubmissionId(submissionId);
    if (!grade) {
      throw new NotFoundError("Báo cáo môn học chưa được giảng viên nhập điểm. Không thể phê duyệt!");
    }

    // 2. Kiểm duyệt chốt chặn học kỳ khóa điểm
    const submission = await submissionRepository.findSubmissionById(submissionId);
    let classId = submission?.group?.classId;
    if (!classId && submission?.student) {
      const student = submission.student as any;
      if (student.enrollments && student.enrollments.length > 0) {
        classId = student.enrollments[0]?.classId;
      }
    }
    if (classId) {
      await academicService.verifyTermActive(classId);
    }

    // 3. Thực thi phê duyệt điểm kèm kiểm soát phiên bản OCC
    const updatedGrade = await gradeRepository.approveGradeWithOCC(
      submissionId,
      version,
      isApproved,
      approvedById
    );

    // 4. Lưu vết hoạt động hệ thống
    const actionName = isApproved ? "PHÊ_DUYỆT_ĐIỂM" : "HỦY_PHÊ_DUYỆT_ĐIỂM";
    const actionDesc = isApproved
      ? `Phê duyệt chính thức điểm số bài báo cáo [ID: ${submissionId}] với điểm tổng kết [${grade.finalScore}]`
      : `Hủy trạng thái phê duyệt chính thức điểm số bài báo cáo [ID: ${submissionId}]`;

    await this.logAction(approvedById, actionName, actionDesc);

    return updatedGrade;
  }

  // ==========================================
  // PORTABLE JSON BACKUP & RESTORE (UC-18)
  // ==========================================

  /**
   * Sao lưu toàn bộ dữ liệu database (PostgreSQL + Uploads ZIP) thành tệp nén lưu trữ trong backups/
   */
  async backupDatabase(actorId: string): Promise<any> {
    const backupDir = path.join(process.cwd(), 'backups');
    
    // Tạo thư mục backups nếu chưa tồn tại
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const tempDir = path.join(backupDir, `temp_backup_${timestamp}`);
    fs.mkdirSync(tempDir, { recursive: true });

    let dbMethod = "pg_dump";
    
    // 1. Xuất dữ liệu JSON (luôn xuất để làm dự phòng an toàn)
    const jsonData = await systemRepository.exportAllTables();
    const jsonPath = path.join(tempDir, 'database.json');
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2), 'utf8');

    // 2. Thử chạy pg_dump để xuất database.sql
    const sqlPath = path.join(tempDir, 'database.sql');
    try {
      // Đọc URL kết nối từ DIRECT_URL hoặc DATABASE_URL
      const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
      if (!dbUrl) {
        throw new Error("Không tìm thấy DIRECT_URL hoặc DATABASE_URL trong môi trường");
      }
      
      // Chạy pg_dump bằng lệnh hệ thống
      const { execSync } = require('child_process');
      execSync(`pg_dump "${dbUrl}" -F p -f "${sqlPath}"`, { stdio: 'ignore' });
      dbMethod = "pg_dump";
    } catch (error: any) {
      dbMethod = "Prisma JSON Fallback";
      // Ghi log warning nội bộ, không throw lỗi vì đã có cơ chế JSON dự phòng
      const { logger } = require('../utils/logger');
      if (logger) {
        logger.warn(`pg_dump không khả dụng hoặc thất bại (${error.message}). Tự động fallback sang sao lưu Prisma JSON.`);
      }
    }

    // 3. Nén thư mục uploads thành uploads.zip
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // Đảm bảo uploads không rỗng bằng cách tạo tệp placeholder nếu cần
    const placeholderPath = path.join(uploadsDir, 'placeholder.txt');
    if (fs.readdirSync(uploadsDir).length === 0) {
      fs.writeFileSync(placeholderPath, 'University Grading System - Uploads Placeholder', 'utf8');
    }

    const uploadsZipPath = path.join(tempDir, 'uploads.zip');
    try {
      const { execSync } = require('child_process');
      execSync(`tar -acf "${uploadsZipPath}" uploads`, { stdio: 'ignore' });
    } catch (error: any) {
      throw new BadRequestError(`Không thể nén thư mục uploads: ${error.message}`);
    }

    // 4. Đo đạc dung lượng các tệp
    const dbSize = fs.existsSync(sqlPath) ? fs.statSync(sqlPath).size : fs.statSync(jsonPath).size;
    const uploadsSize = fs.statSync(uploadsZipPath).size;

    // 5. Tạo file metadata.json
    const metadata = {
      id: `backup_${timestamp}.zip`,
      fileName: `backup_${timestamp}.zip`,
      fileSize: '0 MB', // Sẽ được cập nhật sau khi nén gói tổng
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      type: 'Thủ công',
      creator: 'Hệ thống',
      dbMethod,
      dbSize: `${(dbSize / (1024 * 1024)).toFixed(2)} MB`,
      uploadsSize: `${(uploadsSize / (1024 * 1024)).toFixed(2)} MB`
    };
    fs.writeFileSync(path.join(tempDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    // 6. Nén toàn bộ thư mục tạm thành gói ZIP duy nhất
    const finalZipName = `backup_${timestamp}.zip`;
    const finalZipPath = path.join(backupDir, finalZipName);
    try {
      const { execSync } = require('child_process');
      execSync(`tar -acf "${finalZipPath}" -C "${tempDir}" .`, { stdio: 'ignore' });
    } catch (error: any) {
      throw new BadRequestError(`Không thể đóng gói bản sao lưu: ${error.message}`);
    }

    // 7. Cập nhật dung lượng thực tế của tệp ZIP tổng vào metadata
    const finalZipSize = fs.statSync(finalZipPath).size;
    metadata.fileSize = `${(finalZipSize / (1024 * 1024)).toFixed(2)} MB`;
    
    // Ghi file metadata JSON ra ngoài để phục vụ listBackups nhanh chóng
    const metadataName = `backup_${timestamp}.json`;
    const metadataPath = path.join(backupDir, metadataName);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

    // 8. Dọn dẹp thư mục tạm
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (err) {
      // Bỏ qua lỗi dọn dẹp nếu có
    }

    // 9. Lưu nhật ký hành động hệ thống
    await this.logAction(
      actorId,
      "SAO_LƯU_DỮ_LIỆU",
      `Tạo gói sao lưu hỗn hợp (PostgreSQL DB + Uploads) thành công: ${finalZipName}`
    );

    return metadata;
  }

  /**
   * Khôi phục cơ sở dữ liệu và thư mục uploads từ tệp ZIP sao lưu chỉ định
   */
  async restoreDatabase(backupFile: string, actorId: string): Promise<any> {
    // Ngăn chặn Path Traversal tấn công thư mục bằng cách lấy basename
    const safeFilename = path.basename(backupFile);
    const backupDir = path.join(process.cwd(), 'backups');
    const zipFilePath = path.join(backupDir, safeFilename);

    // 0. Truy tìm họ tên người thực hiện khôi phục trước khi database bị xóa sạch
    let actorName = 'Hệ thống';
    try {
      const { prisma } = require('../config/prisma');
      const user = await prisma.user.findUnique({ where: { id: actorId } });
      if (user) {
        actorName = user.fullName;
      }
    } catch (err) {
      // Bỏ qua lỗi truy vấn ban đầu
    }

    const timestamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
    const tempDir = path.join(backupDir, `temp_restore_${timestamp}`);

    try {
      if (!fs.existsSync(zipFilePath)) {
        throw new NotFoundError(`Không tìm thấy tệp sao lưu có tên '${safeFilename}' trong hệ thống`);
      }
      fs.mkdirSync(tempDir, { recursive: true });
      const { execSync } = require('child_process');
      // 1. Giải nén gói sao lưu vào thư mục tạm
      execSync(`tar -axf "${zipFilePath}" -C "${tempDir}"`, { stdio: 'ignore' });

      // 2. Đọc metadata.json bên trong
      const metadataPath = path.join(tempDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error("Gói sao lưu không chứa tệp tin metadata.json hợp lệ");
      }
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));

      // 3. Khôi phục Cơ sở dữ liệu
      const sqlPath = path.join(tempDir, 'database.sql');
      const jsonPath = path.join(tempDir, 'database.json');
      let dbRestored = false;

      // Ưu tiên phục hồi bằng SQL nếu có tệp SQL và psql khả dụng
      if (fs.existsSync(sqlPath)) {
        try {
          const dbUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
          if (dbUrl) {
            execSync('psql --version', { stdio: 'ignore' });
            execSync(`psql "${dbUrl}" -f "${sqlPath}"`, { stdio: 'ignore' });
            dbRestored = true;
          }
        } catch (sqlErr) {
          // Bỏ qua lỗi SQL, fallback sang JSON
        }
      }

      // Khôi phục bằng JSON fallback nếu SQL chưa được phục hồi
      if (!dbRestored && fs.existsSync(jsonPath)) {
        const rawContent = fs.readFileSync(jsonPath, 'utf8');
        const jsonData = JSON.parse(rawContent);
        await systemRepository.importAllTables(jsonData);
        dbRestored = true;
      }

      if (!dbRestored) {
        throw new Error("Không thể tìm thấy tệp tin sao lưu dữ liệu hợp lệ (database.sql hoặc database.json) trong gói");
      }

      // 4. Khôi phục thư mục uploads
      const uploadsZipPath = path.join(tempDir, 'uploads.zip');
      if (fs.existsSync(uploadsZipPath)) {
        execSync(`tar -axf "${uploadsZipPath}" -C .`, { stdio: 'ignore' });
      }

      // 5. Dọn dẹp thư mục tạm
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {
        // Bỏ qua
      }

      // 5.1 Ghi nhận metadata khôi phục THÀNH CÔNG vào SystemConfig của DB mới khôi phục
      const restoreMetadata = {
        lastRestoreAt: new Date().toISOString(),
        lastRestoredBackupId: safeFilename,
        lastRestoredBackupFile: safeFilename,
        lastRestoredBy: actorName,
        lastRestoreStatus: "SUCCESS"
      };
      try {
        await systemRepository.upsertConfig(
          'last_restore_metadata',
          JSON.stringify(restoreMetadata),
          'Thông tin lần khôi phục dữ liệu gần nhất'
        );
      } catch (dbErr) {
        // Bỏ qua nếu có lỗi ghi DB
      }

      // 6. Ghi nhận nhật ký hệ thống
      await this.logAction(
        actorId,
        "KHÔI_PHỤC_DỮ_LIỆU",
        `Khôi phục thành công toàn bộ cơ sở dữ liệu và tài liệu uploads từ bản sao lưu: ${safeFilename}`
      );

      return restoreMetadata;
    } catch (error: any) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (err) {}

      // Ghi nhận metadata khôi phục THẤT BẠI vào SystemConfig
      try {
        const restoreMetadata = {
          lastRestoreAt: new Date().toISOString(),
          lastRestoredBackupId: safeFilename,
          lastRestoredBackupFile: safeFilename,
          lastRestoredBy: actorName,
          lastRestoreStatus: "FAILED",
          lastRestoreErrorMessage: error.message
        };
        await systemRepository.upsertConfig(
          'last_restore_metadata',
          JSON.stringify(restoreMetadata),
          'Thông tin lần khôi phục dữ liệu gần nhất (Thất bại)'
        );
      } catch (dbErr) {
        // Bỏ qua lỗi ghi DB
      }
      
      throw new BadRequestError(`Quá trình khôi phục dữ liệu thất bại: ${error.message}`);
    }
  }

  async getSemesterLockStats(termId: string) {
    const term = await prisma.academicTerm.findUnique({
      where: { id: termId }
    });
    if (!term) {
      throw new NotFoundError("Học kỳ không tồn tại");
    }

    const submissions = await prisma.submission.findMany({
      where: {
        OR: [
          { student: { enrollments: { some: { class: { termId } } } } },
          { group: { class: { termId } } }
        ]
      }
    });

    const totalReports = submissions.length;
    const approvedReports = submissions.filter(s => s.status === 'HOAN_THANH').length;
    const pendingReports = submissions.filter(s => ['DA_NOP', 'DANG_CHAM'].includes(s.status)).length;
    const rejectedReports = submissions.filter(s => ['YEU_CAU_SUA', 'TU_CHOI'].includes(s.status)).length;

    // Lấy thông tin lần khóa điểm gần nhất từ SystemLog
    const lockLog = await prisma.systemLog.findFirst({
      where: {
        action: 'KHOA_DIEM_CUOI_KY',
        description: { contains: termId }
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true }
    });

    return {
      termId: term.id,
      termName: term.name,
      totalReports,
      approvedReports,
      pendingReports,
      rejectedReports,
      isLocked: term.isLocked,
      lockedAt: lockLog ? lockLog.createdAt.toISOString() : (term.isLocked ? term.createdAt.toISOString() : undefined),
      lockedBy: lockLog ? (lockLog.user?.fullName || 'Admin') : (term.isLocked ? 'Hệ thống (PdT)' : undefined)
    };
  }

  async lockSemester(termId: string, actorId: string) {
    const term = await prisma.academicTerm.findUnique({
      where: { id: termId }
    });
    if (!term) {
      throw new NotFoundError("Học kỳ không tồn tại");
    }

    if (term.isLocked) {
      throw new BadRequestError("Học kỳ này đã được khóa điểm từ trước!");
    }

    const stats = await this.getSemesterLockStats(termId);

    if (stats.approvedReports < stats.totalReports || stats.totalReports === 0) {
      await this.logAction(
        actorId,
        "KHOA_DIEM_THAT_BAI",
        `Khóa điểm học kỳ [${term.name}] thất bại: Chưa hoàn tất phê duyệt toàn bộ báo cáo (${stats.approvedReports}/${stats.totalReports})`
      );
      throw new BadRequestError(`Chưa hoàn tất phê duyệt toàn bộ báo cáo (${stats.approvedReports}/${stats.totalReports}). Toàn bộ kết quả trong phạm vi học kỳ phải được phê duyệt trước khi khóa.`);
    }

    // Tiến hành khóa học kỳ
    const updatedTerm = await prisma.academicTerm.update({
      where: { id: termId },
      data: { isLocked: true }
    });

    await this.logAction(
      actorId,
      "KHOA_DIEM_CUOI_KY",
      `Khóa điểm học kỳ [${term.name}] thành công. Toàn bộ điểm số đã được đóng băng vĩnh viễn.`
    );

    return updatedTerm;
  }

  /**
   * Giám sát tiến độ học kỳ (UC-18)
   */
  async getSemesterProgress(termId: string) {
    const term = await prisma.academicTerm.findUnique({
      where: { id: termId }
    });
    if (!term) {
      throw new NotFoundError("Học kỳ không tồn tại");
    }

    const totalClasses = await prisma.class.count({ where: { termId } });

    // Distinct students enrolled in this term
    const studentEnrollments = await prisma.classEnrollment.findMany({
      where: { class: { termId } },
      distinct: ['studentId'],
      select: { studentId: true }
    });
    const totalStudents = studentEnrollments.length;

    // Distinct teachers assigned in this term
    const teacherAssignments = await prisma.assignment.findMany({
      where: { class: { termId } },
      distinct: ['teacherId'],
      select: { teacherId: true }
    });
    const totalTeachers = teacherAssignments.length;

    // All submissions in this term
    const submissions = await prisma.submission.findMany({
      where: {
        OR: [
          { student: { enrollments: { some: { class: { termId } } } } },
          { group: { class: { termId } } }
        ]
      },
      select: { status: true }
    });

    const statusCounts = submissions.reduce((acc, sub) => {
      acc[sub.status] = (acc[sub.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      termId: term.id,
      termName: term.name,
      totalClasses,
      totalStudents,
      totalTeachers,
      totalSubmissions: submissions.length,
      statusDistribution: statusCounts
    };
  }
}

export const systemService = new SystemService();
