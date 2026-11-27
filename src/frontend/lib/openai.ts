import OpenAI from "openai";
import {
  stripLeadingAssistantGreeting,
  wrapUntrustedPromptBlock,
} from "@/lib/chat-prompt-safety";
import {
  buildEmployeePromptSections,
  buildManagerPromptSections,
  joinPromptSections,
} from "@/lib/chat-prompt-sections";
import { buildCoachAddresses, buildFriendlyAddress } from "@/lib/display-name";
import { findCannedResponse } from "@/lib/tro-ly-canned-responses";
import { type PreferredAddress } from "@/lib/learning-profile";

export type RoleId =
  | "kinh-doanh"
  | "ke-toan"
  | "marketing"
  | "van-hanh"
  | "khac"
  | "nhan-su"
  | "vibe-code";

export const LEARNING_ROLE_IDS = new Set<RoleId>([
  "kinh-doanh",
  "ke-toan",
  "marketing",
  "van-hanh",
  "khac",
  "nhan-su",
  "vibe-code",
]);

// Lưu ý: đây là bản dùng cho system prompt + các module agent/grader —
// PHẢI khớp với label chính thức trong lib/roles.ts (nguồn dữ liệu lộ
// trình). "van-hanh" từng bị lệch thành "Nhân viên vận hành" trong khi
// roles.ts đã đổi thành "Hành chính / Nhân sự (HR)" — khiến Trợ lý AI tự
// xưng sai vai trò của người dùng (QA finding A-04 / B-1).
export const ROLE_LABEL: Record<RoleId, string> = {
  "kinh-doanh": "Nhân viên kinh doanh / bán hàng",
  "ke-toan": "Nhân viên kế toán",
  marketing: "Nhân viên marketing",
  "van-hanh": "Nhân viên Hành chính / Nhân sự (HR)",
  khac: "Nhân viên văn phòng",
  "nhan-su": "Nhân viên nhân sự (HR)",
  "vibe-code": "Học viên Vibe Code (tự build app bằng AI)",
};

export function isRoleId(value: string | null | undefined): value is RoleId {
  return typeof value === "string" && LEARNING_ROLE_IDS.has(value as RoleId);
}

export function normalizeRoleId(value: string | null | undefined): RoleId {
  return isRoleId(value) ? value : "khac";
}

export type EmployeePromptContext = {
  fullName: string;
  preferredAddress: PreferredAddress;
  currentMessage?: string;
  curriculumSummary: string;
  extraSkillSummary: string;
  personalSummary: string;
  companySummary: string;
  ahaSummary: string;
  conversationMemory: string;
  freshConversation?: boolean;
};

export type ManagerPromptContext = {
  fullName: string;
  currentMessage?: string;
  coreContext: string;
  teamSummary: string;
  freshConversation?: boolean;
};

function buildThreadBoundaryBlock(freshConversation: boolean): string {
  if (freshConversation) {
    return `

BIÊN PHIÊN:
- Đây là một cuộc hội thoại mới, không được nối tiếp hay suy diễn từ chat khác.
- Chỉ dùng dữ liệu và tin nhắn trong phiên hiện tại; nếu user không nhắc lại bối cảnh cũ thì không tự kéo nó vào câu trả lời.`;
  }

  return `

BIÊN PHIÊN:
- Đây là phần tiếp nối của cùng một cuộc hội thoại hiện tại.
- Chỉ dùng dữ liệu hợp lệ; không tự bịa thêm bối cảnh ngoài các nguồn đã có.`;
}

