#!/usr/bin/env node
/**
 * Seed realistic sample company data for Supabase real mode.
 *
 * Usage:
 *   node scripts/seed-sample-company-data.mjs                      # dry-run (không ghi dữ liệu)
 *   ALLOW_DESTRUCTIVE_SEED=1 node scripts/seed-sample-company-data.mjs --apply
 *
 * The script intentionally avoids demo/test emails and removes legacy local
 * demo/test accounts before inserting the sample organization.
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const apply = process.argv.includes("--apply");
const allowDestructiveSeed = process.env.ALLOW_DESTRUCTIVE_SEED === "1";
const isDestructiveMode = apply && allowDestructiveSeed;
const now = new Date();
const DAY = 24 * 60 * 60 * 1000;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile("src/frontend/.env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SAMPLE_ORG = {
  name: "Cong ty TNHH Moc An",
  slug: "moc-an",
  settings_json: {
    industry: "retail",
    size: "50-100",
    city: "Ho Chi Minh City",
    learningGoal: "Ung dung AI vao ban hang, marketing, van hanh va nhan su",
  },
};

const SAMPLE_USERS = [
  {
    email: "mai.anh@mocan.vn",
    fullName: "Nguyen Mai Anh",
    phone: "0901000001",
    roleId: "nhan-su",
    departmentId: "van-hanh",
    memberRole: "owner",
    aiLevel: 4,
    dailyTasks: ["recruit", "policy", "report"],
    quizScores: [92, 88],
    hours: [2.5, 1.5, 3],
    completed: 7,
  },
  {
    email: "bao.tran@mocan.vn",
    fullName: "Tran Quoc Bao",
    phone: "0901000002",
    roleId: "kinh-doanh",
    departmentId: "kinh-doanh",
    memberRole: "manager",
    aiLevel: 3,
    dailyTasks: ["sales-email", "customer-follow-up", "crm-note"],
    quizScores: [84, 90],
    hours: [1, 2, 2.5],
    completed: 6,
  },
  {
    email: "ha.pham@mocan.vn",
    fullName: "Pham Thu Ha",
    phone: "0901000003",
    roleId: "ke-toan",
    departmentId: "ke-toan",
    memberRole: "employee",
    aiLevel: 2,
    dailyTasks: ["invoice", "monthly-report", "reconcile"],
    quizScores: [78, 86],
    hours: [1.5, 1, 2],
    completed: 5,
  },
  {
    email: "linh.dang@mocan.vn",
    fullName: "Dang Khanh Linh",
    phone: "0901000004",
    roleId: "marketing",
    departmentId: "marketing",
    memberRole: "employee",
    aiLevel: 3,
    dailyTasks: ["content-plan", "ad-brief", "campaign-report"],
    quizScores: [81, 89],
    hours: [2, 1.5, 2.5],
    completed: 6,
  },
  {
    email: "nam.vu@mocan.vn",
    fullName: "Vu Hai Nam",
    phone: "0901000005",
    roleId: "van-hanh",
    departmentId: "van-hanh",
    memberRole: "employee",
    aiLevel: 2,
    dailyTasks: ["schedule", "inventory-note", "handover"],
    quizScores: [74, 82],
    hours: [1, 1.5],
    completed: 4,
  },
  {
    email: "phuong.le@mocan.vn",
    fullName: "Le Hoai Phuong",
    phone: "0901000006",
    roleId: "khac",
    departmentId: "khac",
    memberRole: "employee",
    aiLevel: 1,
    dailyTasks: ["email", "meeting-summary", "task-list"],
    quizScores: [70, 76],
    hours: [0.5, 1],
    completed: 3,
  },
];

const LEGACY_SAMPLE_EMAILS = new Set(["demo@mocan.vn", "test.optout@aitroly.test"]);

function isoDaysAgo(days, hourOffset = 0) {
  return new Date(now.getTime() - days * DAY + hourOffset * 60 * 60 * 1000).toISOString();
}

function samplePassword() {
  return process.env.SAMPLE_USER_PASSWORD || `MocAn-${randomBytes(8).toString("hex")}!`;
}

async function listAllAuthUsers() {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error(error.message);
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < 100) break;
  }
  return users;
}

async function cleanupLegacyData() {
  const users = await listAllAuthUsers();
  const legacyUsers = users.filter((user) => {
    const email = user.email?.toLowerCase() ?? "";
    return email.endsWith("@test.local") || LEGACY_SAMPLE_EMAILS.has(email);
  });

  if (!legacyUsers.length) {
    console.log("[cleanup] Không có user legacy/demo/test nào để dọn." );
    return;
  }

  console.log(`[dry-run] Sẽ xử lý ${legacyUsers.length} legacy/demo auth user(s):`);
  for (const user of legacyUsers) {
    console.log(`- ${user.id} ${user.email ?? "(no-email)"}`);
  }

  if (!isDestructiveMode) {
    if (apply) {
      console.log(
        "[guard] --apply được truyền nhưng ALLOW_DESTRUCTIVE_SEED không bật. Không có thao tác ghi/xoá nào được thực hiện.",
      );
    } else {
      console.log("[dry-run] Không có --apply, nên chỉ làm kế hoạch dọn legacy." );
    }
    return;
  }

  for (const user of legacyUsers) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) console.warn(`[cleanup] Could not delete ${user.email}: ${error.message}`);
  }

  await supabase.from("profiles").delete().ilike("email", "%@test.local");
  for (const email of LEGACY_SAMPLE_EMAILS) {
    await supabase.from("profiles").delete().eq("email", email);
  }
  console.log(`[cleanup] Removed ${legacyUsers.length} legacy demo/test auth user(s).`);
}

async function ensureUser(person) {
  const existing = (await listAllAuthUsers()).find(
    (user) => user.email?.toLowerCase() === person.email,
  );
  if (!isDestructiveMode) {
    return { id: existing?.id ?? `dry-${person.email}`, email: person.email };
  }
  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: {
        full_name: person.fullName,
        phone_number: person.phone,
        sample_company: SAMPLE_ORG.slug,
      },
    });
    return existing;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: person.email,
    password: samplePassword(),
    email_confirm: true,
    user_metadata: {
      full_name: person.fullName,
      phone_number: person.phone,
      sample_company: SAMPLE_ORG.slug,
    },
  });
  if (error || !data.user) {
    throw new Error(`Could not create ${person.email}: ${error?.message ?? "unknown"}`);
  }
  return data.user;
}

async function ensureOrganization(ownerId) {
  if (!isDestructiveMode) {
    console.log(`[dry-run] Would upsert organization ${SAMPLE_ORG.name}.`);
    return { id: "dry-org" };
  }

  const { data: existing, error: selectError } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", SAMPLE_ORG.slug)
    .maybeSingle();
  if (selectError) throw new Error(selectError.message);

  if (existing?.id) {
    const { data, error } = await supabase
      .from("organizations")
      .update({
        name: SAMPLE_ORG.name,
        status: "active",
        settings_json: SAMPLE_ORG.settings_json,
        created_by: ownerId,
        updated_at: now.toISOString(),
      })
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: SAMPLE_ORG.name,
      slug: SAMPLE_ORG.slug,
      status: "active",
      settings_json: SAMPLE_ORG.settings_json,
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadModules() {
  const { data, error } = await supabase
    .from("learning_modules")
    .select("id, role_id, title, level, sort_order, skill_slug")
    .order("role_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  if (!data?.length) {
    throw new Error("No learning_modules found. Run npm run seed:modules first.");
  }
  return data;
}

async function resetRowsForUsers(userIds) {
  if (!isDestructiveMode || userIds.length === 0) return;
  const tables = [
    "user_roadmap",
    "user_skill_groups",
    "points_ledger",
    "events",
    "time_logs",
    "quiz_results",
    "module_progress",
    "generated_learning_paths",
  ];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().in("user_id", userIds);
    if (error && !["42P01", "42703"].includes(error.code)) {
      console.warn(`[reset] ${table}: ${error.message}`);
    }
  }
}

async function seedProfile(person, userId) {
  const assessment = {
    aiLevel: person.aiLevel,
    displayLevel: person.aiLevel,
    levelLabel: person.aiLevel >= 4 ? "Thanh thao" : person.aiLevel >= 2 ? "Dang ap dung" : "Moi bat dau",
    levelDesc: "Du lieu mau phuc vu dashboard va luong hoc that.",
    dailyTasks: person.dailyTasks,
  };

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: person.email,
      full_name: person.fullName,
      role_id: person.roleId,
      phone_number: person.phone,
      ai_level: person.aiLevel,
      daily_tasks: person.dailyTasks,
      assessment_result: assessment,
      learning_profile: {
        company: SAMPLE_ORG.name,
        roleId: person.roleId,
        focus: person.dailyTasks,
      },
      learning_activated: true,
      learning_activated_at: isoDaysAgo(14),
      updated_at: now.toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(`Profile ${person.email}: ${error.message}`);
}

async function seedMembership(person, userId, orgId, ownerId) {
  const { error } = await supabase.from("organization_members").upsert(
    {
      organization_id: orgId,
      user_id: userId,
      member_role: person.memberRole,
      department_id: person.departmentId,
      invited_email: person.email,
      invited_by: ownerId,
      invited_at: isoDaysAgo(15),
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`Membership ${person.email}: ${error.message}`);
}

async function seedLearningRows(person, userId, orgId, modulesByRole) {
  const modules = modulesByRole.get(person.roleId) ?? modulesByRole.get("khac") ?? [];
  const chosen = modules.slice(0, Math.max(6, Math.min(10, modules.length)));
  const completed = chosen.slice(0, Math.min(person.completed, chosen.length));
  const inProgress = chosen[completed.length];

  if (chosen.length === 0) return;

  const progressRows = [
    ...completed.map((module, index) => ({
      user_id: userId,
      module_id: module.id,
      status: "hoan-thanh",
      completed_at: isoDaysAgo(10 - index),
    })),
    ...(inProgress
      ? [{
          user_id: userId,
          module_id: inProgress.id,
          status: "dang-hoc",
          completed_at: null,
        }]
      : []),
  ];
  if (progressRows.length) {
    const { error } = await supabase
      .from("module_progress")
      .upsert(progressRows, { onConflict: "user_id,module_id" });
    if (error) throw new Error(`Progress ${person.email}: ${error.message}`);
  }

  const quizRows = person.quizScores.map((score, index) => ({
    user_id: userId,
    role_id: person.roleId,
    module_id: chosen[index]?.id ?? null,
    score,
    created_at: isoDaysAgo(8 - index),
  }));
  const { error: quizError } = await supabase.from("quiz_results").insert(quizRows);
  if (quizError) throw new Error(`Quiz ${person.email}: ${quizError.message}`);

  const timeRows = person.hours.map((hours, index) => ({
    user_id: userId,
    hours_saved: hours,
    usefulness: Math.min(10, 7 + index),
    note: [
      "Rut gon email khach hang va checklist viec trong ngay.",
      "Tom tat tai lieu noi bo thanh dau viec uu tien.",
      "Viet ban nhap bao cao ngan cho quan ly.",
    ][index % 3],
    logged_at: isoDaysAgo(7 - index),
  }));
  const { error: timeError } = await supabase.from("time_logs").insert(timeRows);
  if (timeError) throw new Error(`Time logs ${person.email}: ${timeError.message}`);

  const pointRows = completed.map((module, index) => ({
    user_id: userId,
    organization_id: orgId,
    source: "lesson",
    points: 10 + Math.min(index, 3) * 2,
    ref_id: module.id,
    created_at: isoDaysAgo(10 - index, index),
  }));
  const { error: pointsError } = await supabase.from("points_ledger").insert(pointRows);
  if (pointsError) throw new Error(`Points ${person.email}: ${pointsError.message}`);

  const eventRows = chosen.slice(0, 5).map((module, index) => ({
    user_id: userId,
    event_name: index < completed.length ? "lesson_completed" : "lesson_opened",
    properties_json: { moduleId: module.id, roleId: person.roleId, source: "sample-company" },
    created_at: isoDaysAgo(12 - index),
  }));
  const { error: eventsError } = await supabase.from("events").insert(eventRows);
  if (eventsError) throw new Error(`Events ${person.email}: ${eventsError.message}`);

  const skillSlugs = [...new Set(chosen.map((module) => module.skill_slug).filter(Boolean))];
  if (skillSlugs.length) {
    const groupRows = skillSlugs.map((skill_slug) => ({
      user_id: userId,
      skill_slug,
      source: "admin",
      assigned_by: null,
      is_active: true,
    }));
    const { error: groupError } = await supabase
      .from("user_skill_groups")
      .upsert(groupRows, { onConflict: "user_id,skill_slug" });
    if (groupError) throw new Error(`Skill groups ${person.email}: ${groupError.message}`);
  }

  const roadmapRows = chosen
    .filter((module) => module.skill_slug)
    .map((module, index) => ({
      user_id: userId,
      module_id: module.id,
      skill_slug: module.skill_slug,
      is_selected: index < chosen.length - 1,
      source: "admin",
      updated_at: now.toISOString(),
    }));
  if (roadmapRows.length) {
    const { error: roadmapError } = await supabase
      .from("user_roadmap")
      .upsert(roadmapRows, { onConflict: "user_id,module_id" });
    if (roadmapError) throw new Error(`Roadmap ${person.email}: ${roadmapError.message}`);
  }

  const { error: pathError } = await supabase.from("generated_learning_paths").upsert(
    {
      user_id: userId,
      fingerprint: `sample-${SAMPLE_ORG.slug}-${person.roleId}-20260701`,
      flow: "company",
      source: "fallback",
      result: {
        organizationSlug: SAMPLE_ORG.slug,
        roleId: person.roleId,
        orderedModuleIds: chosen.map((module) => module.id),
        missingSkills: [],
      },
      updated_at: now.toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (pathError) throw new Error(`Generated path ${person.email}: ${pathError.message}`);
}

async function main() {
  console.log(`\n=== ${apply ? "APPLY" : "DRY-RUN"} sample company seed ===`);
  await cleanupLegacyData();

  const createdUsers = [];
  for (const person of SAMPLE_USERS) {
    const user = await ensureUser(person);
    createdUsers.push({ person, user });
  }

  const owner = createdUsers.find((entry) => entry.person.memberRole === "owner");
  const organization = await ensureOrganization(owner.user.id);
  const modules = await loadModules();
  const modulesByRole = new Map();
  for (const learningModule of modules) {
    const list = modulesByRole.get(learningModule.role_id) ?? [];
    list.push(learningModule);
    modulesByRole.set(learningModule.role_id, list);
  }

  if (!isDestructiveMode) {
    console.log(`[dry-run] Would seed ${createdUsers.length} users into ${SAMPLE_ORG.name}.`);
    if (apply && !allowDestructiveSeed) {
      console.log("[guard] Để ghi thực tế, chạy seed:sample-data:apply hoặc thêm ALLOW_DESTRUCTIVE_SEED=1.");
    }
    return;
  }

  await resetRowsForUsers(createdUsers.map((entry) => entry.user.id));

  for (const { person, user } of createdUsers) {
    await seedProfile(person, user.id);
    await seedMembership(person, user.id, organization.id, owner.user.id);
    await seedLearningRows(person, user.id, organization.id, modulesByRole);
  }

  console.log(`Seeded ${createdUsers.length} sample users for ${SAMPLE_ORG.name}.`);
  console.log("Sample emails:", createdUsers.map((entry) => entry.person.email).join(", "));
  console.log("Passwords are not printed. Set SAMPLE_USER_PASSWORD before running if login access is needed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
