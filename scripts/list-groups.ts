import { prisma } from '../src/config/prisma';

const CLASS_ID = process.argv[2] || 'cmqxkf7vu00ikwqq402wkaupj';

async function main() {
  const clazz = await prisma.class.findUnique({
    where: { id: CLASS_ID },
    include: { subject: { select: { name: true, subjectCode: true } } },
  });
  if (!clazz) {
    console.error(`Không tìm thấy lớp với id=${CLASS_ID}`);
    process.exit(1);
  }
  console.log(`Lớp: ${clazz.classCode} — ${clazz.subject.name} (${clazz.subject.subjectCode})`);
  console.log(`ID:  ${clazz.id}\n`);

  const groups = await prisma.group.findMany({
    where: { classId: CLASS_ID },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: true, submissions: true } },
    },
  });

  if (groups.length === 0) {
    console.log('Lớp này chưa có nhóm nào.');
    return;
  }

  console.log(`Tổng ${groups.length} nhóm:\n`);
  console.log('STT | Mã nhóm           | Đề tài (rút gọn)                          | SV | Submission | Tạo lúc');
  console.log('----+-------------------+-------------------------------------------+-----+------------+--------------------');
  groups.forEach((g, i) => {
    const topic = (g.topicName || '').slice(0, 40).padEnd(40);
    const name = (g.name || '').padEnd(17);
    const sv = String(g._count.members).padStart(3);
    const sub = String(g._count.submissions).padStart(10);
    const t = g.createdAt.toISOString().replace('T', ' ').slice(0, 19);
    console.log(`${String(i + 1).padStart(3)} | ${name} | ${topic}  | ${sv} | ${sub} | ${t}`);
  });

  const totalMembers = groups.reduce((s, g) => s + g._count.members, 0);
  const totalSubs = groups.reduce((s, g) => s + g._count.submissions, 0);
  console.log(`\nTổng: ${groups.length} nhóm · ${totalMembers} thành viên · ${totalSubs} submission`);
  if (totalSubs > 0) {
    console.log('\n⚠ CẢNH BÁO: có submission đang gắn với nhóm. Xóa nhóm sẽ KHÔNG xóa được nếu FK chặn (cần kiểm tra).');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
