-- Drop 6 supporting models that were never wired into the code.
-- See discussion 2026-06-27: VaiTro/TrangThaiBaoCao stayed unused because
-- User.role and Submission.status are stored as plain strings; DeTai overlaps
-- with NhomSinhVien.TenDeTai; DiemTheoTieuChi is replaced by ChamDiem.DiemChiTiet (JSON);
-- FileBaoCao/LichSuNop are replaced by BaoCao.DuongDanFile + BaoCao.PhienBan + LichSuTrangThai.

DROP TABLE IF EXISTS "DiemTheoTieuChi";
DROP TABLE IF EXISTS "FileBaoCao";
DROP TABLE IF EXISTS "LichSuNop";
DROP TABLE IF EXISTS "DeTai";
DROP TABLE IF EXISTS "TrangThaiBaoCao";
DROP TABLE IF EXISTS "VaiTro";
