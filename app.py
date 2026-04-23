from flask import Flask, render_template, request, jsonify, session
import json, os, uuid, base64
from openai import OpenAI

app = Flask(__name__)
app.secret_key = os.urandom(24)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def get_client():
    cfg = load_config()
    return OpenAI(api_key=cfg.get("api_key", ""), base_url=cfg.get("base_url", ""))

def _math_prompt():
    return """你是一位严谨的小学数学出题专家。输出纯JSON，不要任何多余文字。

JSON格式：
{"title":"练习标题","questions":[
  {"id":1,"section":"一","section_title":"口算","type":"oral","question":"9 + 5 =","visual":"","hint":"","answer":"14","steps":[]},
  {"id":7,"section":"二","section_title":"看图列式","type":"pic","question":"小明有5个苹果，吃了2个，还剩几个？","visual":"🍎🍎🍎|🍎🍎","hint":"","answer":"3","steps":[]},
  {"id":10,"section":"三","section_title":"两步应用题","type":"word_problem","question":"...","visual":"","hint":"💡想一想：先算...，再算...","answer":"...","steps":["第一步...","第二步..."]}
]}

出题数量：综合测试=23题(口算12+看图4+应用题4+规则2+挑战1)；单一知识点=17题(口算10+看图3+应用题3+规则1)
规则：
1. oral：只写算式
2. pic：question不放emoji，visual用|分隔展示图示
3. word_problem：hint写拆解引导，steps写每步算式
4. 符合现实常识，数字匹配年级范围，场景多样"""

def _chinese_prompt():
    return """你是一位严谨的小学语文出题专家。输出纯JSON，不要任何多余文字。

JSON格式：
{"title":"练习标题","questions":[
  {"id":1,"section":"一","section_title":"看拼音写汉字","type":"fill","question":"xiǎo niǎo（  ）","visual":"","hint":"","answer":"小鸟","steps":[]},
  {"id":5,"section":"二","section_title":"组词","type":"choice","question":"用花字组两个词","visual":"","hint":"","answer":"花朵/花园","steps":[]},
  {"id":8,"section":"三","section_title":"阅读理解","type":"reading","question":"根据短文回答问题...","visual":"","hint":"💡先找到文中相关的句子","answer":"...","steps":[]}
]}

出题数量：综合测试=20题；单一知识点=15题
题型说明：
1. fill（填空）：拼音写汉字、选字填空、补充词语等
2. choice（选择）：组词、造句、选正确答案等
3. reading（阅读理解）：短文+问题（综合测试才出）
4. writing（写作）：看图写话、仿写句子等
规则：内容匹配对应年级课本难度，汉字不超纲
绝对禁止：不要生成任何URL链接或图片地址，用emoji和文字描述代替"""

def _english_prompt():
    return """你是一位严谨的小学英语出题专家。输出纯JSON，不要任何多余文字。

JSON格式：
{"title":"练习标题","questions":[
  {"id":1,"section":"一","section_title":"单词","type":"fill","question":"apple 中文意思是（  ）","visual":"🍎","hint":"","answer":"苹果","steps":[]},
  {"id":5,"section":"二","section_title":"句型","type":"choice","question":"选出正确的句子","visual":"","hint":"","answer":"B","steps":[]},
  {"id":8,"section":"三","section_title":"阅读","type":"reading","question":"Read and answer...","visual":"","hint":"","answer":"...","steps":[]}
]}

出题数量：综合测试=20题；单一知识点=15题
题型说明：
1. fill（填空）：单词拼写、中英互译、填空补全等
2. choice（选择）：选正确单词、选正确句子等
3. reading（阅读理解）：短对话/短文+问题
规则：难度匹配年级，3-4年级以单词和简单句为主，5-6年级可加入语法
绝对禁止：不要生成任何URL链接或图片地址"""

