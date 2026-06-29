import { prisma } from '../src/config/prisma';

const TOPIC_KEYWORD = 'Xây dựng phần mềm quản lý việc cho mượn sách';
const MEMBER_MSSVS = ['N23DCAT016', 'N23DCCN032', 'N23DCCN057'];

async function main() {
  const groups = await prisma.group.findMany({
    where: { topicName: { contains: TOPIC_KEYWORD } },
    include: {
      members: { include: { student: { select: { studentCode: true, user: { select: { fullName: true } } } } } },
      submissions: { select: { id: true, status: true, version: true, submittedAt: true } },
      class: { select: { classCode: true } },
    },
  });

  if (groups.length === 0) {
    console.error(`Không tìm thấy nhóm nào với đề tài chứa: "${TOPIC_KEYWORD}"`);
    process.exit(1);
  }

  const matched = groups.filter((g) => {
    const codes = g.members.map((m) => m.student.studentCode).sort();
    return MEMBER_MSSVS.every((mssv) => codes.includes(mssv));
  });

  if (matched.length === 0) {
    console.error('Không tìm thấy nhóm khớp với đầy đủ MSSV thành viên.');
    console.log('Các nhóm có đề tài tương ứng:');
    for (const g of groups) {
      console.log(`  - groupId=${g.id} class=${g.class.classCode} topic="${g.topicName}"`);
      console.log(`    members: ${g.members.map((m) => `${m.student.studentCode} (${m.student.user.fullName})`).join(', ')}`);
    }
    process.exit(1);
  }

  if (matched.length > 1) {
    console.error(`Có ${matched.length} nhóm khớp — abort để tránh xóa nhầm.`);
    process.exit(1);
  }

  const group = matched[0];
  console.log(`Nhóm: ${group.name} | Lớp: ${group.class.classCode} | Đề tài: "${group.topicName}"`);
  console.log(`Thành viên: ${group.members.map((m) => `${m.student.studentCode} (${m.student.user.fullName})`).join(', ')}`);
  console.log(`Báo cáo liên quan: ${group.submissions.length}`);
  for (const s of group.submissions) {
    console.log(`  - id=${s.id} status=${s.status} v${s.version} submittedAt=${s.submittedAt.toISOString()}`);
  }

  if (group.submissions.length === 0) {
    console.log('Không có báo cáo nào để xóa.');
    return;
  }

  const submissionIds = group.submissions.map((s) => s.id);

  await prisma.$transaction(async (tx) => {
    await tx.gradeAppealRequest.deleteMany({ where: { submissionId: { in: submissionIds } } });
    await tx.gradingReopenRequest.deleteMany({ where: { submissionId: { in: submissionIds } } });
    const result = await tx.submission.deleteMany({ where: { id: { in: submissionIds } } });
    console.log(`Đã xóa ${result.count} báo cáo.`);
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
