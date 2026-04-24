// functions/api/analyze_image.js
// POST /api/analyze_image → 智谱GLM-4.6V 读图判卷
import { callAI, zhipu, extractJSON } from "../_shared/ai.js";

export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const file = formData.get("image");
    if (!file) {
      return new Response(JSON.stringify({ success: false, error: "没有上传图片" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 转 base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const imgBase64 = btoa(binary);

    const provider = zhipu(context.env);
    const systemPrompt = '你是一位数学老师，看图片中的批改痕迹，判断每道题对错。输出JSON格式：{"results": [{"question_id": 1, "correct": true/false, "error_type": "错误类型简述"}]}';

    const messages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "请分析这张批改后的数学试卷图片，判断每道题的对错：" },
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imgBase64}` } }
        ]
      }
    ];

    const aiResp = await callAI(provider, "", "", {
      temperature: 0.3,
      maxTokens: 2000,
      messages
    });

    const result = extractJSON(aiResp.choices[0].message.content);
    if (!result) {
      throw new Error("AI返回格式错误");
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
