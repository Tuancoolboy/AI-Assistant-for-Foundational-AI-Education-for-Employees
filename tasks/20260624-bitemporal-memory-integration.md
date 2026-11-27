# Task: Tích hợp API Bitemporal Memory
**Ngày hoàn thành**: 24/06/2026

## Mục tiêu
Tạo luồng kết nối API và UI từ Frontend (Next.js) xuống Database (Supabase) để phục vụ cho giao diện **Bitemporal Graph Memory** (Tính năng tua ngược thời gian quá trình học của sinh viên). Clone kiến trúc tương ứng sang Backend FastAPI (Python).

**Trạng thái**: VERIFIED (Đã được verify thông qua script kiểm chứng đồng bộ logic TS/Python).

```
Starting Bitemporal Logic Parity Check...
Testing slider=0...
Testing slider=50...
Testing slider=100...
SUCCESS: Parity check passed!
```

## Các thay đổi chính

### 1. Next.js API (Lớp thực thi chính)
- **Tạo Endpoint**: `src/frontend/app/api/van-hanh/trajectory/route.ts`
  - Nhận query param `studentId` và `targetTime`.
  - Nếu có `targetTime`, dùng `Supabase Service Client` gọi RPC `get_student_trajectory_at` (bypass RLS do UI đang ở góc độ Manager/Admin) để nhận lại state theo thời gian thực tế.
  - Nếu không có `targetTime`, lấy toàn bộ history để client UI tự nội suy khoảng thời gian (`minTime`, `maxTime`).
  - Xử lý mượt mà các mã lỗi (400, 403, 500).

### 2. Frontend React Component
- Cập nhật UI Component `src/frontend/components/bitemporal-trajectory-view.tsx`:
  - Fetch dữ liệu toàn phần lần đầu tiên (Initial Load).
  - Sử dụng React hook (`useEffect` + `useMemo` kết hợp `setTimeout` debounce) để tối ưu luồng gọi fetch mỗi khi trượt slider. 
  - Khử các hàm gọi `Date.now()` trong quá trình render nhằm thỏa mãn rule `react-hooks/purity` của ESLint.

### 3. Backend Python (Lớp clone dự phòng)
- **FastAPI Route**: Cập nhật `src/backend/api/manager_routes.py`
  - Bổ sung `GET /api/manager/trajectory/{student_id}`
  - Tích hợp với hàm `gateway.rpc` và `gateway.select` của SupabaseGateway.
- **Agent State**: Bổ sung hai custom TypedDict vào `src/backend/agents/learning_path/state.py` để định danh cấu trúc rõ ràng:
  - `GraphTrajectoryEdge`
  - `GraphReasoningTrace`

### 4. Kiểm thử
- **Vitest**: Viết test cho endpoint Next.js trong file `src/frontend/app/api/van-hanh/trajectory/route.test.ts`. 
- **Pytest**: Bổ sung async mock cho các nhánh logic của FastAPI route bên trong file `src/backend/tests/test_api/test_manager_routes.py`.
- Lệnh `npm run lint` pass hoàn toàn sau khi xử lý các side effect của React.

## Open Issues / Bước tiếp theo
- Dữ liệu `reasoning_traces` hiện tại mới chỉ được định nghĩa cấu trúc nhưng chưa có quy trình lưu trữ (persistence) vào bảng trong Supabase. Hiện API đang trả về kết quả rỗng `[]` làm mặc định để UI không bị crash. Cần cân nhắc việc cập nhật table cho Reasoning Traces ở phiên bản sau.
