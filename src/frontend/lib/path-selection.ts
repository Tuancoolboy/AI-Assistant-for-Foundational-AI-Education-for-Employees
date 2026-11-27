// Chọn bài học cho lộ trình theo KẾT QUẢ KHẢO SÁT — rule-based, KHÔNG dùng AI.
// Nguồn sự thật DUY NHẤT để cả màn kết quả onboarding và trang /lo-trinh hiển thị
// CÙNG một số bài. "Người ta chọn phần nào → phân bổ đúng bài phần đó."
//
// Tín hiệu: result.dailyTasks = slug nhóm việc chọn ở câu khảo sát
// (q3hr-tasks cho HR / q3-daily-tasks cho vai trò khác) — khớp trực tiếp với
// `module.skills` trong roles.ts / roles-hr.ts.

import { getRole, type RoleModule } from "@/lib/roles";

type PathSurveyResult = {
  dailyTasks?: string[];
  skipBasicModules?: boolean;
  aiLevel?: number;
};

// Trả về danh sách id bài học (đã sắp thứ tự: nền tảng → level tăng dần) cho lộ
// trình cá nhân hóa, trong phạm vi vai trò. Deterministic — cùng input, cùng output.
export function selectPathModuleIds(
  roleId: string | null | undefined,
  result: PathSurveyResult | null | undefined,
): string[] {
  if (!roleId) return [];
  const role = getRole(roleId);
  if (!role) return [];

  const skipBasic = result?.skipBasicModules ?? (result?.aiLevel ?? 0) >= 5;
  const taskSet = new Set(result?.dailyTasks ?? []);
  const passLevel = (m: RoleModule) => !skipBasic || m.level >= 2;

  const picked = new Map<string, RoleModule>();

  // 1) Bài nền tảng của vai trò luôn có mặt (trừ khi đã giỏi → skip cơ bản).
  for (const m of role.modules) {
    if (m.isFoundation && passLevel(m)) picked.set(m.id, m);
  }

  // 2) Bài khớp đúng PHẦN đã chọn (skills ∩ tasks).
  let matched = false;
  for (const m of role.modules) {
    if (m.isFoundation) continue;
    if ((m.skills ?? []).some((s) => taskSet.has(s))) {
      matched = true;
      if (passLevel(m)) picked.set(m.id, m);
    }
  }

  // 3) Fallback: không chọn phần nào / vai trò chưa gắn skill → toàn bộ bài vai trò.
  if (!matched) {
    for (const m of role.modules) {
      if (passLevel(m)) picked.set(m.id, m);
    }
  }

  const declOrder = new Map(role.modules.map((m, i) => [m.id, i]));
  return [...picked.values()]
    .sort((a, b) => {
      const fa = a.isFoundation ? 0 : 1;
      const fb = b.isFoundation ? 0 : 1;
      if (fa !== fb) return fa - fb;
      if (a.level !== b.level) return a.level - b.level;
      return (declOrder.get(a.id) ?? 0) - (declOrder.get(b.id) ?? 0);
    })
    .map((m) => m.id);
}
