-- CreateEnum
CREATE TYPE "GradingReopenRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "NguoiDung" (
    "NguoiDungID" TEXT NOT NULL,
    "TenDangNhap" TEXT NOT NULL,
    "MatKhauHash" TEXT NOT NULL,
    "HoTen" TEXT NOT NULL,
    "SoDienThoai" TEXT,
    "AnhDaiDien" TEXT,
    "VaiTro" TEXT NOT NULL,
    "IsActive" BOOLEAN NOT NULL DEFAULT true,
    "BatBuocDoiMatKhau" BOOLEAN NOT NULL DEFAULT false,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NgayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NguoiDung_pkey" PRIMARY KEY ("NguoiDungID")
);

-- CreateTable
CREATE TABLE "Admin" (
    "AdminID" TEXT NOT NULL,
    "MaNhanVien" TEXT NOT NULL,
    "NguoiDungID" TEXT NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("AdminID")
);

-- CreateTable
CREATE TABLE "PhongDaoTao" (
    "PhongDaoTaoID" TEXT NOT NULL,
    "MaNhanVien" TEXT NOT NULL,
    "NguoiDungID" TEXT NOT NULL,

    CONSTRAINT "PhongDaoTao_pkey" PRIMARY KEY ("PhongDaoTaoID")
);

-- CreateTable
CREATE TABLE "GiangVien" (
    "GiangVienID" TEXT NOT NULL,
    "MaGiangVien" TEXT NOT NULL,
    "ChucDanh" TEXT,
    "NguoiDungID" TEXT NOT NULL,
    "KhoaID" TEXT,

    CONSTRAINT "GiangVien_pkey" PRIMARY KEY ("GiangVienID")
);

-- CreateTable
CREATE TABLE "SinhVien" (
    "SinhVienID" TEXT NOT NULL,
    "MSSV" TEXT NOT NULL,
    "NguoiDungID" TEXT NOT NULL,
    "KhoaID" TEXT,

    CONSTRAINT "SinhVien_pkey" PRIMARY KEY ("SinhVienID")
);

-- CreateTable
CREATE TABLE "KyHoc" (
    "KyHocID" TEXT NOT NULL,
    "TenKyHoc" TEXT NOT NULL,
    "NgayBatDau" DATE NOT NULL,
    "NgayKetThuc" DATE NOT NULL,
    "IsLocked" BOOLEAN NOT NULL DEFAULT false,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KyHoc_pkey" PRIMARY KEY ("KyHocID")
);

-- CreateTable
CREATE TABLE "MonHoc" (
    "MonHocID" TEXT NOT NULL,
    "MaMonHoc" TEXT NOT NULL,
    "TenMonHoc" TEXT NOT NULL,
    "KhoaID" TEXT,

    CONSTRAINT "MonHoc_pkey" PRIMARY KEY ("MonHocID")
);

-- CreateTable
CREATE TABLE "LopHoc" (
    "LopHocID" TEXT NOT NULL,
    "MaLop" TEXT NOT NULL,
    "MonHocID" TEXT NOT NULL,
    "KyHocID" TEXT NOT NULL,
    "LoaiPhanCong" TEXT NOT NULL DEFAULT 'NHOM',

    CONSTRAINT "LopHoc_pkey" PRIMARY KEY ("LopHocID")
);

-- CreateTable
CREATE TABLE "DangKyLopHocPhan" (
    "DangKyID" TEXT NOT NULL,
    "SinhVienID" TEXT NOT NULL,
    "LopHocID" TEXT NOT NULL,
    "NgayDangKy" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DangKyLopHocPhan_pkey" PRIMARY KEY ("DangKyID")
);

-- CreateTable
CREATE TABLE "PhanCong" (
    "PhanCongID" TEXT NOT NULL,
    "LopHocID" TEXT NOT NULL,
    "GiangVienID" TEXT NOT NULL,

    CONSTRAINT "PhanCong_pkey" PRIMARY KEY ("PhanCongID")
);

-- CreateTable
CREATE TABLE "Rubric" (
    "RubricID" TEXT NOT NULL,
    "TenRubric" TEXT NOT NULL,
    "MoTa" TEXT,
    "NguoiTao" TEXT NOT NULL,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("RubricID")
);

