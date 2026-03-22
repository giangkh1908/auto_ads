FROM node:20-alpine

# Set thư mục làm việc
WORKDIR /app

# Copy file package để cài đặt trước
COPY package*.json ./

# Cài đặt chỉ những dependencies cần thiết cho production
RUN npm install --omit=dev

# Copy toàn bộ mã nguồn vào container
COPY . .

# Mở port 5001
EXPOSE 5001

# Lệnh khởi động ứng dụng
CMD ["node", "src/server.js"]