SUBJECTS = {
    "数学": {
        "1上": ["数一数", "比多少", "10以内加减法", "认识图形(一)", "综合测试"],
        "1下": ["20以内加减法", "凑十法", "两步应用题", "看图列式", "比多少", "认识人民币", "综合测试"],
        "2上": ["100以内加减法", "乘法口诀", "长度单位", "角的认识", "综合测试"],
        "2下": ["表内除法", "万以内数认识", "克和千克", "两步应用题", "综合测试"],
        "3上": ["万以内加减法", "多位数乘一位数", "倍的认识", "长方形正方形周长", "综合测试"],
        "3下": ["除数是一位数除法", "两位数乘两位数", "面积", "分数初步", "综合测试"],
        "4上": ["大数认识", "三位数乘两位数", "平行四边形和梯形", "条形统计图", "综合测试"],
        "4下": ["四则运算", "运算定律", "小数意义和性质", "三角形", "综合测试"],
        "5上": ["小数乘法", "小数除法", "简易方程", "多边形面积", "综合测试"],
        "5下": ["分数加减法", "因数与倍数", "长方体正方体", "折线统计图", "综合测试"],
        "6上": ["分数乘法", "分数除法", "比", "圆", "百分数", "综合测试"],
        "6下": ["负数", "比例", "圆柱圆锥", "统计与概率", "综合测试"],
    },
    "语文": {
        "1上": ["拼音声母韵母", "看拼音写汉字", "笔画笔顺", "组词造句", "看图说话", "综合测试"],
        "1下": ["拼音巩固", "形近字辨析", "量词搭配", "反义词近义词", "句子仿写", "综合测试"],
        "2上": ["生字组词", "词语搭配", "句子练习", "查字典", "看图写话", "综合测试"],
        "2下": ["多音字", "近义词反义词", "句式转换", "阅读理解简单", "看图写话", "综合测试"],
        "3上": ["生字词", "成语积累", "句式变换", "阅读理解", "作文起步", "综合测试"],
        "3下": ["多音字辨析", "词语归类", "修改病句", "阅读理解", "作文练习", "综合测试"],
        "4上": ["字词基础", "成语运用", "修辞手法", "阅读理解", "作文训练", "综合测试"],
        "4下": ["字词辨析", "关联词运用", "句式变换", "阅读理解", "作文训练", "综合测试"],
        "5上": ["字词积累", "成语典故", "文言文入门", "阅读理解", "作文训练", "综合测试"],
        "5下": ["字词运用", "修辞辨析", "文言文基础", "阅读理解", "作文训练", "综合测试"],
        "6上": ["字词总复习", "古诗词鉴赏", "文言文阅读", "现代文阅读", "作文训练", "综合测试"],
        "6下": ["字词总复习", "古诗文综合", "阅读理解综合", "作文综合", "综合测试"],
    },
    "英语": {
        "3上": ["字母认读", "简单单词", "颜色数字", "日常问候", "综合测试"],
        "3下": ["单词拼写", "简单句型", "动物水果", "自我介绍", "综合测试"],
        "4上": ["单词积累", "句型练习", "日常对话", "短文阅读", "综合测试"],
        "4下": ["单词拼写", "时态初步", "情景对话", "阅读理解", "综合测试"],
        "5上": ["词汇扩展", "一般现在时", "句型转换", "阅读理解", "综合测试"],
        "5下": ["词汇积累", "一般过去时", "语法练习", "阅读理解", "综合测试"],
        "6上": ["词汇总复习", "时态综合", "语法综合", "阅读理解", "写作练习", "综合测试"],
        "6下": ["词汇总复习", "语法总复习", "阅读综合", "写作综合", "综合测试"],
    }
}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/subjects")
def get_subjects():
    return jsonify(list(SUBJECTS.keys()))

@app.route("/api/grades/<subject>")
def get_grades(subject):
    if subject in SUBJECTS:
        return jsonify(list(SUBJECTS[subject].keys()))
    return jsonify([])

@app.route("/api/topics/<subject>/<grade>")
def get_topics(subject, grade):
    if subject in SUBJECTS:
        return jsonify(SUBJECTS[subject].get(grade, []))
    return jsonify([])

