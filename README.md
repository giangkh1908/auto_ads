# Facebook Ads Manager

Ứng dụng full-stack hiện đại để quản lý chiến dịch quảng cáo Facebook, đi kèm giao diện đẹp, đáp ứng tốt trên nhiều thiết bị và hỗ trợ đầy đủ thao tác CRUD.

## 🚀 Tính năng

### Frontend
- **UI/UX hiện đại**: Thiết kế đẹp, responsive, hiệu ứng chuyển động mượt và hover trực quan
- **Đồng bộ dữ liệu thời gian thực**: Cập nhật dữ liệu trực tiếp từ Facebook API
- **Thao tác CRUD đầy đủ**: Tạo, đọc, cập nhật, xóa campaign, ad set và ads
- **Dashboard tương tác**: Thẻ thống kê, điều hướng theo tab, điều khiển trực quan
- **Xác thực biểu mẫu**: Quy trình tạo campaign nhiều bước có kiểm tra hợp lệ
- **Hệ thống thông báo**: Phản hồi thành công/lỗi cho mọi thao tác
- **Thiết kế đáp ứng**: Hoạt động tốt trên desktop, tablet và mobile

### Backend
- **RESTful API**: Đầy đủ endpoint CRUD cho mọi thực thể quảng cáo
- **Tích hợp Facebook**: Kết nối trực tiếp với Facebook Marketing API
- **Xử lý lỗi**: Cơ chế xử lý lỗi và logging toàn diện
- **Kiến trúc mô-đun**: Tách bạch rõ ràng giữa controllers, services và routes
- **Upsert insight theo giờ**: Insight theo giờ được lưu bằng khóa tổng hợp `{ ad_id, retrieved_at_hour }` để tránh trùng lặp nhưng vẫn giữ độ chính xác lịch sử; access token đã chuẩn hóa được dùng cho mọi request.

## 🛠️ Công nghệ sử dụng

### Frontend
- **React 18** - React hiện đại với hooks
- **Vite** - Công cụ build và dev server tốc độ cao
- **CSS** - Tùy biến giao diện với các tính năng hiện đại (Grid, Flexbox, Animations)
- **ES6+** - Cú pháp JavaScript hiện đại

### Backend
- **Node.js** - Môi trường chạy JavaScript
- **Express.js** - Web framework
- **Facebook Marketing API** - SDK chính thức của Facebook
- **CORS** - Chia sẻ tài nguyên đa nguồn

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

Backend sẽ chạy tại `http://localhost:3001`

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

## 🔧 API Endpoints

### Campaigns
- `GET /api/status` - Lấy toàn bộ dữ liệu quảng cáo
- `POST /api/create-campaign` - Tạo campaign mới
- `PUT /api/campaigns/:id` - Cập nhật campaign
- `DELETE /api/campaigns/:id` - Xóa campaign

### Ad Sets
- `PUT /api/adsets/:id` - Cập nhật ad set
- `DELETE /api/adsets/:id` - Xóa ad set

### Ads
- `PUT /api/ads/:id` - Cập nhật ad
- `DELETE /api/ads/:id` - Xóa ad

## 🎨 Tính năng giao diện

### Dashboard
- **Thẻ thống kê**: Số lượng campaign, ad set, ads và creative theo thời gian thực
- **Điều hướng tab**: Chuyển đổi nhanh giữa các loại quảng cáo
- **Tìm kiếm và lọc**: Tìm campaign hoặc ads cụ thể một cách nhanh chóng

### Quản lý Campaign
- **Biểu mẫu nhiều bước**: Quy trình tạo campaign trực quan gồm 3 bước
- **Chỉnh sửa trực tiếp**: Chỉnh campaign, ad set và ads ngay trên giao diện
- **Quản lý trạng thái**: Đổi trạng thái dễ dàng (Active/Paused/Deleted)
- **Cập nhật thời gian thực**: Thay đổi phản ánh ngay trên toàn bộ giao diện

### Thành phần thiết kế hiện đại
- **Nền gradient**: Dải màu chuyển sắc đẹp mắt
- **Hiệu ứng mượt**: Hover, transition và trạng thái loading
- **Bố cục dạng thẻ**: Hiển thị thông tin rõ ràng, gọn gàng
- **Lưới responsive**: Tự thích ứng với mọi kích thước màn hình
- **Nhãn trạng thái**: Màu sắc phân biệt trực quan
- **Nút tương tác**: Hiệu ứng hover và loading rõ ràng

## 🔄 Luồng dữ liệu

1. **Frontend** gọi API đến **Backend**
2. **Backend** xử lý request và gọi **Facebook Marketing API**
3. **Facebook API** trả dữ liệu về **Backend**
4. **Backend** chuẩn hóa dữ liệu và gửi lại **Frontend**
5. **Frontend** cập nhật UI và hiển thị thông báo

## 📱 Thiết kế đáp ứng

Ứng dụng responsive đầy đủ trên:
- **Desktop** (1200px+): Bố cục đầy đủ với sidebar và vùng hiển thị chi tiết
- **Tablet** (768px - 1199px): Bố cục thích nghi với thành phần có thể thu gọn
- **Mobile** (320px - 767px): Bố cục xếp dọc tối ưu thao tác chạm

## 🎯 Điểm nổi bật

### Đồng bộ thời gian thực
- Dữ liệu tự động làm mới sau các thao tác tạo/cập nhật/xóa
- Có trạng thái loading khi gọi API
- Xử lý lỗi với thông báo thân thiện
- Insight quảng cáo theo giờ dùng timestamp `retrieved_at_hour` khi ingest, đảm bảo upsert theo khóa `{ ad_id, retrieved_at_hour }` với API token đã chuẩn hóa.

### Trải nghiệm người dùng
- Điều hướng trực quan với phản hồi thị giác rõ ràng
- Kiểm tra hợp lệ biểu mẫu kèm thông báo hữu ích
- Hộp thoại xác nhận cho thao tác phá hủy dữ liệu
- Thông báo thành công/lỗi cho mọi thao tác

### Hiệu năng
- Tối ưu các lần gọi API
- Quản lý state hiệu quả
- Hiệu ứng mượt nhưng không ảnh hưởng hiệu năng
- Thời gian tải nhanh

## 🚀 Bắt đầu nhanh

1. **Thiết lập Facebook Developer Account**:
   - Tạo Facebook App
   - Kích hoạt quyền Marketing API
   - Tạo access token
   - Lấy Ad Account ID

2. **Cấu hình backend**:
   - Thêm thông tin vào file `.env`
   - Khởi chạy backend server

3. **Khởi chạy frontend**:
   - Chạy development server
   - Mở trình duyệt tại `http://localhost:5173`

4. **Tạo campaign đầu tiên**:
   - Bấm "Create Ad" trên thanh điều hướng
   - Điền thông tin campaign
   - Hoàn tất cấu hình ad set
   - Thêm nội dung creative
   - Gửi và xem campaign xuất hiện trên dashboard

## 🔧 Phát triển

### Cấu trúc dự án
```
├── backend/
│   ├── src/
│   │   ├── controllers/    # Bộ điều khiển API
│   │   ├── services/       # Nghiệp vụ xử lý
│   │   ├── routes/         # Định tuyến API
│   │   └── config/         # Cấu hình
│   └── server.js           # File server chính
├── frontend/
│   ├── src/
│   │   ├── components/     # Thành phần React
│   │   ├── services/       # Dịch vụ gọi API
│   │   └── assets/         # Tài nguyên tĩnh
│   └── public/             # File public
└── README.md
```

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

### Chạy lại bài test

```bash
# Cài k6 trên VPS
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6 -y

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
