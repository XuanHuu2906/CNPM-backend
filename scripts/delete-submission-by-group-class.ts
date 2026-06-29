import { prisma } from '../src/config/prisma';

const GROUP_NAME = 'Nhom 1';
const CLASS_CODE = 'IS201_L01';
const STATUS = 'TU_CHOI';

async function main() {
  const groups = await prisma.group.findMany({
    where: { name: GROUP_NAME, class: { classCode: CLASS_CODE } },
    include: {
      class: { select: { classCode: true, subject: { select: { name: true } } } },
      submissions: { select: { id: true, status: true, version: true, submittedAt: true } },
    },
  });

  if (groups.length === 0) {
    console.error(`Không tìm thấy nhóm "${GROUP_NAME}" trong lớp ${CLASS_CODE}`);
    process.exit(1);
  }
  if (groups.length > 1) {
    console.error(`Có ${groups.length} nhóm khớp — abort.`);
    process.exit(1);
  }

  const group = groups[0];
  console.log(`Nhóm: ${group.name} | Lớp: ${group.class.classCode} | Môn: ${group.class.subject.name}`);
  console.log(`Đề tài: "${group.topicName}"`);
  console.log(`Báo cáo của nhóm:`);
  for (const s of group.submissions) {
    console.log(`  - id=${s.id} status=${s.status} v${s.version} submittedAt=${s.submittedAt.toISOString()}`);
  }

  const targets = group.submissions.filter((s) => s.status === STATUS);
  if (targets.length === 0) {
    console.error(`Không có báo cáo nào status=${STATUS} để xóa.`);
    process.exit(1);
  }
  if (targets.length > 1) {
    console.error(`Có ${targets.length} báo cáo status=${STATUS} — abort để tránh xóa nhầm.`);
    process.exit(1);
  }

  const ids = targets.map((s) => s.id);
  console.log(`Sẽ xóa: ${ids.join(', ')}`);

  await prisma.$transaction(async (tx) => {
    await tx.gradeAppealRequest.deleteMany({ where: { submissionId: { in: ids } } });
    await tx.gradingReopenRequest.deleteMany({ where: { submissionId: { in: ids } } });
    const result = await tx.submission.deleteMany({ where: { id: { in: ids } } });
    console.log(`Đã xóa ${result.count} báo cáo.`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
