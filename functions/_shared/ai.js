// functions/_shared/ai.js
// 调用智谱AI API 的通用封装

export async function callZhipuAI(env, systemPrompt, userPrompt, options = {}) {
  const {
    model = env.MODEL_NAME || "glm-4-flash",
    temperature = 0.7,
    maxTokens = 4000,
    messages: extraMessages = null
  } = options;

  const messages = extraMessages || [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  const resp = await fetch(env.API_BASE_URL + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${env.ZHIPU_API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${errText}`);
  }

  return await resp.json();
}

// 从AI回复中提取JSON
export function extractJSON(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}") + 1;
  if (start >= 0 && end > start) {
    let raw = text.substring(start, end);
    // 清理控制字符
    raw = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
    return JSON.parse(raw);
  }
  return null;
}

// 清理AI瞎编的URL
export function cleanURLs(obj) {
  if (!obj || !obj.questions) return obj;
  for (const q of obj.questions) {
    for (const field of ["question", "visual", "hint"]) {
      if (q[field]) {
        q[field] = q[field].replace(/https?:\/\/\S+/g, "[图片]");
      }
    }
  }
  return obj;
}
