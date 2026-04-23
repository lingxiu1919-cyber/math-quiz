// functions/api/grades/[subject].js
// GET /api/grades/:subject → 返回该科目的年级列表
import { SUBJECTS } from "../../_shared/subjects.js";

export async function onRequestGet(context) {
  const subject = decodeURIComponent(context.params.subject);
  const grades = SUBJECTS[subject] ? Object.keys(SUBJECTS[subject]) : [];
  return new Response(JSON.stringify(grades), {
    headers: { "Content-Type": "application/json" }
  });
}
