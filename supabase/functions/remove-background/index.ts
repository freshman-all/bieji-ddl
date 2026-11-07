import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "请先登录" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const removeBgKey = Deno.env.get("REMOVE_BG_API_KEY") || "";
  if (!supabaseUrl || !serviceKey) return json({ error: "Supabase secrets are not configured" }, 500);
  if (!removeBgKey) return json({ error: "AI 抠图服务尚未配置" }, 503);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "登录状态无效" }, 401);

  const body = await request.json().catch(() => ({}));
  const imageData = String(body.imageData || "");
  if (!imageData.startsWith("data:image/")) return json({ error: "请上传图片" }, 400);
  if (imageData.length > 6_000_000) return json({ error: "图片过大，请压缩后重试" }, 400);

  const match = imageData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return json({ error: "图片格式不正确" }, 400);
  const mime = match[1];
  const binary = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0));
  const form = new FormData();
  form.append("image_file", new Blob([binary], { type: mime }), "pet-image.png");
  form.append("size", "auto");

  try {
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": removeBgKey },
      body: form
    });
    if (!response.ok) throw new Error(`Remove.bg returned ${response.status}`);
    const result = await response.arrayBuffer();
    let binaryString = "";
    const bytes = new Uint8Array(result);
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binaryString += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
    }
    return json({ imageData: `data:image/png;base64,${btoa(binaryString)}` });
  } catch (error) {
    return json({ error: "AI 抠图失败，请稍后重试或使用本地抠图" }, 502);
  }
});
