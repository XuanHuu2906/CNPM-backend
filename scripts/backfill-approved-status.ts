/**
 * Backfill 1 lần: đồng bộ Submission.status cho các bài đã được PĐT duyệt lẻ
 * trước khi fix bug (Grade.isApproved=true nhưng Submission.status vẫn là CHO_DUYET).
 *
 * Bối cảnh: Endpoint approveGrade single cũ chỉ flip Grade.isApproved, không đụng
 * Submission.status → dashboard PĐT đếm HOAN_THANH bị thiếu. Đã fix ở service nhưng
 * dữ liệu lịch sử cần backfill.
 *
 * Cách dùng:
 *   - Dry-run (mặc định, không ghi DB):    npx tsx scripts/backfill-approved-status.ts
 *   - Áp dụng thực sự vào DB:               npx tsx scripts/backfill-approved-status.ts --apply
 */
import { prisma } from '../src/config/prisma';

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Mode: ${APPLY ? 'APPLY (ghi DB)' : 'DRY-RUN (không ghi DB)'}\n`);

  // Bài đã có điểm IsXacNhan=true nhưng status còn ở các trạng thái trung gian "an toàn"
  // để ép về HOAN_THANH. Loại trừ DA_NOP vì nghi ngờ SV nộp lại sau khi PĐT đã duyệt
  // — nếu apply sẽ duyệt khống bản nộp mới chưa được GV chấm lại.
  const SAFE_STATUSES = ['CHO_DUYET', 'DA_CHAM', 'DANG_CHAM'];
  const stuck = await prisma.submission.findMany({
    where: {
      status: { in: SAFE_STATUSES },
      grades: { some: { isApproved: true } },
    },
    include: {
      grades: { select: { isApproved: true, approvedById: true, finalScore: true } },
      group: { select: { name: true, classId: true } },
      student: { select: { studentCode: true, user: { select: { fullName: true } } } },
    },
  });

  if (stuck.length === 0) {
    console.log('Không có bài nào cần backfill. Dashboard đã đồng bộ.');
    return;
  }

  console.log(`Tìm thấy ${stuck.length} bài cần đồng bộ về HOAN_THANH:\n`);
  console.log('STT | Submission ID           | Nhóm / SV                        | Điểm | Trạng thái hiện tại');
  console.log('----+-------------------------+----------------------------------+------+--------------------');
  stuck.forEach((s, i) => {
    const owner = s.group?.name || s.student?.user?.fullName || s.studentId || '(không xác định)';
    const score = s.grades[0]?.finalScore?.toString() || '-';
    console.log(
      `${String(i + 1).padStart(3)} | ${s.id.padEnd(23)} | ${owner.slice(0, 32).padEnd(32)} | ${score.padStart(4)} | ${s.status}`
    );
  });

  if (!APPLY) {
    console.log(`\nDry-run xong. Chạy lại với --apply để ghi vào DB.`);
    return;
  }

  console.log(`\nBắt đầu apply...`);
  let success = 0;
  let failed = 0;

  for (const sub of stuck) {
    try {
      await prisma.$transaction(async (tx) => {
        const upd = await tx.submission.updateMany({
          where: { id: sub.id, version: sub.version },
          data: {
            status: 'HOAN_THANH',
            version: { increment: 1 },
          },
        });
        if (upd.count === 0) {
          throw new Error('OCC mismatch (version đã đổi từ lúc query)');
        }

        await tx.submissionLog.create({
          data: {
            submissionId: sub.id,
            oldStatus: sub.status,
            newStatus: 'HOAN_THANH',
            actorId: sub.grades[0]?.approvedById || 'SYSTEM_BACKFILL',
            note: 'Backfill đồng bộ status sau khi fix bug approveGrade single',
          },
        });
      });
      success++;
    } catch (e: any) {
      console.error(`  ✗ ${sub.id}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\nKết quả: ${success}/${stuck.length} OK, ${failed} lỗi.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
