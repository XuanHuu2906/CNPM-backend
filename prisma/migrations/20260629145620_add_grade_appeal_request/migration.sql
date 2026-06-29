-- CreateEnum
CREATE TYPE "GradeAppealRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "YeuCauPhucKhao" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "GradeAppealRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YeuCauPhucKhao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YeuCauPhucKhao_submissionId_key" ON "YeuCauPhucKhao"("submissionId");

-- CreateIndex
CREATE INDEX "YeuCauPhucKhao_studentId_idx" ON "YeuCauPhucKhao"("studentId");

-- CreateIndex
CREATE INDEX "YeuCauPhucKhao_status_idx" ON "YeuCauPhucKhao"("status");

-- AddForeignKey
ALTER TABLE "YeuCauPhucKhao" ADD CONSTRAINT "YeuCauPhucKhao_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "BaoCao"("BaoCaoID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauPhucKhao" ADD CONSTRAINT "YeuCauPhucKhao_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "SinhVien"("SinhVienID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauPhucKhao" ADD CONSTRAINT "YeuCauPhucKhao_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE SET NULL ON UPDATE CASCADE;
