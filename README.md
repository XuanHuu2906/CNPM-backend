# Hệ Thống Quản Lý Chấm Điểm Báo Cáo - Backend

Dự án Backend xây dựng bằng Node.js, Express, TypeScript và Prisma ORM với PostgreSQL.
(Xem thêm chi tiết kiến trúc và thiết kế hệ thống tại [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)).

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy Dự Án

### Yêu cầu hệ thống:
- **Node.js**: Phiên bản 18 trở lên.
- **PostgreSQL**: Đã được cài đặt và đang chạy.

### Bước 1: Cài đặt thư viện
Mở terminal tại thư mục `CNPM-backend` và chạy:
```bash
npm install
```

### Bước 2: Cấu hình môi trường
1. Tạo một file tên là `.env` ngang hàng với file `.env.example`.
2. Copy toàn bộ nội dung từ `.env.example` sang `.env`.
3. Chỉnh sửa `DATABASE_URL` trong file `.env` cho đúng với cấu hình PostgreSQL của máy bạn.
   Ví dụ: `DATABASE_URL="postgresql://postgres:123456@localhost:5432/report_grading_db?schema=public"`

### Bước 3: Khởi tạo Database
Chạy lần lượt các lệnh sau:
```bash
# Tạo Prisma Client
npm run db:generate

# Chạy Migration để tạo các bảng trong Database (Nhập 'y' hoặc đặt tên tuỳ ý nếu được hỏi)
npx prisma migrate dev --name init

# (Tùy chọn) Khởi tạo dữ liệu mẫu (Tài khoản, Rubric,...)
npm run db:seed
```

### Bước 4: Khởi chạy Server
```bash
npm run dev
```
Server sẽ mặc định chạy ở cổng `5000`. Bạn có thể kiểm tra API tại địa chỉ `http://localhost:5000`.
