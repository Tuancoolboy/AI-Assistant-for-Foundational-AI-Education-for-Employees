import { describe, expect, it, afterEach } from "vitest";
import {
  buildEmployeeSystemPrompt,
  buildSystemPrompt,
  getFallbackAnswer,
  getCachedAnswer,
  getRateLimitPerDay,
  isOpenAIConfigured,
  getOpenAIModel,
} from "./openai";

describe("openai", () => {
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalSynthesisModel = process.env.OPENAI_MODEL_SYNTHESIS;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }
    if (originalModel === undefined) {
      delete process.env.OPENAI_MODEL;
    } else {
      process.env.OPENAI_MODEL = originalModel;
    }
    if (originalSynthesisModel === undefined) {
      delete process.env.OPENAI_MODEL_SYNTHESIS;
    } else {
      process.env.OPENAI_MODEL_SYNTHESIS = originalSynthesisModel;
    }
    delete process.env.RATE_LIMIT_PER_DAY;
  });

  it("buildSystemPrompt includes role label for kinh-doanh", () => {
    const prompt = buildSystemPrompt("kinh-doanh");
    expect(prompt).toContain("bán hàng");
    expect(prompt).toContain("Tiếng Việt");
  });

  it("buildSystemPrompt includes khac role", () => {
    const prompt = buildSystemPrompt("khac");
    expect(prompt).toContain("văn phòng");
  });

  it("buildEmployeeSystemPrompt includes company and Aha sources", () => {
    const prompt = buildEmployeeSystemPrompt("marketing", {
      fullName: "Lan",
      preferredAddress: "chi",
      curriculumSummary: "Nguồn curriculum",
      extraSkillSummary: "Nguồn extra",
      personalSummary: "Nguồn personal",
      companySummary: "Nguồn company",
      ahaSummary: "Nguồn aha",
      conversationMemory: "Nguồn memory",
    });

    expect(prompt).toContain("NGUỒN 3");
    expect(prompt).toContain("NGUỒN 4");
    expect(prompt).toContain("NGUỒN 1B");
    expect(prompt).toContain("Nguồn company");
    expect(prompt).toContain("Nguồn aha");
    expect(prompt).toContain("<thinking>");
    expect(prompt).toContain("<final>");
    expect(prompt).toContain("CẤM dùng kiến thức ngoài");
    expect(prompt).toContain("Em chưa có đủ thông tin để kết luận chính xác.");
  });

  it("buildEmployeeSystemPrompt blocks next-lesson leakage for extra skills", () => {
    const prompt = buildEmployeeSystemPrompt("marketing", {
      fullName: "Lan",
      preferredAddress: "chi",
      curriculumSummary: "Nguồn curriculum",
      extraSkillSummary: "Bài học thêm độc lập",
      personalSummary: "Nguồn personal",
      companySummary: "Nguồn company",
      ahaSummary: "Nguồn aha",
      conversationMemory: "Nguồn memory",
    });

    expect(prompt).toContain("Kỹ năng khác");
    expect(prompt).toContain("không có next lesson mặc định");
    expect(prompt).toContain("không bẻ sang lộ trình chính");
  });

  it("buildEmployeeSystemPrompt omits prior memory on a fresh conversation", () => {
    const prompt = buildEmployeeSystemPrompt("marketing", {
      fullName: "Lan",
      preferredAddress: "chi",
      curriculumSummary: "Nguồn curriculum",
      extraSkillSummary: "",
      personalSummary: "Nguồn personal",
      companySummary: "Nguồn company",
      ahaSummary: "Nguồn aha",
      conversationMemory: "Nguồn memory",
      freshConversation: true,
    });

    expect(prompt).toContain("một cuộc hội thoại mới");
    expect(prompt).not.toContain("TRÍ NHỚ HỘI THOẠI");
    expect(prompt).not.toContain("Nguồn memory");
  });

  it("buildEmployeeSystemPrompt injects only relevant repair rules", () => {
    const prompt = buildEmployeeSystemPrompt("marketing", {
      fullName: "Lan",
      preferredAddress: "chi",
      currentMessage:
        "Em cần sửa lại câu trả lời theo checklist, bảng, prompt copy-paste và báo cáo gửi sếp",
      curriculumSummary: "Nguồn curriculum",
      extraSkillSummary: "",
      personalSummary: "Nguồn personal",
      companySummary: "Nguồn company",
      ahaSummary: "Nguồn aha",
      conversationMemory: "Nguồn memory",
    });

    expect(prompt).toContain("QUY TẮC SỬA CÂU TRẢ LỜI");
    expect(prompt).toContain("QUY TẮC CHO BÁO CÁO / PHÂN TÍCH / CHECKLIST");
  });

  it("buildEmployeeSystemPrompt requires concrete table examples for invoice questions", () => {
    const prompt = buildEmployeeSystemPrompt("ke-toan", {
      fullName: "Lan",
      preferredAddress: "chi",
      currentMessage:
        "Cho tôi ví dụ cụ thể đối chiếu hóa đơn với công nợ theo vai trò kế toán.",
      curriculumSummary: "Nguồn curriculum",
      extraSkillSummary: "",
      personalSummary: "Nguồn personal",
      companySummary: "Nguồn company",
      ahaSummary: "Nguồn aha",
      conversationMemory: "Nguồn memory",
    });

    expect(prompt).toContain("## Bảng dữ liệu giả định");
    expect(prompt).toContain("## Cách đối chiếu");
    expect(prompt).toContain("## Prompt mẫu");
    expect(prompt).toContain("dữ liệu giả định");
  });

  it("buildEmployeeSystemPrompt answers clear questions without clarify cards", () => {
    const prompt = buildEmployeeSystemPrompt("nhan-su", {
      fullName: "Lan",
      preferredAddress: "chi",
      currentMessage: "Quy trình xin nghỉ phép là gì?",
      curriculumSummary: "Nguồn curriculum",
      extraSkillSummary: "",
      personalSummary: "",
      companySummary: "",
      ahaSummary: "",
      conversationMemory: "",
    });

    expect(prompt).toContain("NGƯỠNG KÍCH HOẠT __CLARIFY__");
    expect(prompt).toContain("Chỉ cho mình cách làm");
    expect(prompt).toContain("Quy trình xin nghỉ phép là gì?");
    expect(prompt).toContain("BẮT BUỘC trả lời trực tiếp");
    expect(prompt).toContain("Em chưa có đủ thông tin để kết luận chính xác.");
  });

  it("getCachedAnswer returns sales example for AI là gì", () => {
    const answer = getCachedAnswer("kinh-doanh", "AI là gì?");
    expect(answer).toContain("bán hàng");
  });

  it("getCachedAnswer returns null for unknown question", () => {
    expect(getCachedAnswer("kinh-doanh", "xyz random question 12345")).toBeNull();
  });

  it("getFallbackAnswer strips leading greetings from canned replies", () => {
    const { answer } = getFallbackAnswer(
      "co bai noi quy cong ty khong?",
      "van-hanh",
    );

    expect(answer).toContain("ngoài phạm vi");
    expect(answer).not.toMatch(/^Chào/i);
  });

  it("isOpenAIConfigured reflects env", () => {
    delete process.env.OPENAI_API_KEY;
    expect(isOpenAIConfigured()).toBe(false);
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isOpenAIConfigured()).toBe(true);
  });

  it("getRateLimitPerDay defaults to 30", () => {
    expect(getRateLimitPerDay()).toBe(30);
  });

  it("getRateLimitPerDay reads env", () => {
    process.env.RATE_LIMIT_PER_DAY = "50";
    expect(getRateLimitPerDay()).toBe(50);
  });

  it("getOpenAIModel uses synthesis override when configured", () => {
    delete process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL_SYNTHESIS;
    expect(getOpenAIModel()).toBe("gpt-4o-mini");

    process.env.OPENAI_MODEL = "gpt-4o-mini";
    process.env.OPENAI_MODEL_SYNTHESIS = "gpt-4.1";
    expect(getOpenAIModel({ synthesis: true })).toBe("gpt-4.1");
  });
});
