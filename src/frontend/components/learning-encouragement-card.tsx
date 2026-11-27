// Thẻ "Lời nhắn động viên" hiển thị trên /lo-trinh, thay cho block lộ trình AI
// gợi ý đã tạm ẩn. Nội dung tĩnh, tích cực — chờ Lucas duyệt lời (xem WORKLOG).

export function LearningEncouragementCard() {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/10 to-brand-soft p-5 sm:p-6">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">
          Lời nhắn cho bạn
        </p>
        <h2 className="mt-1.5 font-display text-xl font-bold text-ink sm:text-2xl">
          Mỗi bài học hôm nay là một giờ tiết kiệm ngày mai
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2">
          Đừng cố học hết trong một ngày — chỉ cần mỗi ngày tiến thêm một bài và
          mang ngay vào công việc thật của bạn. AI không thay thế bạn, nó giúp bạn
          làm nhanh hơn và nhẹ đầu hơn. Cứ bắt đầu từ việc nhỏ nhất, bạn sẽ bất ngờ
          với chính mình. 💪
        </p>
      </div>
    </section>
  );
}