function buildStructuredResponseContractBlock(): string {
  return `

ĐỊNH DẠNG PHẢN HỒI BẮT BUỘC:
- Nếu đủ dữ kiện, luôn trả theo đúng thứ tự:
  <thinking>
  - Mục tiêu cần giải quyết
  - Dữ kiện thực sự đã dùng
  - Quyết định / suy luận theo từng bước
  - Giả định hoặc cảnh báo nếu có
  </thinking>
  <final>
  - Câu trả lời cuối cùng
  </final>
- Phần <thinking> chỉ là tóm tắt suy luận ngắn gọn, không lặp cùng một ý, không vòng vo.
- Chỉ được dựa trên dữ kiện trong các NGUỒN được cung cấp và tin nhắn thuộc hội thoại hiện tại. CẤM dùng kiến thức ngoài để bịa quy trình, chính sách, bài học, tên bài hoặc nội dung của link.
- Nếu nguồn không đủ để trả lời chính xác, phải nói nguyên văn: "Em chưa có đủ thông tin để kết luận chính xác."
- Chỉ tạo __CLARIFY__ khi một câu hỏi thật sự có thể thu thập đúng dữ kiện còn thiếu; không dùng giả định để lấp dữ kiện nghiệp vụ hoặc nội dung bài học.
- Nếu có link bài học, label và mô tả phải khớp đúng nội dung bài trong NGUỒN 1 hoặc NGUỒN 1B; không bịa slug, không bịa tên bài, không gán nội dung sai cho link.
- Không lặp lại cùng một chuỗi suy luận trong nhiều câu liên tiếp. Mỗi bullet trong <thinking> phải thêm thông tin mới.`;
}

function buildContextBlocks(ctx: {
  curriculumSummary: string;
  extraSkillSummary: string;
  personalSummary: string;
  companySummary: string;
  ahaSummary: string;
  conversationMemory?: string;
  freshConversation?: boolean;
}): string {
  const freshConversation = ctx.freshConversation ?? false;
  const curriculumBlock = ctx.curriculumSummary.trim()
    ? `\n\nNGUỒN 1 — LỘ TRÌNH & BÀI HỌC (nguồn chính thức, ưu tiên cao nhất — KHÔNG bịa module/bài ngoài list):${wrapUntrustedPromptBlock("curriculum", ctx.curriculumSummary.trim(), 4000)}`
    : "";
  const extraSkillBlock = ctx.extraSkillSummary.trim()
    ? `\n\nNGUỒN 1B — KỸ NĂNG KHÁC (bài học có thật trong hệ thống, chỉ dùng khi không trùng lộ trình vai trò):${wrapUntrustedPromptBlock("extra-skills", ctx.extraSkillSummary.trim(), 2500)}`
    : "";
  const personalBlock = ctx.personalSummary.trim()
    ? `\n\nNGUỒN 2 — HỒ SƠ CÁ NHÂN (cách xưng hô, vướng mắc, bối cảnh công việc):${wrapUntrustedPromptBlock("personal", ctx.personalSummary.trim(), 2500)}`
    : "";
  const companyBlock = ctx.companySummary.trim()
    ? `\n\nNGUỒN 3 — CÔNG TY / PHÒNG BAN / LỘ TRÌNH GIAO:${wrapUntrustedPromptBlock("company", ctx.companySummary.trim(), 2500)}`
    : "";
  const ahaBlock = ctx.ahaSummary.trim()
    ? `\n\nNGUỒN 4 — AHA / PHẢN TƯ GẦN ĐÂY:${wrapUntrustedPromptBlock("aha", ctx.ahaSummary.trim(), 1500)}`
    : "";
  const memoryBlock = !freshConversation && ctx.conversationMemory?.trim()
    ? `\n\nTRÍ NHỚ HỘI THOẠI (bổ sung — không thay các nguồn còn lại):${wrapUntrustedPromptBlock("memory", ctx.conversationMemory.trim(), 1200)}`
    : "";

  return `${curriculumBlock}${extraSkillBlock}${personalBlock}${companyBlock}${ahaBlock}${memoryBlock}`;
}

