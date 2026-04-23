// functions/api/subjects.js
// GET /api/subjects → 返回科目列表
import { SUBJECTS } from "../_shared/subjects.js";

export async function onRequestGet() {
  return new Response(JSON.stringify(Object.keys(SUBJECTS)), {
    headers: { "Content-Type": "application/json" }
  });
}
