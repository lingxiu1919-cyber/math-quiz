// functions/api/generate.js
// POST /api/generate → AI出题
import { getSystemPrompt } from "../_shared/prompts.js";
import { callZhipuAI, extractJSON, cleanURLs } from "../_shared/ai.js";

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    const subject = data.subject || "数学";
    const grade = data.grade || "1下";
    const topic = data.topic || "";
    const mode = data.mode || "new";
    const feedback = data.feedback || "";

    let userPrompt;
    if (mode === "similar") {
      userPrompt = `小学${grade}，${subject}，知识点：${topic}\n请出一套同类型巩固练习题，和上一套题型类似但内容不同。`;
    } else if (mode === "upgrade") {
      userPrompt = `小学${grade}，${subject}，知识点：${topic}\n学生上次全部做对了，需要提升挑战。适当增加难度和混淆题。学生反馈：${feedback}`;
    } else {
      userPrompt = `小学${grade}，${subject}，知识点：${topic}\n请出一套练习题。`;
    }

    const systemPrompt = getSystemPrompt(subject);
    const aiResp = await callZhipuAI(context.env, systemPrompt, userPrompt);
    const text = aiResp.choices[0].message.content;

    let result = extractJSON(text);
    if (result) {
      result = cleanURLs(result);
    } else {
      result = { questions: [], title: "解析失败" };
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