-- CreateTable
CREATE TABLE "TieuChiRubric" (
    "TieuChiID" TEXT NOT NULL,
    "RubricID" TEXT NOT NULL,
    "TenTieuChi" TEXT NOT NULL,
    "MoTa" TEXT,
    "ThangDiem" DECIMAL(5,2) NOT NULL,
    "TrongSo" DECIMAL(5,2) NOT NULL,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TieuChiRubric_pkey" PRIMARY KEY ("TieuChiID")
);

-- CreateTable
CREATE TABLE "NhomSinhVien" (
    "NhomID" TEXT NOT NULL,
    "MaNhom" TEXT NOT NULL,
    "TenDeTai" TEXT NOT NULL,
    "LopHocID" TEXT NOT NULL,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NhomSinhVien_pkey" PRIMARY KEY ("NhomID")
);

-- CreateTable
CREATE TABLE "BaoCao" (
    "BaoCaoID" TEXT NOT NULL,
    "SinhVienID" TEXT,
    "NhomID" TEXT,
    "DuongDanFile" TEXT NOT NULL,
    "FileDinhKem" TEXT,
    "MaTrangThai" TEXT NOT NULL DEFAULT 'CHUA_NOP',
    "PhienBan" INTEGER NOT NULL DEFAULT 1,
    "GhiChuYeuCauSua" TEXT,
    "LyDoTuChoi" TEXT,
    "LoaiViPham" TEXT,
    "NgayNop" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NgayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaoCao_pkey" PRIMARY KEY ("BaoCaoID")
);

-- CreateTable
CREATE TABLE "LichSuTrangThai" (
    "LichSuID" TEXT NOT NULL,
    "BaoCaoID" TEXT NOT NULL,
    "TrangThaiCu" TEXT,
    "TrangThaiMoi" TEXT NOT NULL,
    "NguoiThucHien" TEXT NOT NULL,
    "GhiChu" TEXT,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LichSuTrangThai_pkey" PRIMARY KEY ("LichSuID")
);

-- CreateTable
CREATE TABLE "ChamDiem" (
    "ChamDiemID" TEXT NOT NULL,
    "BaoCaoID" TEXT NOT NULL,
    "RubricID" TEXT NOT NULL,
    "GiangVienID" TEXT NOT NULL,
    "DiemChiTiet" TEXT NOT NULL,
    "DiemTong" DECIMAL(5,2) NOT NULL,
    "NhanXet" TEXT,
    "IsXacNhan" BOOLEAN NOT NULL DEFAULT false,
    "NguoiPheDuyet" TEXT,
    "PhienBan" INTEGER NOT NULL DEFAULT 1,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NgayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChamDiem_pkey" PRIMARY KEY ("ChamDiemID")
);

-- CreateTable
CREATE TABLE "DieuChinhDiemThanhVien" (
    "DieuChinhID" TEXT NOT NULL,
    "ChamDiemID" TEXT NOT NULL,
    "SinhVienID" TEXT NOT NULL,
    "HeSoDongGop" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "GhiChu" TEXT,
    "NguoiDieuChinh" TEXT NOT NULL,
    "NgayDieuChinh" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NgayCapNhat" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DieuChinhDiemThanhVien_pkey" PRIMARY KEY ("DieuChinhID")
);

-- CreateTable
CREATE TABLE "CauHinhHeThong" (
    "CauHinhID" TEXT NOT NULL,
    "TenCauHinh" TEXT NOT NULL,
    "GiaTri" TEXT NOT NULL,
    "MoTa" TEXT,

    CONSTRAINT "CauHinhHeThong_pkey" PRIMARY KEY ("CauHinhID")
);

-- CreateTable
CREATE TABLE "NhatKyHeThong" (
    "LogID" TEXT NOT NULL,
    "NguoiDungID" TEXT,
    "HanhDong" TEXT NOT NULL,
    "MoTa" TEXT,
    "DiaChiIP" TEXT,
    "NgayGio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NhatKyHeThong_pkey" PRIMARY KEY ("LogID")
);

-- CreateTable
CREATE TABLE "BinhLuan" (
    "BinhLuanID" TEXT NOT NULL,
    "BaoCaoID" TEXT NOT NULL,
    "NguoiGuiID" TEXT NOT NULL,
    "NoiDung" TEXT NOT NULL,
    "IsAn" BOOLEAN NOT NULL DEFAULT false,
    "NgayGui" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BinhLuan_pkey" PRIMARY KEY ("BinhLuanID")
);

