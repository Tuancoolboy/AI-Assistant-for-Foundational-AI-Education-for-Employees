from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import List, Dict, Any

# Thêm src/backend vào python path nếu chạy direct script
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.services.supabase_gateway import get_supabase_gateway, close_supabase_gateway
from backend.eval.schemas import ChatEvalSample, LearningPathEvalSample, GradingEvalSample


# --- DỮ LIỆU MOCK / SYNTHETIC CHẤT LƯỢNG CAO (FALLBACK) ---
MOCK_CHAT_SAMPLES = [
    {
        "question": "Làm thế nào để áp dụng AI vào quy trình đánh giá nhân sự hiệu quả?",
        "answer": "Để áp dụng AI vào quy trình đánh giá nhân sự, bạn có thể: 1. Sử dụng AI để phân tích hiệu suất làm việc dựa trên dữ liệu lịch sử; 2. Tự động đánh giá các bài luận phản tư (Aha moments) của nhân viên; 3. Dùng AI gợi ý lộ trình đào tạo dựa trên kỹ năng còn thiếu. Việc này giúp giảm định kiến cá nhân và tăng tính khách quan.",
        "contexts": [
            "AI Tro Ly hỗ trợ tự động hóa việc chấm điểm bài luận phản tư thông qua AI Grading Agent (Agent 2).",
            "Hệ thống đề xuất lộ trình học tập (Learning Path Agent) giúp cá nhân hóa nội dung đào tạo dựa trên khoảng cách năng lực của nhân viên."
        ],
        "ground_truth": "Áp dụng AI vào đánh giá nhân sự bằng cách chấm điểm tự luận phản tư tự động (Agent 2), phân tích dữ liệu hiệu suất khách quan và thiết lập lộ trình học tập cá nhân hóa để cải thiện kỹ năng."
    },
    {
        "question": "AI có thể giúp bộ phận Sales cải thiện tỷ lệ chốt đơn (conversion rate) bằng cách nào?",
        "answer": "Bộ phận Sales có thể dùng AI để: 1. Phân loại và chấm điểm leads tiềm năng (Lead Scoring); 2. Gợi ý kịch bản cuộc gọi cá nhân hóa theo hành vi khách hàng; 3. Tự động hóa soạn thảo email theo dõi. Điều này giúp tối ưu hóa thời gian và tập trung vào những khách hàng có khả năng mua hàng cao nhất.",
        "contexts": [
            "Các module đào tạo Sales bao gồm việc ứng dụng AI viết email cá nhân hóa và phân tích chân dung khách hàng mục tiêu."
        ],
        "ground_truth": "AI hỗ trợ Sales tăng tỷ lệ chốt đơn thông qua phân loại khách hàng tiềm năng tự động, đề xuất kịch bản giao tiếp tối ưu và soạn thảo email chăm sóc khách hàng cá nhân hóa."
    }
]

MOCK_PATH_SAMPLES = [
    {
        "role_id": "sale",
        "ai_level": 1,
        "completed_module_ids": [],
        "expected_module_ids": ["sale-ai-101", "sales-email-writing"],
        "generated_path": None
    },
    {
        "role_id": "marketing",
        "ai_level": 2,
        "completed_module_ids": ["marketing-ai-101"],
        "expected_module_ids": ["content-creation-ai", "seo-optimization-ai"],
        "generated_path": None
    }
]

MOCK_GRADING_SAMPLES = [
    {
        "prompt": "Hãy mô tả cách bạn sẽ tích hợp ChatGPT vào việc viết bài đăng mạng xã hội hàng tuần của công ty.",
        "answer": "Em sẽ dùng ChatGPT để lên dàn ý trước. Sau đó em nạp thông tin sản phẩm và yêu cầu nó viết theo 3 phong cách khác nhau: vui vẻ, chuyên nghiệp, và kể chuyện. Cuối cùng em tự chỉnh sửa lại từ ngữ cho tự nhiên rồi đăng.",
        "score": 85,
        "feedback": "Bài làm rất thực tế. Bạn đã biết cách tận dụng ChatGPT cho việc lên ý tưởng và đa dạng hóa phong cách. Điểm cộng lớn là có khâu tự chỉnh sửa lại (Human-in-the-loop). Cần chú ý thêm việc kiểm chứng thông tin thực tế từ AI.",
        "human_score": 90
    },
    {
        "prompt": "Viết một email gửi khách hàng để xin lỗi vì giao hàng chậm trễ sử dụng công thức phản hồi AI.",
        "answer": "Xin lỗi khách hàng nhiều lắm. Do bên giao hàng bị trễ nên đơn hàng chưa tới. Lần sau em bù cho nha.",
        "score": 45,
        "feedback": "Email quá sơ sài, thiếu tính chuyên nghiệp và lịch sự tối thiểu khi làm việc với đối tác/khách hàng. Bạn cần áp dụng các prompt có sẵn của AI để sinh cấu trúc email lịch sự, đưa ra nguyên nhân rõ ràng và giải pháp khắc phục cụ thể.",
        "human_score": 50
    }
]


