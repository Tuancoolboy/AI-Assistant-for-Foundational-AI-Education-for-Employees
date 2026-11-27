#!/bin/bash
set -e

# Đưa thư mục src vào PYTHONPATH để import đúng gói backend
export PYTHONPATH=$(pwd)/src:$(pwd)/src/backend:$PYTHONPATH

echo "📦 1/2: Đang khởi tạo dữ liệu đánh giá..."
python src/backend/eval/dataset_builder.py

echo "📊 2/2: Đang chạy RAGAS Evaluation Suite..."
python src/backend/eval/ragas_runner.py "$@"
