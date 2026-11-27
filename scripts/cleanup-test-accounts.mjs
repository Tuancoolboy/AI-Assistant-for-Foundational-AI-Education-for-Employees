#!/usr/bin/env node
/**
 * Dọn dẹp tài khoản và dữ liệu test (@test.local) sau khi chạy integration tests.
 * Usage: node --env-file=.env.local scripts/cleanup-test-accounts.mjs
 */

import { cleanupTestArtifacts } from "./test-cleanup-helpers.mjs";

async function main() {
  console.log("Đang tìm và xoá dữ liệu test @test.local...");
  await cleanupTestArtifacts();
}

main().catch((err) => {
  console.error("Lỗi:", err.message);
  process.exit(1);
});