-- CreateTable
CREATE TABLE "ThongBao" (
    "ThongBaoID" TEXT NOT NULL,
    "NguoiNhanID" TEXT NOT NULL,
    "TieuDe" TEXT NOT NULL,
    "NoiDung" TEXT NOT NULL,
    "LoaiThongBao" TEXT NOT NULL,
    "BaoCaoID" TEXT,
    "IsDoc" BOOLEAN NOT NULL DEFAULT false,
    "IsGuiEmail" BOOLEAN NOT NULL DEFAULT false,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NgayDoc" TIMESTAMP(3),

    CONSTRAINT "ThongBao_pkey" PRIMARY KEY ("ThongBaoID")
);

-- CreateTable
CREATE TABLE "YeuCauSua" (
    "YeuCauSuaID" TEXT NOT NULL,
    "BaoCaoID" TEXT NOT NULL,
    "GiangVienID" TEXT NOT NULL,
    "NoiDungYeuCau" TEXT NOT NULL,
    "IsXuLy" BOOLEAN NOT NULL DEFAULT false,
    "NgayGui" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NgayXuLy" TIMESTAMP(3),

    CONSTRAINT "YeuCauSua_pkey" PRIMARY KEY ("YeuCauSuaID")
);

-- CreateTable
CREATE TABLE "PheDuyetKetQua" (
    "PheDuyetID" TEXT NOT NULL,
    "BaoCaoID" TEXT NOT NULL,
    "NguoiPheDuyet" TEXT NOT NULL,
    "HanhDong" TEXT NOT NULL,
    "LyDo" TEXT,
    "NgayThucHien" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PheDuyetKetQua_pkey" PRIMARY KEY ("PheDuyetID")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "TokenID" TEXT NOT NULL,
    "NguoiDungID" TEXT NOT NULL,
    "Token" TEXT NOT NULL,
    "HetHan" TIMESTAMP(3) NOT NULL,
    "DaSuDung" BOOLEAN NOT NULL DEFAULT false,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("TokenID")
);

-- CreateTable
CREATE TABLE "SaoLuuDuLieu" (
    "SaoLuuID" TEXT NOT NULL,
    "TenSaoLuu" TEXT NOT NULL,
    "DuongDan" TEXT NOT NULL,
    "KichThuocByte" BIGINT,
    "LoaiSaoLuu" TEXT NOT NULL,
    "TrangThai" TEXT NOT NULL,
    "GhiChu" TEXT,
    "NgayThucHien" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NguoiThucHien" TEXT,

    CONSTRAINT "SaoLuuDuLieu_pkey" PRIMARY KEY ("SaoLuuID")
);

-- CreateTable
CREATE TABLE "YeuCauNopLai" (
    "MaYeuCau" TEXT NOT NULL,
    "MaBaoCao" TEXT NOT NULL,
    "MaSinhVien" TEXT NOT NULL,
    "LyDo" TEXT NOT NULL,
    "TrangThai" TEXT NOT NULL DEFAULT 'CHO_XU_LY',
    "ThoiGianGui" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NguoiDuyet" TEXT,
    "GhiChuPhanHoi" TEXT,

    CONSTRAINT "YeuCauNopLai_pkey" PRIMARY KEY ("MaYeuCau")
);

-- CreateTable
CREATE TABLE "LichSuEmail" (
    "LogEmailID" TEXT NOT NULL,
    "NguoiNhan" TEXT NOT NULL,
    "LoaiEmail" TEXT NOT NULL,
    "TrangThai" TEXT NOT NULL,
    "LoiKhongGhe" TEXT,
    "KhoaChongLap" TEXT,
    "NgayGui" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LichSuEmail_pkey" PRIMARY KEY ("LogEmailID")
);

-- CreateTable
CREATE TABLE "YeuCauMoLaiChamDiem" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "GradingReopenRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YeuCauMoLaiChamDiem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Khoa" (
    "KhoaID" TEXT NOT NULL,
    "MaKhoa" TEXT NOT NULL,
    "TenKhoa" TEXT NOT NULL,
    "MoTa" TEXT,

    CONSTRAINT "Khoa_pkey" PRIMARY KEY ("KhoaID")
);

