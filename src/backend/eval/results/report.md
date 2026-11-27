# Evaluation Report

> Báo cáo đánh giá chất lượng sản phẩm theo tiêu chí BTC.

---

## 1. Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Response accuracy | >80% | — | ⏳ |
| Response latency | <3s | — | ⏳ |
| User satisfaction | >4/5 | — | ⏳ |
| Test coverage | >60% | — | ⏳ |

## 2. Test Results

### Unit Tests
```
pytest tests/ -v
# Paste output here
```

### Integration Tests
```
# Mô tả test scenarios và kết quả
```

## 3. User Feedback

| User | Feedback | Rating |
|------|----------|--------|
| [User 1] | [feedback] | [1-5] |
| [User 2] | [feedback] | [1-5] |

## 4. Demo Results

- Ngày demo: [YYYY-MM-DD]
- Người tham gia: [số người]
- Feedback chung: [tóm tắt]
- Issues phát hiện: [danh sách]

## 5. Action Items

- [ ] [Cần cải thiện 1]
- [ ] [Cần cải thiện 2]

## RAGAS & Agent Evaluation Results (Cập nhật lúc 2026-06-26 11:33:52)

| Target Agent | Metric | Score | Status | Min Threshold |
|---|---|---|---|---|
| **Chat Agent** | Faithfulness (Độ trung thực) | 0.84 | ✅ Pass | 0.75 |
| | Answer Relevancy (Độ phù hợp câu trả lời) | 0.81 | ✅ Pass | 0.70 |
| | Context Precision (Độ chính xác ngữ cảnh) | 0.79 | - | - |
| | Context Recall (Độ đầy đủ ngữ cảnh) | 0.82 | - | - |
| **Learning Path** | Path Coverage (Độ bao phủ lộ trình) | 0.75 | ✅ Pass | 0.60 |
| | Path Relevancy (Độ phù hợp lộ trình) | 0.80 | - | - |
| **Grading Agent** | Grading Consistency (Sự nhất quán điểm) | 0.95 | ✅ Pass | 0.80 |
| | Feedback Faithfulness (Độ chính xác nhận xét) | 0.85 | - | - |

*Báo cáo được chạy tự động thông qua RAGAS harness framework.*