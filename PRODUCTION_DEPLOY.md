# 正式部署步骤

## 一、创建 Supabase 项目

1. 打开 https://supabase.com
2. 注册并创建一个新项目
3. 保存数据库密码
4. 等待项目初始化完成

## 二、创建数据库

1. 打开 Supabase Dashboard → SQL Editor
2. 新建查询
3. 粘贴 `supabase/migrations/001_initial.sql`
4. 点击 Run
5. 确认没有报错

## 三、配置登录地址

打开 Authentication → URL Configuration：

- Site URL 填最终网页地址，例如：
  `https://你的用户名.github.io/bieji-ddl/`
- Redirect URLs 加入同一个地址

如果开启邮箱验证，需要先在 Authentication → Providers → Email 中确认相关设置。

## 四、填写网页配置

打开 Supabase Project Settings → API，复制：

- Project URL
- anon public key

编辑 `cloud-config.js`：

```js
window.BIEJI_CLOUD_CONFIG = {
  supabaseUrl: "https://你的项目.supabase.co",
  supabaseAnonKey: "你的 anon key",
  enableCloud: true,
  aiEnabled: true,
  pollIntervalMs: 5000
};
```

不要把 `service_role` key 放进网页。

## 五、部署 AI 云函数

安装 Supabase CLI：

```bash
npm install -g supabase
```

登录并关联项目：

```bash
supabase login
supabase link --project-ref 你的项目ref
```

部署数据库和函数：

```bash
supabase db push
supabase functions deploy parse-notice
```

设置 AI 密钥：

```bash
supabase secrets set AI_API_KEY=你的模型密钥
supabase secrets set AI_BASE_URL=https://你的模型接口/v1
supabase secrets set AI_MODEL=你的模型名
```

`SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 由 Supabase Edge Function 运行环境提供，不要写进网页。

## 六、部署网页

### GitHub Pages

1. 新建 GitHub 仓库
2. 上传正式版根目录全部文件
3. Settings → Pages
4. Deploy from a branch → main → `/ (root)`
5. 保存并等待部署

### Cloudflare Pages

1. 连接 GitHub 仓库
2. Framework 选择 `None`
3. Build command 留空
4. Output directory 填 `/`
5. 部署

以后修改代码后：

```bash
git add .
git commit -m "update"
git push
```

平台会自动发布新版本。

## 七、验证

- 注册新账号
- 收到验证邮件并完成验证
- 登录后任务为空或显示自己的数据
- 新增任务后刷新页面仍在
- 手机和电脑同时登录，任务会在约 5 秒内同步
- 两个账号的数据互不可见
- AI 设置可以使用云端接口
- 未登录无法调用 AI 函数
- 控制台没有 401/403 错误

## 八、重要安全事项

- 网页只使用 anon key
- service_role key 只放服务端环境变量
- AI key 只放 Supabase secrets
- 确认 tasks、themes、profiles 已开启 RLS
- 不要把用户数据导出到公开仓库
- 正式上线前补充隐私政策、用户协议和账号删除入口

## 1.5 补充配置

### 用户名登录

为了让用户名注册可用，在 Supabase Authentication → Providers → Email 中关闭 Confirm email。用户名会映射成内部的登录邮箱，不向该地址发送邮件。

如果需要密码找回，应增加真实邮箱或管理员重置流程。

### AI 抠图

部署抠图云函数：

```bash
supabase functions deploy remove-background
supabase secrets set REMOVE_BG_API_KEY=你的_remove_bg_密钥
```

### 提醒权限

网页只能请求浏览器通知权限，并在页面打开时触发通知；系统级闹钟需要原生 App。页面同时提供 `.ics` 日历提醒作为兜底。
