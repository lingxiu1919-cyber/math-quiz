// functions/_shared/ai.js
// 多模型AI调用封装

// 通用AI调用
export async function callAI(provider, systemPrompt, userPrompt, options = {}) {
  const {
    model,
    temperature = 0.7,
    maxTokens = 4000,
    messages: extraMessages = null
  } = options;

  const messages = extraMessages || [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  const resp = await fetch(provider.baseUrl + "/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${provider.apiKey}`
    },
    body: JSON.stringify({
      model: model || provider.model,
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

// DeepSeek 出题/分析
export function deepseek(env) {
  return {
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    model: env.DEEPSEEK_MODEL || "deepseek-chat"
  };
}

// 智谱 读图
export function zhipu(env) {
  return {
    apiKey: env.ZHIPU_API_KEY,
    baseUrl: env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
    model: env.ZHIPU_VISION_MODEL || "glm-4v-flash"
  };
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

  // 3. 清理控制字符
  raw = raw.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");

  // 4. 修复字符串值内的裸换行符
  raw = raw.replace(/"([^"]*?)"/g, (match, inner) => {
    return '"' + inner.replace(/[\r\n]+/g, " ") + '"';
  });

  // 5. 去掉尾部逗号
  raw = raw.replace(/,\s*([\]}])/g, "$1");

  try {
    return JSON.parse(raw);
  } catch (e) {
    // 更激进清理后重试
    raw = raw.replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
    raw = raw.replace(/,\s*([\]}])/g, "$1");
    try {
      return JSON.parse(raw);
    } catch (e2) {
      console.error("JSON parse failed:", e2.message);
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
