(function () {
  "use strict";

  const cfg = window.BIEJI_CLOUD_CONFIG || {};
  const SESSION_KEY = "bieji-ddl-supabase-session-v1";
  const enabled = Boolean(cfg.enableCloud && cfg.supabaseUrl && cfg.supabaseAnonKey);
  const baseUrl = String(cfg.supabaseUrl || "").replace(/\/$/, "");
  const authListeners = [];
  const snapshotListeners = [];
  let session = readSession();
  let pollTimer = null;
  let lastSnapshotSignature = "";
  let authUiBound = false;
  let offlineMode = !navigator.onLine;

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch (error) { return null; }
  }

  function saveSession(data) {
    session = data ? { ...data } : null;
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }

  function sessionExpiresAt(data) {
    return data?.expires_at ? Number(data.expires_at) * 1000 : 0;
  }

  function usernameToEmail(value) {
    const input = String(value || "").trim();
    if (input.includes("@")) return input.toLowerCase();
    return `${input.toLowerCase()}@users.bieji-ddl.app`;
  }

  function validateUsername(value) {
    const username = String(value || "").trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) throw new Error("用户名需要 3-24 位，只能包含字母、数字和下划线");
    return username;
  }

  function validatePassword(password) {
    const value = String(password || "");
    if (value.length < 12) throw new Error("密码至少需要 12 位");
    if (!/[a-z]/.test(value)) throw new Error("密码需要包含小写字母");
    if (!/[A-Z]/.test(value)) throw new Error("密码需要包含大写字母");
    if (!/[0-9]/.test(value)) throw new Error("密码需要包含数字");
    if (!/[^A-Za-z0-9]/.test(value)) throw new Error("密码需要包含符号");
    return value;
  }

  async function removeBackground(imageData) {
    if (!(await ensureSession())) throw new Error("请先登录后再使用 AI 抠图");
    const response = await fetch(`${baseUrl}/functions/v1/remove-background`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": cfg.supabaseAnonKey, "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify({ imageData })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `AI 抠图返回 ${response.status}`);
    return data;
  }

  function isNetworkError(error) {
    return /fetch failed|Failed to fetch|NetworkError|网络连接失败|Load failed|ERR_NETWORK/i.test(String(error?.message || error));
  }

  function displayName(user) {
    return user?.user_metadata?.username || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "已登录用户";
  }

  function friendlyError(error) {
    const message = String(error?.message || error || "请求失败");
    if (/Invalid login credentials/i.test(message)) return "邮箱或密码不正确";
    if (/Email not confirmed/i.test(message)) return "请先到邮箱完成验证";
    if (/User already registered/i.test(message)) return "这个邮箱已经注册，请直接登录";
    if (/Password should be/i.test(message)) return "密码长度至少需要 6 位";
    if (/fetch failed|Failed to fetch|NetworkError/i.test(message)) return "网络连接失败，请稍后重试";
    return message;
  }

  async function authRequest(path, body) {
    const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": cfg.supabaseAnonKey, "Authorization": `Bearer ${cfg.supabaseAnonKey}` },
      body: JSON.stringify(body)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.msg || data.message || data.error_description || `HTTP ${response.status}`);
    return data;
  }

  async function refreshSession() {
    if (!session?.refresh_token) return false;
    try {
      const data = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
      data.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600);
      saveSession(data);
      return true;
    } catch (error) {
      if (!isNetworkError(error)) saveSession(null);
      return false;
    }
  }

  async function ensureSession() {
    if (!session) return false;
    if (session.expires_at && sessionExpiresAt(session) < Date.now() + 60000) return refreshSession();
    return true;
  }

  async function restRequest(path, options = {}) {
    if (!(await ensureSession())) throw new Error("登录状态已失效，请重新登录");
    const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "apikey": cfg.supabaseAnonKey,
        "Authorization": `Bearer ${session.access_token}`,
        ...(options.headers || {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    if (response.status === 401) { saveSession(null); throw new Error("登录状态已失效，请重新登录"); }
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || error.hint || `HTTP ${response.status}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  async function rpc(name, params = {}) {
    return restRequest(`rpc/${name}`, { method: "POST", body: params });
  }

  async function loadSnapshot() {
    const snapshot = await rpc("load_user_snapshot");
    lastSnapshotSignature = JSON.stringify(snapshot || {});
    return snapshot || { themes: [], tasks: [], profile: {} };
  }

  async function saveSnapshot(payload) {
    await rpc("save_user_snapshot", { payload });
    lastSnapshotSignature = JSON.stringify(payload || {});
  }

  async function parseNotice(payload) {
    if (!(await ensureSession())) throw new Error("请先登录后再使用云端 AI");
    const response = await fetch(`${baseUrl}/functions/v1/parse-notice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": cfg.supabaseAnonKey, "Authorization": `Bearer ${session.access_token}` },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `AI 接口返回 ${response.status}`);
    return data;
  }

  function emitAuth(user) {
    authListeners.forEach((callback) => callback({ authenticated: Boolean(user), user, email: user?.email || session?.user?.email || "" }));
  }

  function emitSnapshot(snapshot) {
    snapshotListeners.forEach((callback) => callback(snapshot));
  }
  function showAuth(show) {
    const screen = document.getElementById("authScreen");
    if (screen) screen.hidden = !show;
  }

  function showAccount(user) {
    const area = document.getElementById("accountArea");
    const email = document.getElementById("accountEmail");
    if (!area) return;
    area.hidden = !user;
    if (email) email.textContent = displayName(user);
  }

  function setAuthError(message, success = false) {
    const box = document.getElementById("authError");
    if (!box) return;
    box.hidden = !message;
    box.textContent = message || "";
    box.style.background = success ? "var(--green-soft)" : "";
    box.style.color = success ? "var(--green)" : "";
  }

  function setAuthBusy(busy) {
    ["loginButton", "registerButton"].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.disabled = busy;
    });
  }

  async function signIn(email, password) {
    const loginEmail = usernameToEmail(email);
    const data = await authRequest("token?grant_type=password", { email: loginEmail, password });
    data.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600);
    saveSession(data);
    showAuth(false);
    showAccount(data.user);
    const snapshot = await loadSnapshot();
    emitAuth(data.user);
    emitSnapshot(snapshot);
    startPolling();
    return snapshot;
  }

  async function signUp(username, password) {
    const cleanUsername = validateUsername(username);
    validatePassword(password);
    const data = await authRequest("signup", { email: usernameToEmail(cleanUsername), password, data: { username: cleanUsername, display_name: cleanUsername } });
    if (data.access_token) {
      data.expires_at = Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600);
      saveSession(data);
      showAuth(false);
      showAccount(data.user);
      const snapshot = await loadSnapshot();
      emitAuth(data.user);
      emitSnapshot(snapshot);
      startPolling();
      return { needsConfirmation: false, snapshot };
    }
    return { needsConfirmation: true, user: data.user || null };
  }

  async function signOut() {
    try {
      if (session?.access_token) {
        await fetch(`${baseUrl}/auth/v1/logout`, {
          method: "POST",
          headers: { "apikey": cfg.supabaseAnonKey, "Authorization": `Bearer ${session.access_token}` }
        });
      }
    } catch (error) {
      // Keep local logout working when offline.
    }
    saveSession(null);
    stopPolling();
    showAccount(null);
    showAuth(true);
    emitAuth(null);
  }

  async function refreshNow() {
    if (!enabled || !(await ensureSession())) return null;
    const snapshot = await loadSnapshot();
    emitSnapshot(snapshot);
    return snapshot;
  }

  function startPolling() {
    stopPolling();
    const interval = Math.max(3000, Number(cfg.pollIntervalMs) || 5000);
    pollTimer = window.setInterval(async () => {
      if (document.hidden || !session || offlineMode) return;
      try { await refreshNow(); } catch (error) { /* The next poll can recover. */ }
    }, interval);
  }

  function stopPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = null;
  }

  function bindAuthUi() {
    if (authUiBound) return;
    authUiBound = true;
    const form = document.getElementById("authForm");
    const emailInput = document.getElementById("authEmail");
    const passwordInput = document.getElementById("authPassword");
    const registerButton = document.getElementById("registerButton");
    const demoButton = document.getElementById("authDemoButton");
    const signOutButton = document.getElementById("accountSignOutButton");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        setAuthError("");
        setAuthBusy(true);
        try { await signIn(emailInput.value.trim(), passwordInput.value); }
        catch (error) { setAuthError(friendlyError(error)); }
        finally { setAuthBusy(false); }
      });
    }
    if (registerButton) {
      registerButton.addEventListener("click", async () => {
        if (!emailInput.value.trim() || !passwordInput.value) { setAuthError("请先填写邮箱和密码"); return; }
        setAuthError("");
        setAuthBusy(true);
        try {
          const result = await signUp(emailInput.value.trim(), passwordInput.value);
          if (result.needsConfirmation) setAuthError("注册成功，请到邮箱完成验证后再登录", true);
          else setAuthError("注册成功，正在进入你的时间中枢", true);
        } catch (error) { setAuthError(friendlyError(error)); }
        finally { setAuthBusy(false); }
      });
    }
    if (demoButton) demoButton.addEventListener("click", () => showAuth(false));
    if (signOutButton) signOutButton.addEventListener("click", signOut);
    window.addEventListener("focus", () => { if (session && !offlineMode) refreshNow().catch(() => {}); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && session && !offlineMode) refreshNow().catch(() => {}); });
    window.addEventListener("online", () => { offlineMode = false; if (session) refreshNow().catch(() => {}); });
    window.addEventListener("offline", () => { offlineMode = true; });
  }

  async function init() {
    bindAuthUi();
    if (!enabled) {
      showAuth(false);
      showAccount(null);
      return { enabled: false, authenticated: false, snapshot: null };
    }
    if (!(await ensureSession())) {
      if (session?.user) {
        offlineMode = true;
        showAuth(false);
        showAccount(session.user);
        emitAuth(session.user);
        return { enabled: true, authenticated: true, offline: true, user: session.user, snapshot: null };
      }
      showAuth(true);
      showAccount(null);
      return { enabled: true, authenticated: false, snapshot: null };
    }
    const user = session.user || null;
    showAuth(false);
    showAccount(user);
    try {
      const snapshot = await loadSnapshot();
      emitAuth(user);
      emitSnapshot(snapshot);
      startPolling();
      return { enabled: true, authenticated: true, user, snapshot };
    } catch (error) {
      if (isNetworkError(error) && session?.user) {
        offlineMode = true;
        showAuth(false);
        showAccount(session.user);
        emitAuth(session.user);
        return { enabled: true, authenticated: true, offline: true, user: session.user, snapshot: null };
      }
      saveSession(null);
      showAuth(true);
      showAccount(null);
      return { enabled: true, authenticated: false, error: friendlyError(error), snapshot: null };
    }
  }

  window.BiejiCloud = {
    enabled,
    aiEnabled: Boolean(enabled && cfg.aiEnabled),
    init,
    signIn,
    signUp,
    signOut,
    refreshNow,
    loadSnapshot,
    saveSnapshot,
    parseNotice,
    removeBackground,
    isReady: () => Boolean(enabled && session),
    isOffline: () => offlineMode,
    getUserEmail: () => session?.user?.email || "",
    getUsername: () => displayName(session?.user),
    onAuth: (callback) => authListeners.push(callback),
    onSnapshot: (callback) => snapshotListeners.push(callback)
  };
})();
