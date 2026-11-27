/**
 * Map module_id → video ID cho bước thực hành.
 * File video đặt ở public/videos/<videoId>.html, iframe src = `/videos/${id}.html`.
 * Khi module KHÔNG có entry ở đây → không hiển thị khối video.
 */
export const MODULE_PRACTICE_VIDEOS: Record<string, string> = {
  "nhan-su-m0": "bai-0-setup-memory-video",
  "nhan-su-m2": "m2-tour-pro-video",
  "nhan-su-m5": "m5-project-tro-ly-hr-video",
  "nhan-su-m6": "m6-artifacts-video",
  "nhan-su-m9": "m9-sang-loc-cv-video",
  "nhan-su-m14": "m14-claude-excel-video",
  "nhan-su-m22": "m9-sang-loc-cv-video",
  "nhan-su-m26": "m14-claude-excel-video",
  "nhan-su-m32": "m14-claude-excel-video",
  "nhan-su-m44": "m5-project-tro-ly-hr-video",
  "nhan-su-m48": "m6-artifacts-video",
  "nhan-su-m49": "m14-claude-excel-video",
  "nhan-su-m54": "connectors-mcp-video",
  "nhan-su-m60": "connectors-mcp-video",
  "nhan-su-m61": "m61-plugins-video",
  "nhan-su-m66": "connectors-mcp-video",
  "nhan-su-m67": "connectors-mcp-video",
  "nhan-su-m68": "connectors-mcp-video",
  "nhan-su-m70": "m61-plugins-video",
  "nhan-su-m77": "notebooklm-video",
  "nhan-su-m78": "notebooklm-video",
  "nhan-su-m79": "notebooklm-video",
  "nhan-su-m86": "connectors-mcp-video",
};

export function getPracticeVideoId(moduleId: string): string | null {
  return MODULE_PRACTICE_VIDEOS[moduleId] ?? null;
}
