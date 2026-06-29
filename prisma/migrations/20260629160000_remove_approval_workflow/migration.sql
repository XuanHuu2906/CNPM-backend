-- Refactor: bỏ workflow PĐT duyệt điểm.
-- 1. Gộp các submission đang ở CHO_DUYET / HOAN_THANH về DA_CHAM (status terminal mới).
-- 2. Xoá field Grade.isApproved + Grade.approvedById (không còn ai duyệt).

UPDATE "BaoCao" SET "MaTrangThai" = 'DA_CHAM'
 WHERE "MaTrangThai" IN ('CHO_DUYET', 'HOAN_THANH');

ALTER TABLE "ChamDiem" DROP COLUMN IF EXISTS "IsXacNhan";
ALTER TABLE "ChamDiem" DROP COLUMN IF EXISTS "NguoiPheDuyet";
