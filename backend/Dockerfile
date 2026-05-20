FROM node:20-alpine

WORKDIR /app

# Cài đặt dependencies trước để tận dụng layer cache
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy source code sau khi đã cài deps
COPY . .

EXPOSE 5001

CMD ["node", "src/server.js"]
