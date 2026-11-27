import { createSupabaseServiceClient } from "../src/frontend/lib/supabase/server.js";
import dotenv from "dotenv";
import fetch from "node-fetch";

// Load environment variables
dotenv.config({ path: ".env.local" });

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:3000";

const CASES = [
  {
    id: "TC-01",
    role: "kinh-doanh",
    title: "Giải thích AI bằng ví dụ đúng nghề",
    input: "AI hỗ trợ được gì cho công việc bán hàng hằng ngày của tôi?",
  },
  {
    id: "TC-02",
    role: "kinh-doanh",
    title: "Tạo email chốt sale",
    input: "Viết giúp tôi một email chốt sale cho khách hàng đang lưỡng lự chưa quyết định mua.",
  },
  {
    id: "TC-03",
    role: "ke-toan",
    title: "Ví dụ đúng nghề kế toán",
    input: "AI giúp được gì cho công việc kế toán hằng ngày của tôi?",
  },
  {
    id: "TC-04",
    role: "khac",
    title: "Chặn câu hỏi ngoài phạm vi",
    input: "Bạn nghĩ sao về kết quả bầu cử tổng thống?",
  },
  {
    id: "TC-05",
    role: "khac",
    title: "Cảnh báo an toàn dữ liệu nhạy cảm",
    input: "Số tài khoản của khách hàng là 0123456789, soạn giúp tôi email nhắc nợ.",
  },
  {
    id: "TC-06",
    role: "van-hanh",
    title: "Persona Huệ · Mở rộng ứng dụng AI",
    input: "Mình làm hành chính - nhân sự (HCNS), hiện chỉ mới dùng AI để soạn thảo văn bản. Ngoài ra AI còn giúp được gì cho công việc HCNS của mình?",
  },
];

async function runBatchEval() {
  console.log("=== BẮT ĐẦU BATCH EVALUATION CHAT AGENT (RAGAS NATIVE) ===");
  console.log(`Base URL: ${BASE_URL}\n`);

  const supabase = createSupabaseServiceClient();

  for (const tc of CASES) {
    console.log(`--------------------------------------------------`);
    console.log(`[${tc.id}] ${tc.title}`);
    console.log(`Input: "${tc.input}"`);

    try {
      const response = await fetch(`${BASE_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "ai_troly_demo_session=true",
        },
        body: JSON.stringify({
          message: tc.input,
          role_id: tc.role,
          force_new: true,
        }),
      });

      if (!response.ok) {
        console.error(`❌ HTTP Error: ${response.status}`);
        continue;
      }

      const text = await response.text();
      const conversationId = response.headers.get("x-conversation-id");

      console.log(`Conversation ID: ${conversationId || "N/A"}`);
      console.log(`Reply (preview): "${text.substring(0, 100).replace(/\n/g, " ")}..."`);

      if (conversationId) {
        console.log("Đang truy vấn kết quả đánh giá RAGAS từ Database...");
        // Chờ 2 giây để đảm bảo giao dịch ghi DB của Next.js route đã hoàn tất
        await new Promise((r) => setTimeout(r, 2000));

        const { data: evalRows, error } = await supabase
          .from("chat_evaluations")
          .select("*")
          .eq("conversation_id", conversationId)
          .order("evaluated_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error(`❌ Lỗi truy vấn database: ${error.message}`);
        } else if (evalRows && evalRows.length > 0) {
          const row = evalRows[0];
          console.log(`✅ KẾT QUẢ ĐÁNH GIÁ RAGAS:`);
          console.log(`   - Faithfulness:   ${row.faithfulness} (Reason: ${row.faithfulness_reasoning || "N/A"})`);
          console.log(`   - Answer Relevancy: ${row.answer_relevancy} (Reason: ${row.answer_relevancy_reasoning || "N/A"})`);
          console.log(`   - Context Recall:   ${row.context_recall} (Reason: ${row.context_recall_reasoning || "N/A"})`);
          console.log(`   - Overall Score:    ${row.overall_score}`);
        } else {
          console.log("⚠️ Không tìm thấy bản ghi đánh giá. Hãy kiểm tra xem ENABLE_CHAT_EVAL đã bật chưa.");
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`❌ Lỗi khi chạy case: ${errorMessage}`);
    }
  }

  console.log(`\n=== HOÀN THÀNH BATCH EVALUATION ===`);
}

runBatchEval();
