// functions/api/analyze_feedback.js
// POST /api/analyze_feedback → DeepSeek 分析薄弱点
import { getFeedbackPrompt } from "../_shared/prompts.js";
import { callAI, deepseek, extractJSON } from "../_shared/ai.js";

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const results = data.results || [];
    const grade = data.grade || "1";
    const topic = data.topic || "";

    const systemPrompt = getFeedbackPrompt();
    const userPrompt = `小学${grade}年级，知识点：${topic}\n学生答题结果：${JSON.stringify(results)}\n请分析薄弱点。`;

    const aiResp = await callAI(deepseek(context.env), systemPrompt, userPrompt, {
      temperature: 0.5,
      maxTokens: 2000
    });

    const text = aiResp.choices[0].message.content;
    let result = extractJSON(text);
    if (!result) {
      result = { score: 0, total: 100, error_summary: "分析失败", weak_points: [], suggestions: [] };
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
