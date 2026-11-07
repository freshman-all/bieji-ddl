window.BIEJI_CLOUD_CONFIG = {
  // 在 Supabase Project Settings → API 中获取
  supabaseUrl: "",
  supabaseAnonKey: "",

  // 填好上面两项后改为 true
  enableCloud: false,

  // 部署 parse-notice Edge Function 后改为 true
  aiEnabled: true,

  // 多设备同步轮询间隔，单位毫秒
  pollIntervalMs: 5000
};