-- CreateTable
CREATE TABLE "VaiTro" (
    "VaiTroID" TEXT NOT NULL,
    "MaVaiTro" TEXT NOT NULL,
    "TenVaiTro" TEXT NOT NULL,
    "MoTa" TEXT,

    CONSTRAINT "VaiTro_pkey" PRIMARY KEY ("VaiTroID")
);

-- CreateTable
CREATE TABLE "TrangThaiBaoCao" (
    "MaTrangThai" TEXT NOT NULL,
    "TenTrangThai" TEXT NOT NULL,
    "MoTa" TEXT,
    "ThuTuHienThi" INTEGER NOT NULL,

    CONSTRAINT "TrangThaiBaoCao_pkey" PRIMARY KEY ("MaTrangThai")
);

-- CreateTable
CREATE TABLE "DeTai" (
    "DeTaiID" TEXT NOT NULL,
    "TenDeTai" TEXT NOT NULL,
    "MoTa" TEXT,
    "NhomID" TEXT,
    "SinhVienID" TEXT,
    "NgayTao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeTai_pkey" PRIMARY KEY ("DeTaiID")
);

-- CreateTable
CREATE TABLE "ThanhVienNhom" (
    "ThanhVienNhomID" TEXT NOT NULL,
    "NhomID" TEXT NOT NULL,
    "SinhVienID" TEXT NOT NULL,
    "IsNhomTruong" BOOLEAN NOT NULL DEFAULT false,
    "NgayThamGia" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThanhVienNhom_pkey" PRIMARY KEY ("ThanhVienNhomID")
);

-- CreateTable
CREATE TABLE "LichSuPhanCong" (
    "LichSuPhanCongID" TEXT NOT NULL,
    "LopHocID" TEXT NOT NULL,
    "PhanCongID" TEXT,
    "GiangVienCuID" TEXT NOT NULL,
    "GiangVienMoiID" TEXT NOT NULL,
    "LyDo" TEXT NOT NULL,
    "NguoiThucHien" TEXT NOT NULL,
    "NgayThayDoi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LichSuPhanCong_pkey" PRIMARY KEY ("LichSuPhanCongID")
);

-- CreateTable
CREATE TABLE "FileBaoCao" (
    "FileID" TEXT NOT NULL,
    "BaoCaoID" TEXT NOT NULL,
    "LanNop" INTEGER NOT NULL,
    "LoaiFile" TEXT NOT NULL,
    "TenFile" TEXT NOT NULL,
    "DinhDangFile" TEXT NOT NULL,
    "DungLuongByte" BIGINT NOT NULL,
    "DuongDanLuuTru" TEXT NOT NULL,
    "HashFile" TEXT,
    "NgayNop" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "NguoiNop" TEXT NOT NULL,
    "IsHienTai" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FileBaoCao_pkey" PRIMARY KEY ("FileID")
);

-- CreateTable
CREATE TABLE "LichSuNop" (
    "LichSuNopID" TEXT NOT NULL,
    "BaoCaoID" TEXT NOT NULL,
    "LanNop" INTEGER NOT NULL,
    "NgayNop" TIMESTAMP(3) NOT NULL,
    "SoFileDaKem" INTEGER NOT NULL DEFAULT 0,
    "GhiChu" TEXT,
    "NguoiNop" TEXT NOT NULL,

    CONSTRAINT "LichSuNop_pkey" PRIMARY KEY ("LichSuNopID")
);

-- CreateTable
CREATE TABLE "DiemTheoTieuChi" (
    "DiemTieuChiID" TEXT NOT NULL,
    "ChamDiemID" TEXT NOT NULL,
    "TieuChiID" TEXT NOT NULL,
    "DiemNhap" DECIMAL(5,2) NOT NULL,
    "NhanXet" TEXT,
    "NgayNhap" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiemTheoTieuChi_pkey" PRIMARY KEY ("DiemTieuChiID")
);

-- CreateIndex
CREATE UNIQUE INDEX "NguoiDung_TenDangNhap_key" ON "NguoiDung"("TenDangNhap");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_MaNhanVien_key" ON "Admin"("MaNhanVien");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_NguoiDungID_key" ON "Admin"("NguoiDungID");

