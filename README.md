# 别急 DDL 正式版

这是支持账号、云端同步和服务端 AI 的生产版本工程。

## 已包含

- Supabase 邮箱登录与注册
- 本地会话保存与自动刷新
- 用户任务和主题云端同步
- 每 5 秒自动拉取云端更新
- 用户数据隔离 RLS
- 关键词、桌宠、模式等用户设置同步
- 服务端 AI Edge Function
- AI 每日 30 次限额
- 服务端模型密钥
- 正式版全部 1.4 功能
- 云服务未配置时自动退回本地演示模式

## 文件

- `index.html`：网页
- `style.css`：样式
- `app.js`：业务逻辑
- `cloud.js`：Supabase 认证与云同步
- `cloud-config.js`：Supabase 项目配置
- `supabase/migrations/001_initial.sql`：数据库表、权限和同步函数
- `supabase/functions/parse-notice/index.ts`：AI 服务端接口
- `PRODUCTION_DEPLOY.md`：正式部署步骤

## 当前状态

Cloud 配置为空时，页面保持本地演示模式，不需要 Supabase。
完成 `PRODUCTION_DEPLOY.md` 中的配置后，页面会出现登录/注册界面并启用云端同步。

## 在线地址

- 网站：https://freshman-all.github.io/bieji-ddl/
- 仓库：https://github.com/freshman-all/bieji-ddl

## 云端账号说明

当前 `cloud-config.js` 仍使用本地演示配置。接入 Supabase 项目后，把 Project URL 和 anon public key 填入 `cloud-config.js`，并将 `enableCloud` 改为 `true`，即可启用登录和跨设备同步。
