/**
 * Debug 1 lần: in ra phân bố Submission.status + đối chiếu với Grade.isApproved
 * để hiểu vì sao dashboard PĐT đếm nhóm "Hoàn thành" lệch với thực tế.
 */
import { prisma } from '../src/config/prisma';

async function main() {
  // 1. Phân bố theo status
  const byStatus = await prisma.submission.groupBy({
    by: ['status'],
    _count: { _all: true },
    orderBy: { status: 'asc' },
  });
  console.log('=== Phân bố Submission.status ===');
  byStatus.forEach((r) => console.log(`  ${r.status.padEnd(15)} : ${r._count._all}`));

  // 2. Phân bố Grade.isApproved
  const gradeStats = await prisma.grade.groupBy({
    by: ['isApproved'],
    _count: { _all: true },
  });
  console.log('\n=== Phân bố Grade.isApproved ===');
  gradeStats.forEach((r) => console.log(`  isApproved=${r.isApproved} : ${r._count._all}`));

  // 3. Cross-check: submission HOAN_THANH có grade duyệt chưa?
  const completedSubs = await prisma.submission.findMany({
    where: { status: 'HOAN_THANH' },
    include: { grades: { select: { isApproved: true, finalScore: true, version: true } } },
    take: 20,
  });
  console.log(`\n=== Submission HOAN_THANH (top ${completedSubs.length}) ===`);
  completedSubs.forEach((s) => {
    const g = s.grades[0];
    console.log(`  ${s.id} | grade.isApproved=${g?.isApproved ?? 'NULL'} | score=${g?.finalScore ?? '-'}`);
  });

  // 4. Cross-check: grade.isApproved=true nhưng submission.status không phải HOAN_THANH
  const inconsistent = await prisma.submission.findMany({
    where: {
      grades: { some: { isApproved: true } },
      status: { not: 'HOAN_THANH' },
    },
    select: { id: true, status: true, grades: { select: { isApproved: true, finalScore: true } } },
    take: 20,
  });
  console.log(`\n=== Grade duyệt nhưng status ≠ HOAN_THANH (top ${inconsistent.length}) ===`);
  inconsistent.forEach((s) => {
    console.log(`  ${s.id} | status=${s.status} | grade.isApproved=${s.grades[0]?.isApproved}`);
  });

  // 5. Top 10 submission gần đây
  const recent = await prisma.submission.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      status: true,
      updatedAt: true,
      grades: { select: { isApproved: true, finalScore: true, updatedAt: true } },
    },
  });
  console.log(`\n=== 10 Submission cập nhật gần nhất ===`);
  recent.forEach((s) => {
    const g = s.grades[0];
    console.log(`  ${s.id} | status=${s.status.padEnd(12)} | grade.isApproved=${g?.isApproved ?? '-'} | sub.updatedAt=${s.updatedAt.toISOString()}`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