-- CreateIndex
CREATE UNIQUE INDEX "PhongDaoTao_MaNhanVien_key" ON "PhongDaoTao"("MaNhanVien");

-- CreateIndex
CREATE UNIQUE INDEX "PhongDaoTao_NguoiDungID_key" ON "PhongDaoTao"("NguoiDungID");

-- CreateIndex
CREATE UNIQUE INDEX "GiangVien_MaGiangVien_key" ON "GiangVien"("MaGiangVien");

-- CreateIndex
CREATE UNIQUE INDEX "GiangVien_NguoiDungID_key" ON "GiangVien"("NguoiDungID");

-- CreateIndex
CREATE UNIQUE INDEX "SinhVien_MSSV_key" ON "SinhVien"("MSSV");

-- CreateIndex
CREATE UNIQUE INDEX "SinhVien_NguoiDungID_key" ON "SinhVien"("NguoiDungID");

-- CreateIndex
CREATE UNIQUE INDEX "KyHoc_TenKyHoc_key" ON "KyHoc"("TenKyHoc");

-- CreateIndex
CREATE UNIQUE INDEX "MonHoc_MaMonHoc_key" ON "MonHoc"("MaMonHoc");

-- CreateIndex
CREATE UNIQUE INDEX "LopHoc_MaLop_key" ON "LopHoc"("MaLop");

-- CreateIndex
CREATE UNIQUE INDEX "DangKyLopHocPhan_SinhVienID_LopHocID_key" ON "DangKyLopHocPhan"("SinhVienID", "LopHocID");

-- CreateIndex
CREATE UNIQUE INDEX "PhanCong_LopHocID_GiangVienID_key" ON "PhanCong"("LopHocID", "GiangVienID");

-- CreateIndex
CREATE UNIQUE INDEX "ChamDiem_BaoCaoID_key" ON "ChamDiem"("BaoCaoID");

-- CreateIndex
CREATE INDEX "DieuChinhDiemThanhVien_SinhVienID_idx" ON "DieuChinhDiemThanhVien"("SinhVienID");

-- CreateIndex
CREATE UNIQUE INDEX "DieuChinhDiemThanhVien_ChamDiemID_SinhVienID_key" ON "DieuChinhDiemThanhVien"("ChamDiemID", "SinhVienID");

-- CreateIndex
CREATE UNIQUE INDEX "CauHinhHeThong_TenCauHinh_key" ON "CauHinhHeThong"("TenCauHinh");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_Token_key" ON "PasswordResetToken"("Token");

-- CreateIndex
CREATE UNIQUE INDEX "LichSuEmail_KhoaChongLap_key" ON "LichSuEmail"("KhoaChongLap");

-- CreateIndex
CREATE INDEX "YeuCauMoLaiChamDiem_submissionId_idx" ON "YeuCauMoLaiChamDiem"("submissionId");

-- CreateIndex
CREATE INDEX "YeuCauMoLaiChamDiem_teacherId_idx" ON "YeuCauMoLaiChamDiem"("teacherId");

-- CreateIndex
CREATE INDEX "YeuCauMoLaiChamDiem_status_idx" ON "YeuCauMoLaiChamDiem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Khoa_MaKhoa_key" ON "Khoa"("MaKhoa");

-- CreateIndex
CREATE UNIQUE INDEX "VaiTro_MaVaiTro_key" ON "VaiTro"("MaVaiTro");

-- CreateIndex
CREATE UNIQUE INDEX "ThanhVienNhom_NhomID_SinhVienID_key" ON "ThanhVienNhom"("NhomID", "SinhVienID");

-- CreateIndex
CREATE INDEX "LichSuPhanCong_LopHocID_idx" ON "LichSuPhanCong"("LopHocID");

-- CreateIndex
CREATE INDEX "LichSuPhanCong_GiangVienCuID_idx" ON "LichSuPhanCong"("GiangVienCuID");

-- CreateIndex
CREATE INDEX "LichSuPhanCong_GiangVienMoiID_idx" ON "LichSuPhanCong"("GiangVienMoiID");

-- CreateIndex
CREATE UNIQUE INDEX "DiemTheoTieuChi_ChamDiemID_TieuChiID_key" ON "DiemTheoTieuChi"("ChamDiemID", "TieuChiID");

