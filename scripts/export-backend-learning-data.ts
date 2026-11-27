import fs from "node:fs";
import path from "node:path";

import roles from "../src/frontend/lib/roles.ts";

type RoleModule = {
  id: string;
  title: string;
  durationMin: number;
  level: 1 | 2 | 3;
  content: string;
  learnings: string[];
  skills?: string[];
  isFoundation?: boolean;
};

type RoleRecord = {
  modules: RoleModule[];
  quiz: unknown[];
};

const { ROLES } = roles as typeof roles & { ROLES: Record<string, RoleRecord> };

const root = process.cwd();
const outDir = path.join(root, "src/backend/data");
const outPath = path.join(outDir, "learning-data.json");

const payload = {
  generatedAt: new Date().toISOString(),
  modules: Object.entries(ROLES).flatMap(([roleId, role]) =>
    role.modules.map((mod, index) => ({
      id: mod.id,
      role_id: roleId,
      title: mod.title,
      duration_min: mod.durationMin,
      level: mod.level,
      sort_order: index + 1,
      summary: mod.content,
      content: mod.content,
      learnings: mod.learnings,
      skills: mod.skills ?? [],
      isFoundation: Boolean(mod.isFoundation),
    })),
  ),
  quizzes: Object.fromEntries(
    Object.entries(ROLES).map(([roleId, role]) => [roleId, role.quiz]),
  ),
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Exported learning data to ${path.relative(root, outPath)}`);
