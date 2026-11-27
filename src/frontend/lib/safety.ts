// Phát hiện dữ liệu nhạy cảm trong tin nhắn chat — dùng chung client + server.

// Lưu ý: PHẢI có flag "g" — thiếu "g" khiến String.replace() chỉ thay thế
// match ĐẦU TIÊN của mỗi pattern, để lọt các số nhạy cảm tiếp theo trong
// cùng tin nhắn (VD user paste cả CMND lẫn số tài khoản trong 1 câu).
export const SAFETY_TRIGGERS = [
  /\b\d{8,16}\b/g,
  /STK|tài khoản|account number/gi,
  /mật khẩu|password/gi,
  /CMND|CCCD/gi,
];

export const SAFETY_WARNING =
  "⚠ **Em phát hiện thông tin có thể nhạy cảm** (số điện thoại / tài khoản / mật khẩu) trong câu hỏi. Nhắc anh/chị: không nên đưa dữ liệu cá nhân của khách lên công cụ AI công cộng. Hãy mô tả tình huống chung — không kèm thông tin định danh — để em trả lời an toàn hơn.";

export function detectSensitiveData(text: string): boolean {
  // Regex "g" là stateful (lastIndex) — reset trước mỗi lần .test() để tránh
  // kết quả sai lệch giữa các lần gọi liên tiếp trên cùng regex object.
  return SAFETY_TRIGGERS.some((trigger) => {
    trigger.lastIndex = 0;
    return trigger.test(text);
  });
}

export function getSafetyWarning(text: string): string | undefined {
  return detectSensitiveData(text) ? SAFETY_WARNING : undefined;
}
