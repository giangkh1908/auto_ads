# Facebook Ads Manager

Ứng dụng full-stack hiện đại để quản lý chiến dịch quảng cáo Facebook, đi kèm giao diện đẹp, đáp ứng tốt trên nhiều thiết bị và hỗ trợ đầy đủ thao tác CRUD.

## 📦 Cài đặt

### Yêu cầu trước khi cài
- Node.js (v16 trở lên)
- npm hoặc yarn
- Tài khoản Facebook Developer có quyền truy cập Marketing API

### Thiết lập Backend

1. Di chuyển vào thư mục backend:
```bash
cd backend
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Tạo file `.env` trong thư mục backend:
```env
ACCESS_TOKEN=your_facebook_access_token
AD_ACCOUNT_ID=your_ad_account_id
PORT=3001
```

4. Khởi chạy backend server:
```bash
npm start
# hoặc chạy môi trường phát triển
npm run dev
```

Backend sẽ chạy tại `http://localhost:5001`

### Thiết lập Frontend

1. Di chuyển vào thư mục frontend:
```bash
cd frontend
```

2. Cài đặt dependencies:
```bash
npm install
```

3. Khởi chạy development server:
```bash
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`

## 🔐 Tài khoản test

- Email: `quangvu1922@gmail.com`
- Mật khẩu: `19082003`

### Scripts có sẵn

**Backend:**
- `npm start` - Chạy server ở môi trường production
- `npm run dev` - Chạy server phát triển với nodemon

**Frontend:**
- `npm run dev` - Chạy development server
- `npm run build` - Build cho production
- `npm run preview` - Xem trước bản build production

## 🚀 Triển khai & CI/CD
Hệ thống đã được thiết lập quy trình tự động hóa chuyên nghiệp:
- **GitHub Actions**: Tự động Build và Deploy Backend lên VPS mỗi khi có code mới trên branch `main`.
- **VPS (Ubuntu 22.04)**: Tối ưu hóa môi trường với Nginx Reverse Proxy, SSL miễn phí (Certbot).
- **Docker + Docker Compose**: Container hóa toàn bộ stack, dễ dàng scale và rollback.

## ⚡ Kết quả Load Test (k6 trên VPS)

Bài kiểm tra tải được chạy thực tế trên VPS với **k6**, tấn công vào route `/health` - endpoint monitoring dùng để kiểm tra độ ổn định và khả năng chịu tải của server.

### Kịch bản (Scenario)

| Giai đoạn | Thời gian | Virtual Users |
|-----------|-----------|---------------|
| Ramp-up   | 30s       | 0 → 1,000 VUs  |
| Sustained | 1m        | 1,000 → 3,000 VUs  |
| Ramp-down | 30s       | 3,000 → 0 VUs   |

### Kết quả

| Chỉ số | Giá trị |
|--------|---------|
| Tổng requests | **125,470** |
| Throughput | **~1,039 req/s** |
| HTTP lỗi | **0.00%** (không có request nào fail) |
| Checks thành công | **92.35%** (231,746 / 250,940) |
| Checks thất bại (`response < 500ms`) | **7.64%** (19,194 checks) |
| Avg latency | **452 ms** |
| Median latency | **33 ms** |
| p(90) latency | **1.22 s** |
| p(95) latency | **3.02 s** |
| Max latency | **10.09 s** |
| Dữ liệu nhận | **110 MB** (906 kB/s) |
| Dữ liệu gửi | **19 MB** (154 kB/s) |

### Nhận xét

- **Không có request nào bị lỗi** (`http_req_failed: 0.00%`), server ổn định dưới tải cao.
- **Median latency chỉ 33ms** - hầu hết các request được xử lý rất nhanh.
- Latency cao ở p(90)-p(95) cho thấy server bắt đầu bị áp lực khi số VUs tăng cao, các request phải xếp hàng chờ.
- Đây là kết quả tốt cho `/health` - endpoint nhẹ, không có logic phức tạp, thể hiện khả năng xử lý concurrency cao của stack.

# Chạy load test
k6 run load_test.js
```

## 📄 Giấy phép
Dự án này được phát hành theo giấy phép MIT.

## 🤝 Đóng góp
1. Fork repository
2. Tạo feature branch
3. Thực hiện thay đổi
4. Kiểm thử kỹ lưỡng
5. Gửi pull request

## 📞 Hỗ trợ
Nếu cần hỗ trợ hoặc có câu hỏi, vui lòng mở issue trên repository.

---

**Được xây dựng bằng ❤️ với React, Node.js và Facebook Marketing API**
