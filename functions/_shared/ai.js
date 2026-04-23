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

// 从AI回复中提取JSON（健壮版）
export function extractJSON(text) {
  // 1. 去掉 markdown 代码块包裹
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  // 2. 找到最外层 { ... }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}") + 1;
  if (start < 0 || end <= start) return null;

  let raw = cleaned.substring(start, end);

  // 3. 清理控制字符（保留 \n \t 在字符串值里会被JSON.parse拒绝，所以也清掉）
  raw = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

  // 4. 修复常见问题：字符串值内的裸换行符
  //    匹配 "...内容\n内容..." 中的换行并替换为空格
  raw = raw.replace(/"([^"]*?)"/g, (match, inner) => {
    return '"' + inner.replace(/[\r\n]+/g, " ") + '"';
  });

  // 5. 去掉尾部逗号（] , 或 } , 前面的逗号）
  raw = raw.replace(/,\s*([\]}])/g, "$1");

  try {
    return JSON.parse(raw);
  } catch (e) {
    // 最后尝试：更激进地清理
    // 替换所有非ASCII控制字符
    raw = raw.replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
    raw = raw.replace(/,\s*([\]}])/g, "$1");
    try {
      return JSON.parse(raw);
    } catch (e2) {
      console.error("JSON parse failed:", e2.message, "raw length:", raw.length);
      return null;
    }
  }
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