async def fetch_chat_samples(gateway) -> List[Dict[str, Any]]:
    """Fetch dữ liệu từ chat_messages và chat_conversations."""
    try:
        # Lấy các messages của assistant để làm answer, map với message của user ngay trước đó
        messages = await gateway.select(
            "chat_messages",
            query={"select": "conversation_id,role,content,created_at", "order": "created_at.asc"}
        )
        
        samples = []
        conversation_map: Dict[str, List[Dict[str, Any]]] = {}
        for m in messages:
            cid = m["conversation_id"]
            if cid not in conversation_map:
                conversation_map[cid] = []
            conversation_map[cid].append(m)

        for cid, msgs in conversation_map.items():
            for i in range(1, len(msgs)):
                if msgs[i]["role"] == "assistant" and msgs[i-1]["role"] == "user":
                    samples.append({
                        "question": msgs[i-1]["content"],
                        "answer": msgs[i]["content"],
                        "contexts": [],  # Sẽ được bổ sung từ chat logs/retrieval nếu có RAG
                        "ground_truth": None
                    })
        return samples
    except Exception as e:
        print(f"⚠️ Không thể fetch chat logs từ Supabase ({e}). Sử dụng mock data.")
        return []


async def fetch_path_samples(gateway) -> List[Dict[str, Any]]:
    """Fetch dữ liệu từ learning_path_cache."""
    try:
        rows = await gateway.select(
            "learning_path_cache",
            query={"select": "path_json,fingerprint"}
        )
        samples = []
        for row in rows:
            path = row.get("path_json")
            if not path:
                continue
            # Parse thông tin từ fingerprint hoặc metadata nếu có
            # Tạm thời sinh heuristic mong đợi dựa trên cấu trúc path lưu trữ
            role_id = path.get("roleId", "khac")
            ai_level = path.get("aiLevel", 0)
            
            # Trích xuất danh sách module thực tế được sinh ra trong cache
            module_ids = []
            for g in path.get("groups", []):
                module_ids.extend(g.get("moduleIds", []))
                
            samples.append({
                "role_id": role_id,
                "ai_level": ai_level,
                "completed_module_ids": [],
                "expected_module_ids": module_ids[:2], # lấy tạm 2 module làm benchmark
                "generated_path": path
            })
        return samples
    except Exception as e:
        print(f"⚠️ Không thể fetch learning path cache từ Supabase ({e}). Sử dụng mock data.")
        return []


async def fetch_grading_samples(gateway) -> List[Dict[str, Any]]:
    """Fetch dữ liệu từ grading_results."""
    try:
        rows = await gateway.select(
            "grading_results",
            query={"select": "score,feedback,user_id,submission_id"}
        )
        
        samples = []
        for r in rows:
            # Lấy thông tin prompt và answer từ submission_id
            submission_id = r["submission_id"]
            answers = await gateway.select(
                "assessment_answers",
                query={"select": "answer_json,item_id", "submission_id": f"eq.{submission_id}"}
            )
            
            prompt = "Câu hỏi tự luận học viên"
            answer = "Bài làm của học viên"
            
            if answers:
                answer_json = answers[0].get("answer_json") or {}
                answer = answer_json.get("text") or answer_json.get("answer") or answer
                
                # Fetch prompt từ assessment_items
                item_id = answers[0].get("item_id")
                if item_id:
                    items = await gateway.select(
                        "assessment_items",
                        query={"select": "prompt", "id": f"eq.{item_id}"}
                    )
                    if items:
                        prompt = items[0].get("prompt") or prompt

            # Tìm xem có review điều chỉnh điểm từ quản lý không
            reviews = await gateway.select(
                "grading_reviews",
                query={"select": "adjusted_score", "grading_result_id": f"eq.{r.get('id')}"}
            )
            human_score = reviews[0].get("adjusted_score") if reviews else None

            samples.append({
                "prompt": prompt,
                "answer": answer,
                "score": r["score"],
                "feedback": r["feedback"],
                "human_score": human_score
            })
        return samples
    except Exception as e:
        print(f"⚠️ Không thể fetch grading results từ Supabase ({e}). Sử dụng mock data.")
        return []


async def main():
    parser = argparse.ArgumentParser(description="Build golden dataset for RAGAS evaluation")
    parser.add_argument("--output", default="src/backend/eval/data", help="Thư mục xuất file dataset")
    args = parser.parse_args()

    os.makedirs(args.output, exist_ok=True)
    gateway = get_supabase_gateway()
    
    # 1. Chat Dataset
    print("⏳ Building Chat Dataset...")
    chat_data = []
    if gateway.is_configured():
        chat_data = await fetch_chat_samples(gateway)
    if not chat_data:
        chat_data = MOCK_CHAT_SAMPLES
    
    chat_file = os.path.join(args.output, "chat_dataset.json")
    with open(chat_file, "w", encoding="utf-8") as f:
        json.dump(chat_data, f, ensure_ascii=False, indent=2)
    print(f"✅ Chat Dataset saved to {chat_file} ({len(chat_data)} samples)")

    # 2. Learning Path Dataset
    print("⏳ Building Learning Path Dataset...")
    path_data = []
    if gateway.is_configured():
        path_data = await fetch_path_samples(gateway)
    if not path_data:
        path_data = MOCK_PATH_SAMPLES
        
    path_file = os.path.join(args.output, "learning_path_dataset.json")
    with open(path_file, "w", encoding="utf-8") as f:
        json.dump(path_data, f, ensure_ascii=False, indent=2)
    print(f"✅ Learning Path Dataset saved to {path_file} ({len(path_data)} samples)")

    # 3. Grading Dataset
    print("⏳ Building Grading Dataset...")
    grading_data = []
    if gateway.is_configured():
        grading_data = await fetch_grading_samples(gateway)
    if not grading_data:
        grading_data = MOCK_GRADING_SAMPLES
        
    grading_file = os.path.join(args.output, "grading_dataset.json")
    with open(grading_file, "w", encoding="utf-8") as f:
        json.dump(grading_data, f, ensure_ascii=False, indent=2)
    print(f"✅ Grading Dataset saved to {grading_file} ({len(grading_data)} samples)")

    await close_supabase_gateway()


if __name__ == "__main__":
    asyncio.run(main())
