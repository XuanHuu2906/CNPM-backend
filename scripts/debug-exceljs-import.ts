import ExcelJS from 'exceljs';

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('D:\\CNPM\\DanhSachSinhVien_CNPM.xlsx');
  console.log('Sheets:', wb.worksheets.map(w => w.name));

  const sheet = wb.getWorksheet('Điểm Danh') || wb.getWorksheet('Diem Danh') || wb.worksheets[0];
  if (!sheet) { console.log('không có sheet'); return; }
  console.log(`Đang đọc sheet: "${sheet.name}"`);
  console.log(`actualRowCount: ${sheet.actualRowCount}`);
  console.log(`rowCount:       ${sheet.rowCount}`);

  // Mô phỏng chính xác logic importGroupsFromExcel
  const HEADER_ROW = 7;
  const lastRow = Math.max(sheet.actualRowCount || 0, sheet.rowCount || 0); // FIX applied
  let currentGroupNo: number | null = null;
  const seenCodes = new Set<string>();
  const groupMemberCount = new Map<number, string[]>();
  let processed = 0;
  let skippedEmpty = 0;

  for (let r = HEADER_ROW + 1; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const mssvCell = row.getCell(2);
    const mssv = mssvCell.value ? String(mssvCell.value).trim() : '';
    if (!mssv) { skippedEmpty++; continue; }
    if (seenCodes.has(mssv)) {
      console.log(`R${r}: DUPLICATE MSSV ${mssv} — sẽ throw`);
      return;
    }
    seenCodes.add(mssv);

    const hoLot = String(row.getCell(3).value ?? '').trim();
    const ten = String(row.getCell(4).value ?? '').trim();
    const fullName = `${hoLot} ${ten}`.trim();
    const nhomRaw = row.getCell(5).value;
    const tenNhom = String(row.getCell(6).value ?? '').trim();

    if (nhomRaw !== null && nhomRaw !== undefined && nhomRaw !== '') {
      const n = Number(nhomRaw);
      if (!Number.isInteger(n) || n <= 0) {
        console.log(`R${r}: nhóm không hợp lệ (${JSON.stringify(nhomRaw)}) — sẽ throw`);
        return;
      }
      currentGroupNo = n;
    }
    if (currentGroupNo === null) {
      console.log(`R${r}: SV ${mssv} chưa thuộc nhóm — sẽ throw`);
      return;
    }
    if (!groupMemberCount.has(currentGroupNo)) groupMemberCount.set(currentGroupNo, []);
    groupMemberCount.get(currentGroupNo)!.push(`${mssv} (R${r}: ${fullName})`);
    processed++;
  }

  console.log(`\nTổng dòng xử lý: ${processed}`);
  console.log(`Dòng bị skip (mssv rỗng): ${skippedEmpty}`);
  console.log(`Số nhóm: ${groupMemberCount.size}`);

  // Tổng member
  let total = 0;
  groupMemberCount.forEach(members => { total += members.length; });
  console.log(`Tổng member trong tất cả nhóm: ${total}`);

  // Liệt kê các nhóm có size ≠ 3
  console.log('\nNhóm có size ≠ 3:');
  let anomaly = 0;
  [...groupMemberCount.entries()].sort((a, b) => a[0] - b[0]).forEach(([no, members]) => {
    if (members.length !== 3) {
      console.log(`  Nhóm ${no}: ${members.length} SV`);
      members.forEach(m => console.log(`    - ${m}`));
      anomaly++;
    }
  });
  if (anomaly === 0) console.log('  (tất cả 3)');

  // Inspect chi tiết row 130-138
  console.log('\n=== Chi tiết row 130-138 (raw ExcelJS) ===');
  for (let r = 130; r <= Math.min(lastRow + 2, 140); r++) {
    const row = sheet.getRow(r);
    const cells: any = {};
    for (let c = 1; c <= 8; c++) {
      const v = row.getCell(c).value;
      cells[`C${c}`] = v === null ? 'null' : v === undefined ? 'undef' : JSON.stringify(v);
    }
    console.log(`R${r}:`, cells);
  }
}

main().catch(e => console.error(e));
