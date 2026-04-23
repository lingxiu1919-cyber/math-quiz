// functions/api/topics/[subject]/[grade].js
// GET /api/topics/:subject/:grade → 返回该年级的知识点列表
import { SUBJECTS } from "../../../_shared/subjects.js";

export async function onRequestGet(context) {
  const subject = decodeURIComponent(context.params.subject);
  const grade = decodeURIComponent(context.params.grade);
  const topics = (SUBJECTS[subject] && SUBJECTS[subject][grade]) || [];
  return new Response(JSON.stringify(topics), {
    headers: { "Content-Type": "application/json" }
  });
}