function buildSkillGatingPolicyBlock(userAddress: string): string {
  return `

TƯ DUY ĐẶT CÂU HỎI — "ĐIỂM RẼ" (CỐT LÕI, BẮT BUỘC):
Mục đích hỏi KHÔNG phải "hỏi cho có", mà để GIẢM RỦI RO trả lời sai hướng. Nếu em tự đoán sai, ${userAddress} phải đọc một bài dài rồi mới nhận ra lệch ý — mất thời gian hơn nhiều so với trả lời vài câu ngắn lúc đầu.

NGƯỠNG KÍCH HOẠT __CLARIFY__:
- CHỈ dùng \`__CLARIFY__\` khi yêu cầu thực sự thiếu ngữ cảnh, quá ngắn gọn, hoặc có nhiều cách hiểu làm thay đổi đáng kể nội dung trả lời.
- Nếu user chỉ chào hỏi, cảm ơn, phản hồi xã giao, hoặc hỏi một vấn đề đã có đủ thông tin, BẮT BUỘC trả lời trực tiếp; CẤM dùng \`__CLARIFY__\`.
- Không hỏi chỉ để biết thêm một chi tiết "cho hay hơn". Nếu nguồn hiện có đủ thì trả lời ngay; nếu nguồn thiếu dữ kiện quyết định thì nói "Em chưa có đủ thông tin để kết luận chính xác." hoặc hỏi đúng một câu card cần thiết.
- Ví dụ CẦN clarify: "Chỉ cho mình cách làm" khi lịch sử không cho biết user muốn làm việc gì → hỏi đúng 1 câu để xác định đầu việc.
- Ví dụ KHÔNG cần clarify: "Quy trình xin nghỉ phép là gì?" → trả lời trực tiếp quy trình hoặc nói rõ chưa có chính sách nội bộ; không dựng card.

CÁCH TÌM ĐIỂM RẼ (làm trong đầu trước khi trả lời):
1. Tự tưởng tượng 2–3 PHIÊN BẢN câu trả lời khác nhau em có thể viết ra cho yêu cầu này.
2. Tự hỏi: "Phiên bản nào đúng với cái ${userAddress} cần?". Nếu KHÔNG CHẮC → đó chính là câu cần hỏi.
3. Nếu một biến số KHÔNG làm đổi nội dung câu trả lời, HOẶC ${userAddress} đã cho đủ thông tin để em suy ra → KHÔNG hỏi nữa (hỏi thêm chỉ làm chậm, không tăng giá trị).

MINDSET CỐT LÕI — ĐỪNG ĐỂ USER BỊ HỎI LẠI LẦN HAI:
- Nếu em đã hỏi ${userAddress} làm rõ rồi, mọi câu trả lời sau đó phải DỒN TOÀN BỘ context đã thu thập vào hướng dẫn. Không được trả lời như thể mới nhận một câu hỏi trần trụi.
- Sau khi đủ thông tin, hãy tự coi mình đang chuyển một prompt hoàn chỉnh cho chuyên gia xử lý: tách rõ <context> (dữ kiện đã biết), <task> (việc cần làm), <format> (đầu ra cần), và <do_not_ask_again> (không hỏi lại user).
- Nếu đã có đủ dữ kiện từ các card, CẤM hỏi lại cùng thông tin dưới cách diễn đạt khác. Phải đi thẳng vào hướng dẫn có giá trị, nêu giả định nếu còn thiếu chi tiết nhỏ.
- Nếu user phản hồi câu trước chưa sát hoặc yêu cầu sửa lại, phải ưu tiên chẩn đoán chỗ lệch rồi nâng cấp câu trả lời. Chỉ hỏi đúng 1 câu về phần chưa ổn nhất nếu thật sự cần; còn đủ context thì viết lại luôn bản tốt hơn. Không biến feedback sửa câu trả lời thành __CLARIFY__ nếu có thể trả bản sửa trực tiếp. Ưu tiên sửa đúng dạng user yêu cầu: ngắn hơn, sâu hơn, nhiều ví dụ hơn, so sánh với benchmark/kỳ trước, lệch role, đổi giọng văn, hoặc đổi format.
- Với yêu cầu cần phân tích nhiều bước, reason through tuần tự trước khi kết luận, nhưng chỉ trình bày phần kết quả/hướng dẫn gọn gàng cho user.
- Khi cần văn phong/cấu trúc đặc biệt, có thể đưa positive/negative example ngắn để user biết cách làm đúng và tránh cách làm sai.

KHUNG 3 LỚP (áp cho mọi yêu cầu dạng "giúp tôi làm X"):
- Lớp 1 — Phạm vi/chủ đề cụ thể: cụm chung quá rộng cần thu hẹp (vd "báo cáo marketing" → social media / performance ads / báo cáo tổng kết gửi sếp — mỗi loại khác hẳn cấu trúc, chỉ số, văn phong).
- Lớp 2 — Điểm xuất phát: ${userAddress} đã có gì trong tay (dữ liệu sẵn / phải hướng dẫn từ số 0) — cách hỗ trợ khác hẳn.
- Lớp 3 — Output cuối: cần file Word, slide thuyết trình, hay chỉ dàn ý để tự viết tiếp.
Chỉ hỏi những lớp mà câu trả lời thực sự làm ĐỔI nội dung; lớp nào suy ra được thì bỏ qua.

CÁCH HỎI (BẮT BUỘC — VI PHẠM = SAI HOÀN TOÀN):
1. Tối đa 2–3 câu hỏi cho cả yêu cầu, ưu tiên đúng các điểm rẽ quan trọng nhất.
2. MỖI TIN NHẮN CHỈ HỎI MỘT câu — chờ ${userAddress} trả lời rồi mới hỏi tiếp.
3. Câu hỏi phải DỄ TRẢ LỜI: kèm 2–4 lựa chọn gợi ý (vd "social media, performance ads, hay tổng kết gửi sếp?"), không hỏi mở chung chung.
4. Tin nhắn hỏi: một câu dẫn ngắn (1–2 câu) + khối __CLARIFY__ JSON ở dòng riêng (BẮT BUỘC). KHÔNG bullet, KHÔNG đánh số, KHÔNG liệt kê nhiều câu.
   - ĐÚNG (mẫu):
     Chào ${userAddress}! Em muốn hỏi thêm một chút để hướng dẫn đúng hướng.

     __CLARIFY__:{"step":1,"total":3,"question":"Báo cáo này tập trung vào hoạt động marketing nào?","options":["Social media","Quảng cáo performance","Tổng kết gửi sếp","Khác (sẽ mô tả thêm)"]}
   - Ví dụ trên chỉ là ví dụ minh hoạ. Khi user thuộc role khác hoặc ngữ cảnh khác, BẮT BUỘC đổi câu hỏi + options cho đúng nghề của họ; CẤM dùng lại bộ option marketing cho HR/kế toán/vận hành chỉ vì user có chữ "báo cáo".
   - step = thứ tự câu hỏi hiện tại (1–3); total = tổng câu dự kiến (2–3); options = 2–4 lựa chọn cụ thể, luôn có "Khác (sẽ mô tả thêm)" nếu chưa có lựa chọn Khác.
   - options = 2–4 lựa chọn CỤ THỂ khớp câu hỏi; CẤM dùng "Có/Không" khi câu hỏi dạng "nào/gì/loại"; luôn có "Khác (sẽ mô tả thêm)" nếu chưa có lựa chọn Khác.
   - SAI (cấm): intro + bullet "loại nào?" + bullet "có số liệu chưa?".
5. KHI USER TRẢ LỜI DẠNG "Q: …\\nA: …" (đã trả lời câu hỏi card):
   - Tối đa đúng 3 câu card/hội thoại (3 lớp điểm rẽ). Sau câu thứ 3 → BẮT BUỘC trả hướng dẫn đầy đủ; CẤM __CLARIFY__, CẤM hỏi thêm card.
   - Nếu chưa đủ 3 câu → BẮT BUỘC __CLARIFY__ step tiếp theo (2/3 rồi 3/3); CẤM hỏi plain text.
   - step 2 = lớp điểm xuất phát; step 3 = lớp output. Không hỏi lại lớp đã rõ.
   - Sau câu thứ 3, hãy tổng hợp nội bộ theo khung:
     <context>yêu cầu gốc + 3 câu trả lời đã thu thập</context>
     <task>việc cần hướng dẫn hoặc tạo</task>
     <format>đầu ra user cần</format>
     <do_not_ask_again>Thông tin trên đã đủ; không hỏi lại user.</do_not_ask_again>
6. Chỉ chuyển sang hướng dẫn dài (bullet/bước) sau khi đã hỏi đủ 3 câu card HOẶC yêu cầu đã đủ rõ ngay từ đầu (0 câu card).
7. Nếu ${userAddress} không bổ sung và nguồn chưa đủ → nói "Em chưa có đủ thông tin để kết luận chính xác."; không tự chọn phiên bản khả dĩ nhất để lấp dữ kiện.
8. Nếu yêu cầu đã đủ rõ (không còn điểm rẽ) → trả lời thẳng, KHÔNG hỏi lan man, KHÔNG card.

BOUNDARY (BẮT BUỘC):
- CHỈ trả lời: AI trong công việc, lộ trình học, prompt, công cụ AI, an toàn dữ liệu.
- Câu ngoài lề → từ chối lịch sự, gợi ý quay lại module/tiến độ hiện tại.
- Nếu paste dữ liệu nhạy cảm → cảnh báo không đưa lên AI công cộng.
- KHÔNG bịa module hoặc bài học không có trong NGUỒN 1.

LINK BÀI HỌC (BẮT BUỘC):
- Khi nhắc tên module/bài học, dùng markdown link: [Tên bài](/lo-trinh/{module-id}) — lấy đúng slug từ NGUỒN 1. CHỈ dùng slug có trong danh sách NGUỒN 1. KHÔNG bịa slug mới.
- Nếu không có module nào khớp với câu hỏi của user, nói rõ điều đó và hướng dẫn trực tiếp — KHÔNG bịa link hay tên bài.
- KHÔNG bọc tên bài bằng dấu « »; user cần bấm được link để mở bài.

NGUYÊN TẮC SKILL-GATING — "CHO CẦN CÂU, KHÔNG CHO CON CÁ" (khung chung):
- Trợ lý là gia sư MỞ KHOÁ kỹ năng, không phải chatbot trả đáp án vô điều kiện. Khi hệ thống chèn [CHỈ THỊ SKILL-GATING] ở cuối, BẮT BUỘC theo đúng case đó:
  - CASE A (đã học): được cho đáp án trực tiếp, kèm 1 câu cà khịa nhẹ đúng cấp + link ôn lại. Không xúc phạm, luôn vẫn giúp.
  - CASE B (chưa học): KHÔNG cho đáp án đầy đủ; định hướng học, giọng động viên nhẹ, liệt kê bài để user tự chọn.
  - CASE C (chưa có bài): trả lời khéo, hữu ích; mời đăng Topic câu hỏi chưa có lời giải đúng 1 lần; không khịa, không bắt học.
- Nếu KHÔNG có [CHỈ THỊ SKILL-GATING] (vd đang clarify) → bỏ qua khung này, trả lời theo các quy tắc khác.

CHUẨN TRÌNH BÀY KHI VIẾT DÀN Ý / HƯỚNG DẪN (BẮT BUỘC):
- Nếu output là dàn ý, checklist, khung báo cáo, hoặc hướng dẫn nhiều mục: dùng \`##\` cho mục lớn. KHÔNG dùng danh sách đánh số \`1. 2. 3.\` cho mục lớn.
- Bên trong mỗi mục lớn, dùng dấu \`-\` cho các ý con. MỖI ý con PHẢI đứng trên dòng riêng. CẤM nối nhiều ý trên cùng một dòng bằng \` - \`.
- Nếu cần thứ tự thao tác, chỉ đánh số ở mức bước thực hiện (\`1. 2. 3.\`), không trộn với heading.
- Chừa dòng trống giữa các mục lớn để renderer nhận đúng cấu trúc Markdown.
- Tránh mở đầu/kết thúc kiểu xã giao rỗng như "Cảm ơn anh đã cung cấp thông tin", "em luôn sẵn sàng giúp đỡ" nếu câu đó không thêm thông tin mới. Đi thẳng vào nội dung hữu ích.

ĐỘ SÂU NỘI DUNG (BẮT BUỘC):
- Với mỗi ý trong dàn ý hoặc checklist, KHÔNG chỉ ghi tên mục. Phải thêm ít nhất 1 câu ngắn giải thích: cần viết gì, vì sao mục đó quan trọng, và nếu phù hợp thì nêu luôn nguồn dữ liệu, công thức tính, hoặc ví dụ rất ngắn.
- Nếu user đang cần "khung outline", đầu ra vẫn phải đủ sâu để họ tự làm tiếp, không được biến thành template rỗng chỉ có tiêu đề mục.
- Khi nói về số liệu/KPI/báo cáo: ưu tiên nêu nguồn lấy dữ liệu cụ thể (vd Ads Manager, GA4, máy chấm công, phần mềm HR, file Excel nội bộ), công thức tính nếu có, và ngưỡng cần lưu ý nếu biết.
- Nếu chưa chắc ngưỡng chuẩn vì thiếu bối cảnh công ty, nói rõ đó là chỉ báo tham khảo chứ không bịa chuẩn tuyệt đối.
- Mỗi báo cáo/phân tích nên đọc theo nhịp: quan sát dữ liệu → diễn giải/giả thuyết → mức chắc chắn → hành động đề xuất.
- Khi có thể, thêm lớp so sánh với kỳ trước, target, hoặc benchmark; nếu không có thì phải nói thẳng là chưa đủ dữ liệu để kết luận dứt khoát.
- Nếu một số liệu không giúp người dùng ra quyết định, đưa nó xuống phụ lục hoặc bỏ khỏi phần chính.
- Ví dụ MONG MUỐN:
  ## Phân tích số liệu
  - Tỷ lệ nghỉ phép: ghi công thức \`số ngày nghỉ phép / tổng số ngày công kế hoạch\`; mục này giúp nhìn nhanh tháng đó biến động nhân sự có bất thường không.
  - Nguồn dữ liệu: lấy từ máy chấm công hoặc file tổng hợp HR; nếu dữ liệu nằm rải ở nhiều file thì gom về một bảng trước khi viết nhận xét.
- Ví dụ KHÔNG MONG MUỐN:
  1. Phân tích số liệu
  - Tỷ lệ nghỉ phép. - So sánh tháng trước.

ĐỊNH DẠNG: Tiếng Việt đời thường; khi hỏi làm rõ → một đoạn ngắn + một câu hỏi (không bullet); khi hướng dẫn → heading + bullet hoặc bước; tối đa ~250 từ trừ khi user yêu cầu chi tiết.

NHẮC LẠI (ưu tiên cao): nếu đang hỏi làm rõ thiếu dữ kiện → tin nhắn kết thúc bằng ĐÚNG MỘT dấu ?; không bullet; không hai câu hỏi.`;
}

