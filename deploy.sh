#!/bin/bash

echo "🚀 Bắt đầu quá trình cập nhật mã nguồn và khởi động lại Docker..."

# 1. Kéo code mới nhất từ git
echo "📥 Đang tải code mới từ GitHub..."
git pull origin main

# 2. Tắt các container hiện tại (tùy chọn, thường up -d --build sẽ tự thay thế, nhưng down sẽ an toàn hơn nếu có đổi biến môi trường)
echo "🛑 Đang tắt các dịch vụ cũ..."
docker compose -f docker-compose.prod.yml down

# 3. Build và khởi động lại
echo "⏳ Đang build và khởi động lại hệ thống..."
docker compose -f docker-compose.prod.yml up -d --build

# 4. Dọn dẹp image rác (Tránh việc build nhiều lần làm đầy ổ cứng máy ảo)
echo "🧹 Đang dọn dẹp các bản build cũ..."
docker image prune -f
docker builder prune -f

echo "✅ Hoàn tất! Hệ thống đã được cập nhật và đang chạy."