-- AddForeignKey
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_NguoiDungID_fkey" FOREIGN KEY ("NguoiDungID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PhongDaoTao" ADD CONSTRAINT "PhongDaoTao_NguoiDungID_fkey" FOREIGN KEY ("NguoiDungID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GiangVien" ADD CONSTRAINT "GiangVien_NguoiDungID_fkey" FOREIGN KEY ("NguoiDungID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "GiangVien" ADD CONSTRAINT "GiangVien_KhoaID_fkey" FOREIGN KEY ("KhoaID") REFERENCES "Khoa"("KhoaID") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SinhVien" ADD CONSTRAINT "SinhVien_NguoiDungID_fkey" FOREIGN KEY ("NguoiDungID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SinhVien" ADD CONSTRAINT "SinhVien_KhoaID_fkey" FOREIGN KEY ("KhoaID") REFERENCES "Khoa"("KhoaID") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "MonHoc" ADD CONSTRAINT "MonHoc_KhoaID_fkey" FOREIGN KEY ("KhoaID") REFERENCES "Khoa"("KhoaID") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LopHoc" ADD CONSTRAINT "LopHoc_MonHocID_fkey" FOREIGN KEY ("MonHocID") REFERENCES "MonHoc"("MonHocID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LopHoc" ADD CONSTRAINT "LopHoc_KyHocID_fkey" FOREIGN KEY ("KyHocID") REFERENCES "KyHoc"("KyHocID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DangKyLopHocPhan" ADD CONSTRAINT "DangKyLopHocPhan_SinhVienID_fkey" FOREIGN KEY ("SinhVienID") REFERENCES "SinhVien"("SinhVienID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DangKyLopHocPhan" ADD CONSTRAINT "DangKyLopHocPhan_LopHocID_fkey" FOREIGN KEY ("LopHocID") REFERENCES "LopHoc"("LopHocID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhanCong" ADD CONSTRAINT "PhanCong_LopHocID_fkey" FOREIGN KEY ("LopHocID") REFERENCES "LopHoc"("LopHocID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PhanCong" ADD CONSTRAINT "PhanCong_GiangVienID_fkey" FOREIGN KEY ("GiangVienID") REFERENCES "GiangVien"("GiangVienID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_NguoiTao_fkey" FOREIGN KEY ("NguoiTao") REFERENCES "GiangVien"("GiangVienID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "TieuChiRubric" ADD CONSTRAINT "TieuChiRubric_RubricID_fkey" FOREIGN KEY ("RubricID") REFERENCES "Rubric"("RubricID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "NhomSinhVien" ADD CONSTRAINT "NhomSinhVien_LopHocID_fkey" FOREIGN KEY ("LopHocID") REFERENCES "LopHoc"("LopHocID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BaoCao" ADD CONSTRAINT "BaoCao_SinhVienID_fkey" FOREIGN KEY ("SinhVienID") REFERENCES "SinhVien"("SinhVienID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BaoCao" ADD CONSTRAINT "BaoCao_NhomID_fkey" FOREIGN KEY ("NhomID") REFERENCES "NhomSinhVien"("NhomID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LichSuTrangThai" ADD CONSTRAINT "LichSuTrangThai_BaoCaoID_fkey" FOREIGN KEY ("BaoCaoID") REFERENCES "BaoCao"("BaoCaoID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ChamDiem" ADD CONSTRAINT "ChamDiem_RubricID_fkey" FOREIGN KEY ("RubricID") REFERENCES "Rubric"("RubricID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ChamDiem" ADD CONSTRAINT "ChamDiem_GiangVienID_fkey" FOREIGN KEY ("GiangVienID") REFERENCES "GiangVien"("GiangVienID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ChamDiem" ADD CONSTRAINT "ChamDiem_BaoCaoID_fkey" FOREIGN KEY ("BaoCaoID") REFERENCES "BaoCao"("BaoCaoID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DieuChinhDiemThanhVien" ADD CONSTRAINT "DieuChinhDiemThanhVien_ChamDiemID_fkey" FOREIGN KEY ("ChamDiemID") REFERENCES "ChamDiem"("ChamDiemID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "DieuChinhDiemThanhVien" ADD CONSTRAINT "DieuChinhDiemThanhVien_SinhVienID_fkey" FOREIGN KEY ("SinhVienID") REFERENCES "SinhVien"("SinhVienID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "NhatKyHeThong" ADD CONSTRAINT "NhatKyHeThong_NguoiDungID_fkey" FOREIGN KEY ("NguoiDungID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BinhLuan" ADD CONSTRAINT "BinhLuan_BaoCaoID_fkey" FOREIGN KEY ("BaoCaoID") REFERENCES "BaoCao"("BaoCaoID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "BinhLuan" ADD CONSTRAINT "BinhLuan_NguoiGuiID_fkey" FOREIGN KEY ("NguoiGuiID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ThongBao" ADD CONSTRAINT "ThongBao_NguoiNhanID_fkey" FOREIGN KEY ("NguoiNhanID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ThongBao" ADD CONSTRAINT "ThongBao_BaoCaoID_fkey" FOREIGN KEY ("BaoCaoID") REFERENCES "BaoCao"("BaoCaoID") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "YeuCauSua" ADD CONSTRAINT "YeuCauSua_BaoCaoID_fkey" FOREIGN KEY ("BaoCaoID") REFERENCES "BaoCao"("BaoCaoID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "YeuCauSua" ADD CONSTRAINT "YeuCauSua_GiangVienID_fkey" FOREIGN KEY ("GiangVienID") REFERENCES "GiangVien"("GiangVienID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PheDuyetKetQua" ADD CONSTRAINT "PheDuyetKetQua_BaoCaoID_fkey" FOREIGN KEY ("BaoCaoID") REFERENCES "BaoCao"("BaoCaoID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PheDuyetKetQua" ADD CONSTRAINT "PheDuyetKetQua_NguoiPheDuyet_fkey" FOREIGN KEY ("NguoiPheDuyet") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_NguoiDungID_fkey" FOREIGN KEY ("NguoiDungID") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "SaoLuuDuLieu" ADD CONSTRAINT "SaoLuuDuLieu_NguoiThucHien_fkey" FOREIGN KEY ("NguoiThucHien") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "YeuCauNopLai" ADD CONSTRAINT "YeuCauNopLai_MaBaoCao_fkey" FOREIGN KEY ("MaBaoCao") REFERENCES "BaoCao"("BaoCaoID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauNopLai" ADD CONSTRAINT "YeuCauNopLai_MaSinhVien_fkey" FOREIGN KEY ("MaSinhVien") REFERENCES "SinhVien"("SinhVienID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauNopLai" ADD CONSTRAINT "YeuCauNopLai_NguoiDuyet_fkey" FOREIGN KEY ("NguoiDuyet") REFERENCES "GiangVien"("GiangVienID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauMoLaiChamDiem" ADD CONSTRAINT "YeuCauMoLaiChamDiem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "BaoCao"("BaoCaoID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauMoLaiChamDiem" ADD CONSTRAINT "YeuCauMoLaiChamDiem_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "GiangVien"("GiangVienID") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YeuCauMoLaiChamDiem" ADD CONSTRAINT "YeuCauMoLaiChamDiem_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThanhVienNhom" ADD CONSTRAINT "ThanhVienNhom_NhomID_fkey" FOREIGN KEY ("NhomID") REFERENCES "NhomSinhVien"("NhomID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThanhVienNhom" ADD CONSTRAINT "ThanhVienNhom_SinhVienID_fkey" FOREIGN KEY ("SinhVienID") REFERENCES "SinhVien"("SinhVienID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LichSuPhanCong" ADD CONSTRAINT "LichSuPhanCong_LopHocID_fkey" FOREIGN KEY ("LopHocID") REFERENCES "LopHoc"("LopHocID") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LichSuPhanCong" ADD CONSTRAINT "LichSuPhanCong_GiangVienCuID_fkey" FOREIGN KEY ("GiangVienCuID") REFERENCES "GiangVien"("GiangVienID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LichSuPhanCong" ADD CONSTRAINT "LichSuPhanCong_GiangVienMoiID_fkey" FOREIGN KEY ("GiangVienMoiID") REFERENCES "GiangVien"("GiangVienID") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "LichSuPhanCong" ADD CONSTRAINT "LichSuPhanCong_NguoiThucHien_fkey" FOREIGN KEY ("NguoiThucHien") REFERENCES "NguoiDung"("NguoiDungID") ON DELETE NO ACTION ON UPDATE NO ACTION;
