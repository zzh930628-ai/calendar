# 任务安排工作台

当前仓库包含两个应用：

- `apps/web`：Next.js 前端
- `apps/api`：NestJS 后端

## 新推荐部署方案

当前更推荐的 MVP 方案为：

- `GitHub`：代码托管
- `Vercel`：前端与 Next.js 服务端部署
- `Supabase`：数据库与认证

详细说明见：`supabase-vercel-实施方案.md`
上线清单见：`上线步骤.md`

前端 Supabase 环境变量模板：`apps/web/.env.local.example`
Vercel 环境变量模板：`vercel-env.example.txt`

Supabase 建表 SQL：`supabase/schema.sql`

## Supabase Auth

当前前端已补登录页、会话中间件、认证回调和退出登录。

关键路径：

- `apps/web/app/login/page.tsx`
- `apps/web/app/login/actions.ts`
- `apps/web/app/auth/callback/route.ts`
- `apps/web/middleware.ts`

使用前请确认：

1. 在 Supabase Auth 中启用 `Email` 登录
2. 如果要使用 Google 登录，在 Supabase Auth Provider 中启用 `Google`
3. 在 Supabase 后台配置站点地址，例如：`http://localhost:3000`
4. 将回调地址加入 Redirect URLs，例如：`http://localhost:3000/auth/callback`

前端本地环境变量：

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

至少填写：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

如果首页要在服务端直接读取真实数据，可额外填写：

- `SUPABASE_SERVICE_ROLE_KEY`

## 数据库

后端已加入 Prisma schema，位置在 `apps/api/prisma/schema.prisma`。

使用前请先复制环境变量文件：

```bash
cp apps/api/.env.example apps/api/.env
```

然后执行：

```bash
npm run prisma:generate --workspace api
```

如果本地已经准备好 PostgreSQL，可继续执行：

```bash
npm run prisma:migrate --workspace api
```

## Google Calendar 接入骨架

后端已补 Google Calendar 骨架模块，目录在 `apps/api/src/google-calendar`。

请先补充以下环境变量：

```bash
cp apps/api/.env.example apps/api/.env
```

当前可用接口：

- `GET /integrations/google/connect?userId=demo-user-1`
- `GET /integrations/google/callback`
- `GET /integrations/google/status/:userId`
- `GET /integrations/google/calendars/:userId`
- `POST /integrations/google/disconnect/:userId`
- `POST /integrations/google/webhook`

推荐联调顺序：

1. 先配好 Google OAuth 应用和回调地址
2. 调 `connect` 获取授权链接
3. 完成 Google 授权回调
4. 查看 `status` 和 `calendars` 是否已写入
5. 后续再补 `watch + webhook + syncToken` 增量同步

## 本地开发

先安装依赖：

```bash
npm install
```

启动前端：

```bash
npm run dev:web
```

启动后端：

```bash
npm run dev:api
```

## 当前进度

- 已完成工作台首页第一版代码骨架
- 已完成 NestJS API 服务基础入口
- 已补 Prisma schema 和用户、任务、日程模块骨架
- 下一步建议接 Prisma Service 到真实查询，再补登录和日历集成
