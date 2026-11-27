// Luồng opt-in cũ đã ngừng — trả 410 Gone cho cả GET và POST.
// Dùng /api/member/skill-groups + /api/member/roadmap thay thế.
// (Xem git history cho code cũ trước khi retire.)

import { NextResponse } from "next/server";

const GONE_BODY = {
  error: {
    code: "GONE",
    message:
      "Luồng chọn lộ trình cũ đã ngừng. Dùng /api/member/skill-groups.",
  },
};

export async function GET() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE_BODY, { status: 410 });
}
