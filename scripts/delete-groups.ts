import { prisma } from '../src/config/prisma';

const CLASS_ID = process.argv[2] || 'cmqxkf7vu00ikwqq402wkaupj';

async function main() {
  const clazz = await prisma.class.findUnique({
    where: { id: CLASS_ID },
    select: { id: true, classCode: true },
  });
  if (!clazz) {
    console.error(`Không tìm thấy lớp với id=${CLASS_ID}`);
    process.exit(1);
  }

  // Safety: nếu có submission thì abort
  const subCount = await prisma.submission.count({
    where: { group: { classId: CLASS_ID } },
  });
  if (subCount > 0) {
    console.error(`ABORT: Lớp ${clazz.classCode} có ${subCount} submission gắn với nhóm. Không xóa để tránh mất dữ liệu báo cáo.`);
    process.exit(1);
  }

  const beforeCount = await prisma.group.count({ where: { classId: CLASS_ID } });
  console.log(`Sẽ xóa ${beforeCount} nhóm trong lớp ${clazz.classCode} (id=${clazz.id})...`);

  // GroupMember sẽ tự cascade khi xóa Group (onDelete: Cascade)
  const result = await prisma.group.deleteMany({ where: { classId: CLASS_ID } });

  const afterCount = await prisma.group.count({ where: { classId: CLASS_ID } });
  console.log(`Đã xóa ${result.count} nhóm. Còn lại: ${afterCount}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
