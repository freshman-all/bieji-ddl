import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function cleanJson(text: string) {
  return text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = request.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "请先登录" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const aiKey = Deno.env.get("AI_API_KEY") || "";
  const aiBaseUrl = (Deno.env.get("AI_BASE_URL") || "").replace(/\/$/, "");
  const aiModel = Deno.env.get("AI_MODEL") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase secrets are not configured" }, 500);
  if (!aiKey || !aiBaseUrl || !aiModel) return json({ error: "AI secrets are not configured" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "登录状态无效" }, 401);
  const user = authData.user;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("ai_usage_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", since);
  if ((count || 0) >= 30) return json({ error: "今日 AI 使用次数已达上限" }, 429);

  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  const imageData = String(body.imageData || "");
  if (!text && !imageData) return json({ error: "请输入通知或上传图片" }, 400);
  if (text.length > 6000) return json({ error: "通知内容过长，请控制在 6000 字以内" }, 400);
  if (imageData.length > 6_000_000) return json({ error: "图片过大，请压缩后重试" }, 400);

  const { data: profile } = await admin
    .from("profiles")
    .select("keyword_rules, ai_settings")
    .eq("id", user.id)
    .maybeSingle();

  const keywordRules = Array.isArray(body.keywordRules) && body.keywordRules.length
    ? body.keywordRules
    : profile?.keyword_rules || [];
  const aiSettings = profile?.ai_settings || {};
  const rulesText = keywordRules.map((rule: any) => `${rule.label}: ${rule.keywords}`).join("\n");
  const urgent = body.urgentKeywords || aiSettings.urgentKeywords || "紧急, 今天, 今晚, 马上, 立刻, 截止";
  const ignored = body.ignoredKeywords || aiSettings.ignoredKeywords || "广告, 自愿, 可选";

  const prompt = `你是校园任务整理助手。只输出合法 JSON，不要输出 Markdown 或解释。
当前时间：${new Date().toISOString()}
用户任务类型关键词：
${rulesText}
紧急词：${urgent}
忽略词：${ignored}

输出格式：
{"tasks":[{"title":"任务名","category":"任务类型","source":"信息来源","due":"YYYY-MM-DDTHH:mm 或空字符串","urgency":"auto|red|yellow|green","location":"地点或空字符串","firstStep":"下一步行动","requirements":"原始要求摘要"}]}
规则：最多 6 项；不要编造日期；忽略广告和自愿内容。

用户输入：
${text || "请识别图片中的校园通知。"}`;

  const content = imageData
    ? [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageData } }]
    : prompt;

  let usage: any = {};
  try {
    const aiResponse = await fetch(`${aiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: aiModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: "You return only valid JSON." },
          { role: "user", content }
        ]
      })
    });
    if (!aiResponse.ok) throw new Error(`AI provider returned ${aiResponse.status}`);
    const data = await aiResponse.json();
    usage = data.usage || {};
    const rawContent = data.choices?.[0]?.message?.content || "";
    const rawText = Array.isArray(rawContent)
      ? rawContent.map((part: any) => part.text || "").join("")
      : String(rawContent);
    const parsed = JSON.parse(cleanJson(rawText));
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.slice(0, 6) : [];
    if (!tasks.length) throw new Error("AI returned no tasks");

    await admin.from("ai_usage_logs").insert({
      user_id: user.id,
      model: aiModel,
      input_tokens: Number(usage.prompt_tokens || 0),
      output_tokens: Number(usage.completion_tokens || 0),
      status: "ok"
    });

    return json({ tasks });
  } catch (error) {
    await admin.from("ai_usage_logs").insert({
      user_id: user.id,
      model: aiModel,
      status: "error",
      error_message: String(error?.message || error).slice(0, 500)
    });
    return json({ error: "AI 整理失败，请使用本地关键词模式或稍后重试" }, 502);
  }
});
