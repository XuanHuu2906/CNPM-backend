import { systemRepository } from '../repositories/system.repository';
import { logger } from './logger';

/**
 * UC-I04: Ghi nhật ký thao tác hệ thống (SystemLog).
 *
 * Sử dụng helper này thay vì gọi systemService.logAction để tránh phụ thuộc vòng giữa các service.
 * Lỗi ghi log không bao giờ được phép chặn nghiệp vụ chính → bọc try/catch và chỉ log warning.
 */
export async function auditLog(
  actorId: string | null,
  action: string,
  description: string,
  ipAddress?: string,
): Promise<void> {
  try {
    await systemRepository.createLog(actorId, action, description, ipAddress);
  } catch (err) {
    logger.warn(`[AUDIT] Không thể ghi SystemLog (action=${action}): ${(err as Error).message}`);
  }
}
