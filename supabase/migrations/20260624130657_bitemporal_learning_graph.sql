-- Lịch sử học tập Bitemporal (Đồ thị hai thời gian)
-- Lưu lại các trạng thái và thay đổi hồi tố của học viên

CREATE TYPE edge_type_enum AS ENUM ('COMPLETED', 'STRUGGLED', 'MISAPPLIED');

CREATE TABLE temporal_knowledge_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    concept_id TEXT,
    edge_type edge_type_enum NOT NULL,
    
    -- Valid Time (thời điểm sự kiện thực sự xảy ra trong thực tế)
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ, -- NULL nghĩa là sự kiện này vẫn đang có hiệu lực đến hiện tại
    
    -- Transaction Time (thời điểm hệ thống ghi nhận sự kiện)
    system_recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    superseded_at TIMESTAMPTZ -- NULL nghĩa là record này là bản ghi mới nhất chưa bị ghi đè (hồi tố)
);

-- Indexes tối ưu cho các câu query bitemporal
CREATE INDEX idx_temporal_knowledge_edges_student ON temporal_knowledge_edges(student_id);
CREATE INDEX idx_temporal_knowledge_edges_valid_time ON temporal_knowledge_edges(valid_from, valid_to);
CREATE INDEX idx_temporal_knowledge_edges_transaction_time ON temporal_knowledge_edges(system_recorded_at, superseded_at);

-- RLS Policies
ALTER TABLE temporal_knowledge_edges ENABLE ROW LEVEL SECURITY;

-- Nhân viên chỉ được xem data của chính mình
CREATE POLICY "Employees can view own temporal edges" 
    ON temporal_knowledge_edges 
    FOR SELECT 
    USING (auth.uid() = student_id);

-- Managers / Admin xem được data toàn tổ chức (nếu cần thiết, tuỳ thuộc vào implementation của hệ thống role - đang sử dụng get_my_organization_id() hay roles table). 
-- Tạm thời giả định có bảng users/roles hoặc jwt có chứa org_id để phân quyền. Theo specs BE-08, có thể dùng get_my_organization_id() hoặc similar.
-- Tôi sẽ cho phép SELECT dựa trên org/role như các bảng khác.
-- Tuy nhiên, RLS policy của platform này thuờng cho phép manager (role_id = manager/platform_admin) select. Giả định function is_manager() hoặc tương tự.
-- Vì tính chất bảo mật, tạm thời grant SELECT cho user và manager qua service_role (backend FastAPI sẽ dùng service_role bypass RLS, frontend query qua Supabase client sẽ dùng user auth).

-- Hàm nội suy (interpolate) đồ thị tại một thời điểm
CREATE OR REPLACE FUNCTION get_student_trajectory_at(p_student_id UUID, p_target_time TIMESTAMPTZ)
RETURNS TABLE (
    id UUID,
    module_id TEXT,
    concept_id TEXT,
    edge_type edge_type_enum,
    valid_from TIMESTAMPTZ,
    system_recorded_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.id, 
        e.module_id, 
        e.concept_id, 
        e.edge_type, 
        e.valid_from, 
        e.system_recorded_at
    FROM 
        temporal_knowledge_edges e
    WHERE 
        e.student_id = p_student_id
        -- Điều kiện Valid Time: sự kiện đã xảy ra và (chưa kết thúc HOẶC kết thúc sau thời điểm đích)
        AND e.valid_from <= p_target_time
        AND (e.valid_to IS NULL OR e.valid_to > p_target_time)
        -- Điều kiện Transaction Time: sự kiện đã được hệ thống ghi nhận và không bị ghi đè trước thời điểm đích
        AND e.system_recorded_at <= p_target_time
        AND (e.superseded_at IS NULL OR e.superseded_at > p_target_time);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
