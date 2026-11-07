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

## 1.5 新增

- 原创“专注航线”计时器，支持 15/25/45/60 分钟、暂停、继续、结束、晴空/落日/夜航
- 专注安排可以加入时间线
- 左侧栏箭头可以反复收起和展开
- 用户名 + 高强度密码登录
- 5 套视觉风格：暖纸原色、编辑杂志、新粗野、雾面玻璃、夜空航站
- 提醒设置：通知权限、默认提前时间、每个任务单独提醒
- 原创云龙和团子桌宠：云龙原创舞步、团子原创合成笑声
- AI 抠图 Edge Function（remove.bg）
- 支持本地边缘识色抠图作为免费兜底

说明：没有使用或复制“专注飞行”、奶龙、奶娃的原始素材、角色图片或音效。相关功能用原创视觉、原创动画和原创合成声音实现。
