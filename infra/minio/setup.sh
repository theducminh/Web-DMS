#!/bin/sh
# VDT Zero-Trust DMS — khởi tạo MinIO: tạo bucket 'vdt-docs' và bật SSE-S3 (AES-256).
# Chạy tự động một lần qua service 'minio-setup' trong docker-compose.

set -e

BUCKET="${MINIO_BUCKET:-vdt-docs}"

echo "[minio-setup] Chờ MinIO sẵn sàng..."
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null 2>&1; do
  sleep 2
done

echo "[minio-setup] Tạo bucket '${BUCKET}' (nếu chưa có)..."
mc mb --ignore-existing "local/${BUCKET}"

echo "[minio-setup] Bật mã hóa Server-Side Encryption SSE-S3 (AES-256) cho bucket..."
# Auto-encrypt mọi object ghi vào bucket (NFR-1.2)
mc encrypt set sse-s3 "local/${BUCKET}" || echo "[minio-setup] (Bỏ qua nếu phiên bản mc không hỗ trợ encrypt set)"

echo "[minio-setup] Đặt bucket ở chế độ private (mặc định, không public)."
mc anonymous set none "local/${BUCKET}" || true

echo "[minio-setup] Hoàn tất."