export function buildEmployeeSystemPrompt(
  roleId: RoleId,
  ctx: EmployeePromptContext,
): string {
  const label = ROLE_LABEL[roleId] ?? ROLE_LABEL.khac;
  const displayName = ctx.fullName.trim() || "bạn";
  const { named: userAddress, casual: casualAddress } = buildCoachAddresses(
    displayName,
    ctx.preferredAddress,
  );
  const promptSections = buildEmployeePromptSections({
    displayName,
    roleLabel: label,
    userAddress,
    casualAddress,
    currentMessage: ctx.currentMessage,
    curriculumSummary: ctx.curriculumSummary,
    extraSkillSummary: ctx.extraSkillSummary,
    companySummary: ctx.companySummary,
    ahaSummary: ctx.ahaSummary,
  });
  const freshConversation = ctx.freshConversation ?? false;
  const threadBoundaryBlock = buildThreadBoundaryBlock(freshConversation);
  const contextBlocks = buildContextBlocks({
    curriculumSummary: ctx.curriculumSummary,
    extraSkillSummary: ctx.extraSkillSummary,
    personalSummary: ctx.personalSummary,
    companySummary: ctx.companySummary,
    ahaSummary: ctx.ahaSummary,
    conversationMemory: ctx.conversationMemory,
    freshConversation,
  });

  return `${joinPromptSections(promptSections)}

${buildStructuredResponseContractBlock()}

${threadBoundaryBlock}
${buildSkillGatingPolicyBlock(userAddress)}${contextBlocks}`;
}

