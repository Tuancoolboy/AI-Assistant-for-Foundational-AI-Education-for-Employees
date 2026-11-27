"use client";

import React, { useMemo, useState, useEffect } from "react";
import { BitemporalTrajectoryView } from "@/components/bitemporal-trajectory-view";
import type { PlatformAdminUserRow } from "@/lib/platform-admin-types";
import type { BitemporalData } from "@/lib/bitemporal-logic";
import { 
  PanelCard, 
  InsightAlert,
  StatusDot,
  formatDate,
} from "@/components/platform-admin/platform-admin-console-ui";
import { 
  Database, 
  Brain, 
  AlertTriangle, 
  UserCheck, 
  Activity, 
  BookOpen,
  Search,
  Filter,
  ArrowUpDown,
  Building,
  User,
  Users,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2
} from "lucide-react";


export function BitemporalAdminTab({ users }: { users: PlatformAdminUserRow[] }) {
  const [loadingAll, setLoadingAll] = useState(users.length > 0);
  const [allUserData, setAllUserData] = useState<Record<string, BitemporalData>>({});
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  
  // States cho bộ lọc và sắp xếp
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortBy, setSortBy] = useState("lastActivity"); // lastActivity | name | struggles
  
  // State ẩn/hiện hộp giải thích Bitemporal
  const [isGuideCollapsed, setIsGuideCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("bitemporal_guide_collapsed") === "true";
    }
    return false;
  });

  const toggleGuide = () => {
    const nextState = !isGuideCollapsed;
    setIsGuideCollapsed(nextState);
    if (typeof window !== "undefined") {
      localStorage.setItem("bitemporal_guide_collapsed", String(nextState));
    }
  };

  // Background fetch song song dữ liệu quỹ đạo của tất cả các học viên
  useEffect(() => {
    if (users.length === 0) {
      return;
    }

    let isMounted = true;
    
    async function fetchAllTrajectories() {
      setLoadingAll(true);
      const dataMap: Record<string, BitemporalData> = {};
      
      const fetchPromises = users.map(async (user) => {
        try {
          const res = await fetch(`/api/van-hanh/trajectory?studentId=${user.id}`);
          if (!res.ok) return;
          const json = await res.json();
          if (json.ok) {
            dataMap[user.id] = json;
          }
        } catch (err) {
          console.error(`Lỗi tải quỹ đạo của học viên ${user.id}:`, err);
        }
      });
      
      await Promise.all(fetchPromises);
      
      if (isMounted) {
        setAllUserData(dataMap);
        setLoadingAll(false);
      }
    }

    fetchAllTrajectories();
    
    return () => {
      isMounted = false;
    };
  }, [users]);

  // Danh sách tổ chức doanh nghiệp duy nhất phục vụ cho bộ lọc
  const uniqueOrgs = useMemo(() => {
    const orgs = new Set<string>();
    users.forEach((u) => {
      if (u.organizationName) {
        orgs.add(u.organizationName);
      }
    });
    return Array.from(orgs).sort();
  }, [users]);

  // Phân tích thống kê gộp (KPIs & Insights)
  const analytics = useMemo(() => {
    let totalEdges = 0;
    let usersWithMemory = 0;
    let usersStruggling = 0;
    
    const skillStruggleCounts: Record<string, number> = {};
    const userStates: Record<string, { status: "success" | "warning" | "default"; edgeCount: number; struggleCount: number; lastUpdated?: string; strugglingSkills: string[] }> = {};
    
    // Thống kê doanh nghiệp: { orgName: { total, active, struggling } }
    const orgStats: Record<string, { total: number; active: number; struggling: number }> = {};
    
    // Thống kê vai trò: { role: { total, active, struggling } }
    const roleStats: Record<string, { total: number; active: number; struggling: number }> = {
      employee: { total: 0, active: 0, struggling: 0 },
      manager: { total: 0, active: 0, struggling: 0 },
      owner: { total: 0, active: 0, struggling: 0 },
      other: { total: 0, active: 0, struggling: 0 }
    };

    for (const user of users) {
      // Đăng ký thống kê tổ chức
      const orgName = user.organizationName || "Cá nhân/Khác";
      if (!orgStats[orgName]) {
        orgStats[orgName] = { total: 0, active: 0, struggling: 0 };
      }
      orgStats[orgName].total++;

      // Đăng ký thống kê vai trò
      const userRole = user.memberRole || "other";
      if (roleStats[userRole]) {
        roleStats[userRole].total++;
      } else {
        roleStats.other.total++;
      }

      const uData = allUserData[user.id];
      if (!uData || uData.edges.length === 0) {
        userStates[user.id] = { status: "default", edgeCount: 0, struggleCount: 0, strugglingSkills: [] };
        continue;
      }

      usersWithMemory++;
      orgStats[orgName].active++;
      if (roleStats[userRole]) {
        roleStats[userRole].active++;
      } else {
        roleStats.other.active++;
      }
      
      const struggles = uData.edges.filter(e => e.edge_type === "STRUGGLED");
      const hasStruggled = struggles.length > 0;
      const strugglingSkills = Array.from(new Set(struggles.map(e => e.module_id)));
      
      totalEdges += uData.edges.length;
      
      if (hasStruggled) {
        usersStruggling++;
        orgStats[orgName].struggling++;
        if (roleStats[userRole]) {
          roleStats[userRole].struggling++;
        } else {
          roleStats.other.struggling++;
        }
        
        userStates[user.id] = { 
          status: "warning", 
          edgeCount: uData.edges.length,
          struggleCount: struggles.length,
          strugglingSkills
        };
      } else {
        userStates[user.id] = { 
          status: "success", 
          edgeCount: uData.edges.length,
          struggleCount: 0,
          strugglingSkills: []
        };
      }

      // Lấy thời điểm hoạt động gần nhất trong bộ nhớ học tập
      const timestamps = uData.edges.map(e => new Date(e.valid_from).getTime());
      if (timestamps.length > 0) {
        userStates[user.id].lastUpdated = new Date(Math.max(...timestamps)).toISOString();
      }
      
      // Đếm số lượt lỗi từng kỹ năng
      for (const edge of uData.edges) {
        if (edge.edge_type === "STRUGGLED") {
          skillStruggleCounts[edge.module_id] = (skillStruggleCounts[edge.module_id] || 0) + 1;
        }
      }
    }

    // Lọc và sắp xếp top kỹ năng lỗi
    const topStrugglingSkills = Object.entries(skillStruggleCounts)
      .map(([moduleId, count]) => ({ moduleId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalEdges,
      usersWithMemory,
      usersStruggling,
      userStates,
      topStrugglingSkills,
      orgStats,
      roleStats,
      hasData: Object.keys(allUserData).length > 0
    };
  }, [users, allUserData]);

  // Bộ lọc và sắp xếp danh sách học viên hiển thị
  const filteredAndSortedUsers = useMemo(() => {
    return users
      .filter((user) => {
        // 1. Lọc theo thanh tìm kiếm (Tên/Email)
        const nameMatch = (user.fullName || "").toLowerCase().includes(searchQuery.toLowerCase());
        const emailMatch = (user.email || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSearch = nameMatch || emailMatch;

        // 2. Lọc theo Doanh nghiệp
        const matchesOrg = orgFilter === "all" || user.organizationName === orgFilter;

        // 3. Lọc theo vai trò (Role)
        const matchesRole = roleFilter === "all" || user.memberRole === roleFilter;

        // 4. Lọc theo trạng thái học tập
        const userState = analytics.userStates[user.id] || { status: "default" };
        let matchesStatus = true;
        if (statusFilter === "struggling") {
          matchesStatus = userState.status === "warning";
        } else if (statusFilter === "healthy") {
          matchesStatus = userState.status === "success";
        } else if (statusFilter === "inactive") {
          matchesStatus = userState.status === "default";
        }

        return matchesSearch && matchesOrg && matchesRole && matchesStatus;
      })
      .sort((a, b) => {
        const stateA = analytics.userStates[a.id] || { edgeCount: 0, struggleCount: 0, lastUpdated: "" };
        const stateB = analytics.userStates[b.id] || { edgeCount: 0, struggleCount: 0, lastUpdated: "" };

        if (sortBy === "lastActivity") {
          const timeA = stateA.lastUpdated ? new Date(stateA.lastUpdated).getTime() : 0;
          const timeB = stateB.lastUpdated ? new Date(stateB.lastUpdated).getTime() : 0;
          const actA = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
          const actB = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
          
          // Ưu tiên thời gian cập nhật bộ nhớ bitemporal trước, sau đó tới hoạt động chung
          const finalA = Math.max(timeA, actA);
          const finalB = Math.max(timeB, actB);
          
          return finalB - finalA; // Giảm dần (mới nhất lên đầu)
        }
        
        if (sortBy === "name") {
          return (a.fullName || "").localeCompare(b.fullName || "", "vi");
        }
        
        if (sortBy === "struggles") {
          return stateB.struggleCount - stateA.struggleCount; // Nhiều lỗi nhất lên đầu
        }

        return 0;
      });
  }, [users, searchQuery, orgFilter, statusFilter, roleFilter, sortBy, analytics.userStates]);

  if (users.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-card px-5 py-8 text-sm text-ink-2">
        Chưa có dữ liệu học viên để hiển thị quỹ đạo học tập.
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6 animate-in fade-in duration-300">
      
      {/* 1. Thanh KPI hàng đầu */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PanelCard variant="flat" className="p-4 flex items-center gap-4 border border-line/60">
          <div className="rounded-xl bg-sky-500/10 p-2.5 text-sky-600">
            <Database className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Tổng liên kết học tập</p>
            <h4 className="text-xl font-extrabold text-ink mt-0.5">
              {loadingAll ? "…" : analytics.totalEdges}
            </h4>
          </div>
        </PanelCard>
        
        <PanelCard variant="flat" className="p-4 flex items-center gap-4 border border-line/60">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
            <Brain className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Học viên có bộ nhớ</p>
            <h4 className="text-xl font-extrabold text-ink mt-0.5">
              {loadingAll ? "…" : `${analytics.usersWithMemory}/${users.length}`}
            </h4>
          </div>
        </PanelCard>

        <PanelCard variant="flat" className="p-4 flex items-center gap-4 border border-line/60">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Học viên gặp khó khăn</p>
            <h4 className="text-xl font-extrabold text-ink mt-0.5">
              {loadingAll ? "…" : analytics.usersStruggling}
            </h4>
          </div>
        </PanelCard>

        <PanelCard variant="flat" className="p-4 flex items-center gap-4 border border-line/60">
          <div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600">
            <UserCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-ink-3 uppercase tracking-wider">Hoàn thành ổn định</p>
            <h4 className="text-xl font-extrabold text-ink mt-0.5">
              {loadingAll ? "…" : `${analytics.usersWithMemory - analytics.usersStruggling}`}
            </h4>
          </div>
        </PanelCard>
      </div>

      {/* 2. Thanh lọc và tìm kiếm chuyên nghiệp */}
      <PanelCard className="p-4 bg-card/65 backdrop-blur-sm border-line/70">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-ink-3 border-b border-line pb-2">
            <Filter className="h-3.5 w-3.5 text-brand" />
            BỘ LỌC VÀ TÌM KIẾM HỌC VIÊN
          </div>
          
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-5 items-end">
            
            {/* Tìm kiếm */}
            <div className="space-y-1.5 md:col-span-1.5">
              <label className="text-[10px] font-bold text-ink-3 uppercase">Tìm kiếm học viên</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tên hoặc email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 w-full text-xs rounded-lg border border-line bg-card focus:outline-none focus:border-brand transition"
                />
              </div>
            </div>

            {/* Lọc doanh nghiệp */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-3 uppercase">Doanh nghiệp</label>
              <select
                value={orgFilter}
                onChange={(e) => setOrgFilter(e.target.value)}
                className="px-3 py-2 w-full text-xs rounded-lg border border-line bg-card focus:outline-none focus:border-brand transition"
              >
                <option value="all">Tất cả doanh nghiệp</option>
                {uniqueOrgs.map((org) => (
                  <option key={org} value={org}>{org}</option>
                ))}
              </select>
            </div>

            {/* Lọc Trạng thái */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-3 uppercase">Trạng thái học tập</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 w-full text-xs rounded-lg border border-line bg-card focus:outline-none focus:border-brand transition"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="struggling">⚠️ Gặp khó khăn (Struggled)</option>
                <option value="healthy">✅ Hoạt động tốt</option>
                <option value="inactive">⚪ Chưa có dữ liệu</option>
              </select>
            </div>

            {/* Lọc vai trò */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-3 uppercase">Vai trò người dùng</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-3 py-2 w-full text-xs rounded-lg border border-line bg-card focus:outline-none focus:border-brand transition"
              >
                <option value="all">Tất cả vai trò</option>
                <option value="employee">Học viên (Employee)</option>
                <option value="manager">Quản lý (Manager)</option>
                <option value="owner">Chủ sở hữu (Owner)</option>
              </select>
            </div>

            {/* Sắp xếp */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-ink-3 uppercase flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> Sắp xếp theo
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 w-full text-xs rounded-lg border border-line bg-card focus:outline-none focus:border-brand font-semibold text-brand transition"
              >
                <option value="lastActivity">Hoạt động gần nhất</option>
                <option value="name">Tên học viên (A-Z)</option>
                <option value="struggles">Số lượt lỗi (Nhiều nhất)</option>
              </select>
            </div>

          </div>
        </div>
      </PanelCard>

      {/* 3. Khu vực chính: Grid 2 cột */}
      <div className="grid gap-6 xl:grid-cols-[3fr_1.2fr]">
        
        {/* CỘT TRÁI: Bảng danh sách học viên */}
        <div className="space-y-6">
          <PanelCard className="p-6">
            <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
              <div>
                <h3 className="font-display text-base font-bold text-ink flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand" />
                  Quản lý Quỹ đạo Bộ nhớ Học viên
                </h3>
                <p className="text-xs text-ink-2 mt-0.5">
                  Hiển thị <span className="font-bold text-ink">{filteredAndSortedUsers.length}</span> học viên phù hợp. Nhấp vào hàng để xem quỹ đạo nhớ bitemporal chi tiết.
                </p>
              </div>
              {loadingAll && (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-brand bg-brand-soft/20 px-2.5 py-1 rounded-lg border border-brand/10">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand animate-ping" />
                  Đang phân tích bộ nhớ…
                </div>
              )}
            </div>

            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="min-w-full divide-y divide-line text-left text-xs">
                <thead className="bg-secondary/20 text-ink-2 font-bold select-none">
                  <tr>
                    <th scope="col" className="px-4 py-3">Học viên</th>
                    <th scope="col" className="px-4 py-3">Doanh nghiệp</th>
                    <th scope="col" className="px-4 py-3">Vai trò</th>
                    <th scope="col" className="px-4 py-3 text-center">Trạng thái</th>
                    <th scope="col" className="px-4 py-3">Kỹ năng gặp khó</th>
                    <th scope="col" className="px-4 py-3">Hoạt động cuối</th>
                    <th scope="col" className="px-4 py-3 text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-card">
                  {filteredAndSortedUsers.map((user) => {
                    const isExpanded = expandedStudentId === user.id;
                    const state = analytics.userStates[user.id] || { status: "default", edgeCount: 0, struggleCount: 0, strugglingSkills: [] };
                    
                    const initials = (user.fullName || user.email || "?")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    const statusStyles = {
                      default: "text-ink-3",
                      success: "text-emerald-600 dark:text-emerald-400 font-semibold",
                      warning: "text-amber-600 dark:text-amber-400 font-bold"
                    };

                    const statusLabels = {
                      default: "Chưa hoạt động",
                      success: "Hoạt động tốt",
                      warning: "Gặp khó khăn"
                    };

                    const roleLabels = user.memberRole
                      ? {
                          employee: "Học viên",
                          manager: "Quản lý",
                          owner: "Chủ sở hữu",
                        }[user.memberRole]
                      : "---";


                    return (
                      <React.Fragment key={user.id}>
                        {/* Hàng học viên chính */}
                        <tr 
                          onClick={() => setExpandedStudentId(isExpanded ? null : user.id)}
                          className={`hover:bg-secondary/5 transition cursor-pointer select-none ${
                            isExpanded ? "bg-brand-soft/10 font-medium" : ""
                          }`}
                        >
                          {/* Học viên */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/40 font-bold text-ink-2 text-[10px]">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-ink block truncate max-w-[140px]" title={user.fullName || "Ẩn danh"}>
                                  {user.fullName || "Ẩn danh"}
                                </span>
                                <span className="text-[10px] text-ink-3 block truncate max-w-[140px]" title={user.email}>
                                  {user.email}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Doanh nghiệp */}
                          <td className="px-4 py-3.5 text-ink-2 truncate max-w-[120px]" title={user.organizationName || "Cá nhân"}>
                            {user.organizationName || <span className="text-ink-3 italic">Cá nhân</span>}
                          </td>

                          {/* Vai trò */}
                          <td className="px-4 py-3.5 text-ink-2">
                            {roleLabels}
                          </td>

                          {/* Trạng thái */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <StatusDot status={state.status === "default" ? "info" : state.status} className="h-1.5 w-1.5" />
                              <span className={`text-[10px] ${statusStyles[state.status]}`}>
                                {statusLabels[state.status]}
                              </span>
                            </div>
                          </td>

                          {/* Kỹ năng gặp khó */}
                          <td className="px-4 py-3.5">
                            {state.strugglingSkills.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-[160px]">
                                {state.strugglingSkills.slice(0, 2).map((skill, index) => (
                                  <span key={index} className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/20 text-[9px] font-mono font-bold">
                                    {skill}
                                  </span>
                                ))}
                                {state.strugglingSkills.length > 2 && (
                                  <span className="px-1 py-0.5 rounded bg-secondary text-ink-2 text-[9px] font-bold">
                                    +{state.strugglingSkills.length - 2}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-ink-3 italic text-[10px]">Không có</span>
                            )}
                          </td>

                          {/* Hoạt động cuối */}
                          <td className="px-4 py-3.5 text-ink-2 font-mono text-[10px]">
                            {state.lastUpdated ? formatDate(state.lastUpdated) : formatDate(user.lastActivityAt)}
                          </td>

                          {/* Chi tiết */}
                          <td className="px-4 py-3.5 text-center">
                            <button className="text-brand hover:text-brand-hover p-1 rounded-lg hover:bg-brand-soft/20 transition">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>

                        {/* Hàng expanded chứa Bitemporal trajectory chi tiết */}
                        {isExpanded && (
                          <tr className="bg-secondary/5 border-l-2 border-brand">
                            <td colSpan={7} className="px-6 py-4">
                              <BitemporalTrajectoryView studentId={user.id} inline={true} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {filteredAndSortedUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-ink-3 italic">
                        Không tìm thấy học viên nào phù hợp với bộ lọc đã chọn.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </PanelCard>
        </div>

        {/* CỘT PHẢI: Bảng Nhận định từ bộ nhớ (Insight Panel) */}
        <div className="space-y-6">
          
          {/* Card giải thích Bitemporal (Collapsible) */}
          <PanelCard variant="glass" className="p-4 border border-sky-500/20 bg-sky-500/5">
            <button 
              onClick={toggleGuide}
              className="flex items-center justify-between w-full font-display text-sm font-bold text-ink-2 hover:text-ink transition"
            >
              <span className="flex items-center gap-1.5">
                <Info className="h-4 w-4 text-sky-500" />
                Giải thích: Dòng thời gian Bitemporal
              </span>
              {isGuideCollapsed ? <ChevronDown className="h-4 w-4 text-ink-3" /> : <ChevronUp className="h-4 w-4 text-ink-3" />}
            </button>
            
            {!isGuideCollapsed && (
              <div className="mt-3 text-[11px] text-ink-2 space-y-2 leading-relaxed border-t border-sky-500/10 pt-2.5 animate-in slide-in-from-top-1 duration-200">
                <p>
                  Bộ nhớ AI trong hệ thống được cấu trúc dựa trên nguyên lý **Bitemporal (Hai chiều thời gian)** để đảm bảo tính minh bạch tối đa:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong className="text-ink">Thời gian thực tế (Valid Time):</strong> Ghi lại thời điểm học viên thực sự thao tác và phạm lỗi trên UI (Là quá trình tiến hóa kiến thức thực).
                  </li>
                  <li>
                    <strong className="text-ink">Thời gian hệ thống ghi (System Time):</strong> Ghi lại lúc AI của hệ thống phân tích và viết nhận định Reasoning Trace vào DB.
                  </li>
                </ul>
                <p className="text-[10px] text-ink-3 italic">
                  💡 Giúp quản trị viên quay ngược lịch sử để biết chính xác học viên bị hổng kiến thức tại thời gian nào trong quá khứ, loại bỏ hoàn toàn độ trễ xử lý của AI.
                </p>
              </div>
            )}
          </PanelCard>

          {/* Card AI Insights chính */}
          <PanelCard variant="glass" className="p-5">
            <h3 className="font-display text-base font-bold text-ink flex items-center gap-2 mb-4 border-b border-line pb-3">
              <Activity className="h-4 w-4 text-brand" aria-hidden="true" />
              Nhận định từ Bộ nhớ (AI Insights)
            </h3>

            <div className="space-y-5">
              {loadingAll ? (
                <div className="text-xs text-ink-3 italic py-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-brand" />
                  Đang phân tích các chỉ số...
                </div>
              ) : (
                <>
                  {analytics.usersStruggling > 0 ? (
                    <InsightAlert 
                      severity="warning"
                      title="Phát hiện học tập gặp sự cố"
                      message={`Có ${analytics.usersStruggling} học viên ghi nhận trạng thái 'STRUGGLED' trong bộ nhớ. Hãy nhấp vào học viên đó để kiểm tra Reasoning Trace lý do cụ thể.`}
                    />
                  ) : (
                    <InsightAlert 
                      severity="success"
                      title="Tiến trình hoàn hảo"
                      message="Không ghi nhận học viên nào gặp khó khăn học tập nghiêm trọng trên hệ thống."
                    />
                  )}
                  
                  {users.length - analytics.usersWithMemory > 0 && (
                    <InsightAlert 
                      severity="info"
                      title="Chưa kích hoạt bộ nhớ"
                      message={`Có ${users.length - analytics.usersWithMemory} học viên chưa phát sinh dữ liệu bộ nhớ học tập (chưa bắt đầu học bài đầu tiên).`}
                    />
                  )}

                  {/* Top Kỹ năng lỗi nhiều nhất */}
                  <div className="rounded-xl border border-line bg-secondary/10 p-3.5 space-y-3">
                    <span className="font-bold text-ink text-xs flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-brand" />
                      Kỹ năng gặp lỗi nhiều nhất
                    </span>
                    
                    {analytics.topStrugglingSkills.length > 0 ? (
                      <div className="space-y-2">
                        {analytics.topStrugglingSkills.slice(0, 4).map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-ink-2 font-mono font-medium">{item.moduleId}</span>
                            <span className="font-bold text-rose-600 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[10px]">
                              {item.count} lượt lỗi
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-ink-3 italic">Chưa ghi nhận kỹ năng lỗi nào.</p>
                    )}
                  </div>

                  {/* Breakdown theo Doanh nghiệp */}
                  <div className="rounded-xl border border-line bg-secondary/10 p-3.5 space-y-3">
                    <span className="font-bold text-ink text-xs flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-sky-600" />
                      Khó khăn theo doanh nghiệp
                    </span>
                    <div className="space-y-2.5">
                      {Object.entries(analytics.orgStats)
                        .map(([orgName, stats]) => ({
                          orgName,
                          ...stats,
                          struggleRate: stats.active > 0 ? (stats.struggling / stats.active) * 100 : 0
                        }))
                        .sort((a, b) => b.struggleRate - a.struggleRate || b.struggling - a.struggling)
                        .slice(0, 4)
                        .map((org, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-ink-2 truncate max-w-[130px]" title={org.orgName}>{org.orgName}</span>
                              <span className="text-ink font-mono">{org.struggling}/{org.active} học viên ({Math.round(org.struggleRate)}%)</span>
                            </div>
                            <div className="h-1.5 w-full bg-line rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  org.struggleRate > 50 ? "bg-rose-500" : org.struggleRate > 25 ? "bg-amber-500" : "bg-emerald-500"
                                }`} 
                                style={{ width: `${Math.min(org.struggleRate, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Breakdown theo vai trò */}
                  <div className="rounded-xl border border-line bg-secondary/10 p-3.5 space-y-3">
                    <span className="font-bold text-ink text-xs flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-emerald-600" />
                      Phân tích theo nhóm vai trò
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {Object.entries(analytics.roleStats)
                        .filter(([role]) => role !== "other" && role !== "owner") // Tập trung vào Employee và Manager
                        .map(([role, stats]) => {
                          const label = role === "employee" ? "Học viên (Employee)" : "Quản lý (Manager)";
                          const rate = stats.active > 0 ? (stats.struggling / stats.active) * 100 : 0;
                          return (
                            <div key={role} className="border border-line bg-card rounded-lg p-2.5 text-center space-y-1 shadow-sm">
                              <span className="text-[10px] text-ink-3 block font-bold uppercase">{label}</span>
                              <span className="text-sm font-extrabold block text-ink">
                                {stats.struggling}/{stats.active}
                              </span>
                              <span className={`text-[10px] font-bold inline-block px-1.5 py-0.5 rounded ${
                                rate > 40 ? "bg-rose-500/10 text-rose-600" : rate > 15 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"
                              }`}>
                                {Math.round(rate)}% gặp lỗi
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                </>
              )}
            </div>
          </PanelCard>
        </div>

      </div>
    </div>
  );
}