@app.route("/api/generate", methods=["POST"])
def generate():
    data = request.json
    subject = data.get("subject", "数学")
    grade = data.get("grade", "1下")
    topic = data.get("topic", "")
    mode = data.get("mode", "new")
    feedback = data.get("feedback", "")

    cfg = load_config()
    model = cfg.get("model_name", "deepseek-chat")

    if subject == "数学":
        system_prompt = _math_prompt()
    elif subject == "语文":
        system_prompt = _chinese_prompt()
    elif subject == "英语":
        system_prompt = _english_prompt()
    else:
        system_prompt = _math_prompt()

    if mode == "similar":
        user_prompt = f"小学{grade}，{subject}，知识点：{topic}\n请出一套同类型巩固练习题，和上一套题型类似但内容不同。"
    elif mode == "upgrade":
        user_prompt = f"小学{grade}，{subject}，知识点：{topic}\n学生上次全部做对了，需要提升挑战。适当增加难度和混淆题。学生反馈：{feedback}"
    else:
        user_prompt = f"小学{grade}，{subject}，知识点：{topic}\n请出一套练习题。"

    try:
        client = get_client()
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        text = resp.choices[0].message.content
        # 尝试提取JSON，清理控制字符
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            raw = text[start:end]
            import re
            raw = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', raw)
            result = json.loads(raw, strict=False)
            # 清理模型瞎编的URL
            for q in result.get("questions", []):
                for field in ["question", "visual", "hint"]:
                    if q.get(field):
                        q[field] = re.sub(r'https?://\S+', '[图片]', q[field])
        else:
            result = {"questions": [], "title": "解析失败"}
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/analyze_image", methods=["POST"])
def analyze_image():
    """上传批改图片，AI识别对错"""
    if "image" not in request.files:
        return jsonify({"success": False, "error": "没有上传图片"})

    file = request.files["image"]
    img_data = base64.b64encode(file.read()).decode()

    cfg = load_config()
    model = cfg.get("vision_model", cfg.get("model_name", "glm-4.6v"))

    try:
        client = get_client()
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "你是一位数学老师，看图片中的批改痕迹，判断每道题对错。输出JSON格式：{\"results\": [{\"question_id\": 1, \"correct\": true/false, \"error_type\": \"错误类型简述\"}]}"},
                {"role": "user", "content": [
                    {"type": "text", "text": "请分析这张批改后的数学试卷图片，判断每道题的对错："},
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_data}"}}
                ]}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        result = json.loads(resp.choices[0].message.content)
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


@app.route("/api/analyze_feedback", methods=["POST"])
def analyze_feedback():
    """手动批改后，AI分析薄弱点"""
    data = request.json
    results = data.get("results", [])  # [{id, correct, error_type}]
    grade = data.get("grade", "1")
    topic = data.get("topic", "")

    cfg = load_config()
    model = cfg.get("model_name", "deepseek-chat")

    system_prompt = """你是小学数学学习分析专家。根据学生的答题情况分析薄弱点并给出学习建议。
输出JSON格式：
{
  "score": 得分,
  "total": 总分,
  "error_summary": "错误类型总结",
  "weak_points": ["薄弱点1", "薄弱点2"],
  "suggestions": ["建议1", "建议2"],
  "feedback_summary": "一句话总结，用于下次出题参考"
}"""

    try:
        client = get_client()
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"小学{grade}年级，知识点：{topic}\n学生答题结果：{json.dumps(results, ensure_ascii=False)}\n请分析薄弱点。"}
            ],
            temperature=0.5,
            max_tokens=2000
        )
        text = resp.choices[0].message.content
        start = text.find('{')
        end = text.rfind('}') + 1
        if start >= 0 and end > start:
            raw = text[start:end]
            import re
            raw = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', raw)
            result = json.loads(raw, strict=False)
        else:
            result = {"score": 0, "total": 100, "error_summary": "分析失败", "weak_points": [], "suggestions": []}
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