export function buildManagerSystemPrompt(ctx: ManagerPromptContext): string {
  const displayName = ctx.fullName.trim() || "quản lý";
  const friendly = buildFriendlyAddress(displayName);
  const freshConversation = ctx.freshConversation ?? false;
  const promptSections = buildManagerPromptSections({
    displayName,
    friendly,
    currentMessage: ctx.currentMessage,
  });
  const memoryBlock = !freshConversation && ctx.coreContext.trim()
    ? `\n\nTRÍ NHỚ DÀI HẠN (từ các lần trò chuyện trước):${wrapUntrustedPromptBlock("manager-memory", ctx.coreContext.trim(), 1200)}`
    : "";
  const teamBlock = ctx.teamSummary.trim()
    ? `\n\nDỮ LIỆU PHÂN TÍCH TEAM (thật từ hệ thống):${wrapUntrustedPromptBlock("team-summary", ctx.teamSummary.trim(), 4000)}`
    : "";
  const threadBoundaryBlock = buildThreadBoundaryBlock(freshConversation);

  return `${joinPromptSections(promptSections)}

${buildStructuredResponseContractBlock()}

${threadBoundaryBlock}
${memoryBlock}${teamBlock}`;
}

export function buildSystemPrompt(roleId: RoleId): string {
  return buildEmployeeSystemPrompt(roleId, {
    fullName: "bạn",
    preferredAddress: "neutral",
    curriculumSummary: "",
    extraSkillSummary: "",
    personalSummary: "",
    companySummary: "",
    ahaSummary: "",
    conversationMemory: "",
    freshConversation: false,
  });
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

export function getOpenAIModel(options?: { synthesis?: boolean }): string {
  if (options?.synthesis) {
    return (
      process.env.OPENAI_MODEL_SYNTHESIS?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-4o-mini"
    );
  }
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function getRateLimitPerDay(): number {
  const raw = process.env.RATE_LIMIT_PER_DAY;
  const n = raw ? Number.parseInt(raw, 10) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

// Cache câu hỏi phổ biến theo role — giảm chi phí OpenAI.
const QUESTION_CACHE: Record<string, Partial<Record<RoleId, string>>> = {
  "ai la gi": {
    "kinh-doanh": `AI là công cụ giúp bạn xử lý nhanh việc lặp lại trong bán hàng — soạn email chào khách, viết kịch bản gọi điện, gợi ý cách trả lời khi khách nói "đắt quá".

Nghĩ đơn giản: AI làm nháp, bạn duyệt rồi gửi. Quyết định chốt sale vẫn là của bạn.`,
    "ke-toan": `AI giúp kế toán tóm tắt báo cáo dài, gợi ý công thức Excel, soạn email giải trình số liệu — tiết kiệm 1–2 giờ/ngày cho việc lặp lại.

AI không thay bạn ký số liệu chính thức. Bạn vẫn phải kiểm tra lại trước khi nộp.`,
    marketing: `AI giúp marketing lên ý tưởng tiêu đề, viết nháp caption, brainstorm campaign — nhanh hơn nhiều so với ngồi trắng giấy.

Luôn chỉnh lại giọng văn cho đúng thương hiệu trước khi đăng.`,
    "van-hanh": `AI giúp vận hành tóm tắt biên bản họp, soạn email mẫu, tạo checklist quy trình — giảm việc gõ tay lặp đi lặp lại.

Bạn vẫn cần đọc lại đầu việc và deadline trước khi gửi cho team.`,
    khac: `AI là trợ lý soạn thảo — giúp bạn viết email, tóm tắt tài liệu, lên checklist công việc nhanh hơn.

Dùng cho việc nháp, bạn duyệt rồi mới gửi chính thức.`,
  },
};

function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getCachedAnswer(
  roleId: RoleId,
  question: string,
): string | null {
  const norm = normalizeQuestion(question);
  if (/ai la gi|ai la|chatgpt la gi|tri tue nhan tao/.test(norm)) {
    return stripLeadingAssistantGreeting(
      QUESTION_CACHE["ai la gi"][roleId] ?? "",
    );
  }
  return null;
}

export function getFallbackAnswer(
  question: string,
  roleId: RoleId,
): { answer: string; safety?: string } {
  const fallback = findCannedResponse(question, roleId);
  return {
    ...fallback,
    answer: stripLeadingAssistantGreeting(fallback.answer),
  };
}
